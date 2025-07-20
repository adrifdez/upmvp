import OpenAI from 'openai';

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Export model configuration
export const DEFAULT_MODEL = process.env.LLM_MODEL || "gpt-4.1-nano-2025-04-14";
