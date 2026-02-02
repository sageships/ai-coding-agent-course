# Module 4: Code Editing Formats — Conceptual Guide

## 🎯 The Problem We're Solving

LLMs generate text. But we need **precise file changes**. How do we turn "text output" into "surgical code edits"?

This translation is deceptively hard — and getting it wrong means broken code.

---

## ❌ Why JSON Fails for Code Edits

Your first instinct might be: use JSON! It's structured, parseable, clean.

```json
{
  "file": "src/utils.ts",
  "changes": [{
    "line": 15,
    "old": "console.log(\"Hello\")",
    "new": "console.log(\"Hello, World!\")"
  }]
}
```

Now try this real code:

```typescript
function greet() {
  console.log("Say \"Hello\" to the world!");
  console.log("Path: C:\\Users\\name");
}
```

As JSON:
```json
{
  "new": "console.log(\"Say \\\"Hello\\\" to the world!\");\nconsole.log(\"Path: C:\\\\Users\\\\name\");"
}
```

**The escaping nightmare:**
- Every `"` becomes `\"`
- Every `\` becomes `\\`
- Newlines become `\n`
- LLM must write valid JSON WHILE writing code

Result: constant syntax errors, broken escapes, malformed JSON.

---

## 🧠 The Familiar Format Principle

Aider discovered: **LLMs work better with formats they've seen in training data.**

**What GPT has seen millions of times:**
- Git diffs (`git diff` output)
- Code blocks in markdown
- Simple text with markers

**What GPT rarely sees:**
- Custom JSON schemas for code
- XML with embedded code
- Invented syntaxes

**Lesson:** Don't invent a format. Use something familiar.

---

## 📍 Why Line Numbers Are Unreliable

LLMs are BAD at counting lines. Ask GPT to edit line 47, and it might:
- Count wrong
- Get confused by blank lines
- Lose track in long files

```
❌ BAD:  "Replace line 47"
✅ GOOD: "Find this exact code and replace it"
```

**Use the actual code as an anchor, not line numbers.**

---

## 🔧 The Three Edit Formats

### 1. Search/Replace Blocks

```
<<<<<<< SEARCH
async function login(email, password) {
  const user = await db.findUser(email);
  return user;
}
=======
async function login(email, password) {
  const user = await db.findUser(email);
  if (!user) throw new Error('User not found');
  return user;
}
>>>>>>> REPLACE
```

**How it works:**
1. Parse the `<<<<<<< SEARCH` / `>>>>>>> REPLACE` markers
2. Find exact text match of the SEARCH section
3. Replace with REPLACE section

**Pros:** Simple, explicit
**Cons:** Fails if text doesn't match exactly

---

### 2. Unified Diffs (The Gold Standard)

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
+  return user;
 }
```

**How it works:**
1. Parse the diff format (lines starting with ` `, `-`, `+`)
2. Use context lines (` `) to FIND where to apply changes
3. Remove `-` lines, add `+` lines
4. Ignore `@@` line numbers (LLMs get them wrong)

**Key insight:** We use context lines as anchors, not line numbers!

**Pros:** Familiar format, flexible matching
**Cons:** More complex parsing

---

### 3. Whole File Rewrite

```typescript
// src/utils/helpers.ts
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}
```

**How it works:**
1. Parse file path from comment/header
2. Replace entire file with new content

**Pros:** No parsing complexity, no ambiguity
**Cons:** Expensive (tokens), might accidentally change things

---

## 🔧 HOW IT WORKS MECHANICALLY: Diff Application

**Step-by-step algorithm for applying unified diffs:**

```
ALGORITHM: ApplyUnifiedDiff(file_content, diff)
────────────────────────────────────────────────

INPUT:
  file_content = "line1\nline2\nline3\nline4\nline5"
  diff = DiffHunk {
    context_before: ["line2"]
    removals: ["line3"]
    additions: ["new_line3a", "new_line3b"]
    context_after: ["line4"]
  }

STEP 1: Build search pattern from hunk
  search_pattern = context_before + removals + context_after
  search_pattern = ["line2", "line3", "line4"]

STEP 2: Find pattern in file
  Split file into lines: ["line1", "line2", "line3", "line4", "line5"]
  
  Search for consecutive match:
    i=0: ["line1", "line2", "line3"] != search_pattern ❌
    i=1: ["line2", "line3", "line4"] == search_pattern ✓
  
  Found at index 1!

STEP 3: Calculate replacement
  keep_before = lines[0:1] = ["line1"]
  new_content = context_before + additions + context_after
            = ["line2", "new_line3a", "new_line3b", "line4"]
  keep_after  = lines[4:] = ["line5"]

STEP 4: Assemble result
  result = keep_before + new_content + keep_after
         = ["line1", "line2", "new_line3a", "new_line3b", "line4", "line5"]

OUTPUT: "line1\nline2\nnew_line3a\nnew_line3b\nline4\nline5"
```

---

## 🔧 HOW IT WORKS MECHANICALLY: Fuzzy Matching

When exact match fails, we use fuzzy matching:

```
ALGORITHM: FuzzyMatch(content_lines, search_lines, threshold=0.8)
──────────────────────────────────────────────────────────────────

1. Normalize whitespace in both:
   "  const x = 1;  " → "const x = 1;"

2. For each window position in content:
   window = content_lines[i : i + len(search_lines)]
   
3. Calculate similarity using Levenshtein distance:
   similarity = 1 - (edit_distance / max_length)
   
   Example:
     search: "const x = 1;"
     window: "const x = 2;"
     distance = 1 (one character different)
     similarity = 1 - (1/12) = 0.92

4. If similarity > threshold, we found a match!
   Return the position.

5. If no match found, try line-by-line comparison:
   - Trim each line
   - Compare trimmed versions
   - Accounts for indentation differences
```

**Similarity scoring:**
```
100%: "function hello()" vs "function hello()"
 92%: "function hello()" vs "function helo()"  (typo)
 75%: "function hello()" vs "function goodbye()" 
  0%: "function hello()" vs "class Foo"
```

---

## ⚠️ Common Failure Modes

| Failure | Cause | Solution |
|---------|-------|----------|
| "Text not found" | LLM forgot comments/whitespace | Fuzzy matching |
| Wrong indentation | Python/YAML sensitivity | Line-by-line trim match |
| Multiple matches | Search text appears 2+ times | Add more context |
| Encoding issues | Special characters mangled | Normalize Unicode |

---

## 🛡️ Recovery Strategy

```
ALGORITHM: ApplyWithRetry(file, edit, max_attempts=3)
─────────────────────────────────────────────────────

FOR attempt in 1..max_attempts:
    result = try_apply(file, edit)
    
    IF result.success:
        RETURN result
    
    IF attempt < max_attempts:
        # Ask LLM to fix the edit
        fixed_edit = ask_llm("""
            Your edit failed with error: {result.error}
            
            Actual file content:
            {file}
            
            Please provide a corrected edit.
        """)
        
        edit = parse(fixed_edit)

RETURN failure("Max attempts exceeded")
```

---

## 📺 Video Flow

1. Show JSON failing with quotes and escapes
2. Explain the "familiar format" principle
3. Demo Search/Replace format
4. Demo Unified Diff format
5. Show fuzzy matching in action
6. Walk through error recovery

---

**Next:** See `demo.ts` for the implementation
