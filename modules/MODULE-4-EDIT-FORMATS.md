# Module 4: Code Editing Formats — How LLMs Actually Edit

**Duration:** 60 minutes (5 videos)
**Goal:** Master the formats that make LLM code edits reliable

---

## 4.1 The Edit Format Problem (10 min)

### Video Script

**[INTRO - 0:00-0:30]**

"Here's a question nobody asks: HOW does an LLM edit your code?

It generates text. But 'text' needs to become 'precise file changes'. This translation is harder than it looks, and getting it wrong means broken code."

---

**[WHY JSON SUCKS FOR CODE - 0:30-3:00]**

"Your first instinct might be: use JSON! Structured, parseable, clean.

Let's try:"

```json
{
  "file": "src/utils.ts",
  "changes": [
    {
      "type": "replace",
      "line": 15,
      "old": "console.log(\"Hello\")",
      "new": "console.log(\"Hello, World!\")"
    }
  ]
}
```

"Looks reasonable. Now try this code:"

```typescript
function greet() {
  console.log("Say \"Hello\" to the world!");
  console.log("Path: C:\\Users\\name");
}
```

"As JSON:"

```json
{
  "new": "console.log(\"Say \\\"Hello\\\" to the world!\");\nconsole.log(\"Path: C:\\\\Users\\\\name\");"
}
```

"See the problem? Every quote needs escaping. Every backslash doubles. Newlines become `\n`. The LLM has to write valid JSON with proper escaping WHILE writing code.

Result: syntax errors, broken escapes, malformed JSON. Constantly."

---

**[THE FAMILIAR FORMAT PRINCIPLE - 3:00-5:00]**

"Aider discovered something important: LLMs work better with formats they've seen in training data.

What has GPT seen millions of times?
- Git diffs
- Code blocks in markdown
- Simple text with markers

What has it rarely seen?
- Custom JSON schemas
- XML with code inside
- Invented syntaxes

The lesson: don't invent a format. Use something familiar."

---

**[LINE NUMBERS ARE UNRELIABLE - 5:00-7:00]**

"Another discovery: LLMs are BAD at line numbers.

Ask GPT to edit line 47 of a file, and it might:
- Count wrong
- Get confused by blank lines
- Lose track in long files

This makes formats like 'replace lines 45-52' unreliable.

Better approach: use the actual code as an anchor."

```
❌ BAD: "Replace line 47"
✅ GOOD: "Find this exact code and replace it"
```

---

**[THE THREE APPROACHES - 7:00-10:00]**

"There are three main edit formats that work:

**1. Search/Replace Blocks**
- Find exact text, replace with new text
- Simple, explicit
- Fails if text not found exactly

**2. Unified Diffs**
- Standard diff format (git diff style)
- Familiar to LLMs
- Flexible application

**3. Whole File Rewrite**
- Just output the entire new file
- No ambiguity
- Expensive in tokens

We'll implement all three and you'll learn when to use each."

---

## 4.2 Search/Replace Blocks (12 min)

### Video Script

**[INTRO - 0:00-0:30]**

"Search/Replace is the simplest edit format. The LLM outputs blocks that say 'find this exact text, replace with this new text.'

Let's build it."

---

**[THE FORMAT - 0:30-2:00]**

"Here's what the LLM outputs:"

```
To add error handling to the login function:

<<<<<<< SEARCH
async function login(email, password) {
  const user = await db.findUser(email);
  return user;
}
=======
async function login(email, password) {
  const user = await db.findUser(email);
  if (!user) {
    throw new Error('User not found');
  }
  if (!await verifyPassword(password, user.passwordHash)) {
    throw new Error('Invalid password');
  }
  return user;
}
>>>>>>> REPLACE
```

"Clear and explicit:
- SEARCH section = exact text to find
- REPLACE section = new text to use"

---

**[IMPLEMENTATION - 2:00-7:00]**

"Create `src/edit/search-replace.ts`:"

```typescript
export interface SearchReplaceBlock {
  search: string;
  replace: string;
}

export function parseSearchReplaceBlocks(text: string): SearchReplaceBlock[] {
  const blocks: SearchReplaceBlock[] = [];
  
  // Match the pattern
  const regex = /<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/g;
  
  let match;
  while ((match = regex.exec(text)) !== null) {
    blocks.push({
      search: match[1],
      replace: match[2]
    });
  }
  
  return blocks;
}

export interface ApplyResult {
  success: boolean;
  content?: string;
  error?: string;
}

export function applySearchReplace(
  fileContent: string,
  blocks: SearchReplaceBlock[]
): ApplyResult {
  let content = fileContent;
  
  for (const block of blocks) {
    // Check if search text exists
    if (!content.includes(block.search)) {
      return {
        success: false,
        error: `Could not find search text:\n${block.search.slice(0, 100)}...`
      };
    }
    
    // Apply replacement
    content = content.replace(block.search, block.replace);
  }
  
  return { success: true, content };
}
```

---

**[HANDLING EDGE CASES - 7:00-10:00]**

"Search/Replace has pitfalls. Let's handle them:"

```typescript
export function applySearchReplaceRobust(
  fileContent: string,
  blocks: SearchReplaceBlock[]
): ApplyResult {
  let content = fileContent;
  
  for (const block of blocks) {
    let search = block.search;
    let found = false;
    
    // Try exact match first
    if (content.includes(search)) {
      content = content.replace(search, block.replace);
      found = true;
    }
    
    // Try with normalized whitespace
    if (!found) {
      const normalizedSearch = normalizeWhitespace(search);
      const normalizedContent = normalizeWhitespace(content);
      
      if (normalizedContent.includes(normalizedSearch)) {
        // Find the actual position in original content
        const result = fuzzyReplace(content, search, block.replace);
        if (result) {
          content = result;
          found = true;
        }
      }
    }
    
    // Try line-by-line matching
    if (!found) {
      const result = lineByLineMatch(content, search, block.replace);
      if (result) {
        content = result;
        found = true;
      }
    }
    
    if (!found) {
      return {
        success: false,
        error: `Could not find search text (tried exact, normalized, and fuzzy):\n${search.slice(0, 200)}...`,
        suggestion: findSimilarCode(content, search)
      };
    }
  }
  
  return { success: true, content };
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function lineByLineMatch(
  content: string,
  search: string,
  replace: string
): string | null {
  const searchLines = search.split('\n').map(l => l.trim()).filter(l => l);
  const contentLines = content.split('\n');
  
  // Find where search lines start in content
  for (let i = 0; i <= contentLines.length - searchLines.length; i++) {
    let matches = true;
    for (let j = 0; j < searchLines.length; j++) {
      if (contentLines[i + j].trim() !== searchLines[j]) {
        matches = false;
        break;
      }
    }
    
    if (matches) {
      // Found it! Replace those lines
      const before = contentLines.slice(0, i);
      const after = contentLines.slice(i + searchLines.length);
      return [...before, replace, ...after].join('\n');
    }
  }
  
  return null;
}
```

---

**[WHEN TO USE - 10:00-12:00]**

"Search/Replace works best for:
- Small, targeted changes
- Adding/removing a few lines
- Simple refactors

It struggles with:
- Large rewrites
- Complex changes across many locations
- When the LLM doesn't reproduce exact text"

---

## 4.3 Unified Diffs — The Gold Standard (15 min)

### Video Script

**[INTRO - 0:00-0:30]**

"Unified diffs are what `git diff` produces. LLMs have seen millions of them in training. Aider found that switching to diffs made GPT-4 THREE times less lazy about writing complete code.

Let's implement it."

---

**[THE FORMAT - 0:30-3:00]**

"A unified diff looks like:"

```diff
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -10,7 +10,12 @@
 async function login(email, password) {
   const user = await db.findUser(email);
-  return user;
+  if (!user) {
+    throw new Error('User not found');
+  }
+  if (!await verifyPassword(password, user.passwordHash)) {
+    throw new Error('Invalid password');
+  }
+  return user;
 }
```

"Key elements:
- Lines starting with space = context (unchanged)
- Lines starting with `-` = removed
- Lines starting with `+` = added
- The `@@` header shows line numbers (but we'll ignore these)

Why ignore line numbers? LLMs get them wrong. We use the context lines to find where to apply changes."

---

**[PARSING DIFFS - 3:00-8:00]**

"Create `src/edit/diff.ts`:"

```typescript
export interface DiffHunk {
  contextBefore: string[];  // Space lines before changes
  removals: string[];       // Lines starting with -
  additions: string[];      // Lines starting with +
  contextAfter: string[];   // Space lines after changes
}

export interface ParsedDiff {
  filePath: string;
  hunks: DiffHunk[];
}

export function parseDiff(diffText: string): ParsedDiff[] {
  const diffs: ParsedDiff[] = [];
  const lines = diffText.split('\n');
  
  let currentFile: string | null = null;
  let currentHunks: DiffHunk[] = [];
  let currentHunk: DiffHunk | null = null;
  let inHunk = false;
  
  for (const line of lines) {
    // File header
    if (line.startsWith('--- a/') || line.startsWith('--- ')) {
      // Save previous file
      if (currentFile && currentHunks.length > 0) {
        diffs.push({ filePath: currentFile, hunks: currentHunks });
      }
      currentHunks = [];
      continue;
    }
    
    if (line.startsWith('+++ b/') || line.startsWith('+++ ')) {
      currentFile = line.replace(/^\+\+\+ [ab]\//, '').replace(/^\+\+\+ /, '');
      continue;
    }
    
    // Hunk header
    if (line.startsWith('@@')) {
      if (currentHunk) {
        currentHunks.push(currentHunk);
      }
      currentHunk = {
        contextBefore: [],
        removals: [],
        additions: [],
        contextAfter: []
      };
      inHunk = true;
      continue;
    }
    
    if (!inHunk || !currentHunk) continue;
    
    // Hunk content
    if (line.startsWith(' ')) {
      const content = line.slice(1);
      // Determine if before or after changes
      if (currentHunk.removals.length === 0 && currentHunk.additions.length === 0) {
        currentHunk.contextBefore.push(content);
      } else {
        currentHunk.contextAfter.push(content);
      }
    } else if (line.startsWith('-')) {
      currentHunk.removals.push(line.slice(1));
    } else if (line.startsWith('+')) {
      currentHunk.additions.push(line.slice(1));
    }
  }
  
  // Save last hunk and file
  if (currentHunk) currentHunks.push(currentHunk);
  if (currentFile && currentHunks.length > 0) {
    diffs.push({ filePath: currentFile, hunks: currentHunks });
  }
  
  return diffs;
}
```

---

**[APPLYING DIFFS - 8:00-13:00]**

"Now the tricky part — applying:"

```typescript
export function applyDiff(
  fileContent: string,
  diff: ParsedDiff
): ApplyResult {
  let lines = fileContent.split('\n');
  
  // Apply hunks in reverse order to preserve line numbers
  const sortedHunks = [...diff.hunks].reverse();
  
  for (const hunk of sortedHunks) {
    const result = applyHunk(lines, hunk);
    if (!result.success) {
      return result;
    }
    lines = result.lines!;
  }
  
  return { success: true, content: lines.join('\n') };
}

function applyHunk(
  lines: string[],
  hunk: DiffHunk
): { success: boolean; lines?: string[]; error?: string } {
  // Build the search pattern from context + removals
  const searchPattern = [
    ...hunk.contextBefore,
    ...hunk.removals,
    ...hunk.contextAfter
  ];
  
  // Find where this pattern occurs
  const startIndex = findPattern(lines, searchPattern);
  
  if (startIndex === -1) {
    // Try fuzzy matching
    const fuzzyStart = findPatternFuzzy(lines, searchPattern);
    if (fuzzyStart === -1) {
      return {
        success: false,
        error: `Could not find location for hunk:\n${searchPattern.slice(0, 5).join('\n')}...`
      };
    }
    return applyHunkAt(lines, hunk, fuzzyStart);
  }
  
  return applyHunkAt(lines, hunk, startIndex);
}

function applyHunkAt(
  lines: string[],
  hunk: DiffHunk,
  startIndex: number
): { success: boolean; lines?: string[] } {
  const contextBeforeLen = hunk.contextBefore.length;
  const removalsLen = hunk.removals.length;
  const contextAfterLen = hunk.contextAfter.length;
  
  // Build the new content
  const newLines = [
    ...hunk.contextBefore,
    ...hunk.additions,
    ...hunk.contextAfter
  ];
  
  // Calculate what to remove
  const removeStart = startIndex;
  const removeCount = contextBeforeLen + removalsLen + contextAfterLen;
  
  // Apply
  const result = [
    ...lines.slice(0, removeStart),
    ...newLines,
    ...lines.slice(removeStart + removeCount)
  ];
  
  return { success: true, lines: result };
}

function findPattern(lines: string[], pattern: string[]): number {
  outer:
  for (let i = 0; i <= lines.length - pattern.length; i++) {
    for (let j = 0; j < pattern.length; j++) {
      if (lines[i + j] !== pattern[j]) {
        continue outer;
      }
    }
    return i;
  }
  return -1;
}
```

---

**[HIGH-LEVEL DIFFS - 13:00-15:00]**

"Aider prompts the LLM to produce 'high-level diffs' — replacing entire functions rather than surgical line edits.

Why? More context = easier to match, fewer errors."

```diff
# BAD: Surgical (hard to match)
@@ ... @@
 function calculate(n) {
-  return n * 2;
+  if (n < 0) throw new Error('Negative');
+  return n * 2;
 }

# GOOD: High-level (easy to match)
@@ ... @@
-function calculate(n) {
-  return n * 2;
-}
+function calculate(n) {
+  if (n < 0) throw new Error('Negative');
+  return n * 2;
+}
```

"We add this to the system prompt:

'When showing diffs, prefer to show complete function or class replacements rather than minimal line changes. This makes changes clearer and easier to apply.'"

---

## 4.4 Whole File Rewrite (8 min)

### Video Script

**[INTRO - 0:00-0:30]**

"Sometimes the simplest approach is best: just have the LLM output the entire new file.

No parsing, no matching, no ambiguity."

---

**[WHEN TO USE - 0:30-2:00]**

"Whole file rewrite makes sense when:
- Creating new files (obviously)
- Making extensive changes (>50% of file)
- File is small (<200 lines)
- You're frustrated with edit failures

Downsides:
- Uses more tokens (expensive)
- LLM might accidentally change things you didn't ask for
- No clear record of what changed"

---

**[IMPLEMENTATION - 2:00-5:00]**

"The format is simple:"

```
To create the new utils file:

```typescript
// src/utils/helpers.ts
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
```​

"Implementation:"

```typescript
export interface FileBlock {
  path: string;
  content: string;
  language: string;
}

export function parseFileBlocks(text: string): FileBlock[] {
  const blocks: FileBlock[] = [];
  
  // Match: // path/to/file.ext followed by code block
  const patterns = [
    // Comment style: // path/to/file.ts
    /\/\/\s*([\w\/.+-]+\.\w+)\s*\n```(\w+)?\n([\s\S]*?)```/g,
    // Header style: ### path/to/file.ts
    /###?\s*([\w\/.+-]+\.\w+)\s*\n```(\w+)?\n([\s\S]*?)```/g,
    // File: prefix
    /File:\s*([\w\/.+-]+\.\w+)\s*\n```(\w+)?\n([\s\S]*?)```/g,
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      blocks.push({
        path: match[1],
        language: match[2] || inferLanguage(match[1]),
        content: match[3].trim()
      });
    }
  }
  
  return blocks;
}

function inferLanguage(path: string): string {
  const ext = path.split('.').pop() || '';
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    rs: 'rust',
    go: 'go',
  };
  return map[ext] || ext;
}
```

---

**[SAFETY: DIFF BEFORE APPLY - 5:00-8:00]**

"Always show the user what will change:"

```typescript
import { diffLines } from 'diff';

export function previewChanges(
  oldContent: string,
  newContent: string
): string {
  const changes = diffLines(oldContent, newContent);
  
  let preview = '';
  for (const part of changes) {
    const prefix = part.added ? '+' : part.removed ? '-' : ' ';
    const lines = part.value.split('\n').filter(l => l);
    for (const line of lines) {
      preview += prefix + line + '\n';
    }
  }
  
  return preview;
}

// Usage
const preview = previewChanges(oldFile, newFile);
console.log('Changes to be made:');
console.log(preview);
const confirm = await prompt('Apply these changes? (y/n)');
```

"This catches cases where the LLM accidentally removed important code."

---

## 4.5 Handling Edit Failures Gracefully (15 min)

### Video Script

**[INTRO - 0:00-0:30]**

"Edits fail. The LLM forgets whitespace, misremembers code, or just makes mistakes.

A robust agent handles this gracefully instead of crashing."

---

**[COMMON FAILURES - 0:30-3:00]**

"Here are the most common edit failures:

1. **Missing context**: LLM forgets comments, blank lines, or docstrings
2. **Wrong indentation**: Especially in Python
3. **Outdated content**: LLM's 'search' doesn't match current file
4. **Partial match**: Search text appears multiple times
5. **Encoding issues**: Special characters get mangled"

---

**[FUZZY MATCHING - 3:00-7:00]**

"Implement fuzzy matching for when exact fails:"

```typescript
import { distance } from 'fastest-levenshtein';

export function findBestMatch(
  lines: string[],
  searchLines: string[],
  threshold: number = 0.8
): { index: number; score: number } | null {
  const searchText = searchLines.join('\n');
  let bestMatch = { index: -1, score: 0 };
  
  // Slide window over content
  for (let i = 0; i <= lines.length - searchLines.length; i++) {
    const window = lines.slice(i, i + searchLines.length).join('\n');
    const similarity = calculateSimilarity(searchText, window);
    
    if (similarity > bestMatch.score) {
      bestMatch = { index: i, score: similarity };
    }
  }
  
  if (bestMatch.score >= threshold) {
    return bestMatch;
  }
  
  return null;
}

function calculateSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - distance(a, b) / maxLen;
}
```

---

**[AUTO-RETRY WITH FEEDBACK - 7:00-11:00]**

"When an edit fails, ask the LLM to try again with feedback:"

```typescript
export async function applyEditWithRetry(
  fileContent: string,
  edit: EditRequest,
  options: {
    maxRetries?: number;
    llmClient: LLMClient;
  }
): Promise<ApplyResult> {
  const maxRetries = options.maxRetries ?? 3;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const result = applyEdit(fileContent, edit);
    
    if (result.success) {
      return result;
    }
    
    // Ask LLM to fix the edit
    const fixPrompt = `
Your edit could not be applied:

Error: ${result.error}

Original file content:
\`\`\`
${fileContent}
\`\`\`

Your attempted edit:
${JSON.stringify(edit, null, 2)}

Please provide a corrected edit that will match the actual file content.
`;
    
    const fixedEdit = await options.llmClient.chat([
      { role: 'user', content: fixPrompt }
    ]);
    
    // Parse the fixed edit
    edit = parseEdit(fixedEdit);
  }
  
  return {
    success: false,
    error: `Failed to apply edit after ${maxRetries} attempts`
  };
}
```

---

**[VALIDATION AFTER APPLY - 11:00-14:00]**

"Always validate the result:"

```typescript
export async function validateEdit(
  filePath: string,
  oldContent: string,
  newContent: string
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];
  
  // 1. Syntax check
  const ext = path.extname(filePath);
  if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
    try {
      // Try parsing with tree-sitter
      const parser = getParser(ext);
      const tree = parser.parse(newContent);
      
      // Check for syntax errors
      if (tree.rootNode.hasError()) {
        errors.push('Syntax error in generated code');
      }
    } catch (e) {
      errors.push(`Parse error: ${e.message}`);
    }
  }
  
  // 2. Check for accidental deletions
  const oldLines = oldContent.split('\n').length;
  const newLines = newContent.split('\n').length;
  
  if (newLines < oldLines * 0.5) {
    errors.push(`Warning: File shrank significantly (${oldLines} → ${newLines} lines)`);
  }
  
  // 3. Check for removed imports that are still used
  const removedImports = findRemovedImports(oldContent, newContent);
  for (const imp of removedImports) {
    if (newContent.includes(imp.identifier)) {
      errors.push(`Removed import '${imp.identifier}' but it's still used`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
```

---

**[ROLLBACK CAPABILITY - 14:00-15:00]**

"Always keep the ability to undo:"

```typescript
export class EditSession {
  private history: Array<{
    file: string;
    before: string;
    after: string;
    timestamp: Date;
  }> = [];
  
  recordEdit(file: string, before: string, after: string): void {
    this.history.push({
      file,
      before,
      after,
      timestamp: new Date()
    });
  }
  
  async rollback(steps: number = 1): Promise<void> {
    for (let i = 0; i < steps && this.history.length > 0; i++) {
      const edit = this.history.pop()!;
      await fs.writeFile(edit.file, edit.before);
      console.log(`Rolled back ${edit.file}`);
    }
  }
  
  async rollbackAll(): Promise<void> {
    await this.rollback(this.history.length);
  }
}
```

"Never lose the user's code."

---

## Module 4 Summary

You now understand:
1. Why JSON is bad for code edits
2. Search/Replace blocks
3. Unified diffs (the best format)
4. Whole file rewrites
5. Error handling and recovery

**Key insight:** The edit format is as important as the LLM itself. Bad format = bad results regardless of model quality.

Next: Module 5 — The Agent Loop. Putting everything together.
