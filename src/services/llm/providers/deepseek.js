/* src/services/llm/providers/deepseek.js */

export const deepseekProvider = {
  id: "deepseek",
  name: "DeepSeek (V3.2)",
  defaultModel: "deepseek-chat",
  models: [
    "deepseek-chat",     // V3.2 Standard (Fast, cheap)
    "deepseek-reasoner"  // V3.2 Thinking Mode (Reasoning)
  ],

  generate: async (apiKey, model, systemPrompt, userMessage) => {
    // DeepSeek полностью совместим с форматом OpenAI
    const messages = [];

    // Используем стандартную роль "system" (в отличие от новых OpenAI, DeepSeek следует классике)
    if (systemPrompt && systemPrompt.trim()) {
      messages.push({ role: "system", content: systemPrompt });
    }

    if (userMessage && userMessage.trim()) {
      messages.push({ role: "user", content: userMessage });
    }

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 1.0, // Рекомендуемое значение для DeepSeek
        stream: false
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || "DeepSeek API Error");
    }

    const data = await response.json();
    
    // Примечание: У модели deepseek-reasoner может быть поле reasoning_content,
    // но основной ответ всегда лежит в content.
    return data.choices[0].message.content;
  }
};