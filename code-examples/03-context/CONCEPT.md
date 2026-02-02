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

## 🔍 How Context Selection Works

```
User: "Fix the login bug"
           │
           ▼
┌──────────────────────────────────────────┐
│         RELEVANCE SCORING                 │
├──────────────────────────────────────────┤
│  "login" mentioned → auth/service.ts +10  │
│  "login" in function → login() +5         │
│  imports auth → api/routes.ts +3          │
└──────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────┐
│         TOP FILES SELECTED               │
├──────────────────────────────────────────┤
│  1. src/auth/service.ts (score: 15)      │
│  2. src/api/routes.ts (score: 8)         │
│  3. src/models/user.ts (score: 5)        │
└──────────────────────────────────────────┘
           │
           ▼
   Only these 3 files sent to LLM
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

## 🏗️ Building a Repo Map

### Step 1: Scan Files
```
Walk the directory tree
Skip: node_modules, .git, dist
Keep: .ts, .js, .py, etc.
```

### Step 2: Extract Symbols
```
For each file:
  - Find exports (functions, classes, types)
  - Find imports (dependencies)
  - Note file size
```

### Step 3: Generate Map
```
Format as condensed text:
  📄 path/to/file.ts
     └─ export function doThing()
     └─ export class MyClass
```

### Step 4: Find Relevant Files
```
Given user query:
  - Match keywords against file paths
  - Match against function/class names
  - Follow import relationships
  - Return top N files
```

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

## ✅ Key Takeaways

1. **Don't send everything** — use a condensed repo map
2. **Select relevant files** — based on the task
3. **Let LLM request more** — tools for reading files
4. **Tree-sitter** is the standard for code parsing
5. **Embeddings** enable semantic (not just keyword) search

---

## 📺 Video Flow

1. Show the problem: "Can't send 200k tokens"
2. Explain repo maps with a visual
3. Walk through relevance scoring
4. Demo the code that builds a map
5. Show how file selection works

---

**Next:** See `demo.ts` for the code
