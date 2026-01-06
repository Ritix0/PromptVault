/* src/services/llm/providers/xai.js */

export const xaiProvider = {
  id: "xai",
  name: "xAI (Grok)",
  defaultModel: "grok-4",
  models: [
    "grok-4",                      // Флагман
    "grok-4-1-fast-reasoning",     // Fast Reasoning (2M context)
    "grok-4-0709",                 // High-end version
    "grok-4-1-fast-non-reasoning", // Быстрая, без рассуждений
    "grok-code-fast-1",            // Для кода
    "grok-3-mini"                  // Legacy/Light
  ],

  generate: async (apiKey, model, systemPrompt, userMessage) => {
    // xAI поддерживает стандартный формат сообщений через REST API
    const messages = [];

    // System Prompt (аналог chat.append(system(...)))
    if (systemPrompt && systemPrompt.trim()) {
      messages.push({ role: "system", content: systemPrompt });
    }

    // User Message (аналог chat.append(user(...)))
    if (userMessage && userMessage.trim()) {
      messages.push({ role: "user", content: userMessage });
    }

    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.7,
        stream: false 
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || "xAI API Error");
    }

    const data = await response.json();
    
    // В REST API ответ приходит в стандартном формате choices
    return data.choices[0].message.content;
  }
};