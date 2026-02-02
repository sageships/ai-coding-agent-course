# 🎓 Code Examples

Each module has two files:
- **CONCEPT.md** — Theory, diagrams, the WHY
- **demo.ts** — Clean code to run and show

## Quick Start

```bash
cd code-examples
npm install
export ANTHROPIC_API_KEY=your-key
npm run demo:01   # Run Module 1 demo
```

## Structure

```
01-foundations/
├── CONCEPT.md    ← Read this first (explains the theory)
└── demo.ts       ← Run this (shows it working)

02-tools/
├── CONCEPT.md    ← Tool system explained
└── demo.ts       ← Agent loop in action

03-context/
├── CONCEPT.md    ← How LLMs "see" code
└── demo.ts       ← Repo mapping demo

05-agent-loop/
└── demo.ts       ← Complete working agent
```

## For Recording Videos

1. **First:** Open `CONCEPT.md`, explain diagrams
2. **Then:** Switch to `demo.ts`, run it
3. **Look for:** `📺 SHOW THIS` and `▶️ RUN THIS` markers in code

## Tech Stack

- **AI SDK** (Vercel) — Clean API for LLM calls
- **@ai-sdk/anthropic** — Claude integration
- **Zod** — Schema validation for tools
