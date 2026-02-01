# Module 2: The Tool System — Giving LLMs Superpowers

**Duration:** 60 minutes (5 videos)
**Goal:** Build a complete tool system that lets LLMs read files, write code, and run commands

---

## 2.1 What Are Tools/Functions? (10 min)

### Video Script

**[INTRO - 0:00-0:30]**

"Right now, our LLM can generate text. That's cool, but it's like having a brilliant architect who can only describe buildings — they can't actually build them.

Tools change everything. With tools, the LLM goes from 'I can tell you what code to write' to 'I can actually write the code and run it.'"

---

**[THE CONCEPT - 0:30-3:00]**

"Here's how tools work at a high level:"

*[Show diagram]*

```
USER: "What's in my package.json?"
              │
              ▼
┌─────────────────────────────────────┐
│             LLM THINKS              │
│                                     │
│  "I need to read a file to answer   │
│   this. I have a read_file tool.    │
│   Let me use it."                   │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│         LLM RESPONDS WITH:          │
│                                     │
│  Tool Call: read_file               │
│  Arguments: { "path": "package.json" }│
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│         YOUR CODE EXECUTES          │
│                                     │
│  Actually reads the file from disk  │
│  Returns the contents              │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│     LLM RECEIVES TOOL RESULT        │
│                                     │
│  Now has the actual file contents   │
│  Can answer the user's question     │
└─────────────────────────────────────┘
```

"The key insight: the LLM doesn't actually execute anything. It just says 'I want to call this tool with these arguments.' YOUR code does the actual work.

This is crucial for safety — the LLM proposes, your code disposes."

---

**[JSON SCHEMA FOR TOOLS - 3:00-6:00]**

"Tools are defined using JSON Schema. Here's what the read_file tool looks like:"

```json
{
  "type": "function",
  "name": "read_file",
  "description": "Read the contents of a file at the given path. Use this to examine code, configuration files, or any text file in the project.",
  "parameters": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "description": "Relative path to the file from the project root"
      }
    },
    "required": ["path"]
  }
}
```

"Let's break this down:

**name**: How you reference the tool in code
**description**: This is CRITICAL — it tells the LLM WHEN to use the tool
**parameters**: JSON Schema defining the inputs

The description is the most important part. A bad description = the LLM won't know when to use the tool. A good description explains:
- What the tool does
- When to use it
- What kind of results it returns"

---

**[TOOL CALLING FLOW - 6:00-9:00]**

"Here's the complete flow in code:"

```typescript
import OpenAI from 'openai';

const client = new OpenAI();

// Define tools
const tools: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the contents of a file',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the file' }
        },
        required: ['path']
      }
    }
  }
];

// Make request
const response = await client.chat.completions.create({
  model: 'gpt-4-turbo-preview',
  messages: [
    { role: 'user', content: "What's in package.json?" }
  ],
  tools
});

// Check if model wants to call a tool
const message = response.choices[0].message;

if (message.tool_calls) {
  for (const toolCall of message.tool_calls) {
    console.log('Tool:', toolCall.function.name);
    console.log('Args:', toolCall.function.arguments);
    // Execute the tool...
  }
}
```

"The response might look like:"

```json
{
  "tool_calls": [{
    "id": "call_abc123",
    "type": "function",
    "function": {
      "name": "read_file",
      "arguments": "{\"path\":\"package.json\"}"
    }
  }]
}
```

---

**[RETURNING RESULTS - 9:00-10:00]**

"After executing the tool, we send the result back:"

```typescript
// Execute the tool
const fileContent = fs.readFileSync('package.json', 'utf-8');

// Add the result to messages
messages.push(message); // Include the assistant's tool call
messages.push({
  role: 'tool',
  tool_call_id: toolCall.id,
  content: fileContent
});

// Get final response
const finalResponse = await client.chat.completions.create({
  model: 'gpt-4-turbo-preview',
  messages,
  tools
});
```

"Now the LLM has the file contents and can actually answer the question.

In the next video, we'll implement the core coding tools you need."

---

### Key Takeaways

1. Tools = structured way for LLM to request actions
2. Your code executes, not the LLM
3. JSON Schema defines tool interface
4. Good descriptions are critical
5. Results get sent back for further processing

---

## 2.2 Implementing Core Coding Tools (15 min)

### Video Script

**[INTRO - 0:00-0:30]**

"Let's build the essential tools every coding agent needs. These are the tools that Cursor, Claude Code, and Aider all have in some form."

---

**[FILE OPERATIONS - 0:30-6:00]**

"Create `src/tools/file-ops.ts`:"

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';

// Ensure we don't escape the project directory
function safePath(projectRoot: string, filePath: string): string {
  const resolved = path.resolve(projectRoot, filePath);
  if (!resolved.startsWith(projectRoot)) {
    throw new Error('Path escapes project directory');
  }
  return resolved;
}

export async function readFile(
  projectRoot: string,
  filePath: string
): Promise<string> {
  const fullPath = safePath(projectRoot, filePath);
  return fs.readFile(fullPath, 'utf-8');
}

export async function writeFile(
  projectRoot: string,
  filePath: string,
  content: string
): Promise<void> {
  const fullPath = safePath(projectRoot, filePath);
  // Create directory if needed
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, content, 'utf-8');
}

export async function listDirectory(
  projectRoot: string,
  dirPath: string = '.'
): Promise<string[]> {
  const fullPath = safePath(projectRoot, dirPath);
  const entries = await fs.readdir(fullPath, { withFileTypes: true });
  
  return entries.map(entry => {
    const name = entry.name;
    return entry.isDirectory() ? `${name}/` : name;
  });
}

export async function fileExists(
  projectRoot: string,
  filePath: string
): Promise<boolean> {
  try {
    const fullPath = safePath(projectRoot, filePath);
    await fs.access(fullPath);
    return true;
  } catch {
    return false;
  }
}
```

"Notice the `safePath` function — this prevents the LLM from reading files outside your project. Security first!"

---

**[THE EDIT FUNCTION - 6:00-10:00]**

"Editing files is the tricky one. We'll cover advanced edit formats in Module 4, but here's a simple search/replace implementation:"

```typescript
export interface EditOperation {
  search: string;  // Text to find
  replace: string; // Text to replace with
}

export async function editFile(
  projectRoot: string,
  filePath: string,
  edits: EditOperation[]
): Promise<{ success: boolean; error?: string }> {
  const fullPath = safePath(projectRoot, filePath);
  
  let content: string;
  try {
    content = await fs.readFile(fullPath, 'utf-8');
  } catch {
    return { success: false, error: 'File not found' };
  }

  for (const edit of edits) {
    if (!content.includes(edit.search)) {
      return { 
        success: false, 
        error: `Could not find text to replace: "${edit.search.slice(0, 50)}..."` 
      };
    }
    content = content.replace(edit.search, edit.replace);
  }

  await fs.writeFile(fullPath, content, 'utf-8');
  return { success: true };
}
```

"This is basic but it works for simple edits. The key is good error messages — when an edit fails, the LLM needs to know WHY so it can fix the issue."

---

**[COMMAND EXECUTION - 10:00-13:00]**

"Running shell commands is powerful but dangerous. Here's a careful implementation:"

```typescript
import { spawn } from 'child_process';

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function runCommand(
  projectRoot: string,
  command: string,
  args: string[] = [],
  options?: {
    timeout?: number;
    allowedCommands?: string[];
  }
): Promise<CommandResult> {
  // Allowlist check
  if (options?.allowedCommands) {
    if (!options.allowedCommands.includes(command)) {
      throw new Error(`Command not allowed: ${command}`);
    }
  }

  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd: projectRoot,
      timeout: options?.timeout ?? 30000,
      shell: false // Prevent shell injection
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => stdout += data.toString());
    proc.stderr.on('data', (data) => stderr += data.toString());

    proc.on('close', (code) => {
      resolve({
        stdout: stdout.slice(0, 10000), // Truncate for token limits
        stderr: stderr.slice(0, 5000),
        exitCode: code ?? -1
      });
    });

    proc.on('error', reject);
  });
}
```

"Key safety features:
- `shell: false` prevents shell injection attacks
- Allowlist of safe commands
- Timeout prevents runaway processes
- Output truncation for token limits"

---

**[CODE SEARCH - 13:00-15:00]**

"Let's add a code search tool for finding relevant code:"

```typescript
import { glob } from 'glob';

export async function searchCode(
  projectRoot: string,
  query: string,
  options?: {
    filePattern?: string;
    maxResults?: number;
  }
): Promise<Array<{ file: string; line: number; content: string }>> {
  const pattern = options?.filePattern ?? '**/*.{ts,js,tsx,jsx,py,go,rs}';
  const maxResults = options?.maxResults ?? 20;
  
  const files = await glob(pattern, { 
    cwd: projectRoot,
    ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**']
  });

  const results: Array<{ file: string; line: number; content: string }> = [];
  const queryLower = query.toLowerCase();

  for (const file of files) {
    if (results.length >= maxResults) break;
    
    const content = await fs.readFile(
      path.join(projectRoot, file), 
      'utf-8'
    );
    
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(queryLower)) {
        results.push({
          file,
          line: i + 1,
          content: lines.slice(Math.max(0, i - 2), i + 3).join('\n')
        });
        if (results.length >= maxResults) break;
      }
    }
  }

  return results;
}
```

"This gives the LLM ability to search through code — essential for finding where to make changes."

---

### Code File

Create `src/tools/file-ops.ts` with all the above functions.

---

## 2.3 The Art of Tool Design (12 min)

### Video Script

**[INTRO - 0:00-0:30]**

"Here's something surprising from Anthropic: they spent MORE time designing tools than writing prompts for their SWE-bench agent.

Tool design is that important. Bad tools = confused LLM = failed tasks."

---

**[THE INTERN TEST - 0:30-3:00]**

"Anthropic suggests the 'intern test': Could a junior developer correctly use this tool given only the description and parameters?

Let's compare:"

```json
// BAD tool definition
{
  "name": "edit",
  "description": "Edit a file",
  "parameters": {
    "properties": {
      "file": { "type": "string" },
      "changes": { "type": "string" }
    }
  }
}
```

"Problems:
- What format are 'changes'? Diff? New content? Search/replace?
- Is 'file' relative or absolute?
- What happens if the file doesn't exist?

Good version:"

```json
{
  "name": "edit_file",
  "description": "Make targeted edits to an existing file using search/replace blocks. Each edit finds an exact text match and replaces it. Use this for modifying existing code - for new files, use write_file instead.",
  "parameters": {
    "properties": {
      "path": {
        "type": "string",
        "description": "Relative path from project root (e.g., 'src/utils/auth.ts')"
      },
      "edits": {
        "type": "array",
        "description": "List of search/replace operations. The 'search' text must match exactly (including whitespace).",
        "items": {
          "type": "object",
          "properties": {
            "search": {
              "type": "string",
              "description": "Exact text to find in the file"
            },
            "replace": {
              "type": "string", 
              "description": "Text to replace it with"
            }
          },
          "required": ["search", "replace"]
        }
      }
    },
    "required": ["path", "edits"]
  }
}
```

"Now it's clear:
- Relative paths from project root
- Search/replace format
- Must match exactly
- Use write_file for new files"

---

**[POKA-YOKE: MISTAKE-PROOFING - 3:00-6:00]**

"'Poka-yoke' is a Japanese term meaning 'mistake-proofing'. Design tools so it's hard to use them wrong.

Examples from Claude Code's evolution:"

```typescript
// v1: Relative paths
// Problem: If agent cd's into a subdirectory, paths break
read_file({ path: 'src/auth.ts' })

// v2: Always absolute from project root
// Now paths always work regardless of 'current directory'
read_file({ path: '/absolute/path/to/project/src/auth.ts' })
```

"Another example - command execution:"

```typescript
// BAD: Shell string parsing
run_command({ command: 'npm install lodash' })
// LLM might generate: 'rm -rf /' by mistake

// GOOD: Command + args separated
run_command({ 
  command: 'npm',
  args: ['install', 'lodash']
})
// Can't inject dangerous commands
```

---

**[WHEN TO COMBINE TOOLS - 6:00-8:00]**

"Anthropic recommends: combine tools that are always called in sequence.

Bad pattern:"

```typescript
// LLM has to call three tools every time
const location = await get_location(user);
const weather = await get_weather(location);
const formatted = await format_weather(weather);
```

"Good pattern:"

```typescript
// Single tool does the whole thing
const weather = await get_weather_for_user(user);
```

"For coding agents, consider:
- `read_file` + `edit_file` = separate (not always both needed)
- `run_tests` + `parse_results` = combine (always together)
- `lint_file` + `format_file` = maybe combine"

---

**[TOOL COUNT MATTERS - 8:00-10:00]**

"More tools = harder for LLM to choose correctly. Anthropic suggests: aim for fewer than 20 tools.

Here's a good minimal set for a coding agent:"

```typescript
const ESSENTIAL_TOOLS = [
  'read_file',      // Read file contents
  'write_file',     // Create/overwrite file
  'edit_file',      // Make targeted edits
  'list_directory', // Explore structure
  'search_code',    // Find code by content
  'run_command',    // Execute shell commands
];

const NICE_TO_HAVE = [
  'search_web',     // Look up docs
  'run_tests',      // Execute test suite
  'git_diff',       // See recent changes
  'git_commit',     // Commit changes
];
```

"Start with 6 tools. Add more only when needed."

---

**[ERROR MESSAGES MATTER - 10:00-12:00]**

"When tools fail, good error messages help the LLM recover:"

```typescript
// BAD
return { error: 'Failed' };

// GOOD
return { 
  error: 'File not found: src/auth/login.ts',
  suggestion: 'Available files in src/auth/: index.ts, types.ts, utils.ts'
};
```

"The error tells the LLM:
1. What went wrong
2. How to fix it

This enables self-correction."

---

### Key Principles Summary

1. **Intern Test**: Would a junior dev understand?
2. **Poka-yoke**: Make misuse hard
3. **Combine wisely**: Merge sequential tools
4. **Fewer is better**: Aim for <20 tools
5. **Helpful errors**: Tell LLM how to fix

---

## 2.4 Handling Tool Calls in Your Agent Loop (12 min)

### Video Script

**[INTRO - 0:00-0:30]**

"Now let's build the actual agent loop that handles tool calls. This is where everything comes together."

---

**[THE TOOL REGISTRY - 0:30-3:00]**

"First, let's create a clean tool registry. `src/tools/registry.ts`:"

```typescript
import { readFile, writeFile, editFile, listDirectory, searchCode } from './file-ops';
import { runCommand } from './commands';

// Tool execution function type
type ToolExecutor = (args: Record<string, any>, context: ToolContext) => Promise<any>;

interface ToolContext {
  projectRoot: string;
}

// Registry of all tools
export const toolRegistry: Record<string, ToolExecutor> = {
  read_file: async (args, ctx) => {
    return readFile(ctx.projectRoot, args.path);
  },
  
  write_file: async (args, ctx) => {
    await writeFile(ctx.projectRoot, args.path, args.content);
    return { success: true, path: args.path };
  },
  
  edit_file: async (args, ctx) => {
    return editFile(ctx.projectRoot, args.path, args.edits);
  },
  
  list_directory: async (args, ctx) => {
    return listDirectory(ctx.projectRoot, args.path ?? '.');
  },
  
  search_code: async (args, ctx) => {
    return searchCode(ctx.projectRoot, args.query, {
      filePattern: args.file_pattern,
      maxResults: args.max_results
    });
  },
  
  run_command: async (args, ctx) => {
    return runCommand(ctx.projectRoot, args.command, args.args ?? [], {
      timeout: 30000,
      allowedCommands: ['npm', 'node', 'npx', 'git', 'cat', 'ls', 'find']
    });
  }
};

// Tool definitions for API
export const toolDefinitions = [
  {
    type: 'function' as const,
    function: {
      name: 'read_file',
      description: 'Read the contents of a file. Returns the full file content as a string.',
      parameters: {
        type: 'object',
        properties: {
          path: { 
            type: 'string', 
            description: 'Relative path from project root' 
          }
        },
        required: ['path']
      }
    }
  },
  // ... other tool definitions
];
```

---

**[THE AGENT LOOP - 3:00-8:00]**

"Now the main loop. `src/agent/loop.ts`:"

```typescript
import OpenAI from 'openai';
import { toolRegistry, toolDefinitions } from '../tools/registry';

const client = new OpenAI();

interface AgentOptions {
  projectRoot: string;
  model?: string;
  maxIterations?: number;
  onToolCall?: (name: string, args: any) => void;
  onToolResult?: (name: string, result: any) => void;
}

export async function runAgent(
  task: string,
  options: AgentOptions
): Promise<string> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: `You are an AI coding assistant. You help users by reading, writing, and editing code files.
      
Think step by step:
1. First understand what the user wants
2. Read relevant files to understand the current state
3. Plan your changes
4. Make the changes
5. Verify your work

Always explain what you're doing and why.`
    },
    {
      role: 'user',
      content: task
    }
  ];

  const maxIterations = options.maxIterations ?? 10;
  
  for (let i = 0; i < maxIterations; i++) {
    // Call LLM
    const response = await client.chat.completions.create({
      model: options.model ?? 'gpt-4-turbo-preview',
      messages,
      tools: toolDefinitions
    });

    const message = response.choices[0].message;
    messages.push(message);

    // Check if we're done (no tool calls)
    if (!message.tool_calls || message.tool_calls.length === 0) {
      return message.content ?? '';
    }

    // Execute each tool call
    for (const toolCall of message.tool_calls) {
      const name = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments);
      
      options.onToolCall?.(name, args);

      let result: any;
      try {
        const executor = toolRegistry[name];
        if (!executor) {
          result = { error: `Unknown tool: ${name}` };
        } else {
          result = await executor(args, { projectRoot: options.projectRoot });
        }
      } catch (error: any) {
        result = { error: error.message };
      }

      options.onToolResult?.(name, result);

      // Add tool result to messages
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result)
      });
    }
  }

  return 'Max iterations reached without completion';
}
```

---

**[USING THE AGENT - 8:00-10:00]**

"Let's use it:"

```typescript
// src/index.ts
import { runAgent } from './agent/loop';
import chalk from 'chalk';

async function main() {
  const task = process.argv[2] ?? 'List the files in this project';
  
  console.log(chalk.blue('Task:'), task);
  console.log(chalk.gray('─'.repeat(50)));

  const result = await runAgent(task, {
    projectRoot: process.cwd(),
    onToolCall: (name, args) => {
      console.log(chalk.yellow(`→ ${name}`), args);
    },
    onToolResult: (name, result) => {
      const preview = JSON.stringify(result).slice(0, 100);
      console.log(chalk.green(`← ${name}`), preview + '...');
    }
  });

  console.log(chalk.gray('─'.repeat(50)));
  console.log(chalk.blue('Result:'), result);
}

main().catch(console.error);
```

"Run it:"

```bash
npx tsx src/index.ts "What files are in the src directory?"
```

"You'll see the agent:
1. Think about what to do
2. Call list_directory
3. Get the result
4. Formulate an answer"

---

**[ERROR HANDLING - 10:00-12:00]**

"Let's add better error handling:"

```typescript
// In the agent loop
try {
  result = await executor(args, { projectRoot: options.projectRoot });
} catch (error: any) {
  result = { 
    error: error.message,
    type: error.name,
    // Include hints for common errors
    hint: getErrorHint(name, error)
  };
}

function getErrorHint(toolName: string, error: Error): string | undefined {
  if (error.message.includes('ENOENT')) {
    return 'File not found. Use list_directory to see available files.';
  }
  if (error.message.includes('EACCES')) {
    return 'Permission denied. Check file permissions.';
  }
  if (error.message.includes('Path escapes')) {
    return 'Cannot access files outside project directory.';
  }
  return undefined;
}
```

"Good error hints help the LLM self-correct rather than getting stuck."

---

## 2.5 Advanced: Parallel Tool Calls (11 min)

### Video Script

**[INTRO - 0:00-0:30]**

"Modern LLMs can request multiple tool calls at once. If you ask 'What's in package.json and tsconfig.json?', a smart LLM will request both files simultaneously.

Let's handle this properly."

---

**[DETECTING PARALLEL CALLS - 0:30-2:00]**

"When the LLM returns multiple tool calls, they come in an array:"

```json
{
  "tool_calls": [
    {
      "id": "call_1",
      "function": { "name": "read_file", "arguments": "{\"path\":\"package.json\"}" }
    },
    {
      "id": "call_2", 
      "function": { "name": "read_file", "arguments": "{\"path\":\"tsconfig.json\"}" }
    }
  ]
}
```

"These can be executed in parallel — they don't depend on each other."

---

**[PARALLEL EXECUTION - 2:00-5:00]**

"Let's update our agent to handle this:"

```typescript
// Execute tool calls in parallel when possible
async function executeToolCalls(
  toolCalls: OpenAI.Chat.ChatCompletionMessageToolCall[],
  context: ToolContext
): Promise<Array<{ id: string; result: any }>> {
  
  // Analyze dependencies
  const { parallel, sequential } = analyzeDependencies(toolCalls);
  
  // Execute parallel calls concurrently
  const parallelResults = await Promise.all(
    parallel.map(async (call) => ({
      id: call.id,
      result: await executeSingleTool(call, context)
    }))
  );
  
  // Execute sequential calls in order
  const sequentialResults: Array<{ id: string; result: any }> = [];
  for (const call of sequential) {
    sequentialResults.push({
      id: call.id,
      result: await executeSingleTool(call, context)
    });
  }
  
  return [...parallelResults, ...sequentialResults];
}
```

---

**[DEPENDENCY DETECTION - 5:00-8:00]**

"Some calls depend on others. For example, if the LLM wants to:
1. Read a file
2. Edit that same file

We need to wait for the read before the edit:"

```typescript
function analyzeDependencies(
  toolCalls: OpenAI.Chat.ChatCompletionMessageToolCall[]
): {
  parallel: OpenAI.Chat.ChatCompletionMessageToolCall[];
  sequential: OpenAI.Chat.ChatCompletionMessageToolCall[];
} {
  const parallel: OpenAI.Chat.ChatCompletionMessageToolCall[] = [];
  const sequential: OpenAI.Chat.ChatCompletionMessageToolCall[] = [];
  
  // Track which files are being modified
  const modifiedFiles = new Set<string>();
  
  for (const call of toolCalls) {
    const args = JSON.parse(call.function.arguments);
    const path = args.path;
    
    // Write operations must be sequential if touching same file
    if (['write_file', 'edit_file'].includes(call.function.name)) {
      if (modifiedFiles.has(path)) {
        sequential.push(call);
      } else {
        parallel.push(call);
        modifiedFiles.add(path);
      }
    } 
    // Read operations can be parallel unless file is being modified
    else if (call.function.name === 'read_file') {
      if (modifiedFiles.has(path)) {
        sequential.push(call);
      } else {
        parallel.push(call);
      }
    }
    // Command execution is sequential (side effects)
    else if (call.function.name === 'run_command') {
      sequential.push(call);
    }
    // Everything else can be parallel
    else {
      parallel.push(call);
    }
  }
  
  return { parallel, sequential };
}
```

---

**[AGGREGATING RESULTS - 8:00-10:00]**

"We need to return all results in the correct order:"

```typescript
// In the agent loop
const toolCalls = message.tool_calls;
const results = await executeToolCalls(toolCalls, context);

// Add results as separate tool messages
for (const { id, result } of results) {
  messages.push({
    role: 'tool',
    tool_call_id: id,
    content: typeof result === 'string' ? result : JSON.stringify(result)
  });
}
```

"The order doesn't matter for the API — it matches by `tool_call_id`."

---

**[PERFORMANCE IMPACT - 10:00-11:00]**

"Parallel execution makes a big difference:

Sequential (3 file reads, 500ms each): **1500ms**
Parallel: **500ms**

For agents that read many files, this 3x speedup is significant."

---

### Code Files

- `src/tools/registry.ts`
- `src/agent/loop.ts`
- `src/tools/parallel.ts`

---

## Module 2 Summary

You now have:
1. Understanding of tool/function calling
2. Implemented core coding tools
3. Learned tool design principles
4. Built a working agent loop
5. Handled parallel tool execution

**Next up:** Module 3 — Code Context. This is where we make the agent actually smart about your codebase.
