/**
 * 🎓 MODULE 4: Code Editing Formats
 * 
 * How do we turn LLM text output into precise file changes?
 * 
 * This demo shows three edit formats:
 * 1. Search/Replace blocks - Simple find-and-replace
 * 2. Unified diffs - Git-style diffs (the best format)
 * 3. Whole file rewrite - Replace entire file
 * 
 * Plus: fuzzy matching for when exact matches fail.
 */

// ============================================================================
// 📺 SECTION 1: Search/Replace Format
// ============================================================================

interface SearchReplaceBlock {
  search: string;
  replace: string;
}

/**
 * Parse search/replace blocks from LLM output
 * 
 * Format:
 * <<<<<<< SEARCH
 * old code here
 * =======
 * new code here
 * >>>>>>> REPLACE
 */
function parseSearchReplaceBlocks(text: string): SearchReplaceBlock[] {
  const blocks: SearchReplaceBlock[] = [];
  
  // Match the pattern with regex
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

/**
 * Apply search/replace to file content
 */
function applySearchReplace(
  content: string, 
  blocks: SearchReplaceBlock[]
): { success: boolean; content?: string; error?: string } {
  let result = content;
  
  for (const block of blocks) {
    if (!result.includes(block.search)) {
      return {
        success: false,
        error: `Could not find:\n"${block.search.slice(0, 100)}..."`
      };
    }
    result = result.replace(block.search, block.replace);
  }
  
  return { success: true, content: result };
}

// ============================================================================
// 📺 SECTION 2: Unified Diff Format
// ============================================================================

interface DiffHunk {
  contextBefore: string[];
  removals: string[];
  additions: string[];
  contextAfter: string[];
}

interface ParsedDiff {
  filePath: string;
  hunks: DiffHunk[];
}

/**
 * Parse unified diff format
 * 
 * 💡 KEY INSIGHT: We ignore line numbers (@@) because LLMs get them wrong!
 *    Instead, we use the context lines (starting with space) to find
 *    where to apply changes.
 */
function parseDiff(diffText: string): ParsedDiff | null {
  const lines = diffText.split('\n');
  let filePath = '';
  const hunks: DiffHunk[] = [];
  let currentHunk: DiffHunk | null = null;
  let inHunk = false;
  
  for (const line of lines) {
    // Parse file path
    if (line.startsWith('+++ ')) {
      filePath = line.replace(/^\+\+\+ [ab]\//, '').replace(/^\+\+\+ /, '');
      continue;
    }
    
    // Start of new hunk (we ignore the line numbers!)
    if (line.startsWith('@@')) {
      if (currentHunk) hunks.push(currentHunk);
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
    
    // Parse hunk content
    if (line.startsWith(' ')) {
      const content = line.slice(1);
      // Is this before or after the changes?
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
  
  if (currentHunk) hunks.push(currentHunk);
  
  return filePath ? { filePath, hunks } : null;
}

/**
 * 🔧 HOW IT WORKS: Apply a diff hunk to file content
 * 
 * Algorithm:
 * 1. Build search pattern from: context_before + removals + context_after
 * 2. Find this pattern in the file (using context as anchor!)
 * 3. Replace with: context_before + additions + context_after
 */
function applyDiff(
  content: string, 
  diff: ParsedDiff
): { success: boolean; content?: string; error?: string } {
  let lines = content.split('\n');
  
  // Apply hunks in REVERSE order to preserve line positions
  for (const hunk of [...diff.hunks].reverse()) {
    // Build the search pattern
    const searchPattern = [
      ...hunk.contextBefore,
      ...hunk.removals,
      ...hunk.contextAfter
    ];
    
    // Find where this pattern occurs
    const startIndex = findPattern(lines, searchPattern);
    
    if (startIndex === -1) {
      // Try fuzzy matching
      const fuzzyResult = findPatternFuzzy(lines, searchPattern);
      if (fuzzyResult === -1) {
        return {
          success: false,
          error: `Could not find context:\n${searchPattern.slice(0, 3).join('\n')}...`
        };
      }
      lines = applyHunkAt(lines, hunk, fuzzyResult);
    } else {
      lines = applyHunkAt(lines, hunk, startIndex);
    }
  }
  
  return { success: true, content: lines.join('\n') };
}

/**
 * Find exact pattern match in lines
 */
function findPattern(lines: string[], pattern: string[]): number {
  for (let i = 0; i <= lines.length - pattern.length; i++) {
    let matches = true;
    for (let j = 0; j < pattern.length; j++) {
      if (lines[i + j] !== pattern[j]) {
        matches = false;
        break;
      }
    }
    if (matches) return i;
  }
  return -1;
}

/**
 * Apply hunk at specific position
 */
function applyHunkAt(lines: string[], hunk: DiffHunk, startIndex: number): string[] {
  const removeCount = 
    hunk.contextBefore.length + 
    hunk.removals.length + 
    hunk.contextAfter.length;
  
  const newContent = [
    ...hunk.contextBefore,
    ...hunk.additions,
    ...hunk.contextAfter
  ];
  
  return [
    ...lines.slice(0, startIndex),
    ...newContent,
    ...lines.slice(startIndex + removeCount)
  ];
}

// ============================================================================
// 📺 SECTION 3: Fuzzy Matching
// ============================================================================

/**
 * 🔧 HOW IT WORKS: Fuzzy pattern matching
 * 
 * When exact match fails, we try:
 * 1. Normalized whitespace matching
 * 2. Levenshtein distance for similarity
 */
function findPatternFuzzy(
  lines: string[], 
  pattern: string[], 
  threshold: number = 0.8
): number {
  const patternText = pattern.map(l => l.trim()).join('\n');
  
  for (let i = 0; i <= lines.length - pattern.length; i++) {
    const windowText = lines.slice(i, i + pattern.length)
      .map(l => l.trim())
      .join('\n');
    
    const similarity = calculateSimilarity(patternText, windowText);
    
    if (similarity >= threshold) {
      return i;
    }
  }
  
  return -1;
}

/**
 * Calculate string similarity (0-1)
 * Uses simplified Levenshtein-based approach
 */
function calculateSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  
  // Simple character-based similarity
  const maxLen = Math.max(a.length, b.length);
  let matches = 0;
  
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] === b[i]) matches++;
  }
  
  // Also check for substring containment
  if (a.includes(b) || b.includes(a)) {
    return 0.9;
  }
  
  return matches / maxLen;
}

// ============================================================================
// ▶️ DEMO
// ============================================================================

async function main() {
  console.log("🎓 Module 4: Code Editing Formats Demo\n");
  console.log("=".repeat(60) + "\n");
  
  // Sample file content
  const originalFile = `export class AuthService {
  constructor(private db: Database) {}
  
  async login(email: string, password: string) {
    const user = await this.db.findUser(email);
    return user;
  }
  
  async logout(userId: string) {
    await this.db.clearSession(userId);
  }
}`;

  console.log("📄 ORIGINAL FILE:");
  console.log("-".repeat(40));
  console.log(originalFile);
  console.log("-".repeat(40) + "\n");

  // -------------------------------------------------------------------------
  // Demo 1: Search/Replace
  // -------------------------------------------------------------------------
  console.log("📝 DEMO 1: Search/Replace Format\n");
  
  const searchReplaceInput = `I'll add input validation to the login function:

<<<<<<< SEARCH
  async login(email: string, password: string) {
    const user = await this.db.findUser(email);
    return user;
  }
=======
  async login(email: string, password: string) {
    if (!email || !password) {
      throw new Error('Email and password required');
    }
    const user = await this.db.findUser(email);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }
>>>>>>> REPLACE`;

  console.log("LLM Output:");
  console.log(searchReplaceInput);
  console.log();
  
  const blocks = parseSearchReplaceBlocks(searchReplaceInput);
  console.log(`Parsed ${blocks.length} search/replace block(s)\n`);
  
  const searchReplaceResult = applySearchReplace(originalFile, blocks);
  if (searchReplaceResult.success) {
    console.log("✅ Applied successfully!");
    console.log("Result:");
    console.log("-".repeat(40));
    console.log(searchReplaceResult.content);
    console.log("-".repeat(40));
  } else {
    console.log("❌ Failed:", searchReplaceResult.error);
  }
  
  console.log("\n" + "=".repeat(60) + "\n");
  
  // -------------------------------------------------------------------------
  // Demo 2: Unified Diff
  // -------------------------------------------------------------------------
  console.log("📝 DEMO 2: Unified Diff Format\n");
  
  const diffInput = `--- a/src/auth.ts
+++ b/src/auth.ts
@@ -4,7 +4,12 @@
   constructor(private db: Database) {}
   
   async login(email: string, password: string) {
-    const user = await this.db.findUser(email);
-    return user;
+    if (!email || !password) {
+      throw new Error('Email and password required');
+    }
+    const user = await this.db.findUser(email);
+    if (!user) {
+      throw new Error('User not found');
+    }
+    return user;
   }
   
   async logout(userId: string) {`;

  console.log("LLM Output (diff):");
  console.log(diffInput);
  console.log();
  
  const diff = parseDiff(diffInput);
  if (diff) {
    console.log(`Parsed diff for: ${diff.filePath}`);
    console.log(`Contains ${diff.hunks.length} hunk(s)`);
    
    for (let i = 0; i < diff.hunks.length; i++) {
      const h = diff.hunks[i];
      console.log(`  Hunk ${i + 1}: -${h.removals.length} lines, +${h.additions.length} lines`);
    }
    console.log();
    
    const diffResult = applyDiff(originalFile, diff);
    if (diffResult.success) {
      console.log("✅ Applied successfully!");
      console.log("Result:");
      console.log("-".repeat(40));
      console.log(diffResult.content);
      console.log("-".repeat(40));
    } else {
      console.log("❌ Failed:", diffResult.error);
    }
  }
  
  console.log("\n" + "=".repeat(60) + "\n");
  
  // -------------------------------------------------------------------------
  // Demo 3: Fuzzy Matching
  // -------------------------------------------------------------------------
  console.log("📝 DEMO 3: Fuzzy Matching (when exact fails)\n");
  
  // Search text has slightly different whitespace
  const fuzzySearchReplace = `<<<<<<< SEARCH
  async login(email: string, password: string) {
      const user = await this.db.findUser(email);
      return user;
  }
=======
  async login(email: string, password: string) {
    // Validated
    return await this.db.findUser(email);
  }
>>>>>>> REPLACE`;

  console.log("LLM Output (with wrong indentation):");
  console.log(fuzzySearchReplace);
  console.log();
  
  const fuzzyBlocks = parseSearchReplaceBlocks(fuzzySearchReplace);
  const exactResult = applySearchReplace(originalFile, fuzzyBlocks);
  
  if (!exactResult.success) {
    console.log("❌ Exact match failed:", exactResult.error);
    console.log("🔍 Trying fuzzy match...\n");
    
    // Try fuzzy matching
    const searchLines = fuzzyBlocks[0].search.split('\n');
    const fileLines = originalFile.split('\n');
    const fuzzyIndex = findPatternFuzzy(fileLines, searchLines, 0.7);
    
    if (fuzzyIndex !== -1) {
      console.log(`✅ Fuzzy match found at line ${fuzzyIndex + 1}`);
      console.log(`Matched with ~${(calculateSimilarity(
        searchLines.map(l => l.trim()).join('\n'),
        fileLines.slice(fuzzyIndex, fuzzyIndex + searchLines.length).map(l => l.trim()).join('\n')
      ) * 100).toFixed(0)}% similarity`);
    }
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("\n✅ Demo complete!\n");
  
  console.log("💡 KEY TAKEAWAYS:");
  console.log("1. Search/Replace is simple but requires exact matching");
  console.log("2. Unified diffs are more flexible (LLMs know this format well)");
  console.log("3. Fuzzy matching saves the day when LLMs get whitespace wrong");
  console.log("4. Always validate the result before committing changes");
}

main().catch(console.error);
