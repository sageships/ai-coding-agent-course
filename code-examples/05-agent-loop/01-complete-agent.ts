/**
 * 🎓 MODULE 5: The Complete Agent Loop
 * 
 * This is where EVERYTHING comes together.
 * 
 * A complete AI coding agent that can:
 * - Understand your codebase (repo map)
 * - Read and write files (tools)
 * - Execute shell commands (with safety)
 * - Iterate until the task is done (agent loop)
 * 
 * This is essentially a mini version of Cursor/Claude Code/Aider.
 */

import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const client = new Anthropic();

// ============================================
// PART 1: TOOL DEFINITIONS
// ============================================

const tools: Anthropic.Tool[] = [
  {
    name: "read_file",
    description: "Read the contents of a file. Use this to examine code, configs, or any text file.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to the file" }
      },
      required: ["path"]
    }
  },
  {
    name: "write_file",
    description: "Write content to a file. Creates directories if needed. Use for creating or modifying files.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to write to" },
        content: { type: "string", description: "Content to write" }
      },
      required: ["path", "content"]
    }
  },
  {
    name: "list_directory",
    description: "List files and folders in a directory. Use to explore project structure.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Directory path (use '.' for current)" }
      },
      required: ["path"]
    }
  },
  {
    name: "search_files",
    description: "Search for a pattern across all files using grep. Returns matching lines with file paths.",
    input_schema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Search pattern (regex supported)" },
        path: { type: "string", description: "Directory to search in", default: "." }
      },
      required: ["pattern"]
    }
  },
  {
    name: "run_command",
    description: "Execute a shell command. Use for running tests, installing packages, git operations, etc. Be careful with destructive commands.",
    input_schema: {
      type: "object",
      properties: {
        command: { type: "string", description: "Shell command to execute" }
      },
      required: ["command"]
    }
  }
];

// ============================================
// PART 2: TOOL EXECUTION
// ============================================

function executeTool(name: string, input: Record<string, unknown>): string {
  console.log(`  🔧 ${name}(${JSON.stringify(input).substring(0, 100)}...)`);
  
  try {
    switch (name) {
      case "read_file": {
        const content = fs.readFileSync(input.path as string, 'utf-8');
        return content.length > 10000 
          ? content.substring(0, 10000) + "\n...[truncated]" 
          : content;
      }
      
      case "write_file": {
        const dir = path.dirname(input.path as string);
        if (dir && !fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(input.path as string, input.content as string);
        return `✅ Written to ${input.path}`;
      }
      
      case "list_directory": {
        const items = fs.readdirSync(input.path as string, { withFileTypes: true });
        return items
          .map(item => `${item.isDirectory() ? '📁' : '📄'} ${item.name}`)
          .join('\n');
      }
      
      case "search_files": {
        const searchPath = (input.path as string) || '.';
        // Use grep (cross-platform alternative would be needed for Windows)
        const result = execSync(
          `grep -rn "${input.pattern}" ${searchPath} --include="*.ts" --include="*.js" --include="*.py" 2>/dev/null || true`,
          { encoding: 'utf-8', maxBuffer: 1024 * 1024 }
        );
        return result || "No matches found";
      }
      
      case "run_command": {
        // ⚠️ SECURITY: In production, whitelist allowed commands!
        const blocked = ['rm -rf', 'sudo', '> /dev', 'mkfs', 'dd if='];
        const cmd = input.command as string;
        if (blocked.some(b => cmd.includes(b))) {
          return "❌ Command blocked for safety";
        }
        const result = execSync(cmd, { 
          encoding: 'utf-8', 
          maxBuffer: 1024 * 1024,
          timeout: 30000 
        });
        return result || "(no output)";
      }
      
      default:
        return `Unknown tool: ${name}`;
    }
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

// ============================================
// PART 3: REPO MAP GENERATION
// ============================================

function generateRepoMap(dirPath: string = '.', depth: number = 0, maxDepth: number = 3): string {
  if (depth > maxDepth) return '';
  
  const lines: string[] = [];
  const indent = '  '.repeat(depth);
  
  try {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const item of items) {
      // Skip noise
      if (['node_modules', '.git', 'dist', '.next', '__pycache__'].includes(item.name)) continue;
      
      const fullPath = path.join(dirPath, item.name);
      
      if (item.isDirectory()) {
        lines.push(`${indent}📁 ${item.name}/`);
        lines.push(generateRepoMap(fullPath, depth + 1, maxDepth));
      } else if (/\.(ts|js|py|go|rs|tsx|jsx)$/.test(item.name)) {
        lines.push(`${indent}📄 ${item.name}`);
      }
    }
  } catch {
    // Ignore permission errors
  }
  
  return lines.filter(l => l.trim()).join('\n');
}

// ============================================
// PART 4: THE AGENT LOOP
// ============================================

interface AgentConfig {
  maxIterations?: number;
  verbose?: boolean;
}

async function runAgent(task: string, config: AgentConfig = {}): Promise<string> {
  const { maxIterations = 15, verbose = true } = config;
  
  // Generate repo map for context
  const repoMap = generateRepoMap();
  
  const systemPrompt = `You are an expert coding agent. You help users understand and modify code.

## Your Capabilities
You have tools to read files, write files, search code, list directories, and run shell commands.

## Current Project Structure
${repoMap}

## Guidelines
1. Always explore before making changes - read relevant files first
2. Explain your reasoning before taking actions
3. After making changes, verify they work (run tests if available)
4. Be concise but thorough
5. If something fails, try to fix it

## Important
- Read files before modifying them to understand context
- Make targeted, minimal changes
- Test your changes when possible`;

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: task }
  ];
  
  if (verbose) {
    console.log("\n" + "═".repeat(60));
    console.log("🤖 AGENT STARTED");
    console.log("═".repeat(60));
    console.log(`\n📋 Task: ${task}\n`);
  }
  
  let iteration = 0;
  
  while (iteration < maxIterations) {
    iteration++;
    if (verbose) console.log(`\n── Iteration ${iteration} ──`);
    
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      tools,
      messages
    });
    
    // Collect text response
    let textResponse = '';
    const toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];
    
    for (const block of response.content) {
      if (block.type === "text") {
        textResponse += block.text;
        if (verbose && block.text) {
          console.log(`\n💭 ${block.text.substring(0, 200)}${block.text.length > 200 ? '...' : ''}`);
        }
      } else if (block.type === "tool_use") {
        toolCalls.push({
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>
        });
      }
    }
    
    // If no tool calls, we're done
    if (response.stop_reason === "end_turn" || toolCalls.length === 0) {
      if (verbose) {
        console.log("\n" + "═".repeat(60));
        console.log("✅ AGENT COMPLETE");
        console.log("═".repeat(60));
      }
      return textResponse;
    }
    
    // Execute tools and collect results
    messages.push({ role: "assistant", content: response.content });
    
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const tool of toolCalls) {
      const result = executeTool(tool.name, tool.input);
      toolResults.push({
        type: "tool_result",
        tool_use_id: tool.id,
        content: result
      });
    }
    
    messages.push({ role: "user", content: toolResults });
  }
  
  return "Max iterations reached";
}

// ============================================
// PART 5: MAIN - DEMO
// ============================================

async function main() {
  console.log("🚀 Complete AI Coding Agent Demo\n");
  
  // Get task from command line or use default
  const task = process.argv[2] || 
    "List the files in this project and explain what this codebase does based on the file structure.";
  
  const result = await runAgent(task);
  
  console.log("\n📝 FINAL RESPONSE:");
  console.log("-".repeat(40));
  console.log(result);
}

main().catch(console.error);
