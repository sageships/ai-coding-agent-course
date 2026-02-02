/**
 * Module 1: Foundations Demo
 * 
 * 📺 VIDEO INSTRUCTIONS:
 * - Run each section one at a time (comment out others)
 * - Show the terminal output
 * - Explain what's happening at each step
 */

import { generateText, streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

// ============================================
// 📺 DEMO 1: Basic LLM Call
// "This is the simplest way to talk to an LLM"
// ============================================

async function demo1_basicCall() {
  console.log('═'.repeat(50));
  console.log('📺 DEMO 1: Basic LLM Call');
  console.log('═'.repeat(50));

  const result = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    prompt: 'What is 2 + 2? Reply in one word.',
  });

  console.log('\nResponse:', result.text);
  console.log('\n📊 Token usage:');
  console.log('   Input tokens:', result.usage.promptTokens);
  console.log('   Output tokens:', result.usage.completionTokens);
}

// ============================================
// 📺 DEMO 2: Streaming
// "For better UX, we stream the response"
// ============================================

async function demo2_streaming() {
  console.log('\n' + '═'.repeat(50));
  console.log('📺 DEMO 2: Streaming Response');
  console.log('═'.repeat(50));

  console.log('\nResponse: ');
  
  const result = streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    prompt: 'Write a haiku about coding.',
  });

  // 📺 SHOW: Text appears word by word
  for await (const chunk of result.textStream) {
    process.stdout.write(chunk);
  }
  
  console.log('\n');
}

// ============================================
// 📺 DEMO 3: System Prompts
// "System prompts set the LLM's behavior"
// ============================================

async function demo3_systemPrompt() {
  console.log('═'.repeat(50));
  console.log('📺 DEMO 3: System Prompts');
  console.log('═'.repeat(50));

  // Without system prompt
  const basic = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    prompt: 'How do I center a div?',
  });
  console.log('\n❌ Without system prompt:');
  console.log(basic.text.substring(0, 200) + '...');

  // With system prompt
  const expert = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: 'You are a senior frontend developer. Be concise. Give only code, no explanation.',
    prompt: 'How do I center a div?',
  });
  console.log('\n✅ With system prompt:');
  console.log(expert.text);
}

// ============================================
// 📺 DEMO 4: Multi-turn Conversation
// "LLMs have NO memory — you send the full history"
// ============================================

async function demo4_multiTurn() {
  console.log('\n' + '═'.repeat(50));
  console.log('📺 DEMO 4: Multi-turn (Conversation History)');
  console.log('═'.repeat(50));

  // 📺 EXPLAIN: Each message is role + content
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    { role: 'user', content: "I'm building a todo app. What database?" },
    { role: 'assistant', content: 'For a simple todo app, I recommend SQLite.' },
    { role: 'user', content: "Why SQLite specifically?" },  // Follow-up!
  ];

  console.log('\n💬 Conversation so far:');
  messages.forEach((m, i) => {
    console.log(`   ${m.role}: "${m.content}"`);
  });

  const result = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    messages,
  });

  console.log('\n🤖 LLM response (knows the context!):');
  console.log(result.text);
}

// ============================================
// ▶️ RUN: Pick which demo to show
// ============================================

async function main() {
  // 📺 Run one at a time for the video
  await demo1_basicCall();
  // await demo2_streaming();
  // await demo3_systemPrompt();
  // await demo4_multiTurn();
}

main().catch(console.error);
