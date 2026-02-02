# 🎓 Code Examples

Runnable demos for each course module. Each folder has:
- **CONCEPT.md** — Theory, diagrams, the WHY behind it
- **demo.ts** — Clean, runnable code showing it in action

## Quick Start

```bash
cd code-examples
npm install
export ANTHROPIC_API_KEY=your-key   # or OPENAI_API_KEY

# Run any module's demo
npm run demo:01   # Foundations - basic LLM calls
npm run demo:02   # Tools - function calling
npm run demo:03   # Context - repo mapping
npm run demo:05   # Agent Loop - complete agent
```

## What Each Demo Shows

| Module | Demo | What You'll See |
|--------|------|-----------------|
| **01-foundations** | Basic LLM calls | Streaming responses, token counting, error handling |
| **02-tools** | Tool system | Function calling, tool execution, multi-tool responses |
| **03-context** | Repo mapping | Scanning a codebase, extracting symbols, relevance scoring |
| **04-edits** | Edit formats | Parsing diffs, search/replace blocks, applying changes |
| **05-agent-loop** | Complete agent | Full think-act-observe loop, working coding agent |

## Folder Structure

```
01-foundations/
├── CONCEPT.md    ← Theory: how LLMs work, context windows, tokens
└── demo.ts       ← Code: streaming API calls, retry logic

02-tools/
├── CONCEPT.md    ← Theory: function calling, tool design principles
└── demo.ts       ← Code: read_file, write_file, run_command tools

03-context/
├── CONCEPT.md    ← Theory: repo maps, embeddings, file selection
└── demo.ts       ← Code: tree-sitter parsing, relevance scoring

04-edits/
├── CONCEPT.md    ← Theory: diff formats, why JSON fails for code
└── demo.ts       ← Code: unified diff parser, search/replace

05-agent-loop/
├── CONCEPT.md    ← Theory: ReAct pattern, orchestration
└── demo.ts       ← Code: complete working agent

package.json      ← Shared dependencies for all demos
```

## For Video Recording

Each file has markers to help with recording:

```typescript
// 📺 SHOW THIS — Good for explaining on screen
// ▶️ RUN THIS — Good demo to run live
// 💡 KEY INSIGHT — Important concept to highlight
```

**Workflow:**
1. Open `CONCEPT.md`, walk through the diagrams
2. Switch to `demo.ts`, explain the code structure
3. Run the demo, show real output
4. Point out key insights

## Tech Stack

- **AI SDK** (Vercel) — Clean, unified API for LLM calls
- **@ai-sdk/anthropic** — Claude integration
- **@ai-sdk/openai** — OpenAI integration (optional)
- **Zod** — Schema validation for tool definitions
- **tree-sitter** — Code parsing (Module 3)

## Tips

1. **Start with CONCEPT.md** — Always read theory before code
2. **Run on a real project** — `npm run demo:03 /path/to/project`
3. **Check token counts** — Watch how context affects costs
4. **Modify and experiment** — These are starting points, not finished products
