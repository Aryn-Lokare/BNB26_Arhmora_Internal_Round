"""The agent that Black Box debugs: a LangGraph SQL data-analysis agent on Postgres (Neon).

Graph:  schema -> plan -> select_tool -> run_tool -> reflect -+-> answer
                              ^                               |
                              +------------- loop ------------+

Every node is one numbered "step" (state["step_idx"]), which is what the recorder,
fault injector, and diagnosis model all refer to.
"""
import ast
import datetime
import decimal
import hashlib
import json
import operator
import re
import sqlite3
import time
from typing import Optional, TypedDict

import psycopg
from langgraph.graph import END, StateGraph

import config

# ------------------------------------------------------------------ bookkeeping
STATS = {"llm": 0, "cached": 0, "retries": 0}   # reset per run
TRACE = {}  # step_idx -> {node, input, output, error, latency_ms, llm_calls, cached_calls, retries}

# State keys each node actually reads. Keep TRACE payloads small but reconstructible.
_NODE_INPUT_KEYS = {
    "schema": ("task", "hint", "step_idx"),
    "plan": ("task", "schema", "hint", "step_idx"),
    "select_tool": ("task", "schema", "plan", "scratchpad", "hint", "iteration", "step_idx"),
    "run_tool": ("pending_call", "scratchpad", "iteration", "step_idx"),
    "reflect": ("task", "scratchpad", "hint", "iteration", "step_idx"),
    "answer": ("task", "scratchpad", "hint", "step_idx"),
}


def _jsonable(obj):
    return json.loads(json.dumps(obj, default=str))


def _slice_input(name, s):
    keys = _NODE_INPUT_KEYS.get(name) or tuple(s.keys())
    return _jsonable({k: s.get(k) for k in keys})


def begin_run():
    STATS["llm"] = STATS["cached"] = STATS["retries"] = 0
    TRACE.clear()


# ------------------------------------------------------------------ fault hook
FAULT = None                      # {"step": int, "node": str, "fn": callable}
FAULT_APPLIED = {"applied": False}


def set_fault(step: int, node: str, fn):
    global FAULT
    FAULT = {"step": step, "node": node, "fn": fn}
    FAULT_APPLIED["applied"] = False


def clear_fault():
    global FAULT
    FAULT = None
    FAULT_APPLIED["applied"] = False


def maybe_fault(node: str, idx: int, payload):
    """Every node passes its output through here. Corrupts it only if a fault targets this step."""
    if FAULT and FAULT["step"] == idx and FAULT["node"] == node:
        new = FAULT["fn"](payload)
        if new != payload:
            FAULT_APPLIED["applied"] = True
        return new
    return payload


# ------------------------------------------------------------------ tools
def _clean(v):
    if isinstance(v, decimal.Decimal):
        return float(v)
    if isinstance(v, (datetime.date, datetime.datetime)):
        return v.isoformat()
    return v


_FORBIDDEN = re.compile(r"\b(insert|update|delete|drop|alter|create|grant|revoke|truncate|copy)\b", re.I)


def run_sql(query: str):
    q = query.strip().rstrip(";")
    if not re.match(r"^\s*(select|with)\b", q, re.I) or _FORBIDDEN.search(q):
        raise ValueError("only read-only SELECT queries are allowed")
    with psycopg.connect(config.agent_ro_url()) as conn:
        conn.read_only = True
        conn.execute("SET LOCAL statement_timeout = 5000")
        conn.execute("SET LOCAL search_path TO company")
        cur = conn.execute(q)
        cols = [d.name for d in cur.description]
        rows = [[_clean(x) for x in r] for r in cur.fetchmany(20)]
    return {"columns": cols, "rows": rows}


_OPS = {ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul,
        ast.Div: operator.truediv, ast.Pow: operator.pow, ast.USub: operator.neg,
        ast.Mod: operator.mod}


def _eval(n):
    if isinstance(n, ast.Constant) and isinstance(n.value, (int, float)):
        return n.value
    if isinstance(n, ast.BinOp) and type(n.op) in _OPS:
        return _OPS[type(n.op)](_eval(n.left), _eval(n.right))
    if isinstance(n, ast.UnaryOp) and type(n.op) in _OPS:
        return _OPS[type(n.op)](_eval(n.operand))
    raise ValueError("unsupported expression")


def calculator(expression: str):
    return _eval(ast.parse(expression, mode="eval").body)


def get_schema() -> str:
    with psycopg.connect(config.agent_ro_url()) as conn:
        rows = conn.execute(
            "SELECT table_name, column_name, data_type FROM information_schema.columns "
            "WHERE table_schema='company' ORDER BY table_name, ordinal_position").fetchall()
    tables = {}
    for t, c, d in rows:
        tables.setdefault(t, []).append(f"{c} {d}")
    return "\n".join(f"{t}({', '.join(cols)})" for t, cols in tables.items())


# ------------------------------------------------------------------ LLM (temperature 0, cached)
_cache = sqlite3.connect(config.CACHE_PATH, check_same_thread=False)
_cache.execute("CREATE TABLE IF NOT EXISTS c(k TEXT PRIMARY KEY, v TEXT)")
_llm = None


def _make_llm():
    if config.PROVIDER == "groq":
        from langchain_groq import ChatGroq          # reads GROQ_API_KEY from the environment
        return ChatGroq(model=config.MODEL, temperature=0, max_tokens=500)
    from langchain_anthropic import ChatAnthropic    # reads ANTHROPIC_API_KEY
    return ChatAnthropic(model=config.MODEL, temperature=0, max_tokens=500)


def llm(prompt: str) -> str:
    """Cached by prompt hash: unchanged steps replay for free and identically."""
    global _llm
    key = hashlib.sha256((config.PROVIDER + config.MODEL + prompt).encode()).hexdigest()
    hit = _cache.execute("SELECT v FROM c WHERE k=?", (key,)).fetchone()
    if hit:
        STATS["cached"] += 1
        return hit[0]
    if _llm is None:
        _llm = _make_llm()
    for attempt in range(5):                          # back off on rate limits (429)
        try:
            out = _llm.invoke(prompt).content
            break
        except Exception as e:
            if attempt == 4 or not re.search(r"429|rate.?limit", str(e), re.I):
                raise
            STATS["retries"] += 1
            time.sleep(2 * 2 ** attempt)
    if isinstance(out, list):  # content blocks
        out = "".join(b.get("text", "") if isinstance(b, dict) else str(b) for b in out)
    STATS["llm"] += 1
    _cache.execute("INSERT OR REPLACE INTO c VALUES(?,?)", (key, out))
    _cache.commit()
    return out


def parse_json(text: str) -> dict:
    text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.M).strip()
    try:
        return json.loads(text)
    except Exception:
        m = re.search(r"\{.*\}", text, re.S)
        try:
            return json.loads(m.group(0)) if m else {}
        except Exception:
            return {}


# ------------------------------------------------------------------ state
class AgentState(TypedDict):
    task: str
    schema: str
    plan: list
    scratchpad: list          # [{"iter", "call", "result", "error"}]
    pending_call: Optional[dict]
    done: bool
    answer: Optional[str]
    iteration: int
    step_idx: int             # global step counter, one per node execution
    hint: str                 # optional guidance used by alternative executions


def initial_state(task: str, hint: str = "") -> AgentState:
    return {"task": task, "schema": "", "plan": [], "scratchpad": [], "pending_call": None,
            "done": False, "answer": None, "iteration": 0, "step_idx": 0, "hint": hint}


def _hint(s) -> str:
    return f"\nExtra guidance: {s['hint']}\n" if s.get("hint") else ""


# ------------------------------------------------------------------ nodes (state, idx) -> updates
def n_schema(s, idx):
    return {"schema": get_schema()}


def n_plan(s, idx):
    out = llm(f"PostgreSQL schema (tables are in schema 'company'):\n{s['schema']}\n\n"
              f"Question: {s['task']}\n{_hint(s)}"
              'Break this into 1-4 short sub-steps. Reply JSON only: {"plan": ["...", "..."]}')
    plan = parse_json(out).get("plan", [])
    return {"plan": maybe_fault("plan", idx, plan)}


def n_select_tool(s, idx):
    out = llm(f"PostgreSQL schema (tables are in schema 'company'):\n{s['schema']}\n\n"
              f"Question: {s['task']}\nPlan: {s['plan']}\n{_hint(s)}"
              f"Work so far: {json.dumps(s['scratchpad'], default=str)}\n\n"
              "Choose the next tool. Tools: run_sql(query) [PostgreSQL, SELECT only], "
              "calculator(expression).\n"
              'Reply JSON only: {"tool": "run_sql", "args": {"query": "..."}} or '
              '{"tool": "calculator", "args": {"expression": "..."}}')
    return {"pending_call": maybe_fault("select_tool", idx, parse_json(out))}


def n_run_tool(s, idx):
    call = s["pending_call"] or {}
    result, error = None, None
    try:
        tool, args = call.get("tool"), call.get("args", {})
        if tool == "run_sql":
            result = run_sql(args["query"])
        elif tool == "calculator":
            result = calculator(args["expression"])
        else:
            raise ValueError(f"unknown tool {tool}")
    except Exception as e:
        error = f"{type(e).__name__}: {e}"
    result = maybe_fault("run_tool", idx, result)
    entry = {"iter": s["iteration"], "call": call, "result": result, "error": error}
    return {"scratchpad": s["scratchpad"] + [entry]}


def n_reflect(s, idx):
    out = llm(f"Question: {s['task']}\n{_hint(s)}"
              f"Work so far: {json.dumps(s['scratchpad'], default=str)}\n"
              "Do we have enough information to give the final answer? "
              'Reply JSON only: {"done": true/false, "note": "one sentence"}')
    r = maybe_fault("reflect", idx, parse_json(out))
    it = s["iteration"] + 1
    return {"done": bool(r.get("done")) or it >= config.MAX_ITERS, "iteration": it}


def n_answer(s, idx):
    out = llm(f"Question: {s['task']}\n{_hint(s)}"
              f"Work so far: {json.dumps(s['scratchpad'], default=str)}\n"
              "Give only the final answer (a number or short text), nothing else.")
    return {"answer": out.strip()}


def route(s):
    return "answer" if s["done"] else "select_tool"


def traced(name, fn):
    def wrapper(s):
        idx = s["step_idx"]
        l0, c0, r0, t0 = STATS["llm"], STATS["cached"], STATS["retries"], time.time()
        inp = _slice_input(name, s)
        try:
            out = fn(s, idx)
        except Exception as e:
            TRACE[idx] = {
                "node": name, "input": inp, "output": None,
                "error": f"{type(e).__name__}: {e}",
                "latency_ms": int((time.time() - t0) * 1000),
                "llm_calls": STATS["llm"] - l0, "cached_calls": STATS["cached"] - c0,
                "retries": STATS["retries"] - r0,
            }
            raise
        out["step_idx"] = idx + 1
        tool_error = None
        if name == "run_tool":
            pad = out.get("scratchpad") or []
            if pad:
                tool_error = pad[-1].get("error")
        TRACE[idx] = {
            "node": name, "input": inp, "output": _jsonable({k: v for k, v in out.items() if k != "step_idx"}),
            "error": tool_error,
            "latency_ms": int((time.time() - t0) * 1000),
            "llm_calls": STATS["llm"] - l0, "cached_calls": STATS["cached"] - c0,
            "retries": STATS["retries"] - r0,
        }
        TRACE[idx]["output"]["step_idx"] = idx + 1
        return out
    return wrapper


# ------------------------------------------------------------------ graph
def make_saver():
    """Postgres checkpointer on Neon (direct connection). Creates its tables on first use."""
    from langgraph.checkpoint.postgres import PostgresSaver
    from psycopg.rows import dict_row
    conn = psycopg.connect(config.database_url(), autocommit=True,
                           prepare_threshold=0, row_factory=dict_row)
    saver = PostgresSaver(conn)
    saver.setup()
    return saver


def build_graph(saver=None):
    g = StateGraph(AgentState)
    for name, fn in [("schema", n_schema), ("plan", n_plan), ("select_tool", n_select_tool),
                     ("run_tool", n_run_tool), ("reflect", n_reflect), ("answer", n_answer)]:
        g.add_node(name, traced(name, fn))
    g.set_entry_point("schema")
    g.add_edge("schema", "plan")
    g.add_edge("plan", "select_tool")
    g.add_edge("select_tool", "run_tool")
    g.add_edge("run_tool", "reflect")
    g.add_conditional_edges("reflect", route, {"answer": "answer", "select_tool": "select_tool"})
    g.add_edge("answer", END)
    return g.compile(checkpointer=saver or make_saver())


def run_task(graph, task: str, thread_id: str, hint: str = ""):
    begin_run()
    cfg = {"configurable": {"thread_id": thread_id}}
    final = graph.invoke(initial_state(task, hint), cfg)
    return final, cfg


# ------------------------------------------------------------------ quick manual run
if __name__ == "__main__":
    from recorder import run_and_record
    from tasks import TASKS
    graph = build_graph()
    passed = 0
    for i, (q, gsql) in enumerate(TASKS[:5]):
        rec = run_and_record(graph, i, q, gsql)
        passed += rec.outcome == "success"
        print(f"[{rec.outcome.upper()}] {q} -> {rec.final_answer}  ({rec.run_id}, {rec.step_count} steps)")
    print(f"{passed}/5 passed")
 
