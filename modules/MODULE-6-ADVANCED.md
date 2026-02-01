# Module 6: Advanced Features

**Duration:** 50 minutes (5 videos)
**Goal:** Add professional features that make your agent production-ready

---

## 6.1 Git Integration (10 min)

### Video Script

**[INTRO - 0:00-0:30]**

"Git integration gives your agent superpowers: automatic commits, easy rollbacks, and a safety net for all changes."

---

**[AUTO-COMMITTING CHANGES - 0:30-5:00]**

"Create `src/utils/git.ts`:"

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class GitManager {
  private repoPath: string;
  
  constructor(repoPath: string) {
    this.repoPath = repoPath;
  }
  
  async isGitRepo(): Promise<boolean> {
    try {
      await execAsync('git rev-parse --git-dir', { cwd: this.repoPath });
      return true;
    } catch {
      return false;
    }
  }
  
  async status(): Promise<string> {
    const { stdout } = await execAsync('git status --short', {
      cwd: this.repoPath
    });
    return stdout;
  }
  
  async diff(file?: string): Promise<string> {
    const cmd = file ? `git diff ${file}` : 'git diff';
    const { stdout } = await execAsync(cmd, { cwd: this.repoPath });
    return stdout;
  }
  
  async commit(message: string, files?: string[]): Promise<void> {
    // Stage files
    if (files && files.length > 0) {
      await execAsync(`git add ${files.join(' ')}`, { cwd: this.repoPath });
    } else {
      await execAsync('git add -A', { cwd: this.repoPath });
    }
    
    // Commit
    await execAsync(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
      cwd: this.repoPath
    });
  }
  
  async autoCommit(changedFiles: string[], taskDescription: string): Promise<void> {
    // Generate commit message from task
    const shortDesc = taskDescription.slice(0, 50);
    const message = `AI: ${shortDesc}${taskDescription.length > 50 ? '...' : ''}

Changed files:
${changedFiles.map(f => `- ${f}`).join('\n')}`;
    
    await this.commit(message, changedFiles);
  }
  
  async undo(commits: number = 1): Promise<void> {
    await execAsync(`git reset --hard HEAD~${commits}`, {
      cwd: this.repoPath
    });
  }
  
  async createBranch(name: string): Promise<void> {
    await execAsync(`git checkout -b ${name}`, { cwd: this.repoPath });
  }
  
  async stash(): Promise<void> {
    await execAsync('git stash', { cwd: this.repoPath });
  }
  
  async stashPop(): Promise<void> {
    await execAsync('git stash pop', { cwd: this.repoPath });
  }
}
```

---

**[SAFE BRANCHING - 5:00-8:00]**

"Work on a branch so main stays clean:"

```typescript
export class SafeGitSession {
  private git: GitManager;
  private branchName: string;
  private originalBranch: string;
  
  async start(taskId: string): Promise<void> {
    // Remember current branch
    const { stdout } = await execAsync('git branch --show-current', {
      cwd: this.git.repoPath
    });
    this.originalBranch = stdout.trim();
    
    // Create work branch
    this.branchName = `ai-task-${taskId}-${Date.now()}`;
    await this.git.createBranch(this.branchName);
  }
  
  async commit(message: string, files: string[]): Promise<void> {
    await this.git.commit(message, files);
  }
  
  async finish(merge: boolean = true): Promise<void> {
    if (merge) {
      // Merge back to original branch
      await execAsync(`git checkout ${this.originalBranch}`, {
        cwd: this.git.repoPath
      });
      await execAsync(`git merge ${this.branchName}`, {
        cwd: this.git.repoPath
      });
      // Clean up branch
      await execAsync(`git branch -d ${this.branchName}`, {
        cwd: this.git.repoPath
      });
    }
  }
  
  async abort(): Promise<void> {
    // Discard changes and go back
    await execAsync(`git checkout ${this.originalBranch}`, {
      cwd: this.git.repoPath
    });
    await execAsync(`git branch -D ${this.branchName}`, {
      cwd: this.git.repoPath
    });
  }
}
```

---

**[SHOWING DIFFS TO USERS - 8:00-10:00]**

"Always show users what changed:"

```typescript
export async function showChangeSummary(
  git: GitManager,
  files: string[]
): Promise<string> {
  let summary = '## Changes Made\n\n';
  
  for (const file of files) {
    const diff = await git.diff(file);
    if (diff) {
      summary += `### ${file}\n\`\`\`diff\n${diff}\n\`\`\`\n\n`;
    }
  }
  
  return summary;
}
```

---

## 6.2 LSP Integration for Smart Completions (12 min)

### Video Script

**[INTRO - 0:00-0:30]**

"Language Server Protocol (LSP) is how IDEs understand code. We can use it to give our agent deeper code intelligence."

---

**[WHAT LSP PROVIDES - 0:30-3:00]**

"LSP gives us:
- Type information
- Go-to-definition
- Find references
- Diagnostics (errors/warnings)
- Auto-completions

This is how VSCode knows your types — and now your agent can too."

---

**[BASIC LSP CLIENT - 3:00-8:00]**

```typescript
import { spawn } from 'child_process';
import * as rpc from 'vscode-jsonrpc/node';

export class LSPClient {
  private connection: rpc.MessageConnection;
  private serverProcess: any;
  
  async start(serverCommand: string, args: string[] = []): Promise<void> {
    this.serverProcess = spawn(serverCommand, args, {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    this.connection = rpc.createMessageConnection(
      new rpc.StreamMessageReader(this.serverProcess.stdout),
      new rpc.StreamMessageWriter(this.serverProcess.stdin)
    );
    
    this.connection.listen();
    
    // Initialize
    await this.connection.sendRequest('initialize', {
      capabilities: {},
      rootUri: `file://${process.cwd()}`
    });
    
    await this.connection.sendNotification('initialized');
  }
  
  async getDefinition(
    file: string,
    line: number,
    character: number
  ): Promise<any> {
    return this.connection.sendRequest('textDocument/definition', {
      textDocument: { uri: `file://${file}` },
      position: { line, character }
    });
  }
  
  async getReferences(
    file: string,
    line: number,
    character: number
  ): Promise<any> {
    return this.connection.sendRequest('textDocument/references', {
      textDocument: { uri: `file://${file}` },
      position: { line, character },
      context: { includeDeclaration: true }
    });
  }
  
  async getDiagnostics(file: string): Promise<any[]> {
    // Open the file
    const content = await fs.readFile(file, 'utf-8');
    await this.connection.sendNotification('textDocument/didOpen', {
      textDocument: {
        uri: `file://${file}`,
        languageId: 'typescript',
        version: 1,
        text: content
      }
    });
    
    // Wait for diagnostics
    return new Promise((resolve) => {
      this.connection.onNotification('textDocument/publishDiagnostics', 
        (params) => {
          if (params.uri === `file://${file}`) {
            resolve(params.diagnostics);
          }
        }
      );
    });
  }
  
  async stop(): Promise<void> {
    await this.connection.sendRequest('shutdown');
    await this.connection.sendNotification('exit');
    this.serverProcess.kill();
  }
}
```

---

**[USING LSP IN TOOLS - 8:00-12:00]**

```typescript
// Add an LSP-powered tool
const lspTools = {
  get_type_info: async (args: { file: string; line: number; column: number }) => {
    const definition = await lspClient.getDefinition(
      args.file, 
      args.line - 1, 
      args.column
    );
    return definition;
  },
  
  find_usages: async (args: { file: string; symbol: string }) => {
    // Find where symbol is defined
    const content = await fs.readFile(args.file, 'utf-8');
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const col = lines[i].indexOf(args.symbol);
      if (col !== -1) {
        const refs = await lspClient.getReferences(args.file, i, col);
        return refs;
      }
    }
    return [];
  },
  
  check_errors: async (args: { file: string }) => {
    const diagnostics = await lspClient.getDiagnostics(args.file);
    return diagnostics.filter(d => d.severity === 1); // Errors only
  }
};
```

---

## 6.3 Running and Fixing Tests (10 min)

### Video Script

**[INTRO - 0:00-0:30]**

"A coding agent that can run tests and fix failures is incredibly powerful."

---

**[TEST RUNNER - 0:30-4:00]**

```typescript
export interface TestResult {
  passed: boolean;
  totalTests: number;
  failedTests: number;
  failures: Array<{
    name: string;
    error: string;
    file?: string;
    line?: number;
  }>;
  output: string;
}

export async function runTests(
  projectRoot: string,
  testCommand: string = 'npm test'
): Promise<TestResult> {
  const { stdout, stderr, exitCode } = await runCommand(
    projectRoot,
    testCommand.split(' ')[0],
    testCommand.split(' ').slice(1)
  );
  
  const output = stdout + stderr;
  const failures = parseTestFailures(output);
  
  return {
    passed: exitCode === 0,
    totalTests: extractTestCount(output),
    failedTests: failures.length,
    failures,
    output
  };
}

function parseTestFailures(output: string): TestResult['failures'] {
  const failures = [];
  
  // Jest format
  const jestPattern = /● (.+)\n\n([\s\S]+?)(?=\n\n●|\n\nTest Suites:)/g;
  let match;
  while ((match = jestPattern.exec(output)) !== null) {
    failures.push({
      name: match[1],
      error: match[2].trim()
    });
  }
  
  // Extract file/line from stack traces
  for (const failure of failures) {
    const stackMatch = failure.error.match(/at .+ \((.+):(\d+):\d+\)/);
    if (stackMatch) {
      failure.file = stackMatch[1];
      failure.line = parseInt(stackMatch[2]);
    }
  }
  
  return failures;
}
```

---

**[AUTO-FIX LOOP - 4:00-8:00]**

```typescript
export async function runTestsWithAutoFix(
  agent: CodingAgent,
  maxAttempts: number = 3
): Promise<TestResult> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await runTests(agent.projectRoot);
    
    if (result.passed) {
      console.log('✓ All tests passing');
      return result;
    }
    
    console.log(`Attempt ${attempt + 1}: ${result.failedTests} tests failing`);
    
    // Ask agent to fix failures
    const fixPrompt = `
The following tests are failing:

${result.failures.map(f => `
Test: ${f.name}
${f.file ? `File: ${f.file}:${f.line}` : ''}
Error: ${f.error}
`).join('\n---\n')}

Please fix these test failures.
`;
    
    await agent.execute(fixPrompt);
  }
  
  return await runTests(agent.projectRoot);
}
```

---

**[TARGETED TEST RUNS - 8:00-10:00]**

```typescript
// Run only relevant tests
export async function runRelevantTests(
  projectRoot: string,
  changedFiles: string[]
): Promise<TestResult> {
  // Find test files related to changed files
  const testFiles = changedFiles
    .map(f => {
      const dir = path.dirname(f);
      const name = path.basename(f, path.extname(f));
      return [
        `${dir}/${name}.test.ts`,
        `${dir}/__tests__/${name}.test.ts`,
        `tests/${name}.test.ts`
      ];
    })
    .flat()
    .filter(f => fs.existsSync(path.join(projectRoot, f)));
  
  if (testFiles.length === 0) {
    return { passed: true, totalTests: 0, failedTests: 0, failures: [], output: 'No relevant tests' };
  }
  
  return runTests(projectRoot, `npm test -- ${testFiles.join(' ')}`);
}
```

---

## 6.4 Web Browsing for Documentation (10 min)

### Video Script

**[INTRO - 0:00-0:30]**

"Sometimes the agent needs to look up docs. Let's add web browsing."

---

**[SIMPLE WEB FETCHER - 0:30-4:00]**

```typescript
import * as cheerio from 'cheerio';

export async function fetchWebPage(url: string): Promise<{
  title: string;
  content: string;
}> {
  const response = await fetch(url);
  const html = await response.text();
  
  const $ = cheerio.load(html);
  
  // Remove scripts, styles, nav, footer
  $('script, style, nav, footer, header, aside').remove();
  
  // Get main content
  const main = $('main, article, .content, #content').first();
  const content = main.length ? main.text() : $('body').text();
  
  return {
    title: $('title').text(),
    content: content.replace(/\s+/g, ' ').trim().slice(0, 10000)
  };
}

export async function searchDocs(
  query: string,
  site?: string
): Promise<Array<{ title: string; url: string; snippet: string }>> {
  // Use a search API (e.g., SerpAPI, Brave Search)
  const searchUrl = site 
    ? `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query + ' site:' + site)}`
    : `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}`;
  
  const response = await fetch(searchUrl, {
    headers: { 'X-Subscription-Token': process.env.BRAVE_API_KEY! }
  });
  
  const data = await response.json();
  return data.web.results.slice(0, 5).map((r: any) => ({
    title: r.title,
    url: r.url,
    snippet: r.description
  }));
}
```

---

**[DOC LOOKUP TOOL - 4:00-8:00]**

```typescript
const webTools = {
  search_docs: async (args: { query: string; library?: string }) => {
    // Map common libraries to their doc sites
    const docSites: Record<string, string> = {
      react: 'react.dev',
      typescript: 'typescriptlang.org',
      nextjs: 'nextjs.org/docs',
      prisma: 'prisma.io/docs',
      tailwind: 'tailwindcss.com/docs'
    };
    
    const site = args.library ? docSites[args.library.toLowerCase()] : undefined;
    const results = await searchDocs(args.query, site);
    return results;
  },
  
  read_docs: async (args: { url: string }) => {
    const page = await fetchWebPage(args.url);
    return {
      title: page.title,
      content: page.content
    };
  }
};
```

---

**[WHEN TO USE - 8:00-10:00]**

"Train the agent when to look things up:"

```
In your system prompt:

## When to Search Documentation

Search the web when:
- Using an unfamiliar library or API
- Encountering cryptic error messages  
- The user asks about best practices
- You're unsure about the correct syntax

Don't search for:
- Basic language features you know
- Things already in the codebase context
- Simple questions you can answer directly
```

---

## 6.5 Multi-File Operations (8 min)

### Video Script

**[INTRO - 0:00-0:30]**

"Real features touch multiple files. Let's handle that properly."

---

**[COORDINATED CHANGES - 0:30-4:00]**

```typescript
export interface MultiFileEdit {
  files: Array<{
    path: string;
    edits: EditOperation[];
  }>;
}

export async function applyMultiFileEdit(
  projectRoot: string,
  edit: MultiFileEdit,
  editSession: EditSession
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];
  const applied: string[] = [];
  
  // Validate all edits first
  for (const fileEdit of edit.files) {
    const content = await fs.readFile(
      path.join(projectRoot, fileEdit.path),
      'utf-8'
    );
    
    for (const op of fileEdit.edits) {
      if (!content.includes(op.search)) {
        errors.push(`${fileEdit.path}: Could not find search text`);
      }
    }
  }
  
  if (errors.length > 0) {
    return { success: false, errors };
  }
  
  // Apply all edits
  for (const fileEdit of edit.files) {
    const filePath = path.join(projectRoot, fileEdit.path);
    let content = await fs.readFile(filePath, 'utf-8');
    const original = content;
    
    for (const op of fileEdit.edits) {
      content = content.replace(op.search, op.replace);
    }
    
    await fs.writeFile(filePath, content);
    editSession.recordEdit(fileEdit.path, original, content);
    applied.push(fileEdit.path);
  }
  
  return { success: true, errors: [] };
}
```

---

**[ATOMIC OPERATIONS - 4:00-8:00]**

```typescript
export async function atomicMultiFileEdit(
  projectRoot: string,
  edit: MultiFileEdit
): Promise<{ success: boolean; error?: string }> {
  const backups = new Map<string, string>();
  
  try {
    // Backup all files first
    for (const fileEdit of edit.files) {
      const filePath = path.join(projectRoot, fileEdit.path);
      const content = await fs.readFile(filePath, 'utf-8');
      backups.set(fileEdit.path, content);
    }
    
    // Apply edits
    for (const fileEdit of edit.files) {
      const filePath = path.join(projectRoot, fileEdit.path);
      let content = backups.get(fileEdit.path)!;
      
      for (const op of fileEdit.edits) {
        if (!content.includes(op.search)) {
          throw new Error(`${fileEdit.path}: Search text not found`);
        }
        content = content.replace(op.search, op.replace);
      }
      
      await fs.writeFile(filePath, content);
    }
    
    return { success: true };
  } catch (error: any) {
    // Rollback on any failure
    for (const [filePath, content] of backups) {
      await fs.writeFile(path.join(projectRoot, filePath), content);
    }
    
    return { success: false, error: error.message };
  }
}
```

---

## Module 6 Summary

You now have:
1. Git integration for commits and rollbacks
2. LSP for deep code understanding
3. Test running and auto-fixing
4. Web browsing for documentation
5. Multi-file atomic operations

**Your agent is now a serious tool!**

Next: Module 7 — Production Considerations
