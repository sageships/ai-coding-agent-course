/**
 * 🎓 MODULE 1.4: Your First LLM API Call
 * 
 * This is where it all begins. Before we build complex agents,
 * we need to understand the basic building block: talking to an LLM.
 * 
 * KEY CONCEPTS:
 * - Messages array (the conversation history)
 * - System prompts (setting the LLM's behavior)
 * - Streaming vs non-streaming responses
 * - Token counting and costs
 */

import Anthropic from '@anthropic-ai/sdk';

// Initialize the client (uses ANTHROPIC_API_KEY env variable)
const client = new Anthropic();

/**
 * CONCEPT 1: Basic Message Structure
 * 
 * LLMs work with a conversation format:
 * - "system": Sets the AI's behavior/personality (optional but powerful)
 * - "user": What the human says
 * - "assistant": What the AI responds
 * 
 * The LLM sees the ENTIRE conversation history each time and decides
 * what the next "assistant" message should be.
 */
async function basicCompletion() {
  console.log("📝 EXAMPLE 1: Basic Completion\n");
  
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: "You are a helpful coding assistant. Be concise.",
    messages: [
      { role: "user", content: "What's the difference between let and const in JavaScript?" }
    ]
  });

  // The response contains the assistant's message
  console.log("Response:", response.content[0].type === 'text' ? response.content[0].text : '');
  console.log("\n---\n");
}

/**
 * CONCEPT 2: Streaming Responses
 * 
 * For better UX, we can stream the response token-by-token.
 * This is how ChatGPT shows text appearing gradually.
 * 
 * WHY IT MATTERS:
 * - Users see immediate feedback
 * - For coding agents, you can show progress during long operations
 */
async function streamingCompletion() {
  console.log("📝 EXAMPLE 2: Streaming Completion\n");
  
  process.stdout.write("Response: ");
  
  const stream = await client.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 256,
    messages: [
      { role: "user", content: "Write a haiku about coding" }
    ]
  });

  // Process each chunk as it arrives
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      process.stdout.write(event.delta.text);
    }
  }
  
  console.log("\n\n---\n");
}

/**
 * CONCEPT 3: Multi-turn Conversations
 * 
 * To have a back-and-forth conversation, you include the history.
 * The LLM has NO memory between calls — you must send everything each time.
 * 
 * THIS IS CRUCIAL FOR AGENTS:
 * - Each "turn" in an agent loop adds to this history
 * - Context management (Module 3) is about keeping this history efficient
 */
async function multiTurnConversation() {
  console.log("📝 EXAMPLE 3: Multi-turn Conversation\n");
  
  // Simulating a conversation that builds on itself
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: "I'm building a todo app. What database should I use?" },
    { role: "assistant", content: "For a todo app, I'd recommend starting with SQLite for simplicity, or PostgreSQL if you need more features. What's your tech stack?" },
    { role: "user", content: "I'm using Next.js" },
  ];

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 512,
    messages
  });

  console.log("Context-aware response:");
  console.log(response.content[0].type === 'text' ? response.content[0].text : '');
  console.log("\n---\n");
}

/**
 * CONCEPT 4: Understanding Tokens & Costs
 * 
 * Tokens ≈ pieces of words (roughly 4 chars = 1 token)
 * 
 * Cost formula: (input_tokens × input_price) + (output_tokens × output_price)
 * 
 * Claude Sonnet pricing (as of 2024):
 * - Input: $3 per million tokens
 * - Output: $15 per million tokens
 * 
 * A typical coding agent request might use 2000 input + 500 output tokens
 * = (2000 × $0.000003) + (500 × $0.000015) = $0.006 + $0.0075 = ~$0.01 per request
 */
async function understandingTokens() {
  console.log("📝 EXAMPLE 4: Understanding Tokens\n");
  
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 100,
    messages: [
      { role: "user", content: "Say hello" }
    ]
  });

  console.log("Input tokens:", response.usage.input_tokens);
  console.log("Output tokens:", response.usage.output_tokens);
  console.log("Total tokens:", response.usage.input_tokens + response.usage.output_tokens);
  
  // Calculate approximate cost
  const inputCost = response.usage.input_tokens * 0.000003;
  const outputCost = response.usage.output_tokens * 0.000015;
  console.log(`Approximate cost: $${(inputCost + outputCost).toFixed(6)}`);
  console.log("\n---\n");
}

// Run all examples
async function main() {
  console.log("🚀 Module 1.4: Your First LLM API Call\n");
  console.log("=".repeat(50) + "\n");
  
  await basicCompletion();
  await streamingCompletion();
  await multiTurnConversation();
  await understandingTokens();
  
  console.log("✅ All examples complete!");
}

main().catch(console.error);
