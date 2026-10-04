<p align="center">
  <img src="./logo.jpg" alt="Black Box Logo" width="128" height="128" style="border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.15);" />
</p>

<h1 align="center">Black Box</h1>
<p align="center">
  <strong>A Flight Recorder for AI Agents</strong>
</p>

<p align="center">
  <em>Deterministic execution recording, root-cause failure localization, state-rewind counterfactual replay, and differential trace verification for compound AI systems.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16.3.8-black?style=flat-square&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19-blue?style=flat-square&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/Python-3.12%2B-blue?style=flat-square&logo=python" alt="Python" />
  <img src="https://img.shields.io/badge/LangGraph-Checkpointer-orange?style=flat-square" alt="LangGraph" />
  <img src="https://img.shields.io/badge/Database-Neon%20Postgres-36C5F0?style=flat-square&logo=postgresql" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Protocol-Model%20Context%20Protocol%20(MCP)-purple?style=flat-square" alt="MCP" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" />
</p>

---

## Overview

AI agents solve tasks through complex chains of model calls, tool executions, retrieved context, and dynamic state mutations. A flight can execute dozens of valid steps and still fail due to a single inverted condition, wrong tool argument, or hallucinated schema early in the chain.

Standard tracing shows **what happened**, but not **which step was responsible**.

**Black Box** is an end-to-end debugging suite and flight recorder that:
1. **Records** full agent trajectories, intermediate state snapshots, tool I/O, and checkpoint frames.
2. **Diagnoses** the probable root-cause failure step using feature-based localization instead of relying on the final symptom crash.
3. **Rewinds** agent execution directly from persisted checkpoints with zero re-computation costs.
4. **Patches** state or tool arguments counterfactually to test hypotheses.
5. **Verifies** the repair through step-aligned differential trace comparison.

---

## Tech Stack

### Frontend & Observability Studio
- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Turbopack)
- **UI Runtime**: [React 19](https://react.dev/)
- **Styling**: [TailwindCSS](https://tailwindcss.com/) with a custom dark/light engineering TUI palette
- **Component Primitives**: Lucide Icons, Framer Motion animations
- **TypeScript**: Strict typing across run models, diff schemas, and replay jobs
- **Responsiveness**: Fully responsive desktop and mobile views with adaptive layout drawers

### Backend, Agent Engine & Data
- **Language**: Python 3.12+
- **Agent Orchestration**: [LangGraph](https://github.com/langchain-ai/langgraph) / LangChain with native state checkpointers
- **LLM Providers**: Groq (`openai/gpt-oss-120b`), OpenAI, Anthropic
- **Storage & Telemetry**: [Neon Serverless PostgreSQL](https://neon.tech/) with pooled connections and read-only roles
- **Diagnostics**: Per-step anomaly scoring, feature extraction, and root cause classification
- **Integration**: [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server (`mcp_server.py`) over stdio JSON-RPC

---

## Architecture Diagram

```mermaid
flowchart TD
    subgraph S1["1. Agent Runtime and Tracing"]
        UserTask["User Task or Query"] --> Agent["LangGraph SQL Agent"]
        Agent --> PlanNode["Plan Node"]
        PlanNode --> ToolNode["Tool Execution: run_sql"]
        ToolNode --> ReflectNode["Reflect Node"]
        ReflectNode --> AnswerNode["Answer Node"]
    end

    subgraph S2["2. State and Checkpoint Persistence"]
        Agent -.-> Checkpointer["LangGraph Postgres Checkpointer"]
        ToolNode -.-> DeltaExtractor["State and I/O Delta Extractor"]
        Checkpointer --> NeonDB[("Neon PostgreSQL<br/>runs, steps, checkpoints")]
        DeltaExtractor --> NeonDB
    end

    subgraph S3["3. Root-Cause Localization Engine"]
        NeonDB --> AnomalyScorer["Anomaly Scorer and Classifier"]
        AnomalyScorer --> RootCause["Predicted Culprit Step<br/>Step 2: select_tool (P=0.94)"]
    end

    subgraph S4["4. Time Machine Replay and Patch Simulator"]
        RootCause --> ForkPoint["Checkpoint Fork Selector (Step 2)"]
        ForkPoint --> PatchInjector["Counterfactual Patch Injector"]
        NeonDB -->|Reused Steps: 0 ms, 0 Tokens| PatchInjector
        PatchInjector --> ReplayExec["Deterministic Replay Execution"]
        ReplayExec --> VerifiedRun["Counterfactual Replayed Run"]
    end

    subgraph S5["5. Presentation and Tooling Layer"]
        NeonDB --> WebStudio["Black Box Web Studio<br/>Next.js 16 UI"]
        VerifiedRun --> TraceDiff["Step-Aligned Differential Diff View"]
        WebStudio --> DevUser["AI Engineer / Developer"]
        NeonDB --> MCPServer["Black Box MCP Server<br/>mcp_server.py"]
        MCPServer --> AIClient["MCP Clients: Claude, Cursor, IDEs"]
    end
```

---

## Continuous Debugging Pipeline

| Stage | Operation | What Black Box Does |
|---|---|---|
| **01. Trace** | Execution Flight Recording | Captures inputs, outputs, errors, latencies, state snapshots, and checkpoint IDs for every node step. |
| **02. Diagnose** | Root-Cause Localization | Ranks execution frames by failure probability, highlighting where logic inverted before downstream corruption. |
| **03. Rewind** | Zero-Cost Checkpoint Restore | Restores execution state immediately prior to the culprit step without re-running earlier steps. |
| **04. Patch** | Counterfactual State Injection | Modifies tool parameters, schema constraints, or state variables in an interactive studio editor. |
| **05. Replay** | Deterministic Flight Forking | Reruns only subsequent graph nodes from the fork point, recording compute and token savings. |
| **06. Verify** | Differential Trace Diff | Renders a step-aligned comparison demonstrating whether the repair flipped the outcome to passed. |

---

## How to Clone and Run Locally

### Prerequisites
- **Node.js**: v20+ (recommended v22+)
- **npm** or **pnpm**
- **Python**: v3.12+ with `pip`
- **Git**
- A **Neon PostgreSQL** database (or standard Postgres instance)
- A **Groq**, **OpenAI**, or **Anthropic** API Key

---

### Step 1: Clone the Repository

```bash
git clone https://github.com/hardika05/BNB26_Arhmora_Internal_Round.git
cd BNB26_Arhmora_Internal_Round
```

---

### Step 2: Configure Environment Variables

Create your `.env` file in the root directory:

```bash
cp .env.example .env
```

Configure your connection strings and API credentials in `.env`:

```env
# Neon PostgreSQL direct connection string
DATABASE_URL=postgresql://user:password@ep-host-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require

# Read-only role connection string for safe SQL execution
AGENT_RO_URL=postgresql://agent_ro:password@ep-host-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require

# LLM Provider Configuration
LLM_PROVIDER=groq
GROQ_API_KEY=gsk_your_groq_api_key_here
MODEL=openai/gpt-oss-120b
```

---

### Step 3: Setup Backend & Run Smoke Tests

1. Create and activate a Python virtual environment:

```bash
python -m venv .venv

# On Windows (PowerShell):
.venv\Scripts\Activate.ps1

# On macOS/Linux:
source .venv/bin/activate
```

2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Run smoke tests (validates database connection and dependencies without making LLM calls):

```bash
python smoke_test.py
```
*Expected output: `ALL CHECKS PASSED`*

4. Run the test agent:

```bash
python agent.py
```

---

### Step 4: Run the Black Box Frontend

1. Navigate to the frontend directory:

```bash
cd frontend/blackbox
```

2. Install npm dependencies:

```bash
npm install
```

3. Start the local development server:

```bash
npm run dev
```

4. Open your browser and navigate to:
```
http://localhost:3000
```

To validate production builds:
```bash
npm run build
```

---

### Step 5: Connecting via Model Context Protocol (MCP)

Black Box includes a built-in MCP server (`mcp_server.py`) exposing diagnostic and replay capabilities directly to AI assistants (Claude Desktop, Cursor, etc.).

Start the server directly:
```bash
python mcp_server.py
```

Or configure it in your client's `mcp_config.json`:

```json
{
  "mcpServers": {
    "blackbox": {
      "command": "python",
      "args": ["mcp_server.py"],
      "cwd": "path/to/blackbox-worker",
      "env": {
        "PYTHONUNBUFFERED": "1"
      }
    }
  }
}
```

#### Exposed MCP Tools:
- `record_step`: Programmatically stream step execution states (nodes, inputs, outputs, state deltas, latency).
- `diagnose_failure`: Run root-cause localizer on a failed run with calibrated confidence and suspect step.
- `simulate_counterfactual_patch`: Fork at a checkpoint, inject a patch, and verify if the failure is resolved.
- `get_run_trace`: Fetch sequential step execution trace and checkpoint IDs.
- `list_runs`: List recorded runs with execution metadata and outcomes.

### Building Your Own Agent with Black Box MCP

Black Box can be used with **any agent framework** (LangGraph, CrewAI, AutoGen, or a custom Python loop) to provide flight recording, failure diagnosis, and self-healing:

```python
import time
import uuid

# 1. Connect to Black Box MCP Server
# (via JSON-RPC stdio or standard MCP client SDK)
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

# 2. Instrument Your Agent's Step Loop
def execute_agent_step(run_id, step_idx, node_name, action, input_data, state_before):
    t0 = time.time()
    try:
        output_data = call_your_llm_or_tool(node_name, input_data)
        state_after = {**state_before, "last_result": output_data}
        
        # Stream step to Black Box
        mcp_session.call_tool("record_step", {
            "run_id": run_id,
            "step_idx": step_idx,
            "node": node_name,
            "step_type": "tool_call",
            "action": action,
            "input": input_data,
            "output": output_data,
            "state_before": state_before,
            "state_after": state_after,
            "latency_ms": int((time.time() - t0) * 1000),
            "checkpoint_id": f"cp_{step_idx:02d}",
            "status": "success",
        })
        return output_data, state_after
    except Exception as exc:
        # Record failed step
        mcp_session.call_tool("record_step", {
            "run_id": run_id,
            "step_idx": step_idx,
            "node": node_name,
            "action": action,
            "input": input_data,
            "status": "failed",
            "error": str(exc),
            "latency_ms": int((time.time() - t0) * 1000),
            "checkpoint_id": f"cp_{step_idx:02d}",
        })
        
        # 3. Auto-Diagnose Root Cause Using Transformer
        diagnosis = mcp_session.call_tool("diagnose_failure", {
            "run_id": run_id,
            "top_k": 3
        })
        print(f"Root cause culprit: {diagnosis['root_cause_suspect']}")
        print(f"Confidence: {diagnosis['calibrated_confidence'] * 100:.1f}%")
        
        # 4. Test a Counterfactual Patch Before Retrying
        fork_step = diagnosis["top_candidates"][0]["step_number"]
        sim = mcp_session.call_tool("simulate_counterfactual_patch", {
            "run_id": run_id,
            "forked_at_step": fork_step,
            "patch": {"input": {"fixed_argument": "corrected_value"}},
        })
        if sim.get("diagnosis_confirmed"):
            print(f"Counterfactual fix verified! Saved {sim['compute_saved_pct']}% compute.")
        raise exc
```

---

## Repository Structure

```
.
├── logo.jpg                         # Official Black Box Logo
├── schema.sql                       # PostgreSQL schema (runs, steps, checkpoints)
├── smoke_test.py                    # Environment and database connectivity test
├── tasks.py                         # Evaluation benchmark dataset tasks
├── agent.py                         # LangGraph SQL test agent
├── recorder.py                      # Continuous execution tracing & state deltas
├── replay.py                        # Deterministic checkpoint rewind engine
├── mcp_server.py                    # Model Context Protocol server
├── requirements.txt                 # Python dependencies
│
└── frontend/blackbox/               # Next.js Web Studio
    ├── app/
    │   ├── page.tsx                 # Landing page
    │   ├── dashboard/page.tsx       # Agent telemetry overview & stats
    │   ├── runs/page.tsx            # Execution run history & filters
    │   ├── runs/[id]/page.tsx       # 4-stage Continuous Debugging Studio
    │   ├── docs/page.tsx            # MCP integration documentation
    │   └── api/                     # Next.js API route handlers
    ├── components/
    │   ├── trace/                   # Execution timeline component
    │   ├── diagnosis/               # Root cause localization panel
    │   ├── replay/                  # State rewind & patch injection studio
    │   ├── comparison/              # Step-aligned differential trace diff
    │   ├── layout/                  # Responsive Navbar and Footer
    │   └── ui/                      # ASCII badges and code display
    └── services/api.ts              # Resilient client service layer
```

---

## Contributing & License

Contributions are welcome! Please submit issues or pull requests. Black Box is licensed under the [MIT License](LICENSE).
