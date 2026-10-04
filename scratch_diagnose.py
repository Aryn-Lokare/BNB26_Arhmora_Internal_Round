import json
from mcp_server import handle_request

trace = {
    "run_id": "run-news-ai-prompt",
    "task_text": "tell me the latest news in ai",
    "status": "failed",
    "steps": [
        {
            "step_id": "step_01",
            "node": "schema",
            "step_type": "retrieval",
            "action": "inspect_db_schema",
            "input": {"task": "tell me the latest news in ai"},
            "output": {"tables": ["departments", "employees", "projects"]},
            "status": "success",
            "checkpoint_id": "cp_01"
        },
        {
            "step_id": "step_02",
            "node": "plan",
            "step_type": "llm_decision",
            "action": "formulate_plan",
            "input": {"task": "tell me the latest news in ai", "schema": ["departments", "employees", "projects"]},
            "output": {"plan": "Query internal database table 'news' to retrieve articles on AI"},
            "status": "success",
            "checkpoint_id": "cp_02"
        },
        {
            "step_id": "step_03",
            "node": "select_tool",
            "step_type": "tool_call",
            "action": "query_database",
            "input": {"query": "SELECT title, summary FROM news WHERE category = 'AI' ORDER BY published_date DESC LIMIT 5;"},
            "output": {"error": "relation 'news' does not exist in schema company"},
            "status": "failed",
            "error": "UndefinedTable: relation 'news' does not exist",
            "checkpoint_id": "cp_03"
        },
        {
            "step_id": "step_04",
            "node": "answer",
            "step_type": "llm_decision",
            "action": "answer",
            "input": {"error": "relation 'news' does not exist"},
            "output": {"final_answer": "Failed to fetch AI news: table 'news' does not exist."},
            "status": "failed",
            "error": "Execution aborted due to schema mismatch",
            "checkpoint_id": "cp_04"
        }
    ]
}

req = {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
        "name": "diagnose_failure",
        "arguments": {"trace": trace}
    }
}

res = handle_request(req)
print(res["result"]["content"][0]["text"])
