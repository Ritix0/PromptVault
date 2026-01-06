/* src/services/llm/index.js */
import { openaiProvider } from "./providers/openai";
import { anthropicProvider } from "./providers/anthropic";
import { geminiProvider } from "./providers/gemini";
import { xaiProvider } from "./providers/xai"; 
import { deepseekProvider } from "./providers/deepseek"; // Импорт DeepSeek

const providers = {
  [openaiProvider.id]: openaiProvider,
  [anthropicProvider.id]: anthropicProvider,
  [geminiProvider.id]: geminiProvider,
  [xaiProvider.id]: xaiProvider,
  [deepseekProvider.id]: deepseekProvider, // Регистрация DeepSeek
};

export const llmService = {
  getProviders: () => Object.values(providers),
  getModels: (providerId) => providers[providerId]?.models || [],
  
  run: async (providerId, apiKey, model, systemPrompt, userMessage) => {
    const provider = providers[providerId];
    if (!provider) throw new Error(`Provider '${providerId}' not found`);
    
    return await provider.generate(apiKey, model, systemPrompt, userMessage);
  }
};