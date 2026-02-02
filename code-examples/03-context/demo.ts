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

/**
 * CONCEPT 1: The Repository Map
 * 
 * A repo map is a condensed overview of your codebase. It shows:
 * - File structure
 * - Class/function names (without implementation details)
 * - Import relationships
 * 
 * Instead of sending 50,000 lines of code, we send ~1,000 tokens that
 * give the LLM enough context to understand the project structure.
 */

interface FileInfo {
  path: string;
  type: 'file' | 'directory';
  size?: number;
  exports?: string[];  // Exported functions/classes
  imports?: string[];  // Import statements
}

/**
 * Extract exports from a TypeScript/JavaScript file
 * 
 * This is a simplified version. Real tools use tree-sitter for
 * accurate parsing of any language.
 */
function extractExports(content: string): string[] {
  const exports: string[] = [];
  
  // Match: export function name
  const funcMatches = content.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g);
  for (const match of funcMatches) {
    exports.push(`function ${match[1]}`);
  }
  
  // Match: export class name
  const classMatches = content.matchAll(/export\s+class\s+(\w+)/g);
  for (const match of classMatches) {
    exports.push(`class ${match[1]}`);
  }
  
  // Match: export const/let name
  const constMatches = content.matchAll(/export\s+(?:const|let)\s+(\w+)/g);
  for (const match of constMatches) {
    exports.push(`const ${match[1]}`);
  }
  
  // Match: export interface name
  const interfaceMatches = content.matchAll(/export\s+interface\s+(\w+)/g);
  for (const match of interfaceMatches) {
    exports.push(`interface ${match[1]}`);
  }
  
  // Match: export type name
  const typeMatches = content.matchAll(/export\s+type\s+(\w+)/g);
  for (const match of typeMatches) {
    exports.push(`type ${match[1]}`);
  }
  
  return exports;
}

/**
 * Extract imports from a TypeScript/JavaScript file
 */
function extractImports(content: string): string[] {
  const imports: string[] = [];
  
  // Match: import ... from "path"
  const importMatches = content.matchAll(/import\s+.*\s+from\s+['"](.*)['"]/g);
  for (const match of importMatches) {
    imports.push(match[1]);
  }
  
  return imports;
}

/**
 * Scan a directory and build a file tree with metadata
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
  
  if (currentDepth > maxDepth) return results;
  
  try {
    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
      // Skip common non-essential directories
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

/**
 * CONCEPT 2: Generating the Map
 * 
 * Convert the file tree into a condensed, LLM-friendly format.
 * This is what you'd include in the system prompt.
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
      if (file.exports && file.exports.length > 0) {
        for (const exp of file.exports) {
          lines.push(`   └─ ${exp}`);
        }
      }
    }
  }
  
  return lines.join('\n');
}

/**
 * CONCEPT 3: Relevance Scoring
 * 
 * Given a user query, which files are most relevant?
 * This is a simplified version — real tools use:
 * - Embedding search (semantic similarity)
 * - Graph analysis (import relationships)
 * - Keyword matching
 * - Recency (recently edited files)
 */
function findRelevantFiles(files: FileInfo[], query: string, maxFiles: number = 5): FileInfo[] {
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/);
  
  const scored = files
    .filter(f => f.type === 'file')
    .map(file => {
      let score = 0;
      const pathLower = file.path.toLowerCase();
      
      // Score based on path matching
      for (const word of queryWords) {
        if (pathLower.includes(word)) score += 10;
      }
      
      // Score based on exports matching
      if (file.exports) {
        for (const exp of file.exports) {
          const expLower = exp.toLowerCase();
          for (const word of queryWords) {
            if (expLower.includes(word)) score += 5;
          }
        }
      }
      
      return { file, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxFiles);
  
  return scored.map(item => item.file);
}

/**
 * DEMO: Build a repo map for any directory
 */
async function main() {
  console.log("🚀 Module 3: Code Context — Repository Mapping Demo\n");
  console.log("=".repeat(60) + "\n");
  
  // Scan the current course repository
  const targetDir = process.argv[2] || '.';
  console.log(`📂 Scanning: ${path.resolve(targetDir)}\n`);
  
  const files = scanDirectory(targetDir);
  console.log(`Found ${files.length} items\n`);
  
  // Generate the map
  const repoMap = generateRepoMap(files, targetDir);
  console.log("📋 REPOSITORY MAP:");
  console.log("-".repeat(40));
  console.log(repoMap);
  console.log("-".repeat(40));
  
  // Count tokens (rough estimate: 4 chars = 1 token)
  const estimatedTokens = Math.ceil(repoMap.length / 4);
  console.log(`\n📊 Map size: ${repoMap.length} chars (~${estimatedTokens} tokens)`);
  
  // Demo relevance search
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
  
  console.log("\n✅ Demo complete!");
  console.log("\n💡 KEY TAKEAWAY:");
  console.log("Instead of sending your entire codebase to the LLM,");
  console.log("you send this condensed map (~" + estimatedTokens + " tokens)");
  console.log("and only fetch full file contents when needed.");
}

main().catch(console.error);
