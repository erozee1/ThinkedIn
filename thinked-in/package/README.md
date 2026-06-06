# @mubit-ai/sdk

Canonical JavaScript SDK for MuBit. Durable memory + continual learning for AI agents.

**Full documentation:** https://docs.mubit.ai

## Install

```bash
npm install @mubit-ai/sdk
```

## Quickstart

```js
import { Client } from "@mubit-ai/sdk";

const client = new Client({
  transport: process.env.MUBIT_TRANSPORT ?? "auto",
  run_id: "sdk-js-demo",
  api_key: process.env.MUBIT_API_KEY,
});

await client.remember({
  session_id: "sdk-js-demo",
  agent_id: "sdk-quickstart",
  content: "Cache invalidation failures usually show up after stale token reuse.",
  intent: "lesson",
  lesson_type: "failure",
  lesson_scope: "session",
});

const answer = await client.recall({
  session_id: "sdk-js-demo",
  query: "What should I watch for before retrying auth?",
  entry_types: ["lesson", "rule"],
});
console.log(answer.final_answer);
```

## Surface model

The SDK exposes two layers:

1. **`@mubit-ai/sdk/learn`** — zero-config LLM instrumentation (auto-ingest + auto-inject + auto-reflect).
2. **Flat client surface** — every control-plane operation lives directly on `Client`. High-level helpers (`remember`, `recall`, `getContext`, `checkpoint`, `reflect`, `recordOutcome`, `recordStepOutcome`, `archive`, `dereference`, `memoryHealth`, `diagnose`, `registerAgent`, `listAgents`, `handoff`, `feedback`, `surfaceStrategies`, `forget`) are richer wrappers that resolve `session_id` and set sensible defaults; all other ops are called as `client.<op>({...})`.

Admin and low-level storage ops still live under `client.auth.*` and `client.core.*` for clarity.

Helper APIs accept `session_id` as the ergonomic alias for `run_id`.

## Managed MuBit resources

For teams and hosted deployments, configure agents declaratively as **Projects** + **Agent Cards** with versioned prompts and skills. See [Projects, Agents, Skills, Prompts](https://docs.mubit.ai/sdk/projects-and-agents).

### Projects

```js
const { project } = await client.createProject({
  name: "triage-demo",
  description: "Customer-support triage pilot",
});
const projectId = project.project_id;

const { projects } = await client.listProjects({});
```

### Agent Definitions

```js
await client.createAgentDefinition({
  project_id: projectId,
  agent_id: "triage",
  role: "customer triage agent",
  system_prompt_content: "You are a concise, empathetic triage agent...",
});
```

### Prompt version lifecycle

Every agent has exactly one `active` prompt version and any number of `candidate` versions awaiting review.

```js
// Manual edit — activates immediately.
await client.setPrompt({ agent_id: "triage", content: "...", activate: true });

// Ask the control plane to propose a candidate from recent outcomes.
const resp = await client.optimizePrompt({
  agent_id: "triage",
  project_id: projectId,
});
const candidate = resp.candidate;

// Diff + approve.
const diff = await client.getPromptDiff({
  agent_id: "triage",
  version_a_id: activeVersionId,
  version_b_id: candidate.version_id,
});
await client.activatePromptVersion({
  agent_id: "triage",
  version_id: candidate.version_id,
});
```

See [Prompt Optimization Lifecycle](https://docs.mubit.ai/recipes/prompt-optimization) for the full capture → optimize → review → activate workflow.

### Skills

Same shape as prompts — `createSkill`, `optimizeSkill`, `activateSkillVersion`, `getSkillDiff`.

## Learning loop

```js
await client.registerAgent({
  session_id: "sdk-js-demo",
  agent_id: "planner",
  role: "planner",
  read_scopes: ["rule", "lesson", "fact"],
  write_scopes: ["lesson", "trace"],
  shared_memory_lanes: ["knowledge", "history"],
});

await client.checkpoint({
  session_id: "sdk-js-demo",
  label: "pre-compaction-1",
  context_snapshot: "Planner narrowed the failure to token refresh ordering.",
});

await client.recordStepOutcome({
  session_id: "sdk-js-demo",
  step_id: "2026-04-17-route",
  step_name: "routing",
  outcome: "partial",
  signal: 0.3,
  rationale: "Routed to billing but should have gone to compliance",
  directive_hint: "Check billing AND compliance scopes before routing",
});

const strategies = await client.surfaceStrategies({
  session_id: "sdk-js-demo",
  lesson_types: ["success", "failure"],
  max_strategies: 3,
});
```

## Exact references

```js
const archived = await client.archive({
  session_id: "sdk-js-demo",
  artifact_kind: "patch_fragment",
  content: "--- a/query.py\n+++ b/query.py\n@@ ...",
  labels: ["django", "retry"],
  family: "patch-repair",
});

const exact = await client.dereference({
  session_id: "sdk-js-demo",
  reference_id: archived.reference_id,
});
```

## Endpoint resolution

`transport` defaults to `auto` (gRPC primary, HTTP fallback). Resolution order:

1. Explicit `endpoint` / `http_endpoint` / `grpc_endpoint` config fields.
2. Env vars `MUBIT_ENDPOINT`, `MUBIT_HTTP_ENDPOINT`, `MUBIT_GRPC_ENDPOINT`.
3. Shared defaults `https://api.mubit.ai` and `grpc.api.mubit.ai:443`.

See [SDK Configuration](https://docs.mubit.ai/sdk/sdk-configuration) for full details.

## Examples

Public adoption scenarios:

```bash
node sdk/javascript/mubit-sdk/examples/public/run_public_examples.mjs --list
node sdk/javascript/mubit-sdk/examples/public/run_public_examples.mjs --scenario 01_remember_recall
node sdk/javascript/mubit-sdk/examples/public/run_public_examples.mjs --scenario 15_prompt_versioning
```

Internal raw-smoke scenarios remain available for wire-level verification:

```bash
node sdk/javascript/mubit-sdk/examples/internal/run_internal_examples.mjs --list
```

## Related

- **Full documentation:** https://docs.mubit.ai
- **SDK methods reference:** https://docs.mubit.ai/sdk/sdk-methods
- **API reference (HTTP + gRPC):** https://docs.mubit.ai/api-reference/control-http
- **GitHub:** https://github.com/mubit-ai/ricedb
