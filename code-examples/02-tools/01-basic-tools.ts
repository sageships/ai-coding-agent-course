/**
 * 🎓 MODULE 2.1-2.2: The Tool System — Giving LLMs Superpowers
 * 
 * This is the MAGIC that makes AI coding agents possible.
 * 
 * Without tools: LLM can only generate text
 * With tools: LLM can READ files, WRITE code, RUN commands, SEARCH the web
 * 
 * KEY INSIGHT:
 * The LLM doesn't actually execute anything. It says "I want to call this tool
 * with these arguments" and YOUR CODE does the actual work. This is crucial
 * for safety — you control what actually happens.
 */

import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';

const client = new Anthropic();

/**
 * STEP 1: Define Your Tools
 * 
 * Tools are defined using JSON Schema. Each tool needs:
 * - name: How you reference it in code
 * - description: CRITICAL — tells the LLM WHEN to use it
 * - input_schema: What parameters the tool accepts
 * 
 * 💡 TIP: The description is the most important part. A bad description
 * means the LLM won't know when to use the tool.
 */
const tools: Anthropic.Tool[] = [
  {
    name: "read_file",
    description: "Read the contents of a file at the given path. Use this when you need to examine code, configuration files, or any text file in the project. Returns the file contents as a string.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "The relative path to the file from the current directory"
        }
      },
      required: ["path"]
    }
  },
  {
    name: "list_directory",
    description: "List all files and folders in a directory. Use this to explore the project structure and find relevant files. Returns a list of filenames.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "The directory path to list (use '.' for current directory)"
        }
      },
      required: ["path"]
    }
  },
  {
    name: "write_file",
    description: "Write content to a file. Creates the file if it doesn't exist, overwrites if it does. Use this to create or modify code files.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "The path where the file should be written"
        },
        content: {
          type: "string",
          description: "The content to write to the file"
        }
      },
      required: ["path", "content"]
    }
  }
];

/**
 * STEP 2: Implement Tool Execution
 * 
 * This function actually DOES the work when a tool is called.
 * The LLM proposes, this code executes.
 * 
 * 🔒 SECURITY NOTE: In production, you'd add validation here:
 * - Path traversal checks (no ../../etc/passwd)
 * - Allowed directories only
 * - File size limits
 */
function executeTool(name: string, input: Record<string, unknown>): string {
  console.log(`\n🔧 Executing tool: ${name}`);
  console.log(`   Input: ${JSON.stringify(input)}`);
  
  switch (name) {
    case "read_file": {
      const filePath = input.path as string;
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        console.log(`   ✅ Read ${content.length} characters`);
        return content;
      } catch (error) {
        const message = `Error reading file: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.log(`   ❌ ${message}`);
        return message;
      }
    }
    
    case "list_directory": {
      const dirPath = input.path as string;
      try {
        const files = fs.readdirSync(dirPath);
        console.log(`   ✅ Found ${files.length} items`);
        return files.join('\n');
      } catch (error) {
        const message = `Error listing directory: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.log(`   ❌ ${message}`);
        return message;
      }
    }
    
    case "write_file": {
      const filePath = input.path as string;
      const content = input.content as string;
      try {
        // Create directory if it doesn't exist
        const dir = path.dirname(filePath);
        if (dir && !fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, content);
        console.log(`   ✅ Wrote ${content.length} characters`);
        return `Successfully wrote to ${filePath}`;
      } catch (error) {
        const message = `Error writing file: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.log(`   ❌ ${message}`);
        return message;
      }
    }
    
    default:
      return `Unknown tool: ${name}`;
  }
}

/**
 * STEP 3: The Agent Loop
 * 
 * This is the CORE PATTERN of every AI coding agent:
 * 
 * 1. Send user request + tools to LLM
 * 2. LLM responds with either:
 *    a) A text response (done!)
 *    b) A tool call (execute it, then go back to step 1)
 * 3. Repeat until LLM gives final answer
 * 
 * This loop is what makes agents "agentic" — they can take multiple
 * actions to complete a task, not just respond once.
 */
async function runAgentLoop(userMessage: string): Promise<string> {
  console.log("\n" + "=".repeat(60));
  console.log("🤖 AGENT LOOP STARTING");
  console.log("=".repeat(60));
  console.log(`\n📝 User request: "${userMessage}"\n`);
  
  // Conversation history — this grows with each tool call
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userMessage }
  ];
  
  let iterations = 0;
  const maxIterations = 10; // Safety limit
  
  while (iterations < maxIterations) {
    iterations++;
    console.log(`\n--- Iteration ${iterations} ---`);
    
    // Call the LLM with our tools
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: `You are a helpful coding assistant with access to file system tools. 
Use the tools to help answer questions about code and make changes when asked.
Always explain what you're doing and why.`,
      tools,
      messages
    });
    
    console.log(`\n🧠 LLM response (stop_reason: ${response.stop_reason}):`);
    
    // Check if we're done (LLM gave final answer, no more tool calls)
    if (response.stop_reason === "end_turn") {
      // Extract text response
      const textContent = response.content.find(block => block.type === "text");
      const finalResponse = textContent && textContent.type === "text" ? textContent.text : "No response";
      console.log("\n✅ AGENT LOOP COMPLETE");
      return finalResponse;
    }
    
    // Process tool calls
    if (response.stop_reason === "tool_use") {
      // Add assistant's response (with tool calls) to history
      messages.push({ role: "assistant", content: response.content });
      
      // Execute each tool call and collect results
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      
      for (const block of response.content) {
        if (block.type === "tool_use") {
          console.log(`\n📞 Tool call: ${block.name}(${JSON.stringify(block.input)})`);
          
          // Execute the tool
          const result = executeTool(block.name, block.input as Record<string, unknown>);
          
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: result
          });
        } else if (block.type === "text") {
          // LLM might explain what it's doing
          console.log(`\n💭 LLM thinking: "${block.text.substring(0, 100)}..."`);
        }
      }
      
      // Add tool results to conversation
      messages.push({ role: "user", content: toolResults });
    }
  }
  
  return "Max iterations reached";
}

/**
 * DEMO: Let's see the agent in action!
 * 
 * The agent will:
 * 1. List the directory to see what files exist
 * 2. Read relevant files to understand the code
 * 3. Provide an answer based on what it found
 */
async function main() {
  console.log("🚀 Module 2: The Tool System — Basic Tools Demo\n");
  
  // Example 1: Simple file exploration
  const response = await runAgentLoop(
    "List what's in the current directory and tell me what kind of project this is"
  );
  
  console.log("\n" + "=".repeat(60));
  console.log("📄 FINAL RESPONSE:");
  console.log("=".repeat(60));
  console.log(response);
}

main().catch(console.error);
