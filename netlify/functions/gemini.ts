import { GoogleGenAI, Chat } from '@google/genai';
import type { HandlerEvent, HandlerContext } from "@netlify/functions";

// A persistent store for chat sessions, mapping a unique ID to a Chat instance.
const chatSessions = new Map<string, Chat>();
// A temporary store for context before a chat is fully initialized with the first message.
const contextStore = new Map<string, string>();

// Helper function to create a unique session ID
const createSessionId = () => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const handler = async function* (event: HandlerEvent, context: HandlerContext) {

  const yieldError = (message: string) => {
    return JSON.stringify({ type: 'error', message }) + '\n';
  };

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
    const { message, context: companyContext, sessionId } = body;

    if (typeof message !== 'string') {
        yield yieldError('Message must be a string.');
        return;
    }

    // --- Handle starting a new session ---
    if (message === 'START_CHAT_SESSION') {
        const newSessionId = createSessionId();
        
        // Temporarily store the context. The chat object will be created on the first message.
        if (companyContext) {
            contextStore.set(newSessionId, companyContext);
        }

        const initialMessage = companyContext
            ? `Context has been loaded. I am ready to discuss risk management and strategic planning for your organization. How can I assist you?`
            : `I am ready to discuss general risk management and strategic planning. How can I assist you?`;
        
        yield JSON.stringify({
            type: 'session',
            sessionId: newSessionId,
            message: initialMessage,
        }) + '\n';
        return; // End execution for this request.
    }
    
    // --- Handle sending a message to an existing/new session ---
    if (!sessionId) {
        yield yieldError('Session ID is missing. Please start a new chat.');
        return;
    }

    const ai = new GoogleGenAI({ apiKey });
    let chat = chatSessions.get(sessionId);

    // Lazy initialization: If chat doesn't exist, create it now with the stored context.
    if (!chat) {
        const systemInstruction = `You are an expert AI assistant specializing in risk management and strategic planning. Your answers should be professional, insightful, and actionable. When provided with context, you must use it to tailor your responses. All your responses should be formatted in markdown.`;
        
        const history = [];
        const initialContext = contextStore.get(sessionId);
        if (initialContext) {
            history.push(
                { role: 'user', parts: [{ text: `CONTEXT:\n${initialContext}` }] },
                { role: 'model', parts: [{ text: 'Context acknowledged. I will refer to it in my responses.' }] }
            );
            contextStore.delete(sessionId); // Clean up context after use to save memory.
        }

        chat = ai.chats.create({
            model: 'gemini-2.5-flash',
            history,
            config: { systemInstruction },
        });
        
        chatSessions.set(sessionId, chat);
    }

    // Now that we're sure we have a chat instance, send the message.
    const stream = await chat.sendMessageStream({ message });

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