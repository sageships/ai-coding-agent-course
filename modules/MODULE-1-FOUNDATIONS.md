# Module 1: Foundations — How LLMs Actually Code

**Duration:** 45 minutes (4 videos)
**Goal:** Understand the core architecture that makes AI coding agents work

---

## 1.1 The Surprising Truth About AI Code Generation (10 min)

### Video Script

**[INTRO - 0:00-0:30]**

"Let me show you something interesting. Watch this."

*[Screen recording: Open ChatGPT]*

"Write me a function that calculates the factorial of a number."

*[Show ChatGPT generating perfect code]*

"Beautiful, right? Clean code, handles edge cases, even adds a docstring. Now watch this."

*[Screen recording: Show a real codebase]*

"I have this Express app. It has a User model, an AuthService, and some API routes. I want to add a password reset feature."

*[Ask ChatGPT without context]*

"Just asking ChatGPT to add password reset..."

*[Show it hallucinating imports, wrong file structure]*

"See the problem? It doesn't know my codebase. It's guessing at my file structure, making up method names that don't exist, importing from packages I don't have."

---

**[THE CORE PROBLEM - 0:30-3:00]**

"This is the fundamental challenge of AI-assisted coding, and it's why we're building this course.

There's a massive gap between:
- Writing code in isolation (LLMs are great at this)
- Editing code in a real codebase (LLMs struggle without help)

Let me break down why. When you ask an LLM to work on real code, it needs to do three things:"

*[Show diagram]*

```
THE 3-STEP CHALLENGE:

1. FIND    → Which files need to change?
2. UNDERSTAND → How does this code relate to the rest?
3. CHANGE  → What exact edits need to happen?
```

"GPT-4 is actually amazing at step 3 — the actual code changes. The problem is steps 1 and 2. Without knowing your codebase, it can't find the right files or understand how they connect.

You might think: 'Easy fix — just send the whole codebase with every prompt!'

Let's do the math. A medium-sized project — say, 50,000 lines of code — that's roughly 200,000 tokens. GPT-4 Turbo's context window is 128,000 tokens. And even if it fit:
- Cost: about $2-4 per request
- Latency: 30+ seconds
- Accuracy: LLMs get WORSE with too much context — they lose focus

So we need something smarter."

---

**[HOW AI CODING TOOLS SOLVE THIS - 3:00-7:00]**

"This is exactly what tools like Cursor, Claude Code, and Aider solve. They don't just throw everything at the LLM. They intelligently:

1. **Map the codebase** — Create a condensed overview showing all files, classes, and functions
2. **Select relevant context** — Only send files that matter for the current task
3. **Give the LLM tools** — Let it request more files if needed

Here's how it actually works in Aider, one of the best open-source coding agents:"

*[Show Aider architecture diagram]*

```
┌─────────────────────────────────────────┐
│           REPOSITORY MAP                │
│  Condensed view of all files/symbols    │
│  ~1000 tokens instead of 200,000        │
└─────────────────────┬───────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────┐
│         CONTEXT SELECTION               │
│  Graph algorithm finds relevant files   │
│  Based on imports, references, task     │
└─────────────────────┬───────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────┐
│              LLM PROMPT                 │
│  System prompt + Repo map + Files +     │
│  Tools + User request                   │
└─────────────────────┬───────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────┐
│          LLM RESPONSE                   │
│  Code changes OR request for more files │
└─────────────────────────────────────────┘
```

"The magic is in that repository map. Instead of sending 50,000 lines of code, we send something like this:"

*[Show example repo map]*

```
src/auth/service.ts:
│ export class AuthService
│   login(email: string, password: string): Promise<User>
│   logout(userId: string): void
│
src/models/user.ts:
│ export interface User
│   id: string
│   email: string
│   passwordHash: string
│
src/api/routes.ts:
│ export function setupRoutes(app: Express)
```

"This gives the LLM enough context to understand the codebase structure without drowning it in detail. When it needs to see the actual implementation of AuthService, it can ask for it."

---

**[WHAT WE'LL BUILD - 7:00-9:00]**

"In this course, you're going to build every piece of this system:

**Module 2:** The tool system — how LLMs request and execute actions
**Module 3:** The context system — repo mapping, embedding search, smart selection
**Module 4:** The edit system — how to reliably apply LLM-generated code changes
**Module 5:** The agent loop — putting it all together

By the end, you'll have a working AI coding agent that can:
- Understand your codebase
- Make intelligent edits
- Run commands
- Fix its own mistakes

And more importantly, you'll understand exactly how Cursor, Claude Code, and Aider work under the hood. You'll be able to read their source code, understand their design decisions, and maybe even contribute."

---

**[OUTRO - 9:00-10:00]**

"Let me leave you with this: AI coding tools aren't magic. They're well-engineered systems built on a few key ideas that we'll master in this course.

The LLM is just one component — the brain. But brains need eyes to see (the context system), hands to act (the tool system), and memory to remember (conversation history).

In the next video, we'll break down the complete anatomy of an AI coding agent, looking at these four components in detail.

See you there."

---

### Key Visuals Needed

1. ChatGPT success/failure comparison
2. The 3-step challenge diagram
3. Aider architecture diagram
4. Example repo map

### Talking Points Checklist

- [ ] Demo the contrast between isolated vs. contextual coding
- [ ] Explain why "send everything" doesn't work
- [ ] Introduce the repo map concept
- [ ] Set up what we'll build

---

## 1.2 Anatomy of an AI Coding Agent (12 min)

### Video Script

**[INTRO - 0:00-0:30]**

"Every AI coding tool — whether it's Cursor, Claude Code, Aider, GitHub Copilot Workspace, or Devin — they all share the same fundamental architecture.

In this video, I'm going to break down that architecture so you understand exactly what's happening when you ask an AI to write code."

---

**[THE AUGMENTED LLM - 0:30-3:00]**

"Anthropic — the company behind Claude — published a fantastic research article called 'Building Effective Agents'. They describe something called the 'Augmented LLM'.

An Augmented LLM is a language model enhanced with three capabilities:"

*[Show diagram]*

```
         ┌─────────────────────────┐
         │          LLM           │
         │    (The Brain)         │
         └───────────┬────────────┘
                     │
     ┌───────────────┼───────────────┐
     │               │               │
     ▼               ▼               ▼
┌─────────┐   ┌───────────┐   ┌─────────┐
│  TOOLS  │   │  MEMORY   │   │ RETRIEVAL│
│ Actions │   │ Conversation│  │ Search  │
│ it can  │   │ history,    │  │ codebase│
│ take    │   │ context     │  │ & docs  │
└─────────┘   └───────────┘   └─────────┘
```

"Let's break these down:

**TOOLS:** These are actions the LLM can take. Read a file, write a file, run a command, search the web. The LLM doesn't actually do these things — it requests them, and your code executes them.

**MEMORY:** This includes the conversation history (what you've discussed), but also persistent memory (what the LLM should remember across sessions).

**RETRIEVAL:** This is how the LLM gets information it doesn't have. Searching your codebase, looking up documentation, finding relevant examples.

The key insight: a vanilla LLM can only process text. An augmented LLM can interact with the world."

---

**[WORKFLOWS VS AGENTS - 3:00-5:00]**

"Anthropic makes an important distinction between 'workflows' and 'agents'.

**Workflows** are systems where you, the developer, control the flow. The LLM makes decisions at specific points, but the overall path is predefined.

Example workflow: Code Review
1. User submits PR
2. LLM analyzes diff (decision point)
3. If issues found → comment on PR
4. If clean → approve

**Agents** are systems where the LLM controls the flow. It decides what to do, in what order, for how long.

Example agent: Coding Assistant
1. User: 'Add user authentication'
2. LLM decides: first, let me understand the current auth setup
3. LLM requests: read src/auth/*
4. LLM decides: I need to modify these 3 files
5. LLM generates edits
6. LLM decides: let me run the tests
7. Tests fail → LLM decides to fix
8. Loop until done or give up

The coding agents we're building in this course are true agents — they control their own execution based on what they observe."

---

**[THE AGENT LOOP - 5:00-8:00]**

"Every agent follows this basic loop:"

*[Show loop diagram]*

```
              ┌────────────────────┐
              │   USER REQUEST     │
              └─────────┬──────────┘
                        │
                        ▼
              ┌────────────────────┐
       ┌─────>│      THINK         │
       │      │  Analyze & Plan    │
       │      └─────────┬──────────┘
       │                │
       │                ▼
       │      ┌────────────────────┐
       │      │       ACT          │
       │      │  Execute Tool(s)   │
       │      └─────────┬──────────┘
       │                │
       │                ▼
       │      ┌────────────────────┐
       │      │     OBSERVE        │
       │      │  Get Tool Results  │
       │      └─────────┬──────────┘
       │                │
       │                ▼
       │      ┌────────────────────┐
       │      │   DONE / REPEAT?   │
       └──────┤  Check if complete │
              └────────────────────┘
```

"This is called the ReAct pattern — Reasoning + Acting. The LLM:

1. **Thinks** about what to do next
2. **Acts** by calling tools
3. **Observes** the results
4. **Repeats** until the task is done

In practice, here's what an iteration looks like:"

*[Show example conversation]*

```
SYSTEM: You are a coding assistant with these tools: read_file, write_file, run_command...

USER: Add a /health endpoint to my Express app

ASSISTANT: I'll first check the current route structure.
<tool_call>
  <name>read_file</name>
  <path>src/routes/index.ts</path>
</tool_call>

TOOL RESULT: [file contents]

ASSISTANT: I see the routes are organized in this file. I'll add a health endpoint.
<tool_call>
  <name>edit_file</name>
  <path>src/routes/index.ts</path>
  <changes>...</changes>
</tool_call>

TOOL RESULT: File updated successfully

ASSISTANT: The /health endpoint has been added. Should I run the tests to verify it works?
```

"Notice how the LLM is in control. It decides to read first, then edit. It could have decided to search for existing health checks first. Or ask the user for clarification. The agent loop gives it that flexibility."

---

**[THE 4 SUBSYSTEMS - 8:00-11:00]**

"Let me now give you the complete picture of what we're building:"

*[Show architecture diagram]*

```
┌────────────────────────────────────────────────────────────┐
│                    AI CODING AGENT                         │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────────────┐    ┌──────────────────┐             │
│  │  1. CONTEXT      │    │  2. TOOLS        │             │
│  │                  │    │                  │             │
│  │  • Repo map      │    │  • read_file     │             │
│  │  • Embeddings    │    │  • write_file    │             │
│  │  • File selection│    │  • edit_file     │             │
│  │                  │    │  • run_command   │             │
│  │  "What should    │    │  • search_code   │             │
│  │   the LLM see?"  │    │  "What can the   │             │
│  │                  │    │   LLM do?"       │             │
│  └──────────────────┘    └──────────────────┘             │
│                                                            │
│  ┌──────────────────┐    ┌──────────────────┐             │
│  │  3. EDIT FORMAT  │    │  4. AGENT LOOP   │             │
│  │                  │    │                  │             │
│  │  • Unified diffs │    │  • Orchestration │             │
│  │  • Search/replace│    │  • Error recovery│             │
│  │  • Whole file    │    │  • Iteration     │             │
│  │                  │    │  • Exit conditions│             │
│  │  "How does the   │    │  "How does it    │             │
│  │   LLM edit code?"│    │   all fit together?"│          │
│  └──────────────────┘    └──────────────────┘             │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

"These four subsystems are what we'll build:

**1. Context System (Module 3):** This is about getting the right information to the LLM. We'll build repo maps with tree-sitter, embedding-based search, and smart file selection.

**2. Tool System (Module 2):** This is about what the LLM can do. We'll implement file operations, command execution, and design tools that are hard to misuse.

**3. Edit Format (Module 4):** This is about how the LLM expresses code changes. We'll implement unified diffs, search/replace blocks, and robust error handling.

**4. Agent Loop (Module 5):** This is the orchestration layer. We'll build the think-act-observe loop, handle errors, and decide when to stop.

Understanding these four pieces is the key to understanding ANY AI coding tool."

---

**[OUTRO - 11:00-12:00]**

"Here's what I want you to take away: AI coding agents are not black boxes. They're systems built from understandable components.

The LLM is powerful, but it's just one piece. The real engineering is in:
- What context you give it
- What tools you let it use
- How you handle its output
- How you orchestrate the loop

In the next video, we'll set up our development environment and get our first LLM API calls working. Then we'll start building each of these systems.

Let's go."

---

### Key Visuals Needed

1. Augmented LLM diagram
2. Agent loop cycle
3. Four subsystems architecture
4. Example conversation flow

---

## 1.3 Setting Up Your Development Environment (10 min)

### Video Script

**[INTRO - 0:00-0:30]**

"Before we write any agent code, let's set up our development environment. We're going to use TypeScript throughout this course because it gives us type safety, which really helps when dealing with complex tool schemas and API responses."

---

**[PROJECT SETUP - 0:30-3:00]**

"Let's create our project:"

```bash
mkdir ai-coding-agent
cd ai-coding-agent
npm init -y
```

"Now let's install our dependencies. I'll explain each one:"

```bash
# TypeScript and Node types
npm install -D typescript @types/node tsx

# LLM SDKs
npm install openai @anthropic-ai/sdk

# Code parsing (for repo maps)
npm install tree-sitter tree-sitter-typescript tree-sitter-python tree-sitter-javascript

# CLI and utilities
npm install commander chalk ora glob

# Embeddings and vector search (we'll use these later)
npm install @xenova/transformers
```

"Initialize TypeScript:"

```bash
npx tsc --init
```

"Here's the tsconfig.json we'll use:"

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true
  },
  "include": ["src/**/*"]
}
```

---

**[PROJECT STRUCTURE - 3:00-5:00]**

"Here's the project structure we'll build throughout this course:"

```
ai-coding-agent/
├── src/
│   ├── index.ts          # Main entry point
│   ├── agent/
│   │   ├── loop.ts       # The main agent loop
│   │   └── prompts.ts    # System prompts
│   ├── context/
│   │   ├── repo-map.ts   # Repository mapping
│   │   ├── embeddings.ts # Code embeddings
│   │   └── selector.ts   # Context selection
│   ├── tools/
│   │   ├── index.ts      # Tool registry
│   │   ├── file-ops.ts   # File operations
│   │   ├── commands.ts   # Shell commands
│   │   └── schemas.ts    # Tool JSON schemas
│   ├── edit/
│   │   ├── diff.ts       # Unified diff parser
│   │   ├── search-replace.ts
│   │   └── apply.ts      # Edit application
│   └── utils/
│       ├── tokens.ts     # Token counting
│       ├── git.ts        # Git operations
│       └── logger.ts     # Logging
├── package.json
├── tsconfig.json
└── .env                  # API keys
```

"We won't build everything at once. We'll add files as we go through each module."

---

**[API KEYS - 5:00-6:30]**

"You'll need API keys for at least one LLM provider. I recommend getting both OpenAI and Anthropic keys — we'll compare how different models perform.

Create a `.env` file:"

```
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

"And a simple `.env` loader in `src/utils/env.ts`:"

```typescript
import { config } from 'dotenv';
config();

export const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!OPENAI_API_KEY && !ANTHROPIC_API_KEY) {
  throw new Error('At least one API key required');
}
```

---

**[BASIC FILE STRUCTURE - 6:30-9:00]**

"Let's create our initial files. First, `src/index.ts`:"

```typescript
#!/usr/bin/env node
import { Command } from 'commander';

const program = new Command();

program
  .name('ai-agent')
  .description('An AI coding agent')
  .version('1.0.0');

program
  .command('chat')
  .description('Start an interactive chat session')
  .action(async () => {
    console.log('Chat mode coming soon!');
  });

program
  .command('task')
  .argument('<task>', 'The coding task to perform')
  .description('Execute a one-shot coding task')
  .action(async (task: string) => {
    console.log(`Executing task: ${task}`);
  });

program.parse();
```

"Add a start script to `package.json`:"

```json
{
  "scripts": {
    "start": "tsx src/index.ts",
    "build": "tsc"
  }
}
```

"Now we can run:"

```bash
npm start chat
npm start task "add a hello world endpoint"
```

---

**[OUTRO - 9:00-10:00]**

"Our project skeleton is ready. In the next video, we'll make our first LLM API calls and understand how tokens, streaming, and error handling work.

See you there."

---

## 1.4 Your First LLM API Call (13 min)

### Video Script

**[INTRO - 0:00-0:30]**

"Let's make our first API call to an LLM. We'll use both OpenAI and Anthropic SDKs, learn about tokens and context windows, implement streaming, and set up proper error handling."

---

**[BASIC OPENAI CALL - 0:30-3:00]**

"Create `src/llm/openai.ts`:"

```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function chat(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }
): Promise<string> {
  const response = await client.chat.completions.create({
    model: options?.model ?? 'gpt-4-turbo-preview',
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 4096,
  });

  return response.choices[0].message.content ?? '';
}

// Test it
async function main() {
  const response = await chat([
    { role: 'system', content: 'You are a helpful coding assistant.' },
    { role: 'user', content: 'Write a TypeScript function to reverse a string.' }
  ]);
  console.log(response);
}

main();
```

"Run it with `npx tsx src/llm/openai.ts` and you'll see your first generated code!"

---

**[ANTHROPIC VERSION - 3:00-4:30]**

"Here's the equivalent for Claude. Create `src/llm/anthropic.ts`:"

```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function chat(
  messages: Anthropic.MessageParam[],
  options?: {
    model?: string;
    maxTokens?: number;
  }
): Promise<string> {
  const response = await client.messages.create({
    model: options?.model ?? 'claude-3-5-sonnet-latest',
    max_tokens: options?.maxTokens ?? 4096,
    messages,
  });

  // Extract text from content blocks
  const textBlocks = response.content.filter(
    (block): block is Anthropic.TextBlock => block.type === 'text'
  );
  return textBlocks.map(b => b.text).join('');
}
```

"The APIs are slightly different but the concept is the same."

---

**[UNDERSTANDING TOKENS - 4:30-7:00]**

"Before we go further, let's understand tokens — they're how LLMs measure text, and they're how you get billed.

Tokens are roughly 4 characters or 3/4 of a word. Here's how to count them:"

```typescript
// Install: npm install tiktoken
import { encoding_for_model } from 'tiktoken';

export function countTokens(text: string, model: string = 'gpt-4'): number {
  const enc = encoding_for_model(model as any);
  const tokens = enc.encode(text);
  enc.free();
  return tokens.length;
}

// Example
const code = `function hello() {
  console.log("Hello, world!");
}`;

console.log(countTokens(code)); // ~15 tokens
```

"Context windows are the maximum tokens for input + output:
- GPT-4 Turbo: 128k tokens (~300 pages)
- Claude 3.5 Sonnet: 200k tokens
- GPT-4o: 128k tokens

For a typical coding request:
- System prompt: 500-2000 tokens
- User message: 100-1000 tokens
- Code context: 2000-20000 tokens
- Response: 1000-4000 tokens

Always leave room for the response!"

---

**[STREAMING RESPONSES - 7:00-10:00]**

"For a good UX, we want to stream responses as they're generated:"

```typescript
export async function chatStream(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  onChunk: (chunk: string) => void,
  options?: { model?: string }
): Promise<string> {
  const stream = await client.chat.completions.create({
    model: options?.model ?? 'gpt-4-turbo-preview',
    messages,
    stream: true,
  });

  let fullResponse = '';
  
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content ?? '';
    if (content) {
      fullResponse += content;
      onChunk(content);
    }
  }

  return fullResponse;
}

// Usage
await chatStream(
  [{ role: 'user', content: 'Explain TypeScript generics' }],
  (chunk) => process.stdout.write(chunk) // Print as we receive
);
```

---

**[ERROR HANDLING - 10:00-12:00]**

"LLM APIs fail. Rate limits, network issues, overloaded servers. Here's robust error handling:"

```typescript
import { sleep } from './utils';

export async function chatWithRetry(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  options?: { maxRetries?: number; model?: string }
): Promise<string> {
  const maxRetries = options?.maxRetries ?? 3;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await chat(messages, options);
    } catch (error: any) {
      // Rate limit - wait and retry
      if (error?.status === 429) {
        const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff
        console.log(`Rate limited. Waiting ${waitTime}ms...`);
        await sleep(waitTime);
        continue;
      }
      
      // Server error - retry
      if (error?.status >= 500) {
        console.log(`Server error. Retrying...`);
        await sleep(1000);
        continue;
      }
      
      // Other errors - don't retry
      throw error;
    }
  }
  
  throw new Error('Max retries exceeded');
}
```

---

**[UNIFIED LLM INTERFACE - 12:00-13:00]**

"Finally, let's create a unified interface so we can switch between providers:"

```typescript
// src/llm/index.ts
export type LLMProvider = 'openai' | 'anthropic';

export interface LLMOptions {
  provider: LLMProvider;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export async function complete(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options: LLMOptions
): Promise<string> {
  if (options.provider === 'anthropic') {
    return anthropicChat(messages, options);
  }
  return openaiChat(messages, options);
}
```

"Now we have the foundation. In the next module, we'll add tools so the LLM can actually DO things, not just talk.

See you in Module 2!"

---

### Code Files to Create

1. `src/llm/openai.ts`
2. `src/llm/anthropic.ts`
3. `src/llm/index.ts`
4. `src/utils/tokens.ts`
