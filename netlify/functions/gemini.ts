import { GoogleGenAI } from '@google/genai';
import type { Handler, HandlerResponse } from "@netlify/functions";

const createResponse = (statusCode: number, body: object): HandlerResponse => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const handler: Handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return createResponse(405, { message: 'Method Not Allowed' });
  }

  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    return createResponse(500, { message: 'API_KEY is not set on the server.' });
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { question, context: companyContext } = body;

    if (typeof question !== 'string' || !question) {
      return createResponse(400, { message: 'Question must be a non-empty string.' });
    }

    const ai = new GoogleGenAI({ apiKey });
    const model = 'gemini-2.5-flash';

    const hasContext = typeof companyContext === 'string' && companyContext.trim().length > 0;

    const systemInstruction = hasContext
        ? `You are an expert AI assistant specializing in risk management and strategic planning. You will be given a context document and a question. Your task is to answer the question based *only* on the information provided in the context. Your answers should be professional, insightful, and directly reference the source material. Format your responses in markdown.`
        : `You are an expert AI assistant specializing in risk management and strategic planning. Answer the user's questions with professional, insightful, and well-reasoned responses. Do not mention that you are an AI. Format your responses in markdown.`;
    
    const promptText = hasContext
        ? `CONTEXT:\n---\n${companyContext}\n---\n\nQUESTION: ${question}`
        : question;
    
    const contents = [
        {
            role: 'user',
            parts: [{ text: promptText }]
        }
    ];

    const config = hasContext
        ? {
            systemInstruction,
            thinkingConfig: { thinkingBudget: 0 },
            temperature: 0.3,
        }
        : {
            systemInstruction,
            temperature: 0.7,
        };


    const response = await ai.models.generateContent({
        model,
        contents,
        config,
    });

    const answer = response.text;
    
    return createResponse(200, { answer });

  } catch (error) {
    console.error('Error processing query request:', error);
    const errorMessage = error instanceof Error ? error.message : 'An internal server error occurred.';
    return createResponse(500, { message: errorMessage });
  }
};