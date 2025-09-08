import React, { useState, useRef, useEffect } from 'react';
import { Message, Role } from './types';

// Allow global access to pdfjsLib, mammoth, marked, DOMPurify
declare const pdfjsLib: any;
declare const mammoth: any;
declare const marked: any;
declare const DOMPurify: any;

// --- SVG Icon Components ---

const BotIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-3zm0 2.29L19 7.64v3.45c0 4.1-2.92 7.84-7 9.17-4.08-1.33-7-5.07-7-9.17V7.64L12 4.29z"/>
  </svg>
);

const UserIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
  </svg>
);

const SendIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"></line>
    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
  </svg>
);

const UploadIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l-3.75 3.75M12 9.75l3.75 3.75M3 17.25V6.75c0-1.104.896-2 2-2h14c1.104 0 2 .896 2 2v10.5c0 1.104-.896 2-2 2H5c-1.104 0-2-.896-2-2z" />
  </svg>
);

const CloseIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

// --- Types ---
interface UploadedFile {
  name: string;
  content: string;
}

// --- UI Components ---

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isModel = message.role === Role.Model;

  const renderContent = () => {
    if (isModel) {
      const rawMarkup = marked.parse(message.content);
      const cleanMarkup = DOMPurify.sanitize(rawMarkup);
      return <div className="prose" dangerouslySetInnerHTML={{ __html: cleanMarkup }} />;
    }
    return message.content;
  };

  return (
    <div className={`flex items-start gap-3 my-5 ${isModel ? 'justify-start' : 'justify-end'}`}>
      {isModel && <BotIcon className="w-8 h-8 text-slate-500 flex-shrink-0" />}
      <div className={`p-4 rounded-2xl max-w-2xl shadow-sm ${
        isModel
          ? 'bg-white text-slate-800 rounded-tl-none border border-slate-200'
          : 'bg-indigo-500 text-white rounded-br-none'
      }`}>
        {renderContent()}
      </div>
      {!isModel && <UserIcon className="w-8 h-8 text-slate-500 flex-shrink-0" />}
    </div>
  );
};

interface FileDropzoneProps {
  onFileChange: (file: File | null) => void;
  isDragging: boolean;
  handleDragEnter: (e: React.DragEvent<HTMLDivElement>) => void;
  handleDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
  handleDrop: (e: React.DragEvent<HTMLDivElement>) => void;
}

const FileDropzone: React.FC<FileDropzoneProps> = ({ onFileChange, isDragging, handleDragEnter, handleDragLeave, handleDrop }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  return (
     <div
      className={`border-2 border-dashed border-slate-500 rounded-lg flex flex-col items-center justify-center text-center p-4 transition-colors ${isDragging ? 'bg-slate-700' : ''} cursor-pointer hover:border-indigo-400`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".pdf,.txt,.docx"
        onChange={(e) => onFileChange(e.target.files ? e.target.files[0] : null)}
      />
      <UploadIcon className="w-10 h-10 text-slate-500 mb-2" />
      <p className="font-semibold text-sm">Drag & drop files here</p>
      <p className="text-xs text-slate-400">or click to browse</p>
    </div>
  );
};

interface ContextPanelProps {
  onFileParse: (file: File) => void;
  onStartChat: () => void;
  onClearContext: () => void;
  onDeleteFile: (fileName: string) => void;
  context: string;
  setContext: (context: string) => void;
  uploadedFiles: UploadedFile[];
  isChatting: boolean;
  isParsing: boolean;
}

const ContextPanel: React.FC<ContextPanelProps> = ({ 
  onFileParse, onStartChat, onClearContext, onDeleteFile, context, setContext,
  uploadedFiles, isChatting, isParsing 
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (selectedFile: File | null) => {
    if (selectedFile) {
      const allowedTypes = ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (allowedTypes.includes(selectedFile.type) || selectedFile.name.endsWith('.docx')) {
        onFileParse(selectedFile);
      } else {
        alert('Unsupported file type. Please upload a PDF, TXT, or DOCX file.');
      }
    }
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="w-full md:w-1/3 lg:w-1/4 bg-slate-800 text-slate-200 p-6 flex flex-col h-full">
      <div className="flex items-center gap-3 mb-2">
        <BotIcon className="w-8 h-8 text-indigo-400" />
        <h2 className="text-xl font-bold">Context</h2>
      </div>
      <p className="text-sm text-slate-400 mb-6">
        {context ? "Review or edit the combined text from your documents below." : "Upload documents to provide context. You can also start a general chat."}
      </p>
      
      <div className="flex-grow flex flex-col min-h-0">
        <div className="mb-4">
          <FileDropzone 
            onFileChange={handleFileChange} 
            isDragging={isDragging}
            handleDragEnter={handleDragEnter}
            handleDragLeave={handleDragLeave}
            handleDrop={handleDrop}
          />
        </div>
        
        {isParsing && (
            <div className="flex items-center justify-center p-2 text-slate-400 text-sm">
                <div className="w-3 h-3 bg-slate-500 rounded-full animate-pulse [animation-delay:-0.3s] mr-2"></div>
                Parsing file...
            </div>
        )}

        {uploadedFiles.length > 0 && (
          <div className="flex-grow flex flex-col min-h-0">
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm font-medium text-slate-300">
                Loaded Documents ({uploadedFiles.length})
              </p>
              <button
                onClick={onClearContext}
                className="text-xs text-slate-400 hover:text-red-400 transition-colors underline"
              >
                Clear All
              </button>
            </div>
            
             <div className="space-y-2 mb-3 max-h-28 overflow-y-auto pr-2">
              {uploadedFiles.map(file => (
                <div key={file.name} className="flex items-center justify-between bg-slate-700 p-2 rounded-md">
                  <p className="text-xs text-indigo-300 truncate pr-2">{file.name}</p>
                  <button onClick={() => onDeleteFile(file.name)} className="text-slate-400 hover:text-red-400 flex-shrink-0">
                    <CloseIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Combined context from uploaded files..."
              className="flex-grow w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              aria-label="Combined Company Context"
            />
          </div>
        )}
      </div>

      <button
        onClick={onStartChat}
        disabled={isParsing}
        className="mt-6 w-full bg-indigo-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-indigo-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-indigo-500 shadow-lg"
      >
        {isChatting ? 'Restart Chat' : 'Start Chat'}
      </button>
    </div>
  );
};

// --- Main App Component ---

function App() {
  const [companyContext, setCompanyContext] = useState<string>('');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState<string>('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const combinedContent = uploadedFiles.map(f => f.content).join('\n\n---\n\n');
    setCompanyContext(combinedContent);
  }, [uploadedFiles]);
  
  const handleFileParse = async (file: File) => {
    if (uploadedFiles.some(f => f.name === file.name)) {
        alert(`File "${file.name}" has already been uploaded.`);
        return;
    }
    setError(null);
    setIsParsing(true);
    
    let extractedText = '';
    try {
      if (file.type === 'text/plain') {
        extractedText = await file.text();
      } else if (file.name.endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        extractedText = result.value;
      } else if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const allPagesText = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          allPagesText.push(textContent.items.map((item: any) => item.str).join(' '));
        }
        extractedText = allPagesText.join('\n\n');
      } else {
        throw new Error('Unsupported file type.');
      }
      setUploadedFiles(prev => [...prev, { name: file.name, content: extractedText }]);
    } catch (e) {
      const parseError = e instanceof Error ? e.message : 'An unknown error occurred during file parsing.';
      setError(`Failed to parse file: ${parseError}`);
    } finally {
      setIsParsing(false);
    }
  };

  const handleDeleteFile = (fileNameToDelete: string) => {
    setUploadedFiles(prev => prev.filter(file => file.name !== fileNameToDelete));
  };
  
  const handleStartChat = () => {
    setError(null);
    setMessages([
        {
            role: Role.Model,
            content: "I am ready to discuss risk management and strategic planning. How can I assist you?",
        },
    ]);
  };

  const handleClearContext = () => {
    setCompanyContext('');
    setUploadedFiles([]);
    setMessages([]);
    setError(null);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading || messages.length === 0) return;

    const userMessage: Message = { role: Role.User, content: input };
    const isFirstUserMessage = messages.length === 1 && messages[0].role === Role.Model;

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);
    
    try {
        // The API history should not include the initial bot greeting.
        // It should only contain the real back-and-forth conversation.
        const historyForApi = isFirstUserMessage ? [] : messages.slice(1);

        const requestBody = {
            message: input,
            history: historyForApi.map(({ role, content }) => ({ role, content })),
            // Only send the context on the very first user message of the session.
            context: isFirstUserMessage ? companyContext : undefined,
        };

        const response = await fetch('/.netlify/functions/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            let errorText = `Server error: ${response.status} ${response.statusText}`;
            try {
                const bodyText = await response.text();
                // Netlify's gateway error for timeouts is often not JSON
                if (response.status === 502 || response.status === 504) {
                    errorText = "The request timed out. This can happen with very large documents. Please try reducing the context size or rephrasing the question.";
                } else {
                    const errorData = JSON.parse(bodyText);
                    if (errorData && errorData.type === 'error' && errorData.message) {
                        errorText = errorData.message;
                    }
                }
            } catch (e) {
                // Failed to parse body, stick with the status error
            }
            throw new Error(errorText);
        }
        
        if (!response.body) throw new Error('The response from the server is empty.');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let modelResponse = '';
        setMessages(prev => [...prev, { role: Role.Model, content: '' }]);
        let buffer = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.trim() === '') continue;
                try {
                    const data = JSON.parse(line);
                    if (data.type === 'chunk') {
                        modelResponse += data.text;
                        setMessages(prev => {
                            const newMessages = [...prev];
                            newMessages[newMessages.length - 1].content = modelResponse;
                            return newMessages;
                        });
                    } else if (data.type === 'error') {
                        throw new Error(data.message);
                    }
                } catch (e) {
                    console.error("Failed to parse stream line:", line, e);
                }
            }
        }

    } catch (e) {
      console.error(e);
      const errorMessage = e instanceof Error ? e.message : 'Failed to get a response.';
      setError(errorMessage);
       setMessages(prev => [...prev, { role: Role.Model, content: `Error: ${errorMessage}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-white font-sans antialiased">
      <ContextPanel
        onFileParse={handleFileParse}
        onStartChat={handleStartChat}
        onClearContext={handleClearContext}
        onDeleteFile={handleDeleteFile}
        context={companyContext}
        setContext={setCompanyContext}
        uploadedFiles={uploadedFiles}
        isChatting={messages.length > 0}
        isParsing={isParsing}
      />
      <div className="flex-1 flex flex-col h-full bg-slate-100">
        <header className="bg-white p-4 border-b border-slate-200 z-10">
          <h1 className="text-xl font-bold text-slate-800 text-center">ERM Risk Chatbot</h1>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 mt-16">
                <BotIcon className="w-24 h-24 mb-4 text-slate-400"/>
                <h2 className="text-2xl font-semibold text-slate-700">Welcome!</h2>
                <p className="max-w-md mt-2">Press 'Start Chat' to begin. Optionally, upload document(s) first to provide specific context for our discussion.</p>
              </div>
            )}
            {messages.map((msg, index) => (
              <ChatMessage key={index} message={msg} />
            ))}
            {isLoading && messages[messages.length -1]?.role === Role.User && (
               <div className="flex items-start gap-3 my-5 justify-start">
                  <BotIcon className="w-8 h-8 text-slate-500 flex-shrink-0" />
                  <div className="p-4 rounded-2xl max-w-2xl bg-white border border-slate-200 shadow-sm rounded-tl-none">
                    <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-slate-500 rounded-full animate-pulse [animation-delay:-0.3s]"></div>
                        <div className="w-2 h-2 bg-slate-500 rounded-full animate-pulse [animation-delay:-0.15s]"></div>
                        <div className="w-2 h-2 bg-slate-500 rounded-full animate-pulse"></div>
                    </div>
                  </div>
              </div>
            )}
             {error && <p className="text-red-500 text-center my-4">Error: {error}</p>}
            <div ref={chatEndRef} />
          </div>
        </main>
        
        <footer className="bg-white/80 backdrop-blur-sm p-4 border-t border-slate-200">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center bg-white border border-slate-300 rounded-xl p-2 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={messages.length > 0 ? "Ask a follow-up question..." : "Please start a chat using the side panel."}
                className="flex-1 bg-transparent border-none focus:outline-none px-3 text-slate-800 placeholder-slate-400"
                disabled={messages.length === 0 || isLoading}
              />
              <button onClick={handleSend} disabled={messages.length === 0 || isLoading || !input.trim()} className="p-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors">
                <SendIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;