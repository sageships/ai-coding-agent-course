# Module 5: The Agent Loop — Putting It All Together

**Duration:** 60 minutes (5 videos)
**Goal:** Build the complete agent orchestration system

---

## 5.1 Designing the Conversation Flow (12 min)

### Video Script

**[INTRO - 0:00-0:30]**

"We have tools. We have context. We have edit formats. Now we need to orchestrate everything into a coherent agent that can actually complete tasks.

This is the agent loop — the brain that decides what to do next."

---

**[SYSTEM PROMPT DESIGN - 0:30-5:00]**

"The system prompt is your agent's personality and instructions. Here's a battle-tested one:"

```typescript
export const SYSTEM_PROMPT = `You are an expert software engineer assistant.

## Your Capabilities
You can read files, write files, edit code, run commands, and search code.
You have access to the full codebase through the repository map.

## How to Work

1. **Understand First**: Before making changes, read relevant files to understand the current code structure.

2. **Plan Your Approach**: Think through the changes needed before writing code.

3. **Make Targeted Changes**: Edit only what needs to change. Don't rewrite entire files unless necessary.

4. **Verify Your Work**: After making changes, consider running tests or checking for errors.

## When Using Tools

- **read_file**: Use to examine existing code before modifying
- **edit_file**: Use for targeted changes with search/replace blocks
- **write_file**: Use only for new files or complete rewrites
- **run_command**: Use for npm, git, running tests
- **search_code**: Use to find relevant code across the codebase

## Code Style

- Match the existing code style in the project
- Keep changes minimal and focused
- Add comments only when logic is complex
- Use meaningful variable names

## Communication

- Explain what you're doing and why
- If something fails, explain the error and your retry approach
- Ask clarifying questions if the task is ambiguous

## Repository Context

{REPO_MAP}

## Currently Open Files

{OPEN_FILES}
`;
```

"Key elements:
- Clear capabilities
- Workflow guidance
- Tool-specific instructions
- Style guidelines
- Dynamic context injection"

---

**[MESSAGE HISTORY MANAGEMENT - 5:00-9:00]**

"Conversation history grows. We need to manage it:"

```typescript
export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
}

export class ConversationManager {
  private messages: Message[] = [];
  private maxTokens: number;
  private systemPrompt: string;
  
  constructor(systemPrompt: string, maxTokens: number = 100000) {
    this.systemPrompt = systemPrompt;
    this.maxTokens = maxTokens;
    this.messages = [{ role: 'system', content: systemPrompt }];
  }
  
  addUserMessage(content: string): void {
    this.messages.push({ role: 'user', content });
    this.truncateIfNeeded();
  }
  
  addAssistantMessage(content: string): void {
    this.messages.push({ role: 'assistant', content });
    this.truncateIfNeeded();
  }
  
  addToolResult(toolCallId: string, result: string): void {
    this.messages.push({
      role: 'tool',
      tool_call_id: toolCallId,
      content: result
    });
    this.truncateIfNeeded();
  }
  
  private truncateIfNeeded(): void {
    let totalTokens = this.countTotalTokens();
    
    while (totalTokens > this.maxTokens && this.messages.length > 2) {
      // Keep system prompt (index 0) and most recent messages
      // Remove oldest non-system message
      this.messages.splice(1, 1);
      totalTokens = this.countTotalTokens();
    }
  }
  
  private countTotalTokens(): number {
    return this.messages.reduce((sum, msg) => 
      sum + estimateTokens(msg.content), 0
    );
  }
  
  getMessages(): Message[] {
    return [...this.messages];
  }
  
  // Summarize old context instead of deleting
  async summarizeOldMessages(llm: LLMClient): Promise<void> {
    if (this.messages.length < 10) return;
    
    // Take messages 1-5 (skip system prompt)
    const oldMessages = this.messages.slice(1, 6);
    const oldContent = oldMessages
      .map(m => `${m.role}: ${m.content.slice(0, 500)}`)
      .join('\n');
    
    const summary = await llm.chat([
      {
        role: 'user',
        content: `Summarize this conversation context in 2-3 sentences:\n${oldContent}`
      }
    ]);
    
    // Replace old messages with summary
    this.messages = [
      this.messages[0], // System prompt
      { role: 'system', content: `Previous context: ${summary}` },
      ...this.messages.slice(6)
    ];
  }
}
```

---

**[DYNAMIC PROMPT UPDATES - 9:00-12:00]**

"The system prompt should update as files are opened:"

```typescript
export function buildSystemPrompt(
  basePrompt: string,
  context: {
    repoMap: string;
    openFiles: Map<string, string>;
    recentChanges?: string[];
  }
): string {
  let prompt = basePrompt;
  
  // Inject repo map
  prompt = prompt.replace('{REPO_MAP}', context.repoMap);
  
  // Inject open files
  let filesSection = '';
  for (const [path, content] of context.openFiles) {
    filesSection += `\n### ${path}\n\`\`\`\n${content}\n\`\`\`\n`;
  }
  prompt = prompt.replace('{OPEN_FILES}', filesSection || 'No files currently open.');
  
  // Add recent changes if any
  if (context.recentChanges && context.recentChanges.length > 0) {
    prompt += `\n\n## Recent Changes\n${context.recentChanges.join('\n')}`;
  }
  
  return prompt;
}
```

---

## 5.2 Planning and Task Decomposition (15 min)

### Video Script

**[INTRO - 0:00-0:30]**

"Good agents don't just code — they plan first. Let's implement planning and task decomposition."

---

**[CHAIN OF THOUGHT PLANNING - 0:30-4:00]**

"We can prompt the LLM to plan before acting:"

```typescript
const PLANNING_PROMPT = `Before making any changes, analyze the task and create a plan.

## Task Analysis Format

### Understanding
What is being asked? What are the requirements?

### Current State
What does the relevant code look like now?

### Changes Needed
What specific changes need to be made?

### Plan
1. Step one...
2. Step two...
3. Step three...

### Risks
What could go wrong? How will you verify success?

Now analyze this task: {TASK}
`;

export async function planTask(
  task: string,
  context: string,
  llm: LLMClient
): Promise<{
  plan: string[];
  risks: string[];
  filesToModify: string[];
}> {
  const response = await llm.chat([
    {
      role: 'system',
      content: `You are a senior engineer planning a code change.\n\n${context}`
    },
    {
      role: 'user',
      content: PLANNING_PROMPT.replace('{TASK}', task)
    }
  ]);
  
  // Parse the structured response
  return parsePlanResponse(response);
}
```

---

**[TASK DECOMPOSITION - 4:00-9:00]**

"Complex tasks should be broken into subtasks:"

```typescript
export interface SubTask {
  id: string;
  description: string;
  dependencies: string[];  // IDs of tasks this depends on
  files: string[];         // Files likely involved
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

export async function decomposeTask(
  task: string,
  repoMap: string,
  llm: LLMClient
): Promise<SubTask[]> {
  const response = await llm.chat([
    {
      role: 'system',
      content: `You break down coding tasks into subtasks.
      
Repository structure:
${repoMap}`
    },
    {
      role: 'user',
      content: `Break this task into subtasks (2-6 subtasks, ordered by dependency):

Task: ${task}

Respond in JSON format:
{
  "subtasks": [
    {
      "id": "1",
      "description": "...",
      "dependencies": [],
      "files": ["path/to/file.ts"]
    }
  ]
}`
    }
  ]);
  
  const parsed = JSON.parse(response);
  return parsed.subtasks.map((st: any) => ({
    ...st,
    status: 'pending' as const
  }));
}
```

---

**[THE ORCHESTRATOR PATTERN - 9:00-13:00]**

"For complex tasks, use an orchestrator-worker pattern:"

```typescript
export async function executeWithOrchestrator(
  task: string,
  agent: Agent
): Promise<string> {
  // 1. Orchestrator plans the work
  const subtasks = await decomposeTask(task, agent.repoMap, agent.llm);
  
  console.log(`Decomposed into ${subtasks.length} subtasks`);
  
  const results: Map<string, string> = new Map();
  
  // 2. Execute subtasks respecting dependencies
  while (subtasks.some(st => st.status === 'pending')) {
    // Find tasks with satisfied dependencies
    const ready = subtasks.filter(st => 
      st.status === 'pending' &&
      st.dependencies.every(dep => 
        subtasks.find(t => t.id === dep)?.status === 'completed'
      )
    );
    
    if (ready.length === 0) {
      throw new Error('No tasks ready - possible circular dependency');
    }
    
    // Execute ready tasks (could be parallel)
    for (const subtask of ready) {
      subtask.status = 'in_progress';
      console.log(`Executing: ${subtask.description}`);
      
      try {
        // Worker executes the subtask
        const result = await agent.execute(subtask.description);
        results.set(subtask.id, result);
        subtask.status = 'completed';
      } catch (error) {
        subtask.status = 'failed';
        console.error(`Subtask failed: ${error}`);
      }
    }
  }
  
  // 3. Orchestrator synthesizes results
  const synthesis = await synthesizeResults(task, results, agent.llm);
  return synthesis;
}
```

---

**[WHEN TO DECOMPOSE - 13:00-15:00]**

"Not every task needs decomposition:

**Simple (no decomposition needed):**
- Fix a typo
- Add a console.log
- Rename a variable

**Medium (maybe decompose):**
- Add a new API endpoint
- Implement a feature in one file

**Complex (definitely decompose):**
- Add authentication to an app
- Refactor a module
- Multi-file feature

Heuristic: If it touches more than 3 files, decompose."

---

## 5.3 Self-Reflection and Error Recovery (12 min)

### Video Script

**[INTRO - 0:00-0:30]**

"Agents make mistakes. The difference between a good agent and a bad one is how they recover."

---

**[THE REACT PATTERN - 0:30-4:00]**

"ReAct (Reasoning + Acting) makes the agent think explicitly:"

```typescript
const REACT_PROMPT = `You follow the ReAct pattern:

For each step:
1. THOUGHT: Think about what to do next
2. ACTION: Take an action using a tool
3. OBSERVATION: Observe the result
4. Repeat until task is complete

Example:
THOUGHT: I need to understand the current auth implementation
ACTION: read_file("src/auth/index.ts")
OBSERVATION: [file contents]
THOUGHT: I see it uses JWT. I need to add refresh token support...

Always show your thinking before acting.`;
```

"This makes the agent's reasoning visible and debuggable."

---

**[REFLEXION: LEARNING FROM MISTAKES - 4:00-8:00]**

"When something fails, reflect on why:"

```typescript
export async function reflectOnFailure(
  task: string,
  attempt: string,
  error: string,
  llm: LLMClient
): Promise<{
  diagnosis: string;
  newApproach: string;
}> {
  const response = await llm.chat([
    {
      role: 'user',
      content: `A coding task failed. Analyze what went wrong and suggest a better approach.

## Task
${task}

## Attempted Approach
${attempt}

## Error
${error}

## Analysis Required
1. What specifically went wrong?
2. Why did this approach fail?
3. What should be done differently?

Respond in JSON:
{
  "diagnosis": "...",
  "newApproach": "..."
}`
    }
  ]);
  
  return JSON.parse(response);
}

// In the agent loop
async function executeWithReflection(
  task: string,
  agent: Agent,
  maxAttempts: number = 3
): Promise<string> {
  let lastError = '';
  let lastApproach = '';
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const result = await agent.execute(task);
      return result;
    } catch (error: any) {
      lastError = error.message;
      lastApproach = agent.getLastApproach();
      
      // Reflect on failure
      const reflection = await reflectOnFailure(
        task,
        lastApproach,
        lastError,
        agent.llm
      );
      
      console.log(`Attempt ${attempt + 1} failed: ${reflection.diagnosis}`);
      console.log(`New approach: ${reflection.newApproach}`);
      
      // Update context with reflection
      agent.addContext(`Previous attempt failed: ${reflection.diagnosis}. 
        New approach: ${reflection.newApproach}`);
    }
  }
  
  throw new Error(`Failed after ${maxAttempts} attempts. Last error: ${lastError}`);
}
```

---

**[KNOWING WHEN TO ASK - 8:00-12:00]**

"Good agents know when they're stuck:"

```typescript
export function shouldAskForHelp(
  attempts: number,
  errors: string[],
  confidence: number
): { shouldAsk: boolean; reason?: string } {
  // Too many attempts
  if (attempts >= 3) {
    return {
      shouldAsk: true,
      reason: 'Multiple attempts have failed'
    };
  }
  
  // Same error repeating
  if (errors.length >= 2 && errors[errors.length - 1] === errors[errors.length - 2]) {
    return {
      shouldAsk: true,
      reason: 'Same error occurring repeatedly'
    };
  }
  
  // Low confidence on ambiguous task
  if (confidence < 0.5) {
    return {
      shouldAsk: true,
      reason: 'Task requirements are unclear'
    };
  }
  
  return { shouldAsk: false };
}

// Usage in agent
const helpCheck = shouldAskForHelp(attempts, errors, confidence);
if (helpCheck.shouldAsk) {
  return {
    type: 'clarification_needed',
    message: `I'm having trouble with this task. ${helpCheck.reason}. Could you provide more details or clarify the requirements?`
  };
}
```

---

## 5.4 Building the Complete Agent Loop (12 min)

### Video Script

**[INTRO - 0:00-0:30]**

"Let's put everything together into a complete, production-ready agent loop."

---

**[THE COMPLETE AGENT - 0:30-10:00]**

"Create `src/agent/index.ts`:"

```typescript
import OpenAI from 'openai';
import { toolRegistry, toolDefinitions } from '../tools/registry';
import { assembleContext } from '../context/assembler';
import { ConversationManager } from './conversation';
import { EditSession } from '../edit/session';

export interface AgentConfig {
  projectRoot: string;
  model?: string;
  maxIterations?: number;
  maxTokens?: number;
  verbose?: boolean;
}

export class CodingAgent {
  private llm: OpenAI;
  private conversation: ConversationManager;
  private editSession: EditSession;
  private config: AgentConfig;
  private openFiles: Map<string, string> = new Map();
  
  constructor(config: AgentConfig) {
    this.config = config;
    this.llm = new OpenAI();
    this.editSession = new EditSession();
  }
  
  async initialize(): Promise<void> {
    // Build initial context
    const context = await assembleContext(
      this.config.projectRoot,
      '', // No specific task yet
      this.codeIndex
    );
    
    const systemPrompt = buildSystemPrompt(SYSTEM_PROMPT, {
      repoMap: context,
      openFiles: this.openFiles
    });
    
    this.conversation = new ConversationManager(
      systemPrompt,
      this.config.maxTokens ?? 100000
    );
  }
  
  async execute(task: string): Promise<string> {
    this.conversation.addUserMessage(task);
    
    const maxIterations = this.config.maxIterations ?? 20;
    
    for (let i = 0; i < maxIterations; i++) {
      if (this.config.verbose) {
        console.log(`\n--- Iteration ${i + 1} ---`);
      }
      
      // Get LLM response
      const response = await this.llm.chat.completions.create({
        model: this.config.model ?? 'gpt-4-turbo-preview',
        messages: this.conversation.getMessages(),
        tools: toolDefinitions,
        tool_choice: 'auto'
      });
      
      const message = response.choices[0].message;
      
      // Handle content
      if (message.content) {
        if (this.config.verbose) {
          console.log('Assistant:', message.content);
        }
      }
      
      // Check if done (no tool calls)
      if (!message.tool_calls || message.tool_calls.length === 0) {
        this.conversation.addAssistantMessage(message.content ?? '');
        return message.content ?? 'Task completed.';
      }
      
      // Execute tool calls
      this.conversation.messages.push(message as any);
      
      for (const toolCall of message.tool_calls) {
        const result = await this.executeTool(toolCall);
        this.conversation.addToolResult(toolCall.id, result);
      }
    }
    
    return 'Max iterations reached. Task may be incomplete.';
  }
  
  private async executeTool(
    toolCall: OpenAI.Chat.ChatCompletionMessageToolCall
  ): Promise<string> {
    const name = toolCall.function.name;
    const args = JSON.parse(toolCall.function.arguments);
    
    if (this.config.verbose) {
      console.log(`Tool: ${name}`, args);
    }
    
    try {
      const executor = toolRegistry[name];
      if (!executor) {
        return JSON.stringify({ error: `Unknown tool: ${name}` });
      }
      
      const result = await executor(args, {
        projectRoot: this.config.projectRoot,
        editSession: this.editSession
      });
      
      // Track opened files
      if (name === 'read_file' && typeof result === 'string') {
        this.openFiles.set(args.path, result);
      }
      
      // Record edits for rollback
      if (name === 'edit_file' || name === 'write_file') {
        const before = this.openFiles.get(args.path) ?? '';
        this.editSession.recordEdit(args.path, before, result.content ?? '');
      }
      
      if (this.config.verbose) {
        const preview = JSON.stringify(result).slice(0, 200);
        console.log(`Result: ${preview}...`);
      }
      
      return typeof result === 'string' ? result : JSON.stringify(result);
    } catch (error: any) {
      return JSON.stringify({
        error: error.message,
        hint: getErrorHint(name, error)
      });
    }
  }
  
  async rollback(): Promise<void> {
    await this.editSession.rollbackAll();
  }
}
```

---

**[USAGE EXAMPLE - 10:00-12:00]**

```typescript
// main.ts
async function main() {
  const agent = new CodingAgent({
    projectRoot: process.cwd(),
    verbose: true
  });
  
  await agent.initialize();
  
  const result = await agent.execute(
    'Add input validation to the login function in src/auth.ts'
  );
  
  console.log('\n=== Result ===');
  console.log(result);
}

main().catch(console.error);
```

---

## 5.5 Testing Your Agent (9 min)

### Video Script

**[INTRO - 0:00-0:30]**

"How do you know if your agent actually works? Testing."

---

**[UNIT TESTS FOR TOOLS - 0:30-3:00]**

```typescript
// tests/tools.test.ts
import { readFile, writeFile, editFile } from '../src/tools/file-ops';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('File Operations', () => {
  const testDir = path.join(__dirname, 'fixtures');
  
  beforeAll(async () => {
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(
      path.join(testDir, 'test.ts'),
      'const x = 1;\nconst y = 2;\n'
    );
  });
  
  test('readFile returns content', async () => {
    const content = await readFile(testDir, 'test.ts');
    expect(content).toContain('const x = 1');
  });
  
  test('editFile applies search/replace', async () => {
    const result = await editFile(testDir, 'test.ts', [{
      search: 'const x = 1',
      replace: 'const x = 10'
    }]);
    expect(result.success).toBe(true);
  });
  
  test('editFile fails on missing search text', async () => {
    const result = await editFile(testDir, 'test.ts', [{
      search: 'not in file',
      replace: 'anything'
    }]);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Could not find');
  });
});
```

---

**[INTEGRATION TESTS - 3:00-6:00]**

```typescript
// tests/agent.test.ts
describe('Coding Agent', () => {
  let agent: CodingAgent;
  
  beforeEach(async () => {
    agent = new CodingAgent({
      projectRoot: './test-project',
      model: 'gpt-4-turbo-preview'
    });
    await agent.initialize();
  });
  
  test('can read and explain a file', async () => {
    const result = await agent.execute(
      'Read src/index.ts and explain what it does'
    );
    expect(result).toContain('function');
  });
  
  test('can make a simple edit', async () => {
    const result = await agent.execute(
      'Add a comment at the top of src/index.ts that says "Main entry point"'
    );
    
    const content = await fs.readFile('./test-project/src/index.ts', 'utf-8');
    expect(content).toContain('Main entry point');
  });
  
  afterEach(async () => {
    await agent.rollback();
  });
});
```

---

**[BENCHMARKING - 6:00-9:00]**

"For serious evaluation, use established benchmarks:"

```typescript
// SWE-bench style evaluation
interface BenchmarkTask {
  id: string;
  description: string;
  repo: string;
  expectedChanges: string[];
  testCommand: string;
}

async function runBenchmark(
  tasks: BenchmarkTask[],
  agent: CodingAgent
): Promise<{
  passed: number;
  failed: number;
  results: Array<{ id: string; success: boolean; error?: string }>
}> {
  const results = [];
  
  for (const task of tasks) {
    console.log(`Running: ${task.id}`);
    
    try {
      // Execute task
      await agent.execute(task.description);
      
      // Run tests
      const { exitCode } = await runCommand(
        task.repo,
        'npm',
        ['test']
      );
      
      const success = exitCode === 0;
      results.push({ id: task.id, success });
    } catch (error: any) {
      results.push({ id: task.id, success: false, error: error.message });
    }
    
    // Rollback for next task
    await agent.rollback();
  }
  
  return {
    passed: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results
  };
}
```

---

## Module 5 Summary

You now have:
1. System prompt design
2. Message history management
3. Planning and task decomposition
4. Self-reflection and error recovery
5. Complete agent loop
6. Testing strategies

**Your agent is now production-capable!**

Next: Module 6 — Advanced Features (Git, LSP, tests, web browsing)
