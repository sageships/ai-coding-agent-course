# Module 3: Code Context — The Secret Sauce

**Duration:** 75 minutes (5 videos)
**Goal:** Build the context system that makes AI coding agents work on real codebases

---

## 3.1 Why Context is Everything (8 min)

### Video Script

**[INTRO - 0:00-0:30]**

"This module is where we separate toys from tools. Anyone can build a chatbot that generates code. Building something that works on REAL codebases — that's the hard part.

The difference is context."

---

**[THE CONTEXT PROBLEM - 0:30-3:00]**

"Let me show you the scale of the problem.

A medium codebase: 50,000 lines of code ≈ 200,000 tokens

GPT-4 Turbo context: 128,000 tokens

So even with the largest context window, you can't fit a medium project. And there are other problems:"

*[Show chart]*

```
CONTEXT SIZE VS. PERFORMANCE

Tokens     Cost/Request    Latency    Accuracy
─────────────────────────────────────────────────
5,000      $0.05           2s         High ✓
20,000     $0.20           5s         High ✓
50,000     $0.50           15s        Medium ⚠️
100,000    $1.00           30s        Low ✗
```

"More context ≠ better results. LLMs get confused with too much information. They lose focus, miss details, and make more mistakes.

The sweet spot is usually 10-30k tokens of RELEVANT context."

---

**[THE GOLDILOCKS PROBLEM - 3:00-5:00]**

"Too little context: LLM doesn't know about your AuthService, imports wrong modules, breaks patterns.

Too much context: LLM gets confused, responds slowly, costs more, makes errors.

Just right: LLM has exactly what it needs to understand and modify the code."

*[Show example]*

```
BAD: Send everything
├── src/ (20,000 tokens)
├── tests/ (15,000 tokens)
├── docs/ (10,000 tokens)
└── Total: 45,000 tokens of mostly irrelevant code

GOOD: Send smart context
├── Repo map (1,000 tokens) - shows structure
├── Target file (500 tokens) - file being edited
├── Related files (2,000 tokens) - imports/dependencies
└── Total: 3,500 tokens of relevant code
```

---

**[WHAT WE'LL BUILD - 5:00-8:00]**

"In this module, we'll build a context system that:

1. **Maps the entire repo** — using tree-sitter to extract symbols
2. **Ranks by importance** — graph algorithms find the most relevant files
3. **Searches semantically** — embeddings let us find code by meaning
4. **Assembles optimally** — fits the best context into our token budget

By the end, you'll understand exactly how Aider, Cursor, and Claude Code decide what context to send.

Let's start with the repository map."

---

### Key Takeaways

1. Can't send entire codebase (too big, too expensive, worse results)
2. Need just enough context — not too little, not too much
3. Smart context selection is what makes tools work

---

## 3.2 Building a Repository Map with Tree-Sitter (20 min)

### Video Script

**[INTRO - 0:00-0:30]**

"The repository map is Aider's secret weapon. Instead of sending 50,000 lines of code, we send a condensed view showing all the important symbols — classes, functions, methods — with just their signatures.

Let's build one."

---

**[WHAT IS TREE-SITTER? - 0:30-3:00]**

"Tree-sitter is an incremental parsing library used by:
- GitHub (syntax highlighting, code navigation)
- VSCode and Neovim (same)
- Helix editor (same)

It parses code into an AST (Abstract Syntax Tree) extremely fast. Here's what that means:"

```typescript
// This code:
function add(a: number, b: number): number {
  return a + b;
}

// Becomes this AST:
{
  type: 'function_declaration',
  name: 'add',
  parameters: [
    { type: 'parameter', name: 'a', typeAnnotation: 'number' },
    { type: 'parameter', name: 'b', typeAnnotation: 'number' }
  ],
  returnType: 'number',
  body: { ... }
}
```

"From the AST, we can extract just the function signature without the body. That's how we compress 50,000 lines into a readable map."

---

### 🔧 HOW IT WORKS MECHANICALLY: Tree-Sitter Deep Dive

**What is an AST (Abstract Syntax Tree)?**

An AST is a tree representation of code where:
- Each **node** represents a syntactic construct (function, variable, expression)
- **Parent-child relationships** show nesting (a function contains statements)
- The tree preserves the **structure** but discards irrelevant details (whitespace, semicolons)

```
Source Code:                          AST (simplified):
                                      
function greet(name) {                program
  return "Hello, " + name;             └── function_declaration
}                                           ├── identifier: "greet"
                                            ├── formal_parameters
                                            │    └── identifier: "name"
                                            └── statement_block
                                                 └── return_statement
                                                      └── binary_expression
                                                           ├── string: "Hello, "
                                                           └── identifier: "name"
```

**How Tree-Sitter Generates the AST (Incremental Parsing)**

Tree-sitter uses a **GLR parser** with these steps:

```
1. LEXICAL ANALYSIS (Tokenization)
   "function greet(name) { return x; }"
          ↓
   [FUNCTION, IDENTIFIER:"greet", LPAREN, IDENTIFIER:"name", RPAREN, LBRACE, RETURN, ...]

2. SYNTAX ANALYSIS (Parsing)
   Uses a grammar file (grammar.js) that defines rules:
   
   function_declaration: $ => seq(
     'function',
     field('name', $.identifier),
     field('parameters', $.formal_parameters),
     field('body', $.statement_block)
   )

3. TREE CONSTRUCTION
   Builds nodes bottom-up, connecting children to parents

4. INCREMENTAL UPDATE (the magic!)
   When you edit line 50, tree-sitter doesn't re-parse the whole file.
   It reuses unchanged subtrees and only re-parses the affected region.
   
   Before edit:  [===== tree =====]
   After edit:   [=== reused ===][new][=== reused ===]
```

**Traversing the Tree to Find Symbols**

We use **tree queries** — a pattern-matching language for ASTs:

```scheme
; Query to find all function declarations in TypeScript
(function_declaration
  name: (identifier) @function.name) @function.def

; Query to find class methods
(method_definition
  name: (property_identifier) @method.name) @method.def

; Query to find exported items
(export_statement
  declaration: (_) @export.declaration)
```

**The actual traversal algorithm:**

```
ALGORITHM: ExtractSymbols(tree, query)
─────────────────────────────────────────────────────
INPUT: parsed tree, tree-sitter query
OUTPUT: list of symbols with names and locations

1. matches ← query.matches(tree.rootNode)      // Run query against tree
2. symbols ← []

3. FOR each match in matches:
     node ← match.captures['name']              // Get the captured node
     symbol ← {
       name: node.text,                         // The actual text "greet"
       kind: inferKind(node.parent.type),       // "function", "class", etc.
       startLine: node.startPosition.row,
       endLine: node.parent.endPosition.row,
       signature: extractSignature(node.parent) // Just the declaration
     }
     symbols.append(symbol)

4. RETURN symbols

FUNCTION extractSignature(node):
   // Get text from start of node to opening brace
   text ← node.text
   bracePos ← text.indexOf('{')
   IF bracePos > 0:
     RETURN text.substring(0, bracePos) + "{...}"
   ELSE:
     RETURN text
```

**Why Tree-Sitter and Not Regex?**

Regex fails on real code:

```typescript
// Regex: /function\s+(\w+)/g would miss:
const greet = function(name) {}     // anonymous function
const greet = (name) => {}          // arrow function
class Foo { greet(name) {} }        // method
function /* comment */ greet() {}   // comment in middle

// Tree-sitter handles ALL of these because it understands structure
```

---

**[SETTING UP TREE-SITTER - 3:00-6:00]**

"Install the packages:"

```bash
npm install tree-sitter
npm install tree-sitter-typescript tree-sitter-javascript tree-sitter-python
```

"Create `src/context/parser.ts`:"

```typescript
import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';
import JavaScript from 'tree-sitter-javascript';
import Python from 'tree-sitter-python';

// Map file extensions to parsers
const parsers: Record<string, Parser.Language> = {
  '.ts': TypeScript.typescript,
  '.tsx': TypeScript.tsx,
  '.js': JavaScript,
  '.jsx': JavaScript,
  '.py': Python,
};

export function getParser(extension: string): Parser | null {
  const language = parsers[extension];
  if (!language) return null;
  
  const parser = new Parser();
  parser.setLanguage(language);
  return parser;
}

export function parseFile(code: string, extension: string): Parser.Tree | null {
  const parser = getParser(extension);
  if (!parser) return null;
  return parser.parse(code);
}
```

---

**[EXTRACTING SYMBOLS - 6:00-12:00]**

"Now let's extract the important symbols. `src/context/symbols.ts`:"

```typescript
import Parser from 'tree-sitter';

export interface Symbol {
  name: string;
  kind: 'function' | 'class' | 'method' | 'interface' | 'variable' | 'export';
  signature: string;  // Just the declaration, not the body
  startLine: number;
  endLine: number;
}

// Tree-sitter query for TypeScript symbols
const TS_SYMBOL_TYPES = [
  'function_declaration',
  'class_declaration', 
  'interface_declaration',
  'method_definition',
  'public_field_definition',
  'export_statement',
  'lexical_declaration', // const/let
];

export function extractSymbols(tree: Parser.Tree, code: string): Symbol[] {
  const symbols: Symbol[] = [];
  const lines = code.split('\n');
  
  function visit(node: Parser.SyntaxNode) {
    if (TS_SYMBOL_TYPES.includes(node.type)) {
      const symbol = extractSymbol(node, lines);
      if (symbol) symbols.push(symbol);
    }
    
    // Recurse into children
    for (const child of node.children) {
      visit(child);
    }
  }
  
  visit(tree.rootNode);
  return symbols;
}

function extractSymbol(node: Parser.SyntaxNode, lines: string[]): Symbol | null {
  const startLine = node.startPosition.row;
  const endLine = node.endPosition.row;
  
  // Get symbol name
  const nameNode = node.childForFieldName('name');
  const name = nameNode?.text ?? '';
  if (!name) return null;
  
  // Get signature (first line or until opening brace)
  let signature = '';
  for (let i = startLine; i <= Math.min(endLine, startLine + 5); i++) {
    const line = lines[i];
    signature += line + '\n';
    if (line.includes('{') || line.includes('=>')) {
      // Remove body, keep signature
      signature = signature.replace(/\{[\s\S]*$/, '{...}');
      break;
    }
  }
  
  return {
    name,
    kind: getSymbolKind(node.type),
    signature: signature.trim(),
    startLine,
    endLine
  };
}

function getSymbolKind(nodeType: string): Symbol['kind'] {
  switch (nodeType) {
    case 'function_declaration': return 'function';
    case 'class_declaration': return 'class';
    case 'interface_declaration': return 'interface';
    case 'method_definition': return 'method';
    case 'export_statement': return 'export';
    default: return 'variable';
  }
}
```

---

**[BUILDING THE MAP - 12:00-17:00]**

"Now let's build the actual repository map. `src/context/repo-map.ts`:"

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import { parseFile } from './parser';
import { extractSymbols, Symbol } from './symbols';

export interface FileMap {
  path: string;
  symbols: Symbol[];
}

export interface RepoMap {
  files: FileMap[];
  totalSymbols: number;
}

export async function buildRepoMap(
  projectRoot: string,
  options?: {
    include?: string[];
    exclude?: string[];
  }
): Promise<RepoMap> {
  const include = options?.include ?? ['**/*.{ts,tsx,js,jsx,py}'];
  const exclude = options?.exclude ?? [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.git/**',
    '**/coverage/**'
  ];
  
  const files = await glob(include, {
    cwd: projectRoot,
    ignore: exclude
  });
  
  const fileMap: FileMap[] = [];
  let totalSymbols = 0;
  
  for (const file of files) {
    const fullPath = path.join(projectRoot, file);
    const code = await fs.readFile(fullPath, 'utf-8');
    const ext = path.extname(file);
    
    const tree = parseFile(code, ext);
    if (!tree) continue;
    
    const symbols = extractSymbols(tree, code);
    if (symbols.length > 0) {
      fileMap.push({ path: file, symbols });
      totalSymbols += symbols.length;
    }
  }
  
  return { files: fileMap, totalSymbols };
}
```

---

**[FORMATTING THE MAP - 17:00-20:00]**

"Finally, let's format it for the LLM:"

```typescript
export function formatRepoMap(map: RepoMap): string {
  let output = '';
  
  for (const file of map.files) {
    output += `${file.path}:\n`;
    
    for (const symbol of file.symbols) {
      // Indent the signature
      const indented = symbol.signature
        .split('\n')
        .map(line => '│ ' + line)
        .join('\n');
      output += indented + '\n';
    }
    
    output += '\n';
  }
  
  return output;
}

// Usage
const map = await buildRepoMap('/path/to/project');
const formatted = formatRepoMap(map);
console.log(formatted);
```

"Output looks like:"

```
src/auth/service.ts:
│ export class AuthService {
│   constructor(private db: Database) {...}
│ }
│ async login(email: string, password: string): Promise<User> {...}
│ async logout(userId: string): void {...}

src/models/user.ts:
│ export interface User {
│   id: string;
│   email: string;
│   name: string;
│ }
```

"This gives the LLM a bird's-eye view of your entire codebase in ~1000 tokens instead of 200,000!"

---

### Key Code Files

- `src/context/parser.ts`
- `src/context/symbols.ts`
- `src/context/repo-map.ts`

---

## 3.3 Smart Context Selection with Graph Ranking (15 min)

### Video Script

**[INTRO - 0:00-0:30]**

"The repo map shows everything, but for any given task, some files matter more than others. If you're editing AuthService, you probably need to see the User model it uses.

Let's build a ranking system."

---

### 🔧 HOW IT WORKS MECHANICALLY: File Relevance Scoring (THE KEY PART)

This is where the magic happens. We need to answer: **which files should we send to the LLM?**

**Step 1: Build the Dependency Graph**

A dependency graph has:
- **Nodes** = files in your project
- **Edges** = import relationships (A imports B → edge from A to B)

```
ALGORITHM: BuildDependencyGraph(projectRoot)
─────────────────────────────────────────────────────
INPUT: path to project root
OUTPUT: graph with nodes (files) and edges (imports)

1. files ← scanDirectory(projectRoot, extensions=[.ts, .js, .py, ...])
2. graph ← { nodes: Set(), edges: Map(), reverseEdges: Map() }

3. FOR each file in files:
     graph.nodes.add(file)
     content ← readFile(file)
     imports ← extractImports(content)
     
     FOR each importPath in imports:
       resolvedPath ← resolveImport(file, importPath)
       IF resolvedPath exists in files:
         // file imports resolvedPath
         graph.edges[file].add(resolvedPath)
         // resolvedPath is imported BY file
         graph.reverseEdges[resolvedPath].add(file)

4. RETURN graph

Example graph for a simple project:
─────────────────────────────────────────────────────

  src/api/routes.ts ──imports──▶ src/auth/service.ts
         │                              │
         │                              │
         ▼                              ▼
  src/utils/logger.ts          src/models/user.ts

Represented as:
  nodes: {routes.ts, service.ts, logger.ts, user.ts}
  edges: {
    routes.ts → [service.ts, logger.ts],
    service.ts → [user.ts]
  }
  reverseEdges: {
    service.ts → [routes.ts],    // "who imports me"
    logger.ts → [routes.ts],
    user.ts → [service.ts]
  }
```

**Step 2: The PageRank-Style Algorithm**

PageRank was invented by Google to rank web pages. The insight: **a page is important if important pages link to it.**

For code: **a file is important if important files import it.**

```
ALGORITHM: RankFiles(graph, seedFiles, damping=0.85, iterations=20)
─────────────────────────────────────────────────────
INPUT: dependency graph, seed files (task-relevant), damping factor, iterations
OUTPUT: Map<file, score>

// damping = probability of following an edge vs. jumping to random file
// Higher damping (0.85) = more emphasis on link structure
// Lower damping (0.5) = more emphasis on seed files

1. n ← graph.nodes.size
2. scores ← Map()

   // Initialize: everyone starts equal
3. FOR each node in graph.nodes:
     scores[node] ← 1/n   // e.g., 4 files → each starts at 0.25

   // Boost seed files (files mentioned in user's task)
4. FOR each seed in seedFiles:
     scores[seed] ← scores[seed] + 0.5  // Big boost!

5. FOR i ← 1 TO iterations:
     newScores ← Map()
     
     FOR each node in graph.nodes:
       // Base score: random jump probability
       score ← (1 - damping) / n    // e.g., 0.15 / 4 = 0.0375
       
       // Add contributions from files that IMPORT this node
       importers ← graph.reverseEdges[node]  // Who imports me?
       FOR each importer in importers:
         importerScore ← scores[importer]
         importerOutDegree ← graph.edges[importer].size  // How many files does importer import?
         contribution ← damping × (importerScore / importerOutDegree)
         score ← score + contribution
       
       newScores[node] ← score
     
     scores ← newScores

6. RETURN scores
```

**Step 3: Concrete Example with Numbers**

Let's trace through a real example:

```
Project structure:
  routes.ts → imports → [service.ts, logger.ts]
  service.ts → imports → [user.ts]
  
User query: "fix the login bug"
  → "login" matches in service.ts → seed file!

ITERATION 0 (Initial):
─────────────────────────────────────────────────────
  routes.ts:  0.25
  service.ts: 0.25 + 0.5 (seed boost) = 0.75  ← Boosted!
  logger.ts:  0.25
  user.ts:    0.25

ITERATION 1:
─────────────────────────────────────────────────────
For each file, calculate new score:

routes.ts:
  base = (1-0.85)/4 = 0.0375
  importers = [] (nobody imports routes)
  score = 0.0375

service.ts:
  base = 0.0375
  importers = [routes.ts]
  routes.ts has score 0.25, out-degree 2 (imports 2 files)
  contribution = 0.85 × (0.25 / 2) = 0.106
  score = 0.0375 + 0.106 = 0.144

logger.ts:
  base = 0.0375
  importers = [routes.ts]
  contribution = 0.85 × (0.25 / 2) = 0.106
  score = 0.0375 + 0.106 = 0.144

user.ts:
  base = 0.0375
  importers = [service.ts]
  service.ts has score 0.75, out-degree 1
  contribution = 0.85 × (0.75 / 1) = 0.6375  ← Big contribution from high-scoring importer!
  score = 0.0375 + 0.6375 = 0.675

After iteration 1:
  routes.ts:  0.038
  service.ts: 0.144
  logger.ts:  0.144
  user.ts:    0.675  ← user.ts is now highest because service.ts imports it!

... after 20 iterations, scores converge:
  user.ts:    0.45   ← HIGHEST (inherited importance from service.ts)
  service.ts: 0.28   ← seed file
  logger.ts:  0.15
  routes.ts:  0.12
```

**Why This Works**

The seed boost on `service.ts` propagates through the graph:
- `service.ts` imports `user.ts`
- So `user.ts` inherits importance from `service.ts`
- If you're fixing login bugs, you probably need to see the User model!

---

**[THE DEPENDENCY GRAPH - 0:30-4:00]**

"First, we build a graph where:
- Nodes = files
- Edges = dependencies (imports/exports)

`src/context/graph.ts`:"

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';

export interface FileGraph {
  nodes: Set<string>;
  edges: Map<string, Set<string>>; // file -> files it imports
  reverseEdges: Map<string, Set<string>>; // file -> files that import it
}

export async function buildDependencyGraph(
  projectRoot: string,
  files: string[]
): Promise<FileGraph> {
  const graph: FileGraph = {
    nodes: new Set(files),
    edges: new Map(),
    reverseEdges: new Map()
  };
  
  for (const file of files) {
    const fullPath = path.join(projectRoot, file);
    const code = await fs.readFile(fullPath, 'utf-8');
    const imports = extractImports(code, file);
    
    graph.edges.set(file, imports);
    
    for (const imp of imports) {
      if (!graph.reverseEdges.has(imp)) {
        graph.reverseEdges.set(imp, new Set());
      }
      graph.reverseEdges.get(imp)!.add(file);
    }
  }
  
  return graph;
}

function extractImports(code: string, currentFile: string): Set<string> {
  const imports = new Set<string>();
  
  // Match: import ... from '...'
  const importRegex = /import.*from\s+['"]([^'"]+)['"]/g;
  let match;
  
  while ((match = importRegex.exec(code)) !== null) {
    const importPath = match[1];
    
    // Skip node_modules
    if (!importPath.startsWith('.')) continue;
    
    // Resolve relative path
    const resolved = resolveImport(currentFile, importPath);
    if (resolved) imports.add(resolved);
  }
  
  return imports;
}

function resolveImport(fromFile: string, importPath: string): string | null {
  const dir = path.dirname(fromFile);
  let resolved = path.join(dir, importPath);
  
  // Add extension if missing
  if (!path.extname(resolved)) {
    // Try common extensions
    for (const ext of ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.js']) {
      // In real implementation, check if file exists
      resolved = resolved + ext;
      break;
    }
  }
  
  return resolved;
}
```

---

**[PAGERANK FOR CODE - 4:00-9:00]**

"Now we use a PageRank-style algorithm to find important files. Files that are imported by many other files are probably more important.

`src/context/ranker.ts`:"

```typescript
export function rankFiles(
  graph: FileGraph,
  seedFiles: string[] = [],
  options?: { 
    damping?: number;
    iterations?: number;
  }
): Map<string, number> {
  const damping = options?.damping ?? 0.85;
  const iterations = options?.iterations ?? 20;
  const n = graph.nodes.size;
  
  // Initialize scores
  const scores = new Map<string, number>();
  for (const node of graph.nodes) {
    scores.set(node, 1 / n);
  }
  
  // Boost seed files (files explicitly mentioned or relevant to task)
  for (const seed of seedFiles) {
    scores.set(seed, (scores.get(seed) ?? 0) + 0.5);
  }
  
  // Iterate
  for (let i = 0; i < iterations; i++) {
    const newScores = new Map<string, number>();
    
    for (const node of graph.nodes) {
      let score = (1 - damping) / n;
      
      // Add contribution from files that import this one
      const importers = graph.reverseEdges.get(node) ?? new Set();
      for (const importer of importers) {
        const importerScore = scores.get(importer) ?? 0;
        const importerOutDegree = graph.edges.get(importer)?.size ?? 1;
        score += damping * (importerScore / importerOutDegree);
      }
      
      newScores.set(node, score);
    }
    
    // Update scores
    for (const [node, score] of newScores) {
      scores.set(node, score);
    }
  }
  
  return scores;
}

// Get top N files
export function getTopFiles(
  scores: Map<string, number>,
  n: number
): string[] {
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([file]) => file);
}
```

---

**[TASK-SPECIFIC RANKING - 9:00-13:00]**

"We can make ranking task-aware by boosting files related to the user's request:"

```typescript
export async function selectContextForTask(
  projectRoot: string,
  task: string,
  options?: {
    maxFiles?: number;
    maxTokens?: number;
  }
): Promise<string[]> {
  // Build graph and base rankings
  const files = await getProjectFiles(projectRoot);
  const graph = await buildDependencyGraph(projectRoot, files);
  
  // Find files mentioned in task
  const mentionedFiles = files.filter(f => 
    task.toLowerCase().includes(path.basename(f, path.extname(f)).toLowerCase())
  );
  
  // Find files with matching keywords
  const keywords = extractKeywords(task);
  const keywordMatches: string[] = [];
  
  for (const file of files) {
    const code = await fs.readFile(path.join(projectRoot, file), 'utf-8');
    const codeKeywords = extractKeywords(code);
    const overlap = keywords.filter(k => codeKeywords.includes(k));
    if (overlap.length > 2) {
      keywordMatches.push(file);
    }
  }
  
  // Combine seeds
  const seeds = [...new Set([...mentionedFiles, ...keywordMatches])];
  
  // Rank with seeds boosted
  const scores = rankFiles(graph, seeds);
  
  // Get top files within token budget
  return selectWithinBudget(scores, projectRoot, options?.maxTokens ?? 20000);
}

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3);
}
```

---

**[TOKEN BUDGETING - 13:00-15:00]**

"We need to stay within token limits:"

```typescript
async function selectWithinBudget(
  scores: Map<string, number>,
  projectRoot: string,
  maxTokens: number
): Promise<string[]> {
  const selected: string[] = [];
  let totalTokens = 0;
  
  const ranked = getTopFiles(scores, 100);
  
  for (const file of ranked) {
    const content = await fs.readFile(
      path.join(projectRoot, file), 
      'utf-8'
    );
    const tokens = estimateTokens(content);
    
    if (totalTokens + tokens <= maxTokens) {
      selected.push(file);
      totalTokens += tokens;
    }
  }
  
  return selected;
}

function estimateTokens(text: string): number {
  // Rough estimate: 4 chars per token
  return Math.ceil(text.length / 4);
}
```

---

## 3.4 Embeddings and Semantic Search (18 min)

### Video Script

**[INTRO - 0:00-0:30]**

"Keyword matching is limited. If you search for 'authentication', you won't find code that uses 'login' or 'credentials'.

Embeddings fix this. They let us search by meaning, not just text."

---

### 🔧 HOW IT WORKS MECHANICALLY: Embeddings Deep Dive

**What Are Embeddings, Really?**

An embedding is NOT just "a vector." It's a **learned mapping** from text to a high-dimensional space where **semantic similarity = geometric proximity**.

```
Text                    → Neural Network → 1536 numbers (text-embedding-3-small)
                                           
"user authentication"   → [0.021, -0.034, 0.089, ..., 0.012]
                              ↑
                          These aren't random!
                          They encode MEANING.
```

**How the Embedding Model Learns**

During training (which OpenAI/Cohere already did for you):

```
Training objective: Make similar texts have similar vectors

1. Take millions of text pairs known to be similar:
   ("How do I login?", "Authentication process")
   ("What's the weather?", "Temperature forecast")

2. Train neural network to:
   - Map similar pairs to NEARBY points in vector space
   - Map different pairs to FAR points in vector space

3. After training, the network "understands" semantic similarity
```

**The Geometry of Embeddings**

Imagine a 3D space (real embeddings are 1536D, but same principle):

```
                    ▲ dimension 3 (maybe: "security-related")
                    │
                    │     • authentication
                    │    • login      
                    │   • credentials
                    │                    • weather
                    │                   • temperature
                    │                  • forecast
                    └──────────────────────────────────────▶ dimension 1
                   /
                  /
                 ▼ dimension 2

Similar concepts cluster together!
```

**How Cosine Similarity Works (Geometrically)**

Cosine similarity measures the **angle** between two vectors, not the distance:

```
                    ▲
                    │    B = [0.8, 0.9]
                    │   /
                    │  /  θ = 10° → cos(θ) = 0.98 (very similar!)
                    │ /
                    │/ A = [0.7, 0.7]
                    └────────────────▶

Formula:
                   A · B           a₁×b₁ + a₂×b₂ + ... + aₙ×bₙ
  cos(θ) = ─────────────────── = ─────────────────────────────────
           ‖A‖ × ‖B‖           √(a₁² + a₂² + ...) × √(b₁² + b₂² + ...)

Example:
  A = [0.7, 0.7]
  B = [0.8, 0.9]
  
  dot product = 0.7×0.8 + 0.7×0.9 = 0.56 + 0.63 = 1.19
  ‖A‖ = √(0.49 + 0.49) = 0.99
  ‖B‖ = √(0.64 + 0.81) = 1.20
  
  cosine similarity = 1.19 / (0.99 × 1.20) = 0.998 ≈ 0.99

Range: -1 (opposite) to 1 (identical)
In practice for embeddings: usually 0.3 to 0.95
```

**Why Cosine Over Euclidean Distance?**

```
Euclidean distance is affected by vector LENGTH:
  A = [1, 1]
  B = [2, 2]     ← Same direction, different length
  Distance = √2  ← Suggests they're different!
  
Cosine ignores length, only measures DIRECTION:
  cos(A, B) = 1.0  ← Correctly identifies they're identical in meaning
```

---

**[WHAT ARE EMBEDDINGS? - 0:30-4:00]**

"An embedding is a vector (list of numbers) that captures the 'meaning' of text.

Similar concepts have similar vectors:"

```
embed("authentication") → [0.2, 0.8, 0.1, ...]
embed("login system")   → [0.2, 0.7, 0.2, ...]  ← Similar!
embed("database query") → [0.9, 0.1, 0.3, ...]  ← Different

Similarity:
  "authentication" ↔ "login system"   = 0.95 (high)
  "authentication" ↔ "database query" = 0.23 (low)
```

"We can embed all our code, then find code similar to any query."

---

### 🔧 HOW IT WORKS MECHANICALLY: The Search Algorithm

**How We Chunk Code for Embedding**

You can't embed an entire file — it would lose specificity. We split code into **meaningful chunks**:

```
ALGORITHM: ChunkCode(file, code, maxChunkSize=1000)
─────────────────────────────────────────────────────
INPUT: file path, file content, max characters per chunk
OUTPUT: list of chunks with metadata

1. lines ← code.split('\n')
2. chunks ← []
3. currentChunk ← []
4. startLine ← 0
5. currentSize ← 0

6. FOR i ← 0 TO lines.length:
     line ← lines[i]
     
     // Check if this is a "natural break point"
     isBreakpoint ← (
       line matches /^(export |async )?(function|class|interface)/ OR
       line matches /^}$/ OR  // end of block
       currentSize >= maxChunkSize
     )
     
     IF isBreakpoint AND currentChunk.length > 5:
       // Save current chunk
       chunks.append({
         file: file,
         startLine: startLine,
         endLine: i - 1,
         content: currentChunk.join('\n')
       })
       // Reset for next chunk
       currentChunk ← []
       startLine ← i
       currentSize ← 0
     
     currentChunk.append(line)
     currentSize ← currentSize + line.length

7. // Don't forget the last chunk
   IF currentChunk.length > 0:
     chunks.append({...})

8. RETURN chunks

Why chunk at function/class boundaries?
─────────────────────────────────────────────────────
Each chunk should be semantically coherent:
  ✓ A complete function → good chunk
  ✓ A complete class → good chunk
  ✗ Half a function → embedding won't be meaningful
  ✗ Random 1000 chars → loses context
```

**The Full Search Algorithm**

```
ALGORITHM: SemanticCodeSearch(query, index, topK=10)
─────────────────────────────────────────────────────
INPUT: search query, pre-embedded code index, number of results
OUTPUT: top K most similar code chunks

1. // Embed the query (one API call)
   queryEmbedding ← OpenAI.embeddings.create(
     model: "text-embedding-3-small",
     input: query
   )

2. // Calculate similarity to EVERY chunk in the index
   scored ← []
   FOR each chunk in index.chunks:
     similarity ← cosineSimilarity(queryEmbedding, chunk.embedding)
     scored.append({ chunk, score: similarity })

3. // Sort by score descending
   scored.sortBy(item => item.score, descending=true)

4. // Return top K
   RETURN scored[0:topK].map(item => item.chunk)

Time complexity: O(n × d) where n = chunks, d = embedding dimensions
─────────────────────────────────────────────────────
For 10,000 chunks × 1536 dimensions:
  = 15,360,000 multiply operations
  ≈ 5-10ms on modern CPU (vectors are fast!)

For larger codebases, use approximate nearest neighbors (HNSW, IVF):
  - Faiss (Facebook)
  - Pinecone, Weaviate, Qdrant (vector databases)
  - Trade: 99% accuracy for 100x speed
```

**Practical Example: Searching for "user authentication"**

```
Query: "user authentication"
        ↓
Query embedding: [0.12, -0.08, 0.34, ..., 0.05]

Chunk 1: src/auth/login.ts (lines 1-45)
  "export async function login(email: string, password: string)..."
  Embedding: [0.11, -0.09, 0.32, ..., 0.06]
  Similarity: 0.94  ← HIGH MATCH

Chunk 2: src/utils/logger.ts (lines 1-30)
  "export function log(level: string, message: string)..."
  Embedding: [0.45, 0.22, -0.15, ..., 0.18]
  Similarity: 0.23  ← LOW MATCH

Chunk 3: src/models/user.ts (lines 1-50)
  "export interface User { id: string; email: string; }..."
  Embedding: [0.18, -0.05, 0.28, ..., 0.09]
  Similarity: 0.78  ← MEDIUM-HIGH MATCH

Results sorted:
  1. src/auth/login.ts (0.94)      ← Most relevant!
  2. src/models/user.ts (0.78)
  3. src/utils/logger.ts (0.23)
```

---

**[EMBEDDING CODE - 4:00-9:00]**

"Create `src/context/embeddings.ts`:"

```typescript
import OpenAI from 'openai';
import * as fs from 'fs/promises';
import * as path from 'path';

const client = new OpenAI();

export interface CodeChunk {
  file: string;
  startLine: number;
  endLine: number;
  content: string;
  embedding?: number[];
}

// Split code into meaningful chunks
export function chunkCode(
  file: string,
  code: string,
  chunkSize: number = 1000
): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  const lines = code.split('\n');
  
  let currentChunk: string[] = [];
  let startLine = 0;
  let currentLength = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    currentChunk.push(line);
    currentLength += line.length;
    
    // Split at function/class boundaries or size limit
    const isBreakpoint = 
      line.match(/^(export |async )?(function|class|interface)/) ||
      currentLength >= chunkSize;
    
    if (isBreakpoint && currentChunk.length > 5) {
      chunks.push({
        file,
        startLine,
        endLine: i,
        content: currentChunk.join('\n')
      });
      currentChunk = [];
      startLine = i + 1;
      currentLength = 0;
    }
  }
  
  // Don't forget the last chunk
  if (currentChunk.length > 0) {
    chunks.push({
      file,
      startLine,
      endLine: lines.length - 1,
      content: currentChunk.join('\n')
    });
  }
  
  return chunks;
}

// Get embeddings for chunks
export async function embedChunks(
  chunks: CodeChunk[]
): Promise<CodeChunk[]> {
  const batchSize = 100;
  const embedded: CodeChunk[] = [];
  
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const texts = batch.map(c => c.content);
    
    const response = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: texts
    });
    
    for (let j = 0; j < batch.length; j++) {
      embedded.push({
        ...batch[j],
        embedding: response.data[j].embedding
      });
    }
  }
  
  return embedded;
}
```

---

**[SEMANTIC SEARCH - 9:00-14:00]**

"Now let's search:"

```typescript
// Calculate cosine similarity
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function searchCode(
  query: string,
  chunks: CodeChunk[],
  topK: number = 10
): Promise<CodeChunk[]> {
  // Embed the query
  const response = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: query
  });
  const queryEmbedding = response.data[0].embedding;
  
  // Find most similar chunks
  const scored = chunks.map(chunk => ({
    chunk,
    score: cosineSimilarity(queryEmbedding, chunk.embedding!)
  }));
  
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(s => s.chunk);
}
```

---

**[INDEXING A PROJECT - 14:00-18:00]**

"Let's put it together:"

```typescript
export class CodeIndex {
  private chunks: CodeChunk[] = [];
  
  async index(projectRoot: string): Promise<void> {
    const files = await glob('**/*.{ts,tsx,js,jsx,py}', {
      cwd: projectRoot,
      ignore: ['**/node_modules/**', '**/dist/**']
    });
    
    console.log(`Indexing ${files.length} files...`);
    
    const allChunks: CodeChunk[] = [];
    for (const file of files) {
      const code = await fs.readFile(
        path.join(projectRoot, file), 
        'utf-8'
      );
      const chunks = chunkCode(file, code);
      allChunks.push(...chunks);
    }
    
    console.log(`Embedding ${allChunks.length} chunks...`);
    this.chunks = await embedChunks(allChunks);
    
    console.log('Index ready!');
  }
  
  async search(query: string, topK: number = 10): Promise<CodeChunk[]> {
    return searchCode(query, this.chunks, topK);
  }
  
  // Save to disk for reuse
  async save(filePath: string): Promise<void> {
    await fs.writeFile(filePath, JSON.stringify(this.chunks));
  }
  
  async load(filePath: string): Promise<void> {
    const data = await fs.readFile(filePath, 'utf-8');
    this.chunks = JSON.parse(data);
  }
}

// Usage
const index = new CodeIndex();
await index.index('/path/to/project');

const results = await index.search('user authentication');
for (const chunk of results) {
  console.log(`${chunk.file}:${chunk.startLine}-${chunk.endLine}`);
  console.log(chunk.content.slice(0, 200));
}
```

---

## 3.5 The Context Assembly Pipeline (14 min)

### Video Script

**[INTRO - 0:00-0:30]**

"Now let's combine everything: repo map, graph ranking, and semantic search into a unified context assembly pipeline."

---

### 🔧 HOW IT WORKS MECHANICALLY: Context Assembly

**The Decision Tree: What Goes in Context?**

```
                          User Task: "Fix login bug"
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            1. ALWAYS INCLUDE  2. TASK-RELEVANT  3. SEMANTIC MATCHES
            ─────────────────  ─────────────────  ──────────────────
            • Repo map (1-2k)  • Files mentioned  • Code chunks similar
            • Open files       • Graph-ranked     • to the query
            • Recent edits     • imports/exports  
                    │               │               │
                    ▼               ▼               ▼
                    └───────────────┼───────────────┘
                                    │
                                    ▼
                          TOKEN BUDGET CHECK
                         (total < maxTokens?)
                                    │
                        ┌───────────┴───────────┐
                        │ YES                   │ NO
                        ▼                       ▼
                    ADD TO CONTEXT          PRIORITIZE & TRUNCATE
                                           (drop lowest-ranked first)
```

**The Token Budgeting Algorithm**

```
ALGORITHM: AssembleContext(task, budget=25000)
─────────────────────────────────────────────────────
INPUT: user task, token budget
OUTPUT: assembled context string

// Token allocation strategy:
//   Repo map:        ~2000 tokens (8%)
//   Relevant files: ~15000 tokens (60%)
//   Search results:  ~5000 tokens (20%)
//   Buffer:          ~3000 tokens (12%) for safety

1. context ← []
   usedTokens ← 0

2. // PHASE 1: Always include the repo map
   repoMap ← buildRepoMap(projectRoot)
   mapText ← formatRepoMap(repoMap)
   
   IF tokens(mapText) > 2000:
     mapText ← truncateToTokens(mapText, 2000)
   
   context.append("## Repository Structure\n" + mapText)
   usedTokens ← usedTokens + tokens(mapText)

3. // PHASE 2: Add relevant files (full content)
   seeds ← findMentionedFiles(task)        // Files named in the task
   scores ← rankFiles(graph, seeds)        // PageRank with seeds
   rankedFiles ← sortByScore(scores)       // Highest first
   
   FOR each file in rankedFiles:
     content ← readFile(file)
     fileTokens ← tokens(content)
     
     IF usedTokens + fileTokens > 20000:   // Leave room for search
       BREAK
     
     context.append("### " + file + "\n```\n" + content + "\n```")
     usedTokens ← usedTokens + fileTokens

4. // PHASE 3: Fill remaining budget with semantic search
   searchResults ← semanticSearch(task, topK=20)
   
   FOR each chunk in searchResults:
     // Skip if we already included this file
     IF chunk.file already in context:
       CONTINUE
     
     chunkTokens ← tokens(chunk.content)
     
     IF usedTokens + chunkTokens > budget:
       BREAK
     
     context.append("### " + chunk.file + ":" + chunk.lines + "\n```\n" + chunk.content + "\n```")
     usedTokens ← usedTokens + chunkTokens

5. RETURN context.join('\n')
```

**Priority Ordering (When Budget is Tight)**

When you can't fit everything, prioritize:

```
PRIORITY RANKING:
─────────────────────────────────────────────────────
1. CRITICAL (always include)
   ├─ Repo map (without this, LLM is blind)
   └─ Files explicitly named in task

2. HIGH (include if space)
   ├─ Files that import/are imported by critical files
   ├─ Files with matching function/class names
   └─ Recently edited files

3. MEDIUM (include if space)
   ├─ High-scoring semantic search results
   └─ Files in the same directory as critical files

4. LOW (include if budget allows)
   ├─ Test files for affected code
   └─ Config files

5. NEVER INCLUDE
   ├─ node_modules, vendor, dist
   ├─ Generated files
   └─ Binary files
```

**Token Estimation**

```
FUNCTION estimateTokens(text):
─────────────────────────────────────────────────────
  // Simple heuristic: ~4 characters per token for code
  // More accurate: use tiktoken library
  
  RETURN ceil(text.length / 4)

For accurate counts (when precision matters):
  import { encoding_for_model } from 'tiktoken'
  const enc = encoding_for_model('gpt-4')
  const tokens = enc.encode(text).length
```

**Example: Budget Allocation for 25k Token Budget**

```
Task: "Fix the login bug where users can't reset password"

Budget: 25,000 tokens

Allocated:
─────────────────────────────────────────────────────
Component                    Tokens    Cumulative
─────────────────────────────────────────────────────
Repo map (condensed)         1,200       1,200
src/auth/login.ts (critical) 2,800       4,000
src/auth/password-reset.ts   3,100       7,100   ← mentioned!
src/models/user.ts           1,500       8,600
src/api/auth-routes.ts       2,200      10,800
src/utils/email.ts           1,800      12,600
[semantic: reset logic]      1,200      13,800
[semantic: validation]         900      14,700
[semantic: error handling]   1,100      15,800
─────────────────────────────────────────────────────
Buffer remaining             9,200
─────────────────────────────────────────────────────

Total used: 15,800 / 25,000 (63%)
Remaining buffer allows LLM to request more files if needed
```

---

**[THE PIPELINE - 0:30-6:00]**

"Create `src/context/assembler.ts`:"

```typescript
import { buildRepoMap, formatRepoMap } from './repo-map';
import { selectContextForTask } from './ranker';
import { CodeIndex } from './embeddings';
import { countTokens } from '../utils/tokens';

export interface ContextConfig {
  repoMapTokens: number;    // Budget for repo map
  relevantFileTokens: number; // Budget for full relevant files
  searchResultTokens: number; // Budget for semantic search results
  maxTotalTokens: number;   // Hard limit
}

const DEFAULT_CONFIG: ContextConfig = {
  repoMapTokens: 2000,
  relevantFileTokens: 15000,
  searchResultTokens: 5000,
  maxTotalTokens: 25000
};

export async function assembleContext(
  projectRoot: string,
  task: string,
  index: CodeIndex,
  config: ContextConfig = DEFAULT_CONFIG
): Promise<string> {
  const parts: string[] = [];
  let totalTokens = 0;
  
  // 1. Repository Map (bird's eye view)
  const repoMap = await buildRepoMap(projectRoot);
  let mapText = formatRepoMap(repoMap);
  
  // Truncate if needed
  if (countTokens(mapText) > config.repoMapTokens) {
    mapText = truncateToTokens(mapText, config.repoMapTokens);
  }
  
  parts.push('## Repository Structure\n' + mapText);
  totalTokens += countTokens(mapText);
  
  // 2. Relevant Files (full content of important files)
  const relevantFiles = await selectContextForTask(projectRoot, task, {
    maxTokens: config.relevantFileTokens
  });
  
  if (relevantFiles.length > 0) {
    parts.push('\n## Relevant Files');
    for (const file of relevantFiles) {
      const content = await fs.readFile(
        path.join(projectRoot, file), 
        'utf-8'
      );
      const fileSection = `\n### ${file}\n\`\`\`\n${content}\n\`\`\``;
      const tokens = countTokens(fileSection);
      
      if (totalTokens + tokens <= config.maxTotalTokens) {
        parts.push(fileSection);
        totalTokens += tokens;
      }
    }
  }
  
  // 3. Semantic Search Results (code similar to the task)
  const searchResults = await index.search(task, 10);
  
  if (searchResults.length > 0 && totalTokens < config.maxTotalTokens) {
    parts.push('\n## Related Code');
    for (const chunk of searchResults) {
      const chunkSection = `\n### ${chunk.file}:${chunk.startLine}-${chunk.endLine}\n\`\`\`\n${chunk.content}\n\`\`\``;
      const tokens = countTokens(chunkSection);
      
      if (totalTokens + tokens <= config.maxTotalTokens) {
        parts.push(chunkSection);
        totalTokens += tokens;
      }
    }
  }
  
  return parts.join('\n');
}
```

---

**[USING IN THE AGENT - 6:00-10:00]**

"Update the agent to use context:"

```typescript
// In agent/loop.ts

export async function runAgentWithContext(
  task: string,
  options: AgentOptions & { codeIndex: CodeIndex }
): Promise<string> {
  // Assemble context
  const context = await assembleContext(
    options.projectRoot,
    task,
    options.codeIndex
  );
  
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: `You are an AI coding assistant working on a codebase.

Here is context about the codebase:

${context}

Use this context to understand the code structure and make appropriate changes.
When you need to see more of a file, use the read_file tool.`
    },
    {
      role: 'user',
      content: task
    }
  ];
  
  // ... rest of agent loop
}
```

---

**[DYNAMIC CONTEXT - 10:00-14:00]**

"As the agent works, context needs to update:"

```typescript
export class DynamicContext {
  private baseContext: string;
  private addedFiles: Map<string, string> = new Map();
  private tokenBudget: number;
  
  constructor(baseContext: string, tokenBudget: number = 25000) {
    this.baseContext = baseContext;
    this.tokenBudget = tokenBudget;
  }
  
  addFile(path: string, content: string): boolean {
    const tokens = countTokens(content);
    if (this.getTotalTokens() + tokens > this.tokenBudget) {
      return false; // Would exceed budget
    }
    this.addedFiles.set(path, content);
    return true;
  }
  
  removeFile(path: string): void {
    this.addedFiles.delete(path);
  }
  
  getTotalTokens(): number {
    let total = countTokens(this.baseContext);
    for (const content of this.addedFiles.values()) {
      total += countTokens(content);
    }
    return total;
  }
  
  toString(): string {
    let context = this.baseContext;
    
    if (this.addedFiles.size > 0) {
      context += '\n\n## Files Currently in Context\n';
      for (const [path, content] of this.addedFiles) {
        context += `\n### ${path}\n\`\`\`\n${content}\n\`\`\`\n`;
      }
    }
    
    return context;
  }
}
```

"This lets the agent manage its own context window — adding files it needs, removing files that are no longer relevant."

---

### Module 3 Summary

You now have:
1. Understanding of why context matters
2. Repository mapping with tree-sitter
3. Graph-based importance ranking
4. Semantic search with embeddings
5. Complete context assembly pipeline

**This is the core of what makes AI coding tools actually work.**

Next: Module 4 — Edit Formats. How do we turn LLM output into actual code changes?
