# Module 8: Final Project — Your Complete AI Coding Agent

**Duration:** 45 minutes (4 videos)
**Goal:** Build a complete, working AI coding agent from scratch

---

## 8.1 Project Setup and Architecture Review (10 min)

### Video Script

**[INTRO - 0:00-0:30]**

"Time to put everything together. We're going to build a complete AI coding agent that you can actually use — and share."

---

**[FINAL ARCHITECTURE - 0:30-4:00]**

```
ai-coding-agent/
├── src/
│   ├── index.ts              # CLI entry point
│   ├── agent/
│   │   ├── index.ts          # Main CodingAgent class
│   │   ├── loop.ts           # Agent execution loop
│   │   ├── conversation.ts   # Message history management
│   │   └── prompts.ts        # System prompts
│   ├── context/
│   │   ├── index.ts          # Context assembly
│   │   ├── repo-map.ts       # Tree-sitter mapping
│   │   ├── embeddings.ts     # Code embeddings
│   │   └── ranker.ts         # File importance ranking
│   ├── tools/
│   │   ├── index.ts          # Tool registry
│   │   ├── schemas.ts        # JSON schemas
│   │   ├── file-ops.ts       # File operations
│   │   ├── commands.ts       # Shell commands
│   │   └── search.ts         # Code search
│   ├── edit/
│   │   ├── index.ts          # Edit orchestration
│   │   ├── diff.ts           # Unified diff handling
│   │   ├── search-replace.ts # Search/replace
│   │   └── session.ts        # Edit session/rollback
│   ├── utils/
│   │   ├── git.ts            # Git integration
│   │   ├── tokens.ts         # Token counting
│   │   ├── security.ts       # Sandboxing
│   │   └── logger.ts         # Logging
│   └── ui/
│       ├── progress.ts       # Progress indicators
│       └── diff-view.ts      # Diff visualization
├── tests/
│   ├── tools.test.ts
│   ├── edit.test.ts
│   └── agent.test.ts
├── package.json
├── tsconfig.json
└── README.md
```

---

**[CONFIGURATION - 4:00-7:00]**

```typescript
// src/config.ts
export interface AgentConfig {
  // LLM settings
  model: string;
  apiKey?: string;
  maxTokens: number;
  
  // Context settings
  repoMapTokens: number;
  maxContextTokens: number;
  useEmbeddings: boolean;
  
  // Safety settings
  allowedCommands: string[];
  sandboxed: boolean;
  confirmBeforeApply: boolean;
  
  // Git settings
  autoCommit: boolean;
  useBranches: boolean;
  
  // UI settings
  verbose: boolean;
  streaming: boolean;
}

export const DEFAULT_CONFIG: AgentConfig = {
  model: 'gpt-4-turbo-preview',
  maxTokens: 100000,
  
  repoMapTokens: 2000,
  maxContextTokens: 25000,
  useEmbeddings: true,
  
  allowedCommands: ['npm', 'npx', 'node', 'git', 'tsc', 'eslint'],
  sandboxed: false,
  confirmBeforeApply: true,
  
  autoCommit: true,
  useBranches: true,
  
  verbose: false,
  streaming: true,
};

// Load from file
export function loadConfig(configPath?: string): AgentConfig {
  const path = configPath ?? '.ai-agent.json';
  
  if (fs.existsSync(path)) {
    const userConfig = JSON.parse(fs.readFileSync(path, 'utf-8'));
    return { ...DEFAULT_CONFIG, ...userConfig };
  }
  
  return DEFAULT_CONFIG;
}
```

---

**[INITIALIZATION - 7:00-10:00]**

```typescript
// src/agent/index.ts
export class CodingAgent {
  private config: AgentConfig;
  private llm: OpenAI;
  private context: ContextManager;
  private tools: ToolRegistry;
  private editSession: EditSession;
  private git: GitManager;
  private conversation: ConversationManager;
  private ui: ProgressUI;
  
  constructor(projectRoot: string, config?: Partial<AgentConfig>) {
    this.config = { ...loadConfig(), ...config };
    this.llm = new OpenAI({ apiKey: this.config.apiKey });
    this.context = new ContextManager(projectRoot, this.config);
    this.tools = new ToolRegistry(projectRoot, this.config);
    this.editSession = new EditSession();
    this.git = new GitManager(projectRoot);
    this.ui = new ProgressUI();
  }
  
  async initialize(): Promise<void> {
    // Build initial context
    this.ui.progress('Building repository map...');
    const repoMap = await this.context.buildRepoMap();
    
    // Index for embeddings if enabled
    if (this.config.useEmbeddings) {
      this.ui.progress('Indexing codebase...');
      await this.context.buildIndex();
    }
    
    // Setup conversation with system prompt
    const systemPrompt = buildSystemPrompt({
      repoMap,
      config: this.config
    });
    
    this.conversation = new ConversationManager(
      systemPrompt,
      this.config.maxTokens
    );
    
    // Create working branch if configured
    if (this.config.useBranches && await this.git.isGitRepo()) {
      await this.git.createBranch(`ai-work-${Date.now()}`);
    }
    
    this.ui.done();
  }
  
  async execute(task: string): Promise<string> {
    // Main agent loop
    return this.runLoop(task);
  }
  
  // ... rest of implementation
}
```

---

## 8.2 Live Coding: Build Mode (15 min)

### Video Script

**[INTRO - 0:00-0:30]**

"Let's use our agent to build a complete feature. I'll show you exactly how it thinks and works."

---

**[THE TASK - 0:30-2:00]**

"We'll add a user profile feature to a simple Express app:
- GET /api/profile — get current user profile
- PUT /api/profile — update profile
- Profile includes: name, bio, avatar URL

Let's watch the agent work."

---

**[DEMO - 2:00-13:00]**

```bash
$ ai-dev do "Add a user profile feature with GET and PUT endpoints for /api/profile"

→ Thinking...
I'll add a user profile feature. Let me first understand the current structure.

→ read_file("src/routes/index.ts")
✓ read_file

→ read_file("src/models/user.ts")  
✓ read_file

→ Thinking...
I see the app uses Express with a User model. I'll:
1. Add profile fields to the User model
2. Create profile route handlers
3. Register the routes

→ edit_file("src/models/user.ts")
✓ edit_file

Changed:
```diff
  interface User {
    id: string;
    email: string;
+   name?: string;
+   bio?: string;
+   avatarUrl?: string;
  }
```

→ write_file("src/routes/profile.ts")
✓ write_file

Created new file with profile endpoints...

→ edit_file("src/routes/index.ts")
✓ edit_file

Added profile routes import...

→ run_command("npm test")
✓ Tests passing

Done! Added profile feature:
- Extended User model with name, bio, avatarUrl
- Created GET /api/profile endpoint
- Created PUT /api/profile endpoint  
- All tests passing
```

---

**[KEY OBSERVATIONS - 13:00-15:00]**

"Notice how the agent:

1. **Read first** — Understood the codebase before changing
2. **Planned** — Listed steps before executing
3. **Made minimal changes** — Edited existing file, created one new file
4. **Verified** — Ran tests after changes

This is the ReAct pattern in action: Think → Act → Observe → Repeat"

---

## 8.3 Live Coding: Debug Mode (10 min)

### Video Script

**[INTRO - 0:00-0:30]**

"Now let's see the agent debug a real error."

---

**[THE ERROR - 0:30-2:00]**

```bash
TypeError: Cannot read property 'id' of undefined
    at getProfile (/src/routes/profile.ts:15:24)
    at /src/middleware/auth.ts:8:5
```

---

**[DEMO - 2:00-8:00]**

```bash
$ ai-dev do "Fix this error: TypeError: Cannot read property 'id' of undefined at getProfile"

→ Thinking...
This looks like a null reference error. Let me examine the profile route.

→ read_file("src/routes/profile.ts")
✓ read_file

→ Thinking...
I see the issue. The `req.user` might be undefined if auth middleware fails silently.
Let me check the auth middleware.

→ read_file("src/middleware/auth.ts")
✓ read_file

→ Thinking...
Found it! The auth middleware doesn't handle the case where the token is invalid.
It should return 401, but instead it calls next() without setting req.user.

I'll fix both files:
1. Auth middleware should reject invalid tokens
2. Profile route should have a safety check

→ edit_file("src/middleware/auth.ts")
✓ edit_file

```diff
  if (!decoded) {
-   next();
+   return res.status(401).json({ error: 'Invalid token' });
  }
```

→ edit_file("src/routes/profile.ts")
✓ edit_file

```diff
  export async function getProfile(req, res) {
+   if (!req.user) {
+     return res.status(401).json({ error: 'Not authenticated' });
+   }
    const profile = await db.getUser(req.user.id);
```

→ run_command("npm test")
✓ Tests passing

Fixed! The issue was:
1. Auth middleware called next() even with invalid tokens
2. Profile route didn't check for missing user

Both are now fixed with proper error handling.
```

---

**[KEY OBSERVATIONS - 8:00-10:00]**

"The agent:

1. **Read the stack trace** — Found the relevant files
2. **Traced the root cause** — Followed the call chain to auth middleware
3. **Fixed both issues** — Defensive coding at both layers
4. **Verified** — Tests confirmed the fix

This is how a senior developer debugs — understand, trace, fix, verify."

---

## 8.4 Deployment and Distribution (10 min)

### Video Script

**[INTRO - 0:00-0:30]**

"Let's package your agent for the world."

---

**[PACKAGE.JSON - 0:30-3:00]**

```json
{
  "name": "ai-coding-agent",
  "version": "1.0.0",
  "description": "An AI-powered coding assistant",
  "main": "dist/index.js",
  "bin": {
    "ai-dev": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts",
    "test": "jest",
    "prepublishOnly": "npm run build && npm test"
  },
  "keywords": ["ai", "coding", "assistant", "llm", "gpt"],
  "author": "Your Name",
  "license": "MIT",
  "dependencies": {
    "openai": "^4.0.0",
    "@anthropic-ai/sdk": "^0.9.0",
    "commander": "^11.0.0",
    "chalk": "^5.0.0",
    "ora": "^7.0.0",
    "tree-sitter": "^0.20.0",
    "diff": "^5.0.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

---

**[NPM PUBLISH - 3:00-5:00]**

```bash
# Login to npm
npm login

# Build and test
npm run build
npm test

# Publish
npm publish

# Users can now:
npm install -g ai-coding-agent
ai-dev chat
```

---

**[DOCUMENTATION - 5:00-8:00]**

```markdown
# AI Coding Agent

An AI-powered coding assistant that understands your codebase.

## Installation

\`\`\`bash
npm install -g ai-coding-agent
\`\`\`

## Setup

1. Get an OpenAI API key from https://platform.openai.com
2. Set the environment variable:
   \`\`\`bash
   export OPENAI_API_KEY=sk-...
   \`\`\`

## Usage

### Interactive Mode
\`\`\`bash
cd your-project
ai-dev chat
\`\`\`

### One-shot Tasks
\`\`\`bash
ai-dev do "add input validation to the login function"
\`\`\`

### Index Your Codebase
\`\`\`bash
ai-dev index
\`\`\`

## Configuration

Create `.ai-agent.json` in your project root:

\`\`\`json
{
  "model": "gpt-4-turbo-preview",
  "autoCommit": true,
  "confirmBeforeApply": true
}
\`\`\`

## Commands

- `/help` - Show available commands
- `/undo` - Undo last change
- `/diff` - Show all changes
- `/commit` - Commit changes
- `/exit` - Exit

## License

MIT
```

---

**[WHAT'S NEXT - 8:00-10:00]**

"Congratulations! You've built a complete AI coding agent.

Ideas for extending it:
- Add more LLM providers (Claude, Gemini, local models)
- Build a VSCode extension
- Add voice input
- Support more languages
- Create specialized agents (test writer, docs generator)

The foundation you've built is solid. Now go make it yours!"

---

## Course Conclusion

**What You've Learned:**

1. **Foundations** — How LLMs code, agent architecture
2. **Tools** — Function calling, tool design
3. **Context** — Repo maps, embeddings, selection
4. **Editing** — Diffs, search/replace, error handling
5. **Agent Loop** — Planning, reflection, recovery
6. **Advanced** — Git, LSP, testing, web
7. **Production** — Security, cost, UX

**What You've Built:**

A complete, working AI coding agent that:
- Understands codebases
- Makes intelligent edits
- Runs commands
- Fixes its own mistakes
- Is safe and efficient

**You now understand how Cursor, Claude Code, and Aider work.**

Go build something amazing! 🚀
