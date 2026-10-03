"""Workflow definitions for generating realistic agent execution traces across 15 domains."""
from __future__ import annotations

import random
from typing import Any

DOMAINS = [
    "customer_support",
    "ecommerce_order",
    "travel_booking",
    "hotel_booking",
    "payment_processing",
    "calendar_scheduling",
    "email_assistant",
    "document_processing",
    "data_analysis",
    "database_assistant",
    "coding_assistant",
    "it_support",
    "inventory_management",
    "hr_assistant",
    "research_assistant",
]

# Scenario templates with realistic action names, tool names, parameters, and entities
DOMAIN_SCENARIOS: dict[str, list[dict[str, Any]]] = {
    "customer_support": [
        {
            "scenario": "refund_request",
            "entities": {"customer_ids": [1024, 2048, 3072, 4096, 5120], "orders": ["ORD-901", "ORD-902", "ORD-903"]},
            "steps": [
                {"type": "llm_decision", "action": "identify_customer", "input_keys": ["user_query"], "output_keys": ["customer_id", "intent"]},
                {"type": "retrieval", "action": "lookup_account_history", "input_keys": ["customer_id"], "output_keys": ["account_tier", "recent_orders"]},
                {"type": "tool_call", "action": "verify_refund_eligibility", "input_keys": ["order_id", "customer_id"], "output_keys": ["eligible", "max_amount"]},
                {"type": "tool_call", "action": "process_wallet_credit", "input_keys": ["customer_id", "amount"], "output_keys": ["transaction_id", "credit_status"]},
                {"type": "state_update", "action": "log_ticket_resolution", "input_keys": ["customer_id", "transaction_id"], "output_keys": ["ticket_status"]},
                {"type": "llm_decision", "action": "send_customer_email", "input_keys": ["customer_id", "ticket_status"], "output_keys": ["message_sent"]},
            ],
        },
        {
            "scenario": "address_change",
            "entities": {"customer_ids": [1101, 1102, 1103], "zip_codes": ["94107", "10001", "30301"]},
            "steps": [
                {"type": "llm_decision", "action": "parse_address_request", "input_keys": ["user_message"], "output_keys": ["customer_id", "new_address"]},
                {"type": "retrieval", "action": "fetch_shipping_address", "input_keys": ["customer_id"], "output_keys": ["current_address", "pending_shipments"]},
                {"type": "tool_call", "action": "validate_postal_code", "input_keys": ["zip_code"], "output_keys": ["valid_zone", "carrier"]},
                {"type": "tool_call", "action": "update_customer_record", "input_keys": ["customer_id", "new_address"], "output_keys": ["records_updated"]},
                {"type": "llm_decision", "action": "generate_confirmation_response", "input_keys": ["customer_id"], "output_keys": ["reply_body"]},
            ],
        },
    ],
    "ecommerce_order": [
        {
            "scenario": "order_fulfillment",
            "entities": {"skus": ["SKU-A10", "SKU-B20", "SKU-C30"], "warehouses": ["WH-NORTH", "WH-WEST", "WH-EAST"]},
            "steps": [
                {"type": "llm_decision", "action": "parse_order_payload", "input_keys": ["checkout_payload"], "output_keys": ["order_id", "item_list", "shipping_speed"]},
                {"type": "retrieval", "action": "check_warehouse_stock", "input_keys": ["item_list"], "output_keys": ["warehouse_id", "stock_available"]},
                {"type": "tool_call", "action": "reserve_inventory_units", "input_keys": ["warehouse_id", "item_list"], "output_keys": ["reservation_id"]},
                {"type": "tool_call", "action": "create_shipping_label", "input_keys": ["order_id", "warehouse_id", "shipping_speed"], "output_keys": ["tracking_number", "carrier"]},
                {"type": "state_update", "action": "mark_order_dispatched", "input_keys": ["order_id", "tracking_number"], "output_keys": ["order_status"]},
                {"type": "llm_decision", "action": "send_dispatch_notification", "input_keys": ["order_id", "tracking_number"], "output_keys": ["email_id"]},
            ],
        },
        {
            "scenario": "discount_coupon_apply",
            "entities": {"coupons": ["SAVE20", "FLASH50", "WELCOME10"], "carts": ["CART-801", "CART-802"]},
            "steps": [
                {"type": "llm_decision", "action": "extract_promo_code", "input_keys": ["user_input"], "output_keys": ["coupon_code", "cart_id"]},
                {"type": "retrieval", "action": "fetch_cart_subtotal", "input_keys": ["cart_id"], "output_keys": ["subtotal", "eligible_categories"]},
                {"type": "tool_call", "action": "validate_coupon_rules", "input_keys": ["coupon_code", "subtotal"], "output_keys": ["discount_pct", "valid"]},
                {"type": "tool_call", "action": "apply_discount_to_cart", "input_keys": ["cart_id", "discount_pct"], "output_keys": ["new_total"]},
                {"type": "llm_decision", "action": "format_cart_summary", "input_keys": ["cart_id", "new_total"], "output_keys": ["summary_text"]},
            ],
        },
    ],
    "travel_booking": [
        {
            "scenario": "flight_itinerary",
            "entities": {"airports": ["SFO", "JFK", "LHR", "ORD", "HND"], "classes": ["Economy", "Business"]},
            "steps": [
                {"type": "llm_decision", "action": "extract_flight_preferences", "input_keys": ["user_prompt"], "output_keys": ["origin", "destination", "travel_date", "cabin_class"]},
                {"type": "retrieval", "action": "search_flight_routes", "input_keys": ["origin", "destination", "travel_date"], "output_keys": ["flight_candidates", "min_fare"]},
                {"type": "tool_call", "action": "check_seat_inventory", "input_keys": ["flight_number", "cabin_class"], "output_keys": ["available_seats", "fare_quote"]},
                {"type": "tool_call", "action": "hold_flight_seat", "input_keys": ["flight_number", "seat_number", "passenger_id"], "output_keys": ["hold_id", "expiry"]},
                {"type": "state_update", "action": "store_pending_booking", "input_keys": ["hold_id", "fare_quote"], "output_keys": ["booking_reference"]},
                {"type": "llm_decision", "action": "present_flight_itinerary", "input_keys": ["booking_reference", "fare_quote"], "output_keys": ["itinerary_markdown"]},
            ],
        }
    ],
    "hotel_booking": [
        {
            "scenario": "room_reservation",
            "entities": {"cities": ["Paris", "Tokyo", "New York", "London"], "room_types": ["Deluxe King", "Standard Twin", "Suite"]},
            "steps": [
                {"type": "llm_decision", "action": "parse_hotel_criteria", "input_keys": ["query"], "output_keys": ["city", "checkin_date", "nights", "guests"]},
                {"type": "retrieval", "action": "fetch_available_hotels", "input_keys": ["city", "checkin_date", "nights"], "output_keys": ["hotel_ids", "price_range"]},
                {"type": "tool_call", "action": "verify_room_allocation", "input_keys": ["hotel_id", "room_type", "nights"], "output_keys": ["available", "nightly_rate"]},
                {"type": "tool_call", "action": "commit_hotel_reservation", "input_keys": ["hotel_id", "guest_name", "total_price"], "output_keys": ["confirmation_num", "voucher"]},
                {"type": "llm_decision", "action": "generate_booking_confirmation", "input_keys": ["confirmation_num"], "output_keys": ["confirmation_card"]},
            ],
        }
    ],
    "payment_processing": [
        {
            "scenario": "gateway_charge",
            "entities": {"merchants": ["M-441", "M-882", "M-109"], "currencies": ["USD", "EUR", "GBP"]},
            "steps": [
                {"type": "llm_decision", "action": "verify_payment_parameters", "input_keys": ["payment_request"], "output_keys": ["amount", "currency", "customer_token", "merchant_id"]},
                {"type": "retrieval", "action": "check_merchant_account_status", "input_keys": ["merchant_id"], "output_keys": ["merchant_active", "payout_schedule"]},
                {"type": "tool_call", "action": "run_fraud_scoring", "input_keys": ["customer_token", "amount", "currency"], "output_keys": ["risk_score", "fraud_verdict"]},
                {"type": "tool_call", "action": "execute_card_charge", "input_keys": ["customer_token", "amount", "currency"], "output_keys": ["auth_code", "charge_id"]},
                {"type": "state_update", "action": "record_ledger_entry", "input_keys": ["charge_id", "merchant_id", "amount"], "output_keys": ["ledger_balance"]},
                {"type": "llm_decision", "action": "compose_receipt", "input_keys": ["charge_id", "amount"], "output_keys": ["receipt_text"]},
            ],
        }
    ],
    "calendar_scheduling": [
        {
            "scenario": "team_sync",
            "entities": {"users": ["alice@co.com", "bob@co.com", "carol@co.com"], "durations": [30, 45, 60]},
            "steps": [
                {"type": "llm_decision", "action": "parse_meeting_intent", "input_keys": ["prompt"], "output_keys": ["attendees", "duration_mins", "time_window"]},
                {"type": "retrieval", "action": "query_calendar_freebusy", "input_keys": ["attendees", "time_window"], "output_keys": ["common_free_slots"]},
                {"type": "tool_call", "action": "select_optimal_slot", "input_keys": ["common_free_slots", "duration_mins"], "output_keys": ["chosen_start", "chosen_end"]},
                {"type": "tool_call", "action": "schedule_calendar_event", "input_keys": ["attendees", "chosen_start", "chosen_end", "meeting_title"], "output_keys": ["event_id", "meeting_link"]},
                {"type": "llm_decision", "action": "send_calendar_invitations", "input_keys": ["event_id", "attendees"], "output_keys": ["invitations_dispatched"]},
            ],
        }
    ],
    "email_assistant": [
        {
            "scenario": "inbox_triage_reply",
            "entities": {"folders": ["Urgent", "Follow-Up", "Newsletter"], "tags": ["VIP", "ActionRequired"]},
            "steps": [
                {"type": "llm_decision", "action": "parse_email_thread", "input_keys": ["raw_email"], "output_keys": ["sender", "subject", "urgency", "required_action"]},
                {"type": "retrieval", "action": "search_related_correspondence", "input_keys": ["sender", "subject"], "output_keys": ["previous_threads", "context_notes"]},
                {"type": "tool_call", "action": "draft_email_response", "input_keys": ["subject", "context_notes", "required_action"], "output_keys": ["draft_body", "recipients"]},
                {"type": "tool_call", "action": "apply_mailbox_label", "input_keys": ["email_id", "folder"], "output_keys": ["label_applied"]},
                {"type": "state_update", "action": "queue_outbox_message", "input_keys": ["draft_body", "recipients"], "output_keys": ["queue_id", "scheduled_send"]},
                {"type": "llm_decision", "action": "summarize_email_action", "input_keys": ["queue_id"], "output_keys": ["assistant_summary"]},
            ],
        }
    ],
    "document_processing": [
        {
            "scenario": "invoice_extraction",
            "entities": {"doc_types": ["Invoice", "Contract", "Receipt"], "vendors": ["Acme Corp", "Beta LLC", "CloudNet"]},
            "steps": [
                {"type": "llm_decision", "action": "classify_document_type", "input_keys": ["file_bytes"], "output_keys": ["doc_type", "page_count"]},
                {"type": "tool_call", "action": "run_ocr_extraction", "input_keys": ["file_bytes", "page_count"], "output_keys": ["raw_text", "bounding_boxes"]},
                {"type": "retrieval", "action": "extract_key_value_entities", "input_keys": ["raw_text"], "output_keys": ["vendor_name", "invoice_date", "total_due", "line_items"]},
                {"type": "tool_call", "action": "validate_financial_totals", "input_keys": ["line_items", "total_due"], "output_keys": ["math_valid", "discrepancy"]},
                {"type": "state_update", "action": "save_structured_doc_record", "input_keys": ["vendor_name", "total_due"], "output_keys": ["doc_id"]},
                {"type": "llm_decision", "action": "emit_doc_summary", "input_keys": ["doc_id"], "output_keys": ["status_report"]},
            ],
        }
    ],
    "data_analysis": [
        {
            "scenario": "sql_metrics_aggregation",
            "entities": {"tables": ["employees", "departments", "projects"], "metrics": ["salary_avg", "budget_max", "active_count"]},
            "steps": [
                {"type": "llm_decision", "action": "formulate_analysis_plan", "input_keys": ["analysis_question"], "output_keys": ["plan_steps", "target_tables"]},
                {"type": "retrieval", "action": "inspect_db_schema", "input_keys": ["target_tables"], "output_keys": ["schema_columns", "foreign_keys"]},
                {"type": "tool_call", "action": "construct_sql_query", "input_keys": ["plan_steps", "schema_columns"], "output_keys": ["sql_statement"]},
                {"type": "tool_call", "action": "execute_database_query", "input_keys": ["sql_statement"], "output_keys": ["query_result_rows", "row_count"]},
                {"type": "tool_call", "action": "compute_aggregate_metrics", "input_keys": ["query_result_rows"], "output_keys": ["metric_summary"]},
                {"type": "llm_decision", "action": "synthesize_analytical_answer", "input_keys": ["metric_summary"], "output_keys": ["final_insight"]},
            ],
        }
    ],
    "database_assistant": [
        {
            "scenario": "slow_query_optimization",
            "entities": {"queries": ["SELECT * FROM orders WHERE status='pending'", "SELECT count(*) FROM logs GROUP BY ip"], "index_types": ["btree", "gin"]},
            "steps": [
                {"type": "llm_decision", "action": "analyze_slow_query_log", "input_keys": ["query_string"], "output_keys": ["filter_predicates", "table_name"]},
                {"type": "tool_call", "action": "explain_query_execution_plan", "input_keys": ["query_string"], "output_keys": ["total_cost", "scan_type", "bottleneck"]},
                {"type": "retrieval", "action": "fetch_table_existing_indexes", "input_keys": ["table_name"], "output_keys": ["current_indexes"]},
                {"type": "tool_call", "action": "recommend_index_ddl", "input_keys": ["table_name", "filter_predicates", "current_indexes"], "output_keys": ["create_index_sql"]},
                {"type": "llm_decision", "action": "produce_optimization_report", "input_keys": ["create_index_sql", "total_cost"], "output_keys": ["advisory_markdown"]},
            ],
        }
    ],
    "coding_assistant": [
        {
            "scenario": "bug_fix_and_test",
            "entities": {"repos": ["auth-service", "billing-worker", "search-api"], "branches": ["fix/auth-leak", "feat/discount"]},
            "steps": [
                {"type": "llm_decision", "action": "parse_issue_description", "input_keys": ["issue_text", "stacktrace"], "output_keys": ["target_file", "root_function", "repro_steps"]},
                {"type": "retrieval", "action": "read_source_code_file", "input_keys": ["target_file", "root_function"], "output_keys": ["code_snippet", "imports"]},
                {"type": "tool_call", "action": "generate_code_diff", "input_keys": ["code_snippet", "issue_text"], "output_keys": ["patch_diff", "functions_modified"]},
                {"type": "tool_call", "action": "run_unit_test_suite", "input_keys": ["patch_diff", "target_file"], "output_keys": ["tests_passed", "coverage_pct"]},
                {"type": "state_update", "action": "create_git_pull_request", "input_keys": ["patch_diff", "tests_passed"], "output_keys": ["pr_number", "pr_url"]},
                {"type": "llm_decision", "action": "post_pr_summary", "input_keys": ["pr_number", "coverage_pct"], "output_keys": ["review_comment"]},
            ],
        }
    ],
    "it_support": [
        {
            "scenario": "vpn_access_provision",
            "entities": {"users": ["dev_01", "dev_02", "ops_09"], "roles": ["StandardDev", "SREAdmin", "Contractor"]},
            "steps": [
                {"type": "llm_decision", "action": "evaluate_access_request", "input_keys": ["ticket_text"], "output_keys": ["username", "requested_group", "manager_approved"]},
                {"type": "retrieval", "action": "lookup_ldap_directory", "input_keys": ["username"], "output_keys": ["employee_status", "dept", "security_clearance"]},
                {"type": "tool_call", "action": "verify_security_policy", "input_keys": ["requested_group", "security_clearance"], "output_keys": ["policy_satisfied", "mfa_enabled"]},
                {"type": "tool_call", "action": "assign_vpn_profile", "input_keys": ["username", "requested_group"], "output_keys": ["cert_serial", "provision_status"]},
                {"type": "state_update", "action": "audit_log_access_grant", "input_keys": ["username", "cert_serial"], "output_keys": ["audit_id"]},
                {"type": "llm_decision", "action": "notify_user_credentials", "input_keys": ["username", "provision_status"], "output_keys": ["instruction_email"]},
            ],
        }
    ],
    "inventory_management": [
        {
            "scenario": "reorder_stock_threshold",
            "entities": {"products": ["PROD-100", "PROD-200", "PROD-300"], "suppliers": ["SUPPLIER-ALPHA", "SUPPLIER-OMEGA"]},
            "steps": [
                {"type": "llm_decision", "action": "inspect_depletion_velocity", "input_keys": ["product_id"], "output_keys": ["daily_burn_rate", "safety_stock"]},
                {"type": "retrieval", "action": "query_current_shelf_quantity", "input_keys": ["product_id"], "output_keys": ["units_on_hand", "units_in_transit"]},
                {"type": "tool_call", "action": "calculate_reorder_quantity", "input_keys": ["units_on_hand", "daily_burn_rate", "safety_stock"], "output_keys": ["recommended_order_units"]},
                {"type": "tool_call", "action": "submit_purchase_order", "input_keys": ["product_id", "recommended_order_units", "supplier_id"], "output_keys": ["po_number", "eta_days"]},
                {"type": "state_update", "action": "update_procurement_ledger", "input_keys": ["po_number", "product_id"], "output_keys": ["ledger_status"]},
                {"type": "llm_decision", "action": "broadcast_restock_schedule", "input_keys": ["po_number", "eta_days"], "output_keys": ["slack_announcement"]},
            ],
        }
    ],
    "hr_assistant": [
        {
            "scenario": "leave_request_approval",
            "entities": {"employees": ["EMP-501", "EMP-502", "EMP-503"], "leave_types": ["Annual", "Sick", "Parental"]},
            "steps": [
                {"type": "llm_decision", "action": "parse_leave_application", "input_keys": ["form_data"], "output_keys": ["employee_id", "leave_type", "start_date", "days_count"]},
                {"type": "retrieval", "action": "query_pto_balance", "input_keys": ["employee_id", "leave_type"], "output_keys": ["accrued_days", "used_days", "available_days"]},
                {"type": "tool_call", "action": "validate_blackout_periods", "input_keys": ["start_date", "days_count", "dept_id"], "output_keys": ["coverage_ok", "blackout_conflict"]},
                {"type": "tool_call", "action": "deduct_pto_balance", "input_keys": ["employee_id", "days_count"], "output_keys": ["new_pto_balance", "approval_code"]},
                {"type": "state_update", "action": "calendar_sync_out_of_office", "input_keys": ["employee_id", "start_date", "days_count"], "output_keys": ["ooo_event_id"]},
                {"type": "llm_decision", "action": "send_leave_confirmation", "input_keys": ["employee_id", "approval_code"], "output_keys": ["confirmation_receipt"]},
            ],
        }
    ],
    "research_assistant": [
        {
            "scenario": "literature_synthesis",
            "entities": {"topics": ["Quantum Error Correction", "Transformer KV Cache Compression", "Reinforcement Learning from Human Feedback"], "journals": ["arXiv", "Nature", "IEEE"]},
            "steps": [
                {"type": "llm_decision", "action": "formulate_search_keywords", "input_keys": ["research_query"], "output_keys": ["keywords", "inclusion_criteria", "min_year"]},
                {"type": "retrieval", "action": "query_academic_index", "input_keys": ["keywords", "min_year"], "output_keys": ["paper_ids", "citation_counts"]},
                {"type": "tool_call", "action": "fetch_paper_abstracts", "input_keys": ["paper_ids"], "output_keys": ["abstract_texts", "author_institutions"]},
                {"type": "tool_call", "action": "extract_methodology_findings", "input_keys": ["abstract_texts"], "output_keys": ["benchmark_results", "comparative_table"]},
                {"type": "state_update", "action": "store_annotated_bibliography", "input_keys": ["comparative_table"], "output_keys": ["bibliography_id"]},
                {"type": "llm_decision", "action": "draft_literature_review", "input_keys": ["comparative_table"], "output_keys": ["synthesis_section"]},
            ],
        }
    ],
}
