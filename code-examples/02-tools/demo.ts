/**
 * Module 2: Tool System Demo
 * 
 * 📺 VIDEO INSTRUCTIONS:
 * - Run this file and show the terminal output
 * - Pause at each "--- Step X ---" to explain what's happening
 * - The code is intentionally simple — focus on the FLOW
 */

import { generateText, tool } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import * as fs from 'fs';
import { z } from 'zod';

// ============================================
// 📺 SHOW THIS: Tool Definitions
// "Here's how we define tools for the LLM"
// ============================================

const tools = {
  read_file: tool({
    description: 'Read the contents of a file',
    parameters: z.object({
      path: z.string().describe('Path to the file'),
    }),
    execute: async ({ path }) => {
      console.log(`\n  🔧 Tool called: read_file("${path}")`);
      try {
        const content = fs.readFileSync(path, 'utf-8');
        console.log(`  ✅ Success: Read ${content.length} characters`);
        return content;
      } catch (error) {
        console.log(`  ❌ Error: File not found`);
        return `Error: Could not read ${path}`;
      }
    },
  }),

  list_directory: tool({
    description: 'List files in a directory',
    parameters: z.object({
      path: z.string().describe('Directory path'),
    }),
    execute: async ({ path }) => {
      console.log(`\n  🔧 Tool called: list_directory("${path}")`);
      try {
        const files = fs.readdirSync(path);
        console.log(`  ✅ Success: Found ${files.length} items`);
        return files.join('\n');
      } catch (error) {
        return `Error: Could not list ${path}`;
      }
    },
  }),
};

// ============================================
// ▶️ RUN THIS: Main Demo
// ============================================

async function main() {
  console.log('═'.repeat(50));
  console.log('🎬 MODULE 2 DEMO: The Tool System');
  console.log('═'.repeat(50));

  // 📺 EXPLAIN: "Watch the LLM decide which tools to use"
  const userQuestion = "What files are in this directory and what's in package.json?";
  
  console.log(`\n📝 User asks: "${userQuestion}"`);
  console.log('\n--- The Agent Loop Begins ---\n');

  const result = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    tools,
    maxSteps: 5, // Allow up to 5 tool calls
    prompt: userQuestion,
    
    // 📺 SHOW THIS: We can see each step
    onStepFinish: ({ stepType, toolCalls, text }) => {
      if (stepType === 'tool-result') {
        console.log('\n  📨 Tool result sent back to LLM');
      }
    },
  });

  // 📺 EXPLAIN: "After all tools run, LLM gives final answer"
  console.log('\n--- Agent Loop Complete ---');
  console.log('\n📤 Final Response:');
  console.log('─'.repeat(40));
  console.log(result.text);
  console.log('─'.repeat(40));

  // 📺 SHOW THIS: Stats
  console.log('\n📊 Stats:');
  console.log(`   Tool calls made: ${result.steps.filter(s => s.toolCalls?.length).length}`);
  console.log(`   Total steps: ${result.steps.length}`);
}

main().catch(console.error);
