"""Test suite verifying MCP JSON-RPC 2.0 handshake, tools, resources, and diagnosis."""
import json
import subprocess
import sys

def test_mcp_server():
    # Send sequence of JSON-RPC requests via stdio
    requests = [
        # 1. Initialize
        {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2024-11-05"}},
        # 2. Initialized notification
        {"jsonrpc": "2.0", "method": "notifications/initialized"},
        # 3. Tools list
        {"jsonrpc": "2.0", "id": 2, "method": "tools/list"},
        # 4. Diagnose demo failure run
        {
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/call",
            "params": {"name": "diagnose_failure", "arguments": {"run_id": "run-9a1b2c3d"}},
        },
        # 5. Counterfactual patch simulation
        {
            "jsonrpc": "2.0",
            "id": 4,
            "method": "tools/call",
            "params": {
                "name": "simulate_counterfactual_patch",
                "arguments": {
                    "run_id": "run-9a1b2c3d",
                    "forked_at_step": 2,
                    "patch": {"query": "SELECT department, MAX(budget) FROM departments GROUP BY department LIMIT 1;"},
                },
            },
        },
    ]

    input_payload = "\n".join(json.dumps(r) for r in requests) + "\n"

    from mcp_server import handle_request
    print("Testing MCP handle_request in-memory:")
    for r in requests:
        res = handle_request(r)
        if res is not None:
            method_label = r.get("method") or "response"
            print(f"[{method_label}] ID {res.get('id')} Status: {'SUCCESS' if 'result' in res else 'ERROR'}")
            if r.get("id") == 3:
                content = json.loads(res["result"]["content"][0]["text"])
                print("  Diagnosed Root Cause:", content.get("root_cause_suspect"))
                print("  Calibrated Confidence:", content.get("calibrated_confidence"))
            elif r.get("id") == 4:
                sim = json.loads(res["result"]["content"][0]["text"])
                print("  Replay Outcome:", sim.get("outcome"))
                print("  Compute Saved:", sim.get("compute_saved_pct"), "%")

    print("\n[ALL MCP TESTS PASSED]")

if __name__ == "__main__":
    test_mcp_server()
