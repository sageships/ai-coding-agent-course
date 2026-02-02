# Module 2: The Tool System — Conceptual Guide

## 🎯 What You'll Understand After This Module

By the end, you'll know:
- What "tools" actually are (not magic, just JSON)
- Why LLMs need tools to be useful for coding
- The exact flow: User → LLM → Tool → Result → LLM → Answer
- Why this design is secure (LLM proposes, your code executes)

---

## 🧠 The Core Concept

### Without Tools: LLM is Blind

Imagine asking someone to fix a bug in your code, but:
- They can't see your files
- They can't run any commands
- They can only talk

That's an LLM without tools. It can give advice, but it can't DO anything.

### With Tools: LLM Can Act

Now give that person:
- The ability to read files
- The ability to write files
- The ability to run commands

Suddenly they're useful! That's what tools do.

---

## 🔄 The Tool Flow (IMPORTANT!)

```
┌─────────────────────────────────────────────────────────┐
│  USER: "What's in my package.json?"                     │
└─────────────────────────┬───────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────┐
│  LLM THINKS:                                            │
│  "I need to read a file. I have a read_file tool.       │
│   Let me use it."                                       │
└─────────────────────────┬───────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────┐
│  LLM OUTPUTS (not text, but a tool call!):              │
│                                                         │
│  {                                                      │
│    "tool": "read_file",                                 │
│    "arguments": { "path": "package.json" }              │
│  }                                                      │
└─────────────────────────┬───────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────┐
│  YOUR CODE EXECUTES:                                    │
│                                                         │
│  Actually reads package.json from disk                  │
│  Returns: "{ \"name\": \"my-app\", ... }"              │
└─────────────────────────┬───────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────┐
│  LLM RECEIVES RESULT:                                   │
│                                                         │
│  Now it has the actual file contents                    │
│  Can give a meaningful answer to the user              │
└─────────────────────────┬───────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────┐
│  LLM RESPONDS:                                          │
│  "Your package.json shows this is a Next.js app         │
│   called 'my-app' with React 18..."                     │
└─────────────────────────────────────────────────────────┘
```

---

## 🔐 Why This Design is Secure

**Key insight:** The LLM never executes anything directly.

1. LLM says: "I want to call `delete_file` with path `/etc/passwd`"
2. YOUR code decides: "Nope, that's blocked"
3. You return: "Permission denied"

You're always in control. The LLM proposes, your code disposes.

---

## 📋 Tool Definition Structure

Every tool needs 3 things:

```
┌─────────────────────────────────────────┐
│  NAME                                   │
│  What you call it: "read_file"          │
├─────────────────────────────────────────┤
│  DESCRIPTION (most important!)          │
│  Tells LLM WHEN to use it:              │
│  "Read contents of a file. Use this     │
│   to examine code or config files."     │
├─────────────────────────────────────────┤
│  PARAMETERS                             │
│  What inputs it needs:                  │
│  - path: string (required)              │
└─────────────────────────────────────────┘
```

💡 **The description is everything.** A bad description = LLM won't know when to use the tool.

---

## 🔁 The Agent Loop

Tools enable the "agent loop" — the core pattern of every AI coding tool:

```
        ┌──────────────────────────┐
        │     User gives task      │
        └───────────┬──────────────┘
                    ▼
        ┌──────────────────────────┐
   ┌───▶│   LLM decides action     │
   │    └───────────┬──────────────┘
   │                ▼
   │    ┌──────────────────────────┐
   │    │  Tool call? ───No───▶ Done (return response)
   │    └───────────┬──────────────┘
   │               Yes
   │                ▼
   │    ┌──────────────────────────┐
   │    │   Execute tool           │
   │    └───────────┬──────────────┘
   │                ▼
   │    ┌──────────────────────────┐
   └────│   Feed result to LLM     │
        └──────────────────────────┘
```

This loop continues until the LLM decides it has enough information to answer.

---

## 🛠 Common Tools in Coding Agents

| Tool | Purpose | Example Use |
|------|---------|-------------|
| `read_file` | See code | Understanding existing implementation |
| `write_file` | Create/edit code | Making the actual changes |
| `list_directory` | Explore structure | Finding relevant files |
| `search_files` | Find patterns | Locating where something is defined |
| `run_command` | Execute anything | Running tests, git, npm |

---

## ✅ Key Takeaways

1. **Tools = JSON definitions** that tell the LLM what actions are available
2. **LLM proposes, code executes** — you're always in control
3. **The description is crucial** — it tells the LLM WHEN to use each tool
4. **Agent loop** = keep calling LLM until it stops requesting tools

---

## 📺 What to Show in Video

1. First, explain the flow diagram (no code yet)
2. Show a tool definition JSON — explain each part
3. Then switch to code demo
4. Run the demo, show the loop in action

---

**Next:** See `demo.ts` for the code walkthrough
