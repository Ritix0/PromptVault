/* src/services/llm/providers/anthropic.js */

export const anthropicProvider = {
  id: "anthropic",
  name: "Anthropic (Claude 4.5)",
  defaultModel: "claude-sonnet-4-5",
  models: [
    "claude-sonnet-4-5", // Recommended (Balance)
    "claude-haiku-4-5",  // Fast & Cheap
    "claude-opus-4-5"    // Maximum Intelligence
  ],

  generate: async (apiKey, model, systemPrompt, userMessage) => {
    // Формируем тело запроса согласно документации 2026
    const body = {
      model: model,
      max_tokens: 4096, // Обязательный параметр в Anthropic
      messages: [
        { role: "user", content: userMessage }
      ]
    };

    // SYSTEM PROMPT: Передается отдельным полем верхнего уровня
    if (systemPrompt && systemPrompt.trim()) {
      body.system = systemPrompt;
    }

    // Заголовки для Anthropic API
    // Примечание: 'anthropic-dangerous-direct-browser-access' может потребоваться 
    // в некоторых средах, чтобы разрешить запросы с клиента.
    const headers = {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01", // Стабильная версия API
      "content-type": "application/json",
      "anthropic-dangerous-direct-browser-access": "true" // Разрешаем браузеру (если API поддерживает)
    };

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const err = await response.json();
      // Anthropic возвращает ошибки в объекте error: { type, message }
      throw new Error(err.error?.message || "Anthropic API Error");
    }

    const data = await response.json();
    
    // Ответ лежит в content[0].text
    if (data.content && data.content.length > 0 && data.content[0].type === 'text') {
        return data.content[0].text;
    }
    
    return ""; // Fallback
  }
};