# Build Your Own AI Coding Agent From Scratch

> A comprehensive 6-7 hour course on how tools like Cursor, Claude Code, and Aider actually work under the hood — and how to build your own.

**Target Audience:** Developers who want to understand (and build) AI-powered coding tools
**Duration:** 6-7 hours (40 videos, ~10 min each)
**Prerequisites:** JavaScript/TypeScript basics, familiarity with APIs

---

## Course Philosophy

This isn't just "how to use Cursor" — it's **how to BUILD Cursor**.

You'll understand:
- The architecture that makes these tools work
- The specific techniques that make LLMs good at coding
- How to implement each component yourself
- Why certain design decisions matter

By the end, you'll have built a working AI coding agent.

---

## Module 1: Foundations — How LLMs Actually Code (45 min)

### 1.1 The Surprising Truth About AI Code Generation (10 min)
**Hook:** "Why can ChatGPT write a Fibonacci function but fails at editing your real codebase?"

**Key Points:**
- Self-contained vs. context-dependent coding
- The 3-step problem: Find → Understand → Change
- Why "just send the whole codebase" doesn't work
- Context window limits and their implications

**Script Notes:**
- Start with demo: Ask ChatGPT to write a simple function (works great)
- Then show it failing on a real codebase edit (no context)
- Introduce the core problem this course solves

### 1.2 Anatomy of an AI Coding Agent (12 min)
**Hook:** "Every AI coding tool — Cursor, Claude Code, Aider, Copilot — uses the same 4 components"

**Key Points:**
- The Augmented LLM concept (from Anthropic's research)
- The 4 pillars: Planning, Memory, Tools, Action
- How the agent loop works: Prompt → Think → Act → Observe → Repeat
- Difference between "workflows" (predefined) and "agents" (dynamic)

**Diagram to show:**
```
┌─────────────────────────────────────────┐
│              USER REQUEST               │
└─────────────────┬───────────────────────┘
                  ▼
┌─────────────────────────────────────────┐
│         PLANNING & REASONING            │
│   (Break down task, decide approach)    │
└─────────────────┬───────────────────────┘
                  ▼
┌─────────────────────────────────────────┐
│         TOOL SELECTION & USE            │
│  (Read files, search, run commands)     │
└─────────────────┬───────────────────────┘
                  ▼
┌─────────────────────────────────────────┐
│           CODE GENERATION               │
│   (Write/edit code based on context)    │
└─────────────────┬───────────────────────┘
                  ▼
┌─────────────────────────────────────────┐
│         VERIFICATION & FEEDBACK         │
│    (Run tests, check errors, iterate)   │
└─────────────────────────────────────────┘
```

### 1.3 Setting Up Your Development Environment (10 min)
**Key Points:**
- Node.js + TypeScript setup
- OpenAI/Anthropic API keys
- Project structure we'll use throughout
- Installing dependencies (openai, anthropic, tree-sitter, etc.)

**Code deliverable:** Starter project template

### 1.4 Your First LLM API Call (13 min)
**Key Points:**
- Making basic completion requests
- Understanding tokens and context windows
- Streaming responses
- Error handling and retries
- Cost optimization basics

**Code deliverable:** Basic chat completion wrapper

---

## Module 2: The Tool System — Giving LLMs Superpowers (60 min)

### 2.1 What Are Tools/Functions? (10 min)
**Hook:** "Tools are how LLMs go from 'I can tell you about code' to 'I can actually change code'"

**Key Points:**
- Tools = structured ways for LLM to request actions
- JSON Schema for defining tool interfaces
- The tool calling flow: Request → LLM decides → Execute → Return result
- Why this is better than asking LLM to output commands

**Diagram:**
```
User: "What's the weather in Paris?"
        ↓
LLM: "I need to call get_weather(location='Paris')"
        ↓
Your Code: Actually fetches weather
        ↓
LLM: "The weather in Paris is 15°C and sunny"
```

### 2.2 Implementing Core Coding Tools (15 min)
**Key Points:**
- read_file — Read file contents
- write_file — Create/overwrite files
- edit_file — Make surgical edits (the hard one!)
- list_directory — Explore file structure
- run_command — Execute shell commands

**Code deliverable:** Complete tool implementations

### 2.3 The Art of Tool Design (12 min)
**Hook:** "Anthropic spent more time on tool design than prompt engineering for their SWE-bench agent"

**Key Points:**
- Clear descriptions that tell LLM WHEN to use each tool
- Parameter design: types, enums, required vs optional
- The "intern test" — could a junior dev use this correctly?
- Poka-yoke: make it hard to use tools incorrectly
- Example: absolute vs relative paths

**Case study:** How Claude Code's edit tool evolved

### 2.4 Handling Tool Calls in Your Agent Loop (12 min)
**Key Points:**
- Parsing tool call responses
- Executing tools safely
- Returning results to the LLM
- Handling errors gracefully
- Multi-tool calls in one response

**Code deliverable:** Complete agent loop with tool handling

### 2.5 Advanced: Parallel Tool Calls (11 min)
**Key Points:**
- When LLMs request multiple tools at once
- Dependency detection
- Parallel vs sequential execution
- Aggregating results

---

## Module 3: Code Context — The Secret Sauce (75 min)

### 3.1 Why Context is Everything (8 min)
**Hook:** "The difference between a toy demo and a production tool is context management"

**Key Points:**
- Context window limits (128k tokens = ~300 pages)
- Why you can't just send everything
- The cost/latency of large contexts
- The Goldilocks problem: too little context = wrong code, too much = confused LLM

### 3.2 Building a Repository Map with Tree-Sitter (20 min)
**Hook:** "Aider's repo map is why it works on large codebases — let's build one"

**Key Points:**
- What is tree-sitter? (Parser used by VSCode, GitHub, etc.)
- Parsing code into AST
- Extracting symbols: functions, classes, methods
- Building a condensed map showing signatures only

**The repo map concept:**
```
src/auth/login.ts:
│ export class AuthService
│   constructor(private db: Database)
│   async login(email: string, password: string): Promise<User>
│   async logout(userId: string): void
│
src/api/routes.ts:
│ export function setupRoutes(app: Express, auth: AuthService)
│   app.post('/login', ...)
│   app.post('/logout', ...)
```

**Code deliverable:** Tree-sitter based repo mapper

### 3.3 Smart Context Selection with Graph Ranking (15 min)
**Key Points:**
- Files as nodes, imports/references as edges
- PageRank-style algorithm for importance
- Prioritizing files relevant to current task
- Dynamic budget allocation based on token limits

**Code deliverable:** Graph-based context ranker

### 3.4 Embeddings and Semantic Search (18 min)
**Key Points:**
- What are embeddings? (Code → vectors)
- Using OpenAI's embedding API
- Vector databases (Pinecone, Chroma, local options)
- Semantic search: "find code related to authentication"
- Combining keyword + semantic search

**Code deliverable:** Embedding-based code search

### 3.5 The Context Assembly Pipeline (14 min)
**Key Points:**
- Combining repo map + relevant files + user context
- Token counting and budget management
- Prompt caching for efficiency
- When to include full files vs summaries

**Code deliverable:** Context assembly module

---

## Module 4: Code Editing Formats — How LLMs Actually Edit (60 min)

### 4.1 The Edit Format Problem (10 min)
**Hook:** "JSON is terrible for code edits. Here's why — and what works better"

**Key Points:**
- The escaping nightmare: `print("hello")` in JSON
- Why function calling isn't ideal for code
- The "familiar format" principle
- What GPT has seen in training data

### 4.2 Search/Replace Blocks (12 min)
**Key Points:**
- Simple find-and-replace approach
- Exact matching requirements
- Handling whitespace sensitivity
- When this works well (small edits)
- When it fails (large changes)

**Format example:**
```
<<<<<<< SEARCH
def hello():
    print("Hello")
=======
def hello():
    print("Hello, World!")
>>>>>>> REPLACE
```

### 4.3 Unified Diffs — The Gold Standard (15 min)
**Hook:** "Aider's switch to unified diffs made GPT 3x less lazy"

**Key Points:**
- Why diffs are familiar to LLMs (git diff everywhere)
- The +/- line prefix system
- Skipping line numbers (LLMs are bad at them!)
- "High level diffs" — encouraging coherent blocks
- Flexible diff application for imperfect outputs

**Code deliverable:** Unified diff parser and applier

### 4.4 Whole File Rewrite (8 min)
**Key Points:**
- When to just replace the entire file
- Advantages: no parsing complexity
- Disadvantages: token cost, error risk
- Hybrid approaches

### 4.5 Handling Edit Failures Gracefully (15 min)
**Key Points:**
- Common failure modes (missing context, wrong indentation)
- Fuzzy matching strategies
- Retry mechanisms
- Asking LLM to fix its own mistakes
- Knowing when to give up

**Code deliverable:** Robust edit application module

---

## Module 5: The Agent Loop — Putting It All Together (60 min)

### 5.1 Designing the Conversation Flow (12 min)
**Key Points:**
- System prompt design for coding agents
- Message history management
- When to include tool results in history
- Truncation strategies for long conversations

### 5.2 Planning and Task Decomposition (15 min)
**Hook:** "Good agents don't just code — they plan first"

**Key Points:**
- Chain of Thought prompting for planning
- Breaking complex tasks into subtasks
- The orchestrator-worker pattern
- When to use multi-agent architectures

**Anthropic's workflow patterns:**
```
PROMPT CHAINING:  Task → Subtask 1 → Subtask 2 → Result
ROUTING:          Task → Classify → Route to specialist
PARALLEL:         Task → [Subtask A, Subtask B, Subtask C] → Merge
ORCHESTRATOR:     Task → Planner → [Workers] → Synthesizer
```

### 5.3 Self-Reflection and Error Recovery (12 min)
**Key Points:**
- ReAct pattern: Reason → Act → Observe
- Reflexion: learning from mistakes
- When to retry vs. ask for help
- Maintaining state across iterations

### 5.4 Building the Complete Agent Loop (12 min)
**Key Points:**
- The main loop structure
- Exit conditions (success, max iterations, user abort)
- Progress reporting
- Graceful degradation

**Code deliverable:** Complete agent loop implementation

### 5.5 Testing Your Agent (9 min)
**Key Points:**
- Unit tests for individual tools
- Integration tests for full workflows
- Benchmark datasets (SWE-bench, etc.)
- Evaluating quality: syntax correctness, test passage, human review

---

## Module 6: Advanced Features (50 min)

### 6.1 Git Integration (10 min)
**Key Points:**
- Auto-committing changes with good messages
- Using git for undo/recovery
- Working with branches for safety
- Showing diffs to users

**Code deliverable:** Git integration module

### 6.2 LSP Integration for Smart Completions (12 min)
**Key Points:**
- What is Language Server Protocol?
- Getting type information and definitions
- Using LSP for better context
- Go-to-definition for LLMs

### 6.3 Running and Fixing Tests (10 min)
**Key Points:**
- Test detection and execution
- Parsing test output
- Automatic fix attempts
- CI/CD integration

### 6.4 Web Browsing for Documentation (10 min)
**Key Points:**
- When LLMs need external docs
- Web scraping vs. API access
- Extracting relevant content
- RAG for documentation

### 6.5 Multi-File Operations (8 min)
**Key Points:**
- Coordinating changes across files
- Detecting side effects
- Rollback strategies
- Transaction-like operations

---

## Module 7: Production Considerations (45 min)

### 7.1 Security and Sandboxing (12 min)
**Hook:** "Your AI agent has shell access. What could possibly go wrong?"

**Key Points:**
- The risks of arbitrary code execution
- Sandboxing with Docker containers
- Allowlisting safe commands
- User confirmation for dangerous operations
- Never trust LLM output for security decisions

### 7.2 Cost Optimization (10 min)
**Key Points:**
- Token counting and budgeting
- Prompt caching strategies
- Model selection (GPT-4 vs Claude vs smaller models)
- When to use cheaper models
- Batching and parallel requests

### 7.3 Streaming and UX (10 min)
**Key Points:**
- Real-time response streaming
- Progress indicators for long operations
- Cancellation support
- Inline diff previews

### 7.4 Building a CLI Interface (8 min)
**Key Points:**
- Command structure and arguments
- Interactive vs. non-interactive modes
- Configuration files
- Keyboard shortcuts

**Code deliverable:** CLI wrapper

### 7.5 IDE Extension Basics (5 min)
**Key Points:**
- Overview of VSCode extension architecture
- Connecting your agent to an editor
- Resources for going further

---

## Module 8: Final Project — Your Complete AI Coding Agent (45 min)

### 8.1 Project Setup and Architecture Review (10 min)
**Key Points:**
- Final project structure
- Configuration options
- Customization points

### 8.2 Live Coding: Build Mode (15 min)
**Demo:** Build a complete feature from description

### 8.3 Live Coding: Debug Mode (10 min)
**Demo:** Find and fix a bug from error message

### 8.4 Deployment and Distribution (10 min)
**Key Points:**
- Packaging your agent
- npm publish basics
- Documentation
- What's next: extending your agent

---

## Bonus Content (30 min)

### B.1 How Cursor Works (10 min)
- Cursor's unique features
- Codebase embeddings
- Tab completions
- The Composer feature

### B.2 How Claude Code Works (10 min)
- MCP (Model Context Protocol)
- The tools Claude Code exposes
- GitHub Actions integration
- VS Code extension architecture

### B.3 How Aider Works (10 min)
- Edit formats comparison
- Repository mapping deep dive
- Voice coding feature
- The leaderboard and benchmarks

---

## Total Runtime

| Module | Duration |
|--------|----------|
| 1. Foundations | 45 min |
| 2. Tool System | 60 min |
| 3. Code Context | 75 min |
| 4. Edit Formats | 60 min |
| 5. Agent Loop | 60 min |
| 6. Advanced Features | 50 min |
| 7. Production | 45 min |
| 8. Final Project | 45 min |
| Bonus | 30 min |
| **Total** | **~7 hours** |

---

## Key Differentiators vs Other Courses

1. **From research, not tutorials** — Based on Anthropic's agent research, Aider's implementation, actual tool architectures

2. **Build, don't just use** — Every concept has a code deliverable

3. **Production-grade** — Security, cost, UX considerations included

4. **The hard problems** — Context management, edit formats, error recovery — the stuff that makes real tools work

5. **Your voice** — You've used these tools at a YC startup. You know what actually matters.

---

## Content Creation Order

**Recommended filming order:**

1. Module 1 (Foundations) — Sets up everything
2. Module 2 (Tools) — Exciting, tangible results fast
3. Module 5 (Agent Loop) — Complete working agent
4. Module 4 (Edit Formats) — Deep technical dive
5. Module 3 (Context) — The most complex module
6. Module 6-7 (Advanced + Production)
7. Module 8 (Final Project)
8. Bonus content

This order lets you release early modules while still developing later ones.
