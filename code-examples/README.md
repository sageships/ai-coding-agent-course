# 🎓 Code Examples — Run Them Yourself!

This folder contains working code for every major concept in the course.

## Quick Start

```bash
# 1. Install dependencies
cd code-examples
npm install

# 2. Set your API key
export ANTHROPIC_API_KEY=your-key-here

# 3. Run any example
npm run example:01  # First LLM call
npm run example:02  # Tool system basics
npm run example:03  # Repo mapping
npm run example:05  # Complete agent
```

## What's Inside

### 01-foundations/
Your first LLM API calls. Learn:
- Basic completions
- Streaming responses
- Multi-turn conversations
- Token counting & costs

### 02-tools/
The tool system that gives LLMs superpowers:
- Defining tools with JSON Schema
- Executing tool calls safely
- The basic agent loop

### 03-context/
How to help LLMs understand codebases:
- Building repository maps
- Finding relevant files
- Smart context selection

### 04-edits/
(Coming soon) Reliable code editing:
- Diff formats
- Search/replace blocks
- Error recovery

### 05-agent-loop/
The complete picture:
- Full working agent
- Multiple tools combined
- Iteration until completion

## Pro Tips

1. **Read the comments** — Each file is heavily documented to explain WHY, not just WHAT

2. **Modify and experiment** — Change the prompts, add new tools, break things and fix them

3. **Check the costs** — Watch your API usage, especially with the agent loop

4. **Start simple** — Begin with 01-foundations before jumping to the complete agent

## Troubleshooting

**"Cannot find module"**
```bash
npm install
```

**"ANTHROPIC_API_KEY not set"**
```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

**"Permission denied" on grep/commands**
The search and command tools use Unix commands. On Windows, use WSL or modify the tools.

## Next Steps

After running these examples, you'll understand:
- ✅ How LLMs process code tasks
- ✅ How tools extend LLM capabilities  
- ✅ How context management works
- ✅ How to build a complete coding agent

Now go build your own! 🚀
