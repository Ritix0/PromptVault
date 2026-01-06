/* src/services/llm/providers/custom.js */

export const customProvider = {
  id: "custom_legacy",
  name: "Legacy / Single Input API",
  defaultModel: "default",
  models: ["default"],

  generate: async (apiKey, model, systemPrompt, userMessage) => {
    // ЭТОТ API НЕ ПОНИМАЕТ РОЛЕЙ. СКЛЕИВАЕМ СТРОКИ.
    
    // Формируем единый текст
    const finalPrompt = `
      === INSTRUCTIONS ===
      ${systemPrompt}
      
      === USER DATA ===
      ${userMessage}
    `.trim();

    // Отправляем как одно поле 'prompt' (пример для типичного старого API)
    /* 
    const response = await fetch("https://my-custom-api.com/v1/completion", {
       body: JSON.stringify({ prompt: finalPrompt }) 
    ...
    */
   
    // Для теста просто вернем то, что мы склеили, чтобы ты увидел это в интерфейсе
    return `[SIMULATION] I received this single merged string:\n\n${finalPrompt}`;
  }
};