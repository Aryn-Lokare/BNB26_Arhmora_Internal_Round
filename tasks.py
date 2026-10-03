"""Task set with gold SQL. Ground truth is computed from the database, never hand-typed."""
import itertools
import re

import psycopg

import config

DEPTS = ["Engineering", "Sales", "HR", "Marketing"]
PROJECTS = ["Atlas", "Beacon", "Comet", "Delta", "Ember"]


def _build():
    t = []
    for fn, word in [("MAX", "highest"), ("MIN", "lowest")]:
        t.append((f"What is the {word} department budget?",
                  f"SELECT {fn}(budget) FROM departments"))
    for d in DEPTS:
        t.append((f"What is the average salary in the {d} department?",
                  f"SELECT AVG(e.salary) FROM employees e JOIN departments d ON e.dept_id=d.id WHERE d.name='{d}'"))
        t.append((f"How many employees work in the {d} department?",
                  f"SELECT COUNT(*) FROM employees e JOIN departments d ON e.dept_id=d.id WHERE d.name='{d}'"))
        t.append((f"What is the highest salary in the {d} department?",
                  f"SELECT MAX(e.salary) FROM employees e JOIN departments d ON e.dept_id=d.id WHERE d.name='{d}'"))
        for status in ("active", "done"):
            t.append((f"How many {status} projects does the {d} department have?",
                      f"SELECT COUNT(*) FROM projects p JOIN departments d ON p.dept_id=d.id "
                      f"WHERE d.name='{d}' AND p.status='{status}'"))
        for pct in (10, 15, 20):
            t.append((f"What is {pct}% of the {d} department's budget?",
                      f"SELECT budget*{pct}/100.0 FROM departments WHERE name='{d}'"))
    for y in (2018, 2019, 2020, 2021, 2022):
        t.append((f"What is the total salary of employees hired after {y}-12-31?",
                  f"SELECT SUM(salary) FROM employees WHERE hire_date > '{y}-12-31'"))
        t.append((f"How many employees were hired before {y}-01-01?",
                  f"SELECT COUNT(*) FROM employees WHERE hire_date < '{y}-01-01'"))
    for a, b in itertools.combinations(DEPTS, 2):
        t.append((f"How much higher is the average salary in {a} than in {b}? (negative if lower)",
                  f"SELECT (SELECT AVG(e.salary) FROM employees e JOIN departments d ON e.dept_id=d.id WHERE d.name='{a}') - "
                  f"(SELECT AVG(e.salary) FROM employees e JOIN departments d ON e.dept_id=d.id WHERE d.name='{b}')"))
    for p in PROJECTS:
        t.append((f"What is the salary of the lead of project {p}?",
                  f"SELECT e.salary FROM projects p JOIN employees e ON p.lead_id=e.id WHERE p.name='{p}'"))
        t.append((f"What is the budget of the department that owns project {p}?",
                  f"SELECT d.budget FROM projects p JOIN departments d ON p.dept_id=d.id WHERE p.name='{p}'"))
    t.append(("What is the total budget of departments that have at least one active project?",
              "SELECT SUM(budget) FROM departments WHERE id IN (SELECT dept_id FROM projects WHERE status='active')"))
    t.append(("What is the average salary of project leads?",
              "SELECT AVG(e.salary) FROM employees e WHERE e.id IN (SELECT lead_id FROM projects)"))
    return t


TASKS = _build()   # list of (question, gold_sql)


def gold_answer(gold_sql: str) -> float:
    with psycopg.connect(config.agent_ro_url()) as conn:
        conn.execute("SET LOCAL search_path TO company")
        return float(conn.execute(gold_sql).fetchone()[0])


def check(answer: str, gold) -> bool:
    """True if any number in the answer matches the gold value within a small tolerance."""
    text = (answer or "").replace(",", "")
    for n in re.findall(r"-?\d+\.?\d*", text):
        try:
            if abs(float(n) - float(gold)) <= max(0.01, 1e-4 * abs(float(gold))):
                return True
        except ValueError:
            continue
    return False


if __name__ == "__main__":
    print(len(TASKS), "tasks")
    for q, g in TASKS[:5]:
        print(q, "->", gold_answer(g))
