/* src/services/llm/providers/gemini.js */

export const geminiProvider = {
  id: "gemini",
  name: "Google Gemini (3.0 / 2.5)",
  defaultModel: "gemini-3-flash-preview",
  models: [
    "gemini-3-flash-preview", // Быстрая, дешевая, актуальная
    "gemini-3-pro",           // Самая умная
    "gemini-2.5-pro",         // Программирование и логика
    "gemini-2.5-flash"        // Контекст 1М токенов
  ],

  generate: async (apiKey, model, systemPrompt, userMessage) => {
    // URL для REST API Google AI Studio
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    // Формируем тело запроса
    const body = {
      contents: [
        {
          parts: [{ text: userMessage }]
        }
      ],
      generationConfig: {
        // ВАЖНО: Для Gemini 3 рекомендуется температура 1.0, иначе модель может "отупеть"
        temperature: model.includes("gemini-3") ? 1.0 : 0.7
      }
    };

    // SYSTEM INSTRUCTION: В Gemini это отдельное поле верхнего уровня (не внутри contents)
    if (systemPrompt && systemPrompt.trim()) {
      body.systemInstruction = {
        parts: [{ text: systemPrompt }]
      };
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || "Gemini API Error");
    }

    const data = await response.json();

    // Парсим ответ. Gemini может вернуть несколько candidates, берем первого.
    // Если ответ заблокирован (Safety), content может быть null.
    const candidate = data.candidates?.[0];
    
    if (candidate?.finishReason === "SAFETY") {
      throw new Error("Response blocked by Safety Filters.");
    }

    if (candidate?.content?.parts?.[0]?.text) {
      return candidate.content.parts[0].text;
    }

    return ""; // Пустой ответ
  }
};