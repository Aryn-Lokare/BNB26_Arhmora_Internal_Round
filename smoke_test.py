"""Offline smoke test (no LLM key needed). Uses a scripted fake LLM against your real Neon DB.

Verifies the riskiest assumptions BEFORE you build anything else:
  1. tools + read-only role work on Neon
  2. the Postgres checkpointer stores one checkpoint per step
  3. a fault hook corrupts exactly one step
  4. you can fork from a checkpoint, patch state, and resume WITHOUT re-running earlier steps

Run:  python smoke_test.py
"""
import json
import uuid

import agent
from tasks import check, gold_answer

TASK = "What is the highest department budget?"
GOOD_SQL = "SELECT MAX(budget) FROM departments"
BAD_SQL = "SELECT MIN(budget) FROM departments"


def fake_llm(prompt: str) -> str:
    if "Break this into" in prompt:
        return json.dumps({"plan": ["find max budget"]})
    if "Choose the next tool" in prompt:
        return json.dumps({"tool": "run_sql", "args": {"query": GOOD_SQL}})
    if "enough information" in prompt:
        return json.dumps({"done": True, "note": "got it"})
    # answer step: read the number out of the scratchpad
    work = prompt.split("Work so far: ")[1].split("\n")[0]
    rows = json.loads(work)[0]["result"]["rows"]
    return str(rows[0][0])


agent.llm = fake_llm


def history_nodes(graph, cfg):
    snaps = list(graph.get_state_history(cfg))[::-1]       # oldest -> newest
    return snaps, [s.next[0] for s in snaps if s.next and s.next[0] != "__start__"]


def fork(graph, parent_cfg, k, patch, new_thread):
    """Copy the state from just BEFORE step k into a new thread, apply a patch, resume."""
    snaps = list(graph.get_state_history(parent_cfg))       # newest -> oldest
    i = next(i for i, s in enumerate(snaps) if s.next and s.values.get("step_idx") == k)
    prev_node = snaps[i + 1].next[0]                        # node that produced this checkpoint
    cfg = {"configurable": {"thread_id": new_thread}}
    graph.update_state(cfg, {**snaps[i].values, **patch}, as_node=prev_node)
    agent.begin_run()
    return graph.invoke(None, cfg), cfg


def main():
    graph = agent.build_graph()
    gold = gold_answer("SELECT MAX(budget) FROM departments")
    tid = f"smoke-{uuid.uuid4().hex[:6]}"

    # 1+2: clean run, checkpoints exist
    final, cfg = agent.run_task(graph, TASK, tid)
    snaps, order = history_nodes(graph, cfg)
    print("answer:", final["answer"], "| gold:", gold)
    print("node order:", order)
    assert check(final["answer"], gold), "clean run should pass"
    assert order[:5] == ["schema", "plan", "select_tool", "run_tool", "reflect"], order

    # 3: fault hook corrupts exactly one step
    k = 2   # select_tool
    agent.set_fault(k, "select_tool",
                    lambda call: {**call, "args": {"query": BAD_SQL}} if call else call)
    bad, bad_cfg = agent.run_task(graph, TASK, tid + "-fault")
    agent.clear_fault()
    assert not check(bad["answer"], gold), "faulted run should fail"
    print("faulted answer:", bad["answer"], "(fail, as expected)")

    # 4: fork from the checkpoint before the faulty step; fault is cleared, so step 2 reruns clean
    fixed, fixed_cfg = fork(graph, bad_cfg, k, {}, tid + "-replay")
    executed = sorted(agent.TRACE)
    print("steps re-executed in replay:", executed, "of", fixed["step_idx"], "total")
    assert check(fixed["answer"], gold), "replay from checkpoint should fix the run"
    assert min(executed) == k, "earlier steps must NOT be re-executed"

    print("\nALL CHECKS PASSED")


if __name__ == "__main__":
    main()
