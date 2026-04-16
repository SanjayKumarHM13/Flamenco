import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function askGemini(prompt: string, history: { role: "user" | "model"; parts: { text: string }[] }[] = []) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        ...history.map(h => ({ role: h.role, parts: h.parts })),
        { role: "user", parts: [{ text: prompt }] }
      ],
      config: {
        systemInstruction: `You are an expert AI Trading Assistant for the "Flamenco" platform. 
        You help users with market analysis, platform features, and general trading questions.
        Be professional, concise, and insightful. 
        If asked about specific market data, mention that you have access to real-time feeds.
        Current platform: Flamenco (AI-First Statistical Arbitrage).`
      }
    });

    return response.text || "I'm sorry, I couldn't process that request.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "An error occurred while communicating with the AI assistant.";
  }
}
