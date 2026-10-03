# Black Box - worker setup

1. Neon: run `schema.sql` in the SQL editor, then create the read-only role (uncomment the
   CREATE ROLE block at the bottom of schema.sql, set a password).
2. `cd worker && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`
3. `cp .env.example .env` and fill in DATABASE_URL (direct), AGENT_RO_URL (agent_ro), ANTHROPIC_API_KEY.
4. `python smoke_test.py`   # no API key needed; must print ALL CHECKS PASSED
5. `python tasks.py`        # prints the task count and a few gold answers
6. `python agent.py`        # real LLM; runs 5 tasks and prints PASS/FAIL
