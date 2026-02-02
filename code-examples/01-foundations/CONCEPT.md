# Module 1: Foundations — Conceptual Guide

## 🎯 The Big Picture

Before we build agents, you need to understand one thing:

**LLMs are amazing at writing code. They're terrible at editing YOUR code.**

Why? Because they can't see it.

---

## 🧠 The Core Problem

### What LLMs ARE Good At:

```
You: "Write a function that calculates factorial"

LLM: 
function factorial(n) {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

✅ Perfect! Clean code, handles edge cases.
```

### What LLMs STRUGGLE With:

```
You: "Add password reset to my Express app"

LLM: 
import { sendEmail } from './services/email';  // ❌ This file doesn't exist
import User from './models/User';              // ❌ Wrong path

app.post('/reset', async (req, res) => {
  const user = await User.findByEmail(req.body.email);  // ❌ Method doesn't exist
  ...
});

❌ Hallucinated imports, wrong structure, made-up methods
```

---

## 💡 Why This Happens

The LLM has no idea:
- What files exist in your project
- How your code is structured
- What functions/methods you have
- What packages you use

It's guessing. And guessing doesn't work for real code.

---

## 🎯 The 3-Step Challenge

Every coding task requires:

```
┌─────────────────────────────────────────────────────────┐
│  1. FIND                                                │
│     Which files need to change?                         │
│     (LLM can't do this alone — needs file access)       │
├─────────────────────────────────────────────────────────┤
│  2. UNDERSTAND                                          │
│     How does this code connect to other code?           │
│     (LLM needs to see related files)                    │
├─────────────────────────────────────────────────────────┤
│  3. CHANGE                                              │
│     What exact edits need to happen?                    │
│     (LLM is actually great at this part!)               │
└─────────────────────────────────────────────────────────┘
```

The LLM only struggles with steps 1 & 2. That's what this course fixes.

---

## 🚫 Why "Just Send Everything" Doesn't Work

You might think: "Just send my whole codebase with every request!"

Let's do the math:

| Codebase Size | Tokens (~4 chars each) | Cost per Request | Problem |
|---------------|------------------------|------------------|---------|
| 10k lines | ~40k tokens | $0.50 | Expensive |
| 50k lines | ~200k tokens | $2.50 | Too big for context |
| 100k lines | ~400k tokens | Impossible | Way over limits |

Plus: **LLMs get WORSE with more context.** They lose focus.

---

## ✨ The Solution: Smart Context

Instead of sending everything, we:

1. **Map the codebase** — Create a condensed overview (~1000 tokens)
2. **Select relevant files** — Only what matters for this task
3. **Give LLM tools** — Let it request more files if needed

```
50,000 lines of code
        ↓
   Smart selection
        ↓
500 lines sent to LLM
        ↓
   Accurate response
```

This is what Cursor, Claude Code, and Aider all do.

---

## 🔗 The Architecture

Every AI coding tool has 4 parts:

```
┌───────────────────────────────────────────────────────┐
│                    USER REQUEST                        │
│            "Add password reset feature"                │
└─────────────────────────┬─────────────────────────────┘
                          ▼
┌───────────────────────────────────────────────────────┐
│                 CONTEXT SYSTEM                         │
│   • Repo map (what files/functions exist)              │
│   • Smart file selection                               │
│   • Embeddings search                                  │
└─────────────────────────┬─────────────────────────────┘
                          ▼
┌───────────────────────────────────────────────────────┐
│                   TOOL SYSTEM                          │
│   • read_file, write_file                              │
│   • run_command, search_files                          │
│   • LLM decides which to use                           │
└─────────────────────────┬─────────────────────────────┘
                          ▼
┌───────────────────────────────────────────────────────┐
│                  AGENT LOOP                            │
│   • LLM acts → observes → acts → observes              │
│   • Continues until task complete                      │
│   • Handles errors, retries                            │
└─────────────────────────┬─────────────────────────────┘
                          ▼
┌───────────────────────────────────────────────────────┐
│                    RESULT                              │
│            Code changes applied to files               │
└───────────────────────────────────────────────────────┘
```

---

## 📚 What Each Module Covers

| Module | What You Learn |
|--------|----------------|
| **1. Foundations** (this) | The problem + architecture overview |
| **2. Tool System** | How LLMs call functions |
| **3. Context** | How to show LLMs your codebase |
| **4. Edits** | Reliable code modification |
| **5. Agent Loop** | Putting it all together |

---

## ✅ Key Takeaways

1. LLMs are great at code generation, bad at codebase understanding
2. Sending your whole codebase doesn't work (cost + context limits)
3. Smart context selection is the secret sauce
4. Tools let LLMs take actions (read files, run commands)
5. The agent loop ties everything together

---

## 📺 Video Flow

1. Start with the ChatGPT demo (good at isolated code, bad at real projects)
2. Show the 3-step challenge diagram
3. Explain why "send everything" fails (do the math)
4. Introduce the 4-part architecture
5. Preview what we'll build

---

**Next:** See `demo.ts` for basic LLM API calls
