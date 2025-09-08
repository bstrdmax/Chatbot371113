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
    const { context: companyContext } = body;

    if (typeof companyContext !== 'string' || !companyContext) {
      return createResponse(400, { message: 'Context must be a non-empty string.' });
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Please act as an expert document analyst. Summarize the following text for a risk management expert. Extract only the most critical information, key risks, strategic goals, financial data, and major stakeholders mentioned. The summary must be dense, factual, and significantly shorter than the original, intended to be used as context for a chatbot. Do not include conversational fluff.
    
    DOCUMENT TEXT:
    ---
    ${companyContext}`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            // Disable thinking budget to get the fastest possible response and avoid timeouts
            thinkingConfig: { thinkingBudget: 0 },
            temperature: 0.2, // Lower temperature for more factual summary
        },
    });

    const summary = response.text;
    
    return createResponse(200, { summary });

  } catch (error) {
    console.error('Error processing summarization request:', error);
    const errorMessage = error instanceof Error ? error.message : 'An internal server error occurred.';
    return createResponse(500, { message: errorMessage });
  }
};
