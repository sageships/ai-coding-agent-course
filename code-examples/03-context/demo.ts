/**
 * 🎓 MODULE 3: Code Context — How AI Agents "See" Your Codebase
 * 
 * This is THE SECRET SAUCE that makes tools like Cursor and Aider work.
 * 
 * THE PROBLEM:
 * - A medium project has 50,000+ lines of code
 * - LLMs have context limits (128k tokens max)
 * - Even if it fit, sending everything is: expensive, slow, and makes LLMs worse
 * 
 * THE SOLUTION:
 * - Create a "map" of the codebase (file structure + key symbols)
 * - Only send files that are RELEVANT to the current task
 * - Let the LLM request more files when needed
 * 
 * This file shows you how to build a basic repo map.
 */

import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// CONCEPT 1: The Repository Map
// =============================================================================
/**
 * A repo map is a condensed overview of your codebase. It shows:
 * - File structure
 * - Class/function names (without implementation details)
 * - Import relationships
 * 
 * WHY THIS MATTERS:
 * Instead of sending 50,000 lines of code (~200k tokens), we send ~1,000 tokens
 * that give the LLM enough context to understand the project structure.
 * 
 * WHAT THE LLM CAN DO WITH IT:
 * - Know which files exist and what they contain
 * - Understand the architecture (auth/, models/, api/ etc.)
 * - Ask for specific files when needed (using read_file tool)
 */

interface FileInfo {
  path: string;
  type: 'file' | 'directory';
  size?: number;
  exports?: string[];  // Exported functions/classes
  imports?: string[];  // Import statements
}

// =============================================================================
// SYMBOL EXTRACTION
// =============================================================================
/**
 * Extract exports from a TypeScript/JavaScript file
 * 
 * HOW IT WORKS:
 * This is a simplified regex-based approach. It finds patterns like:
 *   - export function foo()
 *   - export class Bar
 *   - export const baz
 * 
 * WHY REGEX ISN'T ENOUGH (and why real tools use tree-sitter):
 * Regex fails on:
 *   - const foo = function() {}           // anonymous function
 *   - export { foo } from './bar'         // re-exports
 *   - function /* comment */ foo() {}     // comments break patterns
 *   - Nested functions, classes with methods, etc.
 * 
 * Tree-sitter understands the STRUCTURE of code, not just text patterns.
 * It builds an AST (Abstract Syntax Tree) that represents the code as a tree,
 * then we query that tree for specific node types.
 * 
 * See CONCEPT.md for detailed tree-sitter explanation.
 */
function extractExports(content: string): string[] {
  const exports: string[] = [];
  
  // Match: export function name
  // WHY: These are the public API of the file
  const funcMatches = content.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g);
  for (const match of funcMatches) {
    exports.push(`function ${match[1]}`);
  }
  
  // Match: export class name
  // WHY: Classes define major abstractions (AuthService, UserModel, etc.)
  const classMatches = content.matchAll(/export\s+class\s+(\w+)/g);
  for (const match of classMatches) {
    exports.push(`class ${match[1]}`);
  }
  
  // Match: export const/let name
  // WHY: Exported constants are often configuration or singleton instances
  const constMatches = content.matchAll(/export\s+(?:const|let)\s+(\w+)/g);
  for (const match of constMatches) {
    exports.push(`const ${match[1]}`);
  }
  
  // Match: export interface name
  // WHY: Interfaces define data shapes — critical for understanding types
  const interfaceMatches = content.matchAll(/export\s+interface\s+(\w+)/g);
  for (const match of interfaceMatches) {
    exports.push(`interface ${match[1]}`);
  }
  
  // Match: export type name
  // WHY: Type aliases are also part of the public API
  const typeMatches = content.matchAll(/export\s+type\s+(\w+)/g);
  for (const match of typeMatches) {
    exports.push(`type ${match[1]}`);
  }
  
  return exports;
}

/**
 * Extract imports from a TypeScript/JavaScript file
 * 
 * WHY WE NEED IMPORTS:
 * Imports define the DEPENDENCY GRAPH of your codebase.
 * If service.ts imports user.ts, they're related.
 * When you edit one, you probably need to see the other.
 * 
 * HOW WE USE THIS:
 * 1. Build a graph: nodes = files, edges = imports
 * 2. Run PageRank-style algorithm to find "important" files
 * 3. Files that are imported by many other files are probably core utilities
 * 4. Files that import the "seed" files (mentioned in task) are probably related
 */
function extractImports(content: string): string[] {
  const imports: string[] = [];
  
  // Match: import ... from "path"
  // This captures both:
  //   import { foo } from './bar'
  //   import foo from './bar'
  //   import * as foo from './bar'
  const importMatches = content.matchAll(/import\s+.*\s+from\s+['"](.*)['"]/g);
  for (const match of importMatches) {
    imports.push(match[1]);
  }
  
  return imports;
}

// =============================================================================
// DIRECTORY SCANNING
// =============================================================================
/**
 * Scan a directory and build a file tree with metadata
 * 
 * WHY WE SKIP CERTAIN DIRECTORIES:
 * - node_modules: External dependencies, often 100k+ files
 * - .git: Version control metadata, not source code
 * - dist/build: Compiled output, not source of truth
 * - __pycache__: Python bytecode cache
 * 
 * WHAT WE KEEP:
 * - Source files: .ts, .js, .py, .go, .rs, etc.
 * - These are the files the LLM might need to read or edit
 * 
 * DEPTH LIMIT:
 * We limit recursion depth to avoid spending forever on huge monorepos.
 * The map should be useful, not exhaustive.
 */
function scanDirectory(
  dirPath: string, 
  options: { maxDepth?: number; currentDepth?: number; extensions?: string[] } = {}
): FileInfo[] {
  const { 
    maxDepth = 5, 
    currentDepth = 0, 
    extensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.go', '.rs'] 
  } = options;
  
  const results: FileInfo[] = [];
  
  // WHY: Prevent infinite recursion in deep directory structures
  if (currentDepth > maxDepth) return results;
  
  try {
    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
      // WHY: These directories add noise without value for understanding code
      // node_modules alone can be 500MB+ and thousands of files
      if (['node_modules', '.git', 'dist', 'build', '__pycache__', '.next'].includes(item)) {
        continue;
      }
      
      const fullPath = path.join(dirPath, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        results.push({ path: fullPath, type: 'directory' });
        // Recursively scan subdirectories
        results.push(...scanDirectory(fullPath, { ...options, currentDepth: currentDepth + 1 }));
      } else if (stat.isFile()) {
        const ext = path.extname(item);
        // WHY: Only process files we can meaningfully extract symbols from
        // Binary files, images, etc. don't have exports/imports
        if (extensions.includes(ext)) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          results.push({
            path: fullPath,
            type: 'file',
            size: stat.size,
            exports: extractExports(content),
            imports: extractImports(content)
          });
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning ${dirPath}:`, error);
  }
  
  return results;
}

// =============================================================================
// CONCEPT 2: Generating the Map
// =============================================================================
/**
 * Convert the file tree into a condensed, LLM-friendly format.
 * This is what you'd include in the system prompt.
 * 
 * FORMAT RATIONALE:
 * - 📁/📄 emojis: Visual distinction between files and folders
 * - └─ prefix: Shows hierarchy clearly
 * - Only show exports: The LLM doesn't need every line, just the API
 * 
 * TOKEN EFFICIENCY:
 * A 50,000 line codebase might compress to 500-2000 tokens as a map.
 * That's a 100x+ compression ratio while preserving the structure.
 * 
 * WHAT THE LLM CAN DO:
 * "I see there's an AuthService in src/auth/service.ts with login() and logout().
 *  The user wants to fix login, so I should read that file."
 */
function generateRepoMap(files: FileInfo[], basePath: string = '.'): string {
  const lines: string[] = [];
  lines.push('# Repository Map\n');
  
  for (const file of files) {
    const relativePath = path.relative(basePath, file.path);
    
    if (file.type === 'directory') {
      lines.push(`📁 ${relativePath}/`);
    } else {
      lines.push(`📄 ${relativePath}`);
      // WHY: Only show exports, not the full content
      // Exports are the "public API" of each file
      if (file.exports && file.exports.length > 0) {
        for (const exp of file.exports) {
          lines.push(`   └─ ${exp}`);
        }
      }
    }
  }
  
  return lines.join('\n');
}

// =============================================================================
// CONCEPT 3: Relevance Scoring
// =============================================================================
/**
 * Given a user query, which files are most relevant?
 * 
 * THE PROBLEM:
 * User says "fix the login bug" — which of 500 files should we send?
 * 
 * THIS SIMPLIFIED VERSION:
 * - Keyword matching in file paths
 * - Keyword matching in export names
 * - Returns top N matches by score
 * 
 * REAL TOOLS USE:
 * 1. Embedding search (semantic similarity — "authentication" matches "login")
 * 2. Graph analysis (PageRank-style — files imported by seed files rank higher)
 * 3. Recency (recently edited files are more likely to be relevant)
 * 4. AST analysis (find references to specific symbols)
 * 
 * THE PAGERANK INSIGHT:
 * If file A imports file B, and file A is relevant to the task,
 * then file B is probably relevant too. This "importance" propagates
 * through the dependency graph.
 * 
 * See MODULE-3-CODE-CONTEXT.md for the full PageRank algorithm.
 */
function findRelevantFiles(files: FileInfo[], query: string, maxFiles: number = 5): FileInfo[] {
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/);
  
  const scored = files
    .filter(f => f.type === 'file')
    .map(file => {
      let score = 0;
      const pathLower = file.path.toLowerCase();
      
      // SCORING RULE 1: Path contains query word
      // WHY: If user says "auth", files in auth/ are probably relevant
      for (const word of queryWords) {
        if (pathLower.includes(word)) score += 10;
      }
      
      // SCORING RULE 2: Export names match query words  
      // WHY: If user mentions "login", files exporting login() are relevant
      if (file.exports) {
        for (const exp of file.exports) {
          const expLower = exp.toLowerCase();
          for (const word of queryWords) {
            if (expLower.includes(word)) score += 5;
          }
        }
      }
      
      // FUTURE ENHANCEMENT: Add import-based scoring
      // If this file imports a high-scoring file, boost its score
      // This is the PageRank propagation
      
      return { file, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxFiles);
  
  return scored.map(item => item.file);
}

// =============================================================================
// CONCEPT 4: Token Estimation
// =============================================================================
/**
 * Estimate how many tokens a piece of text will use.
 * 
 * WHY THIS MATTERS:
 * - LLMs have context limits (e.g., 128k tokens)
 * - We need to fit: system prompt + repo map + relevant files + user message
 * - If we go over, the LLM either truncates or errors
 * 
 * SIMPLE HEURISTIC:
 * ~4 characters per token for English text / code
 * 
 * ACCURATE METHOD:
 * Use tiktoken library with the specific model's tokenizer:
 *   import { encoding_for_model } from 'tiktoken'
 *   const enc = encoding_for_model('gpt-4')
 *   return enc.encode(text).length
 * 
 * WHY THE HEURISTIC IS OFTEN FINE:
 * We're budgeting, not billing. Being off by 10% is okay.
 * We leave buffer room anyway (e.g., use 80% of budget).
 */
function estimateTokens(text: string): number {
  // Rough estimate: 4 characters per token
  // This is good enough for budgeting purposes
  return Math.ceil(text.length / 4);
}

// =============================================================================
// DEMO: Build a repo map for any directory
// =============================================================================
async function main() {
  console.log("🚀 Module 3: Code Context — Repository Mapping Demo\n");
  console.log("=".repeat(60) + "\n");
  
  // Scan the target directory (default: current directory)
  const targetDir = process.argv[2] || '.';
  console.log(`📂 Scanning: ${path.resolve(targetDir)}\n`);
  
  // STEP 1: Scan all files and extract metadata
  // This is the raw data we'll work with
  const files = scanDirectory(targetDir);
  console.log(`Found ${files.length} items\n`);
  
  // STEP 2: Generate the condensed repo map
  // This is what we'd put in the LLM's system prompt
  const repoMap = generateRepoMap(files, targetDir);
  console.log("📋 REPOSITORY MAP:");
  console.log("-".repeat(40));
  console.log(repoMap);
  console.log("-".repeat(40));
  
  // STEP 3: Estimate token usage
  // This tells us how much of our budget the map uses
  const estimatedTokens = estimateTokens(repoMap);
  console.log(`\n📊 Map size: ${repoMap.length} chars (~${estimatedTokens} tokens)`);
  
  // STEP 4: Demo relevance search
  // Given a query, find the most relevant files
  const query = "tool function";
  console.log(`\n🔍 Finding files relevant to: "${query}"`);
  const relevant = findRelevantFiles(files, query);
  if (relevant.length > 0) {
    console.log("Relevant files:");
    for (const file of relevant) {
      console.log(`  - ${file.path}`);
    }
  } else {
    console.log("No matches found");
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("\n✅ Demo complete!");
  console.log("\n💡 KEY TAKEAWAY:");
  console.log("Instead of sending your entire codebase to the LLM,");
  console.log("you send this condensed map (~" + estimatedTokens + " tokens)");
  console.log("and only fetch full file contents when needed.");
  console.log("\n📚 For the full algorithms (tree-sitter, PageRank, embeddings),");
  console.log("see CONCEPT.md and MODULE-3-CODE-CONTEXT.md");
}

main().catch(console.error);
