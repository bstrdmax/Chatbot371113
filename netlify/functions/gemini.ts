import { GoogleGenAI } from '@google/genai';
import type { HandlerEvent, HandlerContext } from "@netlify/functions";
import type { Part, Content } from '@google/genai';

// Interface for messages sent from the client's history
interface HistoryMessage {
  role: 'user' | 'model';
  content: string;
}

const yieldError = (message: string) => {
    return JSON.stringify({ type: 'error', message }) + '\n';
};

export const handler = async function* (event: HandlerEvent, context: HandlerContext) {
  if (event.httpMethod !== 'POST') {
    yield yieldError('Method Not Allowed');
    return;
  }

  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    yield yieldError('API_KEY is not set on the server.');
    return;
  }
  
  try {
    const body = JSON.parse(event.body || '{}');
    const { message, context: companyContext, history: clientHistory } = body;

    if (typeof message !== 'string' || !message) {
        yield yieldError('Message must be a non-empty string.');
        return;
    }

    if (!Array.isArray(clientHistory)) {
        yield yieldError('History must be an array.');
        return;
    }

    const ai = new GoogleGenAI({ apiKey });
    
    let systemInstruction = `You are an expert AI assistant specializing in risk management and strategic planning. Your answers should be professional, insightful, and actionable. When provided with context, you must use it to tailor your responses. All your responses should be formatted in markdown.`;
    
    // Append company context to the system instruction if provided.
    if (companyContext) {
      systemInstruction += `\n\nRefer to the following context when answering:\nCONTEXT:\n${companyContext}`;
    }
    
    // Reconstruct conversation history (`contents`) for the API call.
    const contents: Content[] = [];

    // Add the chat history from the client.
    clientHistory.forEach((msg: HistoryMessage) => {
        contents.push({ role: msg.role, parts: [{ text: msg.content }] });
    });
    
    // Add the new user message to the end of the contents
    contents.push({ role: 'user', parts: [{ text: message }] });

    // Define the generation config
    const config: { systemInstruction: string; thinkingConfig?: { thinkingBudget: number } } = {
        systemInstruction,
    };

    // For the first message that includes large context, disable the thinking budget
    // to get a faster initial response and avoid serverless function timeouts.
    if (companyContext) {
        config.thinkingConfig = { thinkingBudget: 0 };
    }

    // Use the stateless `generateContentStream` method.
    const stream = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents,
        config,
    });

    // Stream the response back to the client
    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
         yield JSON.stringify({ type: 'chunk', text }) + '\n';
      }
    }
    
  } catch (error) {
    console.error('Error processing request:', error);
    const errorMessage = error instanceof Error ? error.message : 'An internal server error occurred.';
    yield yieldError(errorMessage);
  }
};