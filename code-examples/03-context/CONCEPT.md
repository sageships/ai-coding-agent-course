# Module 3: Code Context — Conceptual Guide

## 🎯 The Problem We're Solving

LLMs have a context window limit (e.g., 128k tokens). Your codebase might be 200k+ tokens.

**You can't send everything. So what DO you send?**

---

## 🧠 The Key Insight

You don't need the entire codebase. You need:
1. A **map** of what exists (file names, function names)
2. The **specific files** relevant to the current task

Think of it like giving directions:
- ❌ Wrong: Hand someone a detailed map of the entire country
- ✅ Right: Give them an overview + detailed map of just their route

---

## 🗺️ What is a Repository Map?

A condensed overview of your codebase:

```
📁 src/
  📁 auth/
    📄 service.ts
       └─ class AuthService
       └─ function login()
       └─ function logout()
  📁 models/
    📄 user.ts
       └─ interface User
       └─ interface UserSettings
  📁 api/
    📄 routes.ts
       └─ function setupRoutes()
```

**What this gives the LLM:**
- Knows `AuthService` exists in `src/auth/service.ts`
- Knows the project has auth, models, and API layers
- Can ask for specific files when needed

**What this costs:** ~500-1000 tokens (instead of 200,000)

---

## 🌳 Under the Hood: Tree-Sitter and AST Parsing

### What is an AST?

An **Abstract Syntax Tree** is code represented as a tree structure:

```
Source:  function add(a, b) { return a + b; }

            program
               │
      function_declaration
         ┌────┼────┬─────────┐
     identifier  params     body
        "add"      │          │
              ┌────┴────┐   return_statement
           "a"        "b"        │
                          binary_expression
                           ┌─────┼─────┐
                          "a"   "+"   "b"
```

### How Tree-Sitter Works

```
STEP 1: Tokenization
─────────────────────────────────────────────────────
"function add(a, b) { return a + b; }"
      ↓
[FUNCTION] [IDENT:add] [LPAREN] [IDENT:a] [COMMA] [IDENT:b] [RPAREN] [LBRACE] ...

STEP 2: Parsing with Grammar Rules
─────────────────────────────────────────────────────
Grammar rule (from grammar.js):

function_declaration: $ => seq(
  'function',                           // literal keyword
  field('name', $.identifier),          // capture the name
  field('parameters', $.formal_params), // capture params
  field('body', $.statement_block)      // capture body
)

Parser matches tokens against these rules to build the tree.

STEP 3: Incremental Updates (the magic!)
─────────────────────────────────────────────────────
When you edit line 50, tree-sitter doesn't re-parse everything.
It tracks which parts of the tree are affected and only re-parses those.

Before: [========= valid tree =========]
Edit:   [=== unchanged ===][EDIT][=== unchanged ===]
Result: [=== reused ======][new][======= reused ===]

This is why it's FAST — used by GitHub, VSCode, Neovim.
```

### Tree-Sitter Query Language

To find symbols, we write queries in S-expression syntax:

```scheme
; Find all function declarations and capture their names
(function_declaration
  name: (identifier) @func.name) @func.def

; Find all class declarations  
(class_declaration
  name: (type_identifier) @class.name) @class.def

; Find all export statements
(export_statement) @export
```

The `@name` syntax **captures** that part of the match for us to use.

---

## 🔍 Under the Hood: How Context Selection ACTUALLY Works

This is the part most guides skip. Here's the real algorithm:

### Step 1: Build the Dependency Graph

```
ALGORITHM: BuildDependencyGraph
─────────────────────────────────────────────────────
INPUT:  list of files in project
OUTPUT: graph with nodes (files) and edges (imports)

FOR each file in project:
  content ← readFile(file)
  imports ← extractImportsFromAST(content)
  
  FOR each import in imports:
    resolved ← resolveImportPath(file, import)
    graph.addEdge(file → resolved)

Example result:
─────────────────────────────────────────────────────
nodes: [routes.ts, service.ts, user.ts, logger.ts]

edges (who imports whom):
  routes.ts  → [service.ts, logger.ts]
  service.ts → [user.ts]
  user.ts    → []
  logger.ts  → []

reverse edges (who is imported by whom):
  routes.ts  ← []
  service.ts ← [routes.ts]
  user.ts    ← [service.ts]
  logger.ts  ← [routes.ts]
```

### Step 2: Score Files with PageRank

PageRank insight: **A file is important if important files depend on it.**

```
ALGORITHM: PageRank for Code
─────────────────────────────────────────────────────
INPUT:  graph, seed files (from task), damping = 0.85
OUTPUT: score for each file

1. Initialize all scores to 1/N (equal probability)

2. Boost seed files (files mentioned in user's task)
   seed_files.forEach(f => scores[f] += 0.5)

3. Iterate 20 times:
   FOR each file F:
     new_score = (1 - damping) / N   // random jump
     
     // Add contribution from files that import F
     FOR each importer of F:
       contribution = damping × (scores[importer] / importer.import_count)
       new_score += contribution
     
     scores[F] = new_score

4. Return scores sorted descending

WORKED EXAMPLE:
─────────────────────────────────────────────────────
Files: [routes.ts, service.ts, user.ts]
Graph: routes → service → user
Seed: service.ts (user mentioned "login")

Initial:
  routes:  0.33
  service: 0.33 + 0.50 = 0.83  ← seed boost
  user:    0.33

Iteration 1:
  routes:  0.05 (base only, no importers)
  service: 0.05 + 0.85 × (0.33/2) = 0.19
  user:    0.05 + 0.85 × (0.83/1) = 0.76  ← inherits from service!

Final ranking:
  1. user.ts    (0.76) ← highest because service imports it
  2. service.ts (0.19)
  3. routes.ts  (0.05)
```

### Step 3: Assemble Context Within Budget

```
ALGORITHM: AssembleContext
─────────────────────────────────────────────────────
INPUT:  task, budget = 25000 tokens
OUTPUT: formatted context string

// Priority queue by score
queue = files.sortBy(score, descending)
context = []
used_tokens = 0

// Always include repo map first
repo_map = buildRepoMap()  // ~1000-2000 tokens
context.add(repo_map)
used_tokens += tokens(repo_map)

// Greedily add highest-scored files that fit
WHILE queue not empty AND used_tokens < budget:
  file = queue.pop()
  content = readFile(file)
  file_tokens = countTokens(content)
  
  IF used_tokens + file_tokens <= budget:
    context.add(formatFile(file, content))
    used_tokens += file_tokens
  ELSE:
    // Try next file (it might be smaller)
    CONTINUE

RETURN context.join('\n')
```

---

## 📊 Under the Hood: Embeddings and Vector Search

### What Embeddings Actually Are

An embedding maps text to a **high-dimensional point** where distance = semantic similarity.

```
                    Dimension 2 (maybe "security-related")
                         ▲
                         │     • "authentication"
                         │    • "login"
                         │   • "password"
                         │
                         │                    • "weather"
                         │                   • "forecast"  
                         │
                         └──────────────────────────────▶ Dimension 1
                                                          (maybe "data-related")

The neural network learns these dimensions automatically from data.
We don't choose them — they're emergent properties of training.
```

### How Cosine Similarity Works

```
Two vectors: A and B

Cosine similarity = cos(angle between A and B)
                              A · B
                  = ─────────────────────────
                    magnitude(A) × magnitude(B)

                    a₁×b₁ + a₂×b₂ + ... + aₙ×bₙ
                  = ────────────────────────────────────────
                    √(a₁² + ...) × √(b₁² + ...)

Range: -1 (opposite) to 1 (identical)

Example:
  A = [0.8, 0.6]   (authentication)
  B = [0.75, 0.65] (login)
  
  dot product = 0.8×0.75 + 0.6×0.65 = 0.99
  |A| = √(0.64 + 0.36) = 1.0
  |B| = √(0.5625 + 0.4225) = 0.99
  
  cosine = 0.99 / (1.0 × 0.99) = 1.0 ← nearly identical!
```

### The Chunking Strategy

You can't embed a whole file — too much information gets averaged out.

```
BAD: Embed entire 500-line file
─────────────────────────────────────────────────────
Result: One vector that's the "average" of everything
Problem: Searching for "authentication" might not match
         a file that has auth code buried in line 450

GOOD: Chunk at semantic boundaries
─────────────────────────────────────────────────────
Chunk 1: lines 1-45   (imports + class declaration)
Chunk 2: lines 46-89  (login function)
Chunk 3: lines 90-120 (logout function)
Chunk 4: lines 121-180 (helper functions)

Now search for "authentication" matches Chunk 2 specifically!
```

---

## 📊 Real Tools' Approaches

### Aider's Approach
- Uses **tree-sitter** to parse code into AST
- Builds a graph of imports/references
- Scores files by relevance to the task
- [Blog post: aider.chat/2023/10/22/repomap.html](https://aider.chat/2023/10/22/repomap.html)

### Cursor's Approach  
- Creates **embeddings** of code chunks
- Uses vector similarity search
- Finds semantically related code (not just keyword match)

### Claude Code's Approach
- Gives LLM tools to search/read files
- LLM decides what to look at
- More dynamic, less pre-selection

---

## 🎯 The Trade-offs

| Approach | Pros | Cons |
|----------|------|------|
| **Repo map only** | Fast, cheap | Might miss context |
| **Embedding search** | Semantic matching | Requires setup, costs |
| **LLM decides** | Most flexible | More API calls |
| **Hybrid** | Best results | Most complex |

Most production tools use a hybrid approach.

---

## 🔧 Complete Pipeline Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER REQUEST                                  │
│                  "Fix the login bug in auth"                        │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 1: PARSE REQUEST                                              │
│  ─────────────────────                                              │
│  • Extract keywords: ["login", "bug", "auth"]                       │
│  • Identify file mentions: ["auth"] → src/auth/*                    │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 2: BUILD REPO MAP (if not cached)                             │
│  ──────────────────────────────────────                             │
│  • Scan all source files                                            │
│  • Parse with tree-sitter → extract symbols                         │
│  • Build dependency graph from imports                              │
│  • Format as condensed text                                         │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 3: FIND SEED FILES                                            │
│  ───────────────────────                                            │
│  • Exact path match: "auth" → src/auth/service.ts ✓                 │
│  • Symbol match: "login" → login() in service.ts ✓                  │
│  • Keyword in content: grep-style search                            │
│                                                                     │
│  Seeds: [src/auth/service.ts]                                       │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 4: RANK ALL FILES (PageRank-style)                            │
│  ───────────────────────────────────────                            │
│  • Start with seed files boosted                                    │
│  • Propagate scores through dependency edges                        │
│  • Iterate until convergence                                        │
│                                                                     │
│  Ranked: [user.ts: 0.8, service.ts: 0.6, routes.ts: 0.3, ...]      │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 5: SEMANTIC SEARCH (optional, adds cost)                      │
│  ─────────────────────────────────────────────                      │
│  • Embed the query: "fix login bug" → [0.2, 0.8, ...]              │
│  • Find similar code chunks in vector index                         │
│  • Dedupe with already-selected files                               │
│                                                                     │
│  Matches: [auth/validators.ts:45-80, models/session.ts:1-30]       │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 6: ASSEMBLE WITHIN TOKEN BUDGET                               │
│  ────────────────────────────────────                               │
│  Budget: 25,000 tokens                                              │
│                                                                     │
│  ┌─────────────────────────────────┬─────────┐                     │
│  │ Component                       │ Tokens  │                     │
│  ├─────────────────────────────────┼─────────┤                     │
│  │ Repo map                        │  1,500  │                     │
│  │ src/auth/service.ts (full)      │  2,800  │                     │
│  │ src/models/user.ts (full)       │  1,200  │                     │
│  │ src/auth/validators.ts:45-80    │    400  │                     │
│  │ src/api/routes.ts (full)        │  1,800  │                     │
│  ├─────────────────────────────────┼─────────┤                     │
│  │ TOTAL                           │  7,700  │                     │
│  │ REMAINING                       │ 17,300  │                     │
│  └─────────────────────────────────┴─────────┘                     │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│  OUTPUT: FORMATTED CONTEXT FOR LLM                                  │
│  ─────────────────────────────────                                  │
│                                                                     │
│  ## Repository Structure                                            │
│  📁 src/                                                            │
│    📁 auth/                                                         │
│      📄 service.ts                                                  │
│         └─ class AuthService                                        │
│         └─ function login()                                         │
│    ...                                                              │
│                                                                     │
│  ## Relevant Files                                                  │
│                                                                     │
│  ### src/auth/service.ts                                            │
│  ```typescript                                                      │
│  export class AuthService { ... }                                   │
│  ```                                                                │
│  ...                                                                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## ✅ Key Takeaways

1. **Don't send everything** — use a condensed repo map
2. **Select relevant files** — based on the task
3. **Let LLM request more** — tools for reading files
4. **Tree-sitter** is the standard for code parsing
5. **Embeddings** enable semantic (not just keyword) search
6. **PageRank** propagates importance through the dependency graph
7. **Token budgeting** is a greedy packing problem

---

## 📺 Video Flow

1. Show the problem: "Can't send 200k tokens"
2. Explain repo maps with a visual
3. Walk through relevance scoring
4. Demo the code that builds a map
5. Show how file selection works

---

**Next:** See `demo.ts` for the code
