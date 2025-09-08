import { GoogleGenAI, Chat } from '@google/genai';
import type { HandlerEvent, HandlerContext } from "@netlify/functions";

// A persistent store for chat sessions, mapping a unique ID to a Chat instance.
// In a real-world scenario, you might use a more robust storage solution
// like a database or a Redis cache, but for this example, memory is fine.
const chatSessions = new Map<string, Chat>();

// Helper function to create a unique session ID
const createSessionId = () => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const handler = async function* (event: HandlerEvent, context: HandlerContext) {
  if (event.httpMethod !== 'POST') {
    yield JSON.stringify({ error: 'Method Not Allowed' });
    return;
  }

  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    yield JSON.stringify({ error: 'API_KEY is not set on the server.' });
    return;
  }
  
  try {
    const body = JSON.parse(event.body || '{}');
    const { message, context: companyContext, sessionId: existingSessionId } = body;
    let sessionId = existingSessionId;

    if (typeof message !== 'string') {
        yield JSON.stringify({ error: 'Message must be a string.' });
        return;
    }

    const ai = new GoogleGenAI({ apiKey });
    let chat: Chat | undefined;

    // Check if we are starting a new chat or continuing one
    if (message === 'START_CHAT_SESSION' || !sessionId || !chatSessions.has(sessionId)) {
        let systemInstruction: string;
        if (companyContext) {
            systemInstruction = `You are an expert AI assistant specializing in risk management and strategic planning. Your answers should be professional, insightful, and actionable. You must use the following information to tailor your responses:\n\n--- CONTEXT INFORMATION ---\n${companyContext}\n--- END CONTEXT INFORMATION ---\n\nWhen answering user questions, always consider this context. Your responses should be formatted in markdown.`;
        } else {
            systemInstruction = `You are an expert AI assistant specializing in risk management and strategic planning. Your answers should be professional, insightful, and actionable. You will act as a general expert. Your responses should be formatted in markdown.`;
        }
        
        chat = ai.chats.create({
            model: 'gemini-2.5-flash',
            config: { systemInstruction },
        });
        
        sessionId = createSessionId();
        chatSessions.set(sessionId, chat);

        const initialMessage = companyContext
            ? `Context has been loaded. I am ready to discuss risk management and strategic planning for your organization. How can I assist you?`
            : `I am ready to discuss general risk management and strategic planning. How can I assist you?`;
        
        yield JSON.stringify({
            sessionId,
            message: initialMessage,
        });

        return;
    } else {
        chat = chatSessions.get(sessionId);
        if (!chat) {
            yield JSON.stringify({ error: 'Chat session not found.' });
            return;
        }
    }

    const stream = await chat.sendMessageStream({ message });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
         yield text;
      }
    }
    
  } catch (error) {
    console.error('Error processing request:', error);
    yield JSON.stringify({ error: error instanceof Error ? error.message : 'An internal server error occurred.' });
  }
};