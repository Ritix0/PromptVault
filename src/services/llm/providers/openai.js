/* src/services/llm/providers/openai.js */

export const openaiProvider = {
  id: "openai",
  name: "OpenAI (GPT-5 / o3)",
  defaultModel: "gpt-5.2",
  models: [
    "gpt-5.2",
    "gpt-5-pro",
    "gpt-4.1",
    "o3",
    "o4-mini"
  ],
  
  generate: async (apiKey, model, systemPrompt, userMessage) => {
    const messages = [];

    if (systemPrompt && systemPrompt.trim()) {
      messages.push({ role: "developer", content: systemPrompt });
    }

    if (userMessage && userMessage.trim()) {
      messages.push({ role: "user", content: userMessage });
    }

    if (messages.length === 0) {
      messages.push({ role: "user", content: " " });
    }

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: model,
            messages: messages,
            max_completion_tokens: 2000, 
            temperature: 0.7,
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error("OpenAI API Error Details:", errText); // <--- СМОТРИ СЮДА В КОНСОЛИ
          try {
              const errJson = JSON.parse(errText);
              throw new Error(errJson.error?.message || `API Error: ${response.status}`);
          } catch (e) {
              throw new Error(`API Error ${response.status}: ${errText}`);
          }
        }

        const data = await response.json();
        return data.choices[0].message.content;

    } catch (networkError) {
        console.error("Network/Fetch Error:", networkError); // <--- СМОТРИ СЮДА
        
        // Подсказка для пользователя
        if (networkError.message === "Failed to fetch") {
            throw new Error("Network Error: Could not connect to OpenAI. Check your VPN or Internet connection.");
        }
        throw networkError;
    }
  }
};