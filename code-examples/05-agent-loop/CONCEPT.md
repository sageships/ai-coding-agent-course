# Module 5: The Agent Loop — Conceptual Guide

## 🎯 The Problem We're Solving

We have:
- Tools (read, write, edit, run)
- Context (repo map, file selection)
- Edit formats (diffs, search/replace)

Now we need to **orchestrate** everything into a coherent agent that can actually complete tasks.

---

## 🔄 The Core Loop: Think → Act → Observe

Every AI agent follows this pattern:

```
┌─────────────────────────────────────────┐
│            USER REQUEST                 │
│    "Add input validation to login"      │
└───────────────────┬─────────────────────┘
                    ▼
         ┌──────────────────┐
    ┌────│      THINK       │◄───────┐
    │    │  What do I need  │        │
    │    │  to do next?     │        │
    │    └────────┬─────────┘        │
    │             ▼                  │
    │    ┌──────────────────┐        │
    │    │       ACT        │        │
    │    │   Call a tool    │        │
    │    │  (read, edit)    │        │
    │    └────────┬─────────┘        │
    │             ▼                  │
    │    ┌──────────────────┐        │
    │    │     OBSERVE      │        │
    │    │   See result     │        │
    │    │   of tool call   │        │
    │    └────────┬─────────┘        │
    │             │                  │
    │             ▼                  │
    │    ┌──────────────────┐        │
    │    │   DONE? / ERROR? │────────┘
    │    │   Need to retry? │   No
    │    └────────┬─────────┘
    │             │ Yes
    │             ▼
    │    ┌──────────────────┐
    └────│     OUTPUT       │
         │  Task completed  │
         └──────────────────┘
```

This is called the **ReAct pattern** (Reasoning + Acting).

---

## 🧠 System Prompt Design

The system prompt is your agent's **personality + instructions**:

```markdown
## Your Capabilities
- Read files, write files, edit code
- Run shell commands
- Search code semantically

## How to Work
1. Understand First: Read relevant files before modifying
2. Plan Your Approach: Think before coding
3. Make Targeted Changes: Don't rewrite entire files
4. Verify Your Work: Run tests when available

## Repository Context
{REPO_MAP}

## Open Files
{CURRENT_FILES}
```

**Key elements:**
- Clear capabilities (what can the agent do?)
- Workflow guidance (how should it approach tasks?)
- Dynamic context (repo map, open files)

---

## 📝 Conversation History Management

Problem: History grows → context window fills up → costs increase

**Strategy 1: Truncation**
```
Messages:  [system, user1, asst1, tool1, user2, asst2, tool2, ...]
                     ▲
                     └── Remove oldest when over limit
```

**Strategy 2: Summarization**
```
Old messages → Ask LLM: "Summarize this context in 2-3 sentences"
              → Replace with summary

Before: [system, user1, asst1, tool1, user2, asst2, tool2, user3, asst3]
After:  [system, "Summary: User added auth, fixed bug", user3, asst3]
```

**Strategy 3: Selective Retention**
```
Keep:
  - System prompt (always)
  - Last N user messages
  - Tool results that are still relevant
  
Remove:
  - Intermediate "thinking" messages
  - Tool results for completed subtasks
```

---

## 🔧 HOW IT WORKS MECHANICALLY: The Agent Loop

```
ALGORITHM: AgentLoop(task, tools, max_iterations)
────────────────────────────────────────────────────

INPUT:
  task = "Add input validation to login function"
  tools = [read_file, write_file, edit_file, run_command]
  max_iterations = 20

STATE:
  messages = [system_prompt]
  iteration = 0

LOOP:
  1. Add user task to messages
     messages.append({role: "user", content: task})
  
  2. Call LLM with messages + tools
     response = llm.chat(messages, tools=tools)
  
  3. Check response type:
     
     IF response has tool_calls:
        FOR each tool_call in response.tool_calls:
          a. Extract tool name and arguments
             tool = tool_call.function.name      // "read_file"
             args = parse(tool_call.arguments)   // {path: "src/auth.ts"}
          
          b. Execute the tool
             result = execute(tool, args)        // file contents
          
          c. Add result to messages
             messages.append({
               role: "tool",
               tool_call_id: tool_call.id,
               content: result
             })
        
        CONTINUE LOOP (let LLM see results)
     
     ELSE (response is just text):
        // LLM is done or wants to respond
        RETURN response.content
  
  4. Check termination:
     IF iteration >= max_iterations:
       RETURN "Max iterations reached"
     
     iteration += 1
     GOTO LOOP
```

**Example execution trace:**

```
Iteration 1:
  User: "Add validation to login"
  LLM → tool_call: read_file("src/auth.ts")
  
Iteration 2:  
  Tool result: [file contents]
  LLM → tool_call: edit_file("src/auth.ts", {...changes})
  
Iteration 3:
  Tool result: "File updated successfully"
  LLM → text: "I've added input validation..."
  
DONE ✓
```

---

## 🎯 Planning and Task Decomposition

Complex tasks should be broken down:

```
TASK: "Add user authentication to the app"

DECOMPOSITION:
┌─────────────────────────────────────────┐
│ Orchestrator (planning LLM)             │
├─────────────────────────────────────────┤
│ Subtask 1: Create User model            │
│ Subtask 2: Add password hashing         │ ← depends on 1
│ Subtask 3: Create auth routes           │ ← depends on 1, 2
│ Subtask 4: Add session handling         │ ← depends on 3
│ Subtask 5: Update existing routes       │ ← depends on 4
└─────────────────────────────────────────┘
                    │
                    ▼
         Execute in dependency order
```

**When to decompose:**
- Task touches 3+ files → decompose
- Multiple distinct steps mentioned → decompose
- User says "completely", "full", "entire" → decompose

---

## 🔁 Error Recovery: The Reflexion Pattern

When something fails, **reflect** before retrying:

```
ALGORITHM: ExecuteWithReflection(task, max_attempts=3)
─────────────────────────────────────────────────────

FOR attempt in 1..max_attempts:
    TRY:
        result = agent.execute(task)
        RETURN result  // Success!
    
    CATCH error:
        IF attempt == max_attempts:
            THROW "Failed after max attempts"
        
        // REFLECTION STEP
        reflection = ask_llm("""
            Task: {task}
            Attempt: {attempt}
            Error: {error}
            
            1. What went wrong?
            2. Why did this approach fail?
            3. What should be done differently?
        """)
        
        // Update context with learning
        agent.add_context("Previous attempt failed: " + reflection)
        
        // Continue with next attempt
```

**Example reflection:**

```
Error: "Cannot find module './authService'"

Reflection:
1. What went wrong? Import path is wrong
2. Why? I assumed the file was in the same directory
3. What's different? Check actual file location first

New approach: Read directory structure before importing
```

---

## 🤔 Knowing When to Ask for Help

Good agents know their limits:

```python
def should_ask_for_help(attempts, errors, confidence):
    # Too many failures
    if attempts >= 3:
        return True, "Multiple attempts failed"
    
    # Same error repeating
    if len(errors) >= 2 and errors[-1] == errors[-2]:
        return True, "Same error occurring repeatedly"
    
    # Low confidence on task
    if confidence < 0.5:
        return True, "Task requirements unclear"
    
    # Destructive operation
    if is_destructive(last_action):
        return True, "Confirming before destructive action"
    
    return False, None
```

---

## 🔧 HOW IT WORKS MECHANICALLY: Tool Execution

```
ALGORITHM: ExecuteTool(tool_call, context)
──────────────────────────────────────────

INPUT:
  tool_call = {
    id: "call_abc123",
    function: {
      name: "edit_file",
      arguments: '{"path": "src/auth.ts", "changes": [...]}'
    }
  }

STEPS:
  1. Parse arguments
     args = JSON.parse(tool_call.function.arguments)
     // args = {path: "src/auth.ts", changes: [...]}
  
  2. Validate arguments
     IF !args.path:
       RETURN {error: "Missing required parameter: path"}
  
  3. Security check
     IF args.path.includes(".."):
       RETURN {error: "Path traversal not allowed"}
  
  4. Execute
     tool = tool_registry[tool_call.function.name]
     result = tool.execute(args, context)
  
  5. Record for rollback
     IF tool modifies files:
       edit_history.push({
         file: args.path,
         before: read_file(args.path),
         after: result.content
       })
  
  6. Return result
     RETURN {
       success: true,
       content: result
     }
```

---

## ✅ Testing Your Agent

**Unit tests for tools:**
```typescript
test('readFile returns content', async () => {
  const content = await readFile(testDir, 'test.ts');
  expect(content).toContain('function');
});
```

**Integration tests for flows:**
```typescript
test('can make simple edit', async () => {
  await agent.execute('Add comment to top of file');
  const content = await readFile('test.ts');
  expect(content).toStartWith('//');
});
```

**Benchmark evaluation:**
```typescript
const benchmark = [
  { task: "Fix typo", expectedSuccess: true },
  { task: "Add function", expectedSuccess: true },
  { task: "Refactor module", expectedSuccess: true }
];

for (const test of benchmark) {
  const result = await agent.execute(test.task);
  assert(result.success === test.expectedSuccess);
}
```

---

## 📺 Video Flow

1. Show the Think-Act-Observe loop diagram
2. Walk through a real execution trace
3. Demonstrate error recovery in action
4. Show task decomposition for complex tasks
5. Run the complete agent demo

---

**See `demo.ts` for the complete working implementation!**
