import { GoogleGenAI } from '@google/ai';
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

    const prompt = `You are an expert document analyst. Create a concise summary of the following text for a risk management expert.

**Instructions:**
1.  Extract **only** the most critical information: key risks, strategic goals, core financial data, and major stakeholders.
2.  The summary **must be extremely dense, factual, and under 800 words.**
3.  The purpose of this summary is to be used as fast, efficient context for a chatbot. It must be significantly shorter than the original.
4.  Omit all conversational fluff, introductions, and conclusions that don't add factual value. Get straight to the key points.

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
