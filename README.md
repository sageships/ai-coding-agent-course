# Build Your Own AI Coding Agent From Scratch

> A comprehensive 6-7 hour course on how tools like Cursor, Claude Code, and Aider actually work under the hood — and how to build your own.

![Course Duration](https://img.shields.io/badge/Duration-7%20Hours-blue)
![Modules](https://img.shields.io/badge/Modules-8-green)
![Videos](https://img.shields.io/badge/Videos-40-orange)

## 🎯 What You'll Learn

This isn't just "how to use Cursor" — it's **how to BUILD Cursor**.

- The architecture that makes AI coding tools work
- Specific techniques that make LLMs good at coding
- How to implement each component yourself
- Why certain design decisions matter

By the end, you'll have built a working AI coding agent and understand exactly how professional tools work.

## 📚 Course Modules

| Module | Duration | Topics |
|--------|----------|--------|
| 1. Foundations | 45 min | LLM coding capabilities, agent architecture, setup |
| 2. Tool System | 60 min | Function calling, tool design, agent loop |
| 3. Code Context | 75 min | Tree-sitter, repo maps, embeddings, selection |
| 4. Edit Formats | 60 min | Diffs, search/replace, error handling |
| 5. Agent Loop | 60 min | Planning, reflection, orchestration |
| 6. Advanced Features | 50 min | Git, LSP, testing, web browsing |
| 7. Production | 45 min | Security, cost optimization, UX |
| 8. Final Project | 45 min | Building & deploying your agent |

**Total: ~7 hours**

## 🔑 Key Differentiators

1. **From research, not tutorials** — Based on Anthropic's agent research, Aider's implementation, actual tool architectures

2. **Build, don't just use** — Every concept has working code

3. **Production-grade** — Security, cost, UX considerations included

4. **The hard problems** — Context management, edit formats, error recovery — the stuff that makes real tools work

## 📁 Repository Structure

```
ai-coding-agent-course/
├── COURSE-OUTLINE.md      # Master roadmap with all video scripts
├── README.md              # This file
│
├── modules/               # Detailed course content
│   ├── MODULE-1-FOUNDATIONS.md   # LLM basics, architecture overview
│   ├── MODULE-2-TOOL-SYSTEM.md   # Function calling, tool design
│   ├── MODULE-3-CODE-CONTEXT.md  # Repo maps, embeddings, file selection
│   ├── MODULE-4-EDIT-FORMATS.md  # Diffs, search/replace, applying changes
│   ├── MODULE-5-AGENT-LOOP.md    # The think-act-observe loop
│   ├── MODULE-6-ADVANCED.md      # Git, LSP, testing integration
│   ├── MODULE-7-PRODUCTION.md    # Security, cost, UX
│   └── MODULE-8-FINAL-PROJECT.md # Building the complete agent
│
├── code-examples/         # Runnable demos for each module
│   ├── 01-foundations/    # Basic LLM API calls
│   ├── 02-tools/          # Tool implementation examples
│   ├── 03-context/        # Repo mapping and file selection
│   ├── 04-edits/          # Edit format parsers
│   ├── 05-agent-loop/     # Complete agent loop
│   ├── package.json       # Shared dependencies
│   └── README.md          # How to run the demos
│
└── assets/                # Diagrams and visuals (coming soon)
```

### Why Modules?

The course is organized into **8 progressive modules** because:

1. **Each builds on the previous** — You can't understand context selection (Module 3) without knowing what tools are (Module 2). The agent loop (Module 5) combines everything.

2. **Maps to video sessions** — Each module = 45-75 min of video content, broken into 3-5 videos of ~10-15 min each. Digestible chunks.

3. **Reference-friendly** — Already understand tools? Jump straight to Module 3. Each module is self-contained with its theory, code, and exercises.

4. **Code alignment** — `modules/MODULE-3-CODE-CONTEXT.md` has the theory → `code-examples/03-context/` has the runnable demo.

### How Deep Do We Go?

Each module has two layers:

| Layer | What It Covers | Where |
|-------|---------------|-------|
| **Conceptual** | High-level "what and why" | `modules/MODULE-X.md` |
| **Mechanical** | Algorithm details, step-by-step "how" | `code-examples/0X-*/CONCEPT.md` |

For example, Module 3 (Code Context):
- **Conceptual**: "We use tree-sitter to parse code and extract symbols"
- **Mechanical**: "Tree-sitter generates an AST. We traverse it with a cursor, matching node types like `function_declaration`. Here's the exact query..."

## 🛠 Prerequisites

- JavaScript/TypeScript basics
- Familiarity with APIs
- Node.js installed
- OpenAI or Anthropic API key

## 📖 How to Use This Course

1. **Read the course outline** (`COURSE-OUTLINE.md`) for the full roadmap
2. **Go through modules in order** — each builds on the previous
3. **Follow along with code** — each module has implementation examples
4. **Build the final project** — put everything together

## 🎬 For Content Creators

Each module includes:
- Complete video scripts with timestamps
- Talking points and key visuals
- Code examples ready to show
- Estimated durations

Perfect for creating YouTube courses or educational content.

## 📚 Research Sources

This course is built on research from:

- [Anthropic's "Building Effective Agents"](https://www.anthropic.com/engineering/building-effective-agents)
- [Aider's Repository Map](https://aider.chat/2023/10/22/repomap.html)
- [Lilian Weng's LLM Agents](https://lilianweng.github.io/posts/2023-06-23-agent/)
- OpenAI Function Calling documentation
- Claude Code architecture

## 🤝 Contributing

Found an error? Have a suggestion? PRs welcome!

## 📄 License

MIT License - use this content however you want.

---

**Created by Aaveg Gupta** | [YouTube](https://youtube.com/@aavegcodes) | [Twitter](https://twitter.com/mystikalgorithm)
