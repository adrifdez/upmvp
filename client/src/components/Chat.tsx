import { useState, useEffect, useRef } from 'preact/hooks';
import Message from './Message';
import { Send, Trash2, MessageCircle, Bot, Loader2 } from 'lucide-react';
import type { Message as MessageType } from '@/types';

interface ChatProps {
    messages: MessageType[];
    isLoading: boolean;
    onSendMessage: (message: string) => void;
    onClearChat: () => void;
}

export default function Chat({ messages, isLoading, onSendMessage, onClearChat }: ChatProps) {
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const [showTyping, setShowTyping] = useState(false);

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }, [messages]);

    useEffect(() => {
        setShowTyping(isLoading);
    }, [isLoading]);


    const handleSubmit = (e: Event) => {
        e.preventDefault();
        if (!inputValue.trim() || isLoading) return;
        
        onSendMessage(inputValue.trim());
        setInputValue('');
    };


    const TypingIndicator = () => (
        <div className="chat chat-start">
            <div className="chat-image avatar">
                <div className="w-10 rounded-full bg-base-300 flex items-center justify-center">
                    <Bot className="w-5 h-5" />
                </div>
            </div>
            <div className="chat-bubble">
                <div className="flex gap-1 items-center">
                    <span className="loading loading-dots loading-sm"></span>
                    <span className="text-sm opacity-70">AI is thinking...</span>
                </div>
            </div>
        </div>
    );

    return (
        <div className="card bg-base-100 shadow-xl h-[600px] flex flex-col">
            <div className="card-body p-4 flex flex-col h-full">
                {/* Chat Header */}
                <div className="flex items-center justify-between mb-4">
                    <h2 className="card-title text-lg">Chat</h2>
                    <button onClick={onClearChat} className="btn btn-sm btn-ghost">
                        <Trash2 className="w-4 h-4" />
                        Clear
                    </button>
                </div>
                
                {/* Chat Messages Area */}
                <div 
                    ref={messagesContainerRef}
                    className="chat-container flex-1 overflow-y-auto space-y-4 p-4 bg-base-200 rounded-lg"
                >
                    {messages.length === 0 ? (
                        <div className="text-center text-base-content/50">
                            <MessageCircle className="w-12 h-12 mx-auto mb-2" />
                            <p>Start a conversation...</p>
                        </div>
                    ) : (
                        <>
                            {messages.map((msg, index) => (
                                <Message 
                                    key={msg.id || index}
                                    message={msg} 
                                    isLatest={index === messages.length - 1}
                                />
                            ))}
                        </>
                    )}
                    
                    {showTyping && <TypingIndicator />}
                    
                    <div ref={messagesEndRef}></div>
                </div>
                
                {/* Input Area */}
                <div className="mt-4">
                    <form onSubmit={handleSubmit} className="flex gap-2">
                        <div className="form-control flex-1">
                            <input 
                                type="text" 
                                value={inputValue}
                                onInput={(e) => setInputValue((e.target as HTMLInputElement).value)}
                                placeholder="Type your message..." 
                                className="input input-bordered w-full"
                                disabled={isLoading}
                                autoFocus
                            />
                        </div>
                        <button 
                            type="submit" 
                            className="btn btn-primary"
                            disabled={isLoading || !inputValue.trim()}
                        >
                            {isLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <>
                                    <Send className="w-4 h-4"/>
                                    Send
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}