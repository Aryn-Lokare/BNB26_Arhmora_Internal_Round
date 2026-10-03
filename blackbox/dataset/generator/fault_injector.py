"""Fault injector module defining 15 distinct failure mechanisms and downstream propagation."""
from __future__ import annotations

import copy
import random
from typing import Any

FAILURE_TYPES = [
    "wrong_tool_argument",
    "incorrect_llm_decision",
    "wrong_state_update",
    "invalid_tool_output_handling",
    "incorrect_retrieval",
    "stale_state",
    "incorrect_parameter",
    "wrong_agent_handoff",
    "missing_information",
    "incorrect_api_response_handling",
    "incorrect_database_operation",
    "invalid_data_transformation",
    "wrong_order_of_operations",
    "incorrect_condition",
    "hallucinated_value",
]

# Set of held-out unseen failure types for generalization testing
UNSEEN_FAILURE_TYPES = [
    "wrong_order_of_operations",
    "stale_state",
    "hallucinated_value",
]

KNOWN_FAILURE_TYPES = [f for f in FAILURE_TYPES if f not in UNSEEN_FAILURE_TYPES]


def inject_fault_into_workflow(
    workflow_steps: list[dict[str, Any]],
    failure_type: str,
    rng: random.Random,
) -> tuple[list[dict[str, Any]], int, str]:
    """Inject a controlled fault into a sequence of steps.

    Returns:
        (mutated_steps, injected_step_index_0_based, downstream_error_message)
    """
    num_steps = len(workflow_steps)
    steps = copy.deepcopy(workflow_steps)

    # Pick an intermediate step for root cause (step 1 to num_steps - 2)
    # so there is room for downstream propagation
    min_k = 1 if num_steps > 3 else 0
    max_k = max(min_k, num_steps - 2)
    k = rng.randint(min_k, max_k)

    target_step = steps[k]
    step_type = target_step.get("step_type", "tool_call")
    action = target_step.get("action", "action")

    error_msg = f"Execution failed downstream due to {failure_type}"

    if failure_type == "wrong_tool_argument":
        # Root cause: wrong argument passed into tool
        inp = target_step.get("input", {})
        if isinstance(inp, dict) and inp:
            key = rng.choice(list(inp.keys()))
            inp[key] = f"INVALID_{key.upper()}_9999"
        else:
            target_step["input"] = {"invalid_arg": -99999}
        target_step["output"] = {"status": "accepted_with_bad_arg", "warning": "Unchecked parameter format"}
        error_msg = "Invalid tool argument caused downstream processing error: entity not found"

    elif failure_type == "incorrect_llm_decision":
        # Root cause: LLM takes wrong branch or selects inappropriate action
        target_step["output"] = {
            "decision": "bypass_validation",
            "reasoning": "Skipping prerequisite checks based on incorrect user assumption",
            "route_to": "unsupported_path",
        }
        error_msg = "LLM made incorrect branch decision; prerequisite state missing downstream"

    elif failure_type == "wrong_state_update":
        # Root cause: state update corrupts or empties crucial keys
        target_step["output"] = {"corrupted_keys": ["all_context_cleared"], "reset": True}
        target_step["state_after"] = {"error_state": "state_wiped_prematurely"}
        error_msg = "State update dropped critical context keys required by subsequent steps"

    elif failure_type == "invalid_tool_output_handling":
        # Root cause: tool returned valid result, but agent parsed/handled it wrongly
        target_step["output"] = {"raw_output": "200 OK", "parsed_as": None, "extracted": {}}
        error_msg = "Agent failed to extract fields from tool output, causing NullReferenceError"

    elif failure_type == "incorrect_retrieval":
        # Root cause: retrieved wrong entity/documents
        target_step["output"] = {
            "retrieved_records": [{"id": "MISMATCH_999", "score": 0.12, "content": "Unrelated topic"}],
            "top_match": "MISMATCH_999",
        }
        error_msg = "Retrieved entity mismatch: downstream operations applied to wrong entity"

    elif failure_type == "stale_state":
        # Root cause: agent reads cached/stale variable instead of freshly computed one
        target_step["output"] = {
            "balance": 0.0,
            "version": "v1_deprecated_cache",
            "is_stale": True,
        }
        error_msg = "Downstream action attempted using stale version/cache token"

    elif failure_type == "incorrect_parameter":
        # Root cause: wrong parameter type or magnitude (e.g. 100x multiplier or string instead of int)
        target_step["input"] = {**target_step.get("input", {}), "rate_limit_ms": "infinite_string", "pct": 9999}
        target_step["output"] = {"warning": "coerced_bad_type"}
        error_msg = "Type error / out of bounds parameter encountered in downstream service call"

    elif failure_type == "wrong_agent_handoff":
        # Root cause: handed off to the wrong specialized sub-agent
        target_step["output"] = {"handoff_target": "legacy_deprecated_agent", "protocol": "v0"}
        error_msg = "Handoff to incompatible sub-agent resulted in dropped execution context"

    elif failure_type == "missing_information":
        # Root cause: step failed to ask for or include mandatory field
        inp = target_step.get("input", {})
        if isinstance(inp, dict):
            inp.pop(next(iter(inp.keys()), None), None)
        target_step["output"] = {"status": "partial_payload", "missing_required": True}
        error_msg = "Downstream request rejected due to missing mandatory schema attributes"

    elif failure_type == "incorrect_api_response_handling":
        # Root cause: treated 404 / 500 or error envelope as successful payload
        target_step["output"] = {"code": 404, "body": {"message": "Not Found"}, "treated_as_success": True}
        error_msg = "Downstream parser crashed attempting to index non-existent response attributes"

    elif failure_type == "incorrect_database_operation":
        # Root cause: bad SQL filter, bad join, or missing WHERE clause
        target_step["output"] = {
            "sql": "SELECT * FROM records WHERE 1=0",
            "rows_returned": 0,
            "query_cost": 0.01,
        }
        error_msg = "Database query returned 0 rows due to flawed predicate; downstream math divided by zero"

    elif failure_type == "invalid_data_transformation":
        # Root cause: date formatted wrongly or currency miscalculated
        target_step["output"] = {
            "transformed_value": "NaN",
            "source_value": 150.0,
            "units": "mismatched_timezone_and_currency",
        }
        error_msg = "Downstream validation failed: expected numeric float, received 'NaN'"

    elif failure_type == "wrong_order_of_operations":
        # Root cause: step committed action before performing necessary validation
        target_step["action"] = f"premature_{target_step.get('action')}"
        target_step["output"] = {"executed_unverified": True}
        error_msg = "Order of operations violation: action executed prior to authorization check"

    elif failure_type == "incorrect_condition":
        # Root cause: inverted if/else logic or bad comparator
        target_step["output"] = {"evaluated_condition": False, "inverted": True, "branch_taken": "fallback_abort"}
        error_msg = "Inverted condition caused agent to branch into unrecoverable failure state"

    elif failure_type == "hallucinated_value":
        # Root cause: LLM hallucinated a fact, ID, or non-existent endpoint
        target_step["output"] = {
            "hallucinated_id": "FAKE_TOKEN_XYZ_9876",
            "confidence": 0.99,
            "verified": False,
        }
        error_msg = "Hallucinated token does not exist in backend database; 401 Unauthorized"

    # Mark root cause step
    target_step["failure_label"] = 1
    # Note: step k itself can succeed in execution (e.g. LLM generated the hallucination successfully)
    # but the label is 1 because it is the root cause!

    # Propagate failure to downstream steps
    for j in range(k + 1, num_steps):
        steps[j]["failure_label"] = 0
        # Update state_before with corrupted state_after from previous step
        steps[j]["state_before"] = copy.deepcopy(steps[j - 1]["state_after"])

        if j == num_steps - 1:
            # Final step experiences the visible error
            steps[j]["status"] = "failed"
            steps[j]["error"] = error_msg
            steps[j]["output"] = {"error": error_msg, "execution_aborted": True}
            steps[j]["state_after"] = {**steps[j]["state_before"], "execution_status": "failed", "last_error": error_msg}
        else:
            # Intermediate downstream steps propagate the bad state
            steps[j]["status"] = "success"
            steps[j]["error"] = None
            steps[j]["state_after"] = {**steps[j]["state_before"], f"step_{j+1}_propagated": True}

    return steps, k, error_msg
