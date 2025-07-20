import { useEffect, useRef, useState } from 'preact/hooks';
import Message from './Message';
import GuidelineUsageStats from './GuidelineUsageStats';
import MethodStats from './MethodStats';
import { Bot, MessageCircle, Loader2, Zap, FileText, ChevronRight, ChevronLeft } from 'lucide-react';
import type { MessageWithMethod, MatchedGuideline } from '@/types';

interface ChatPaneProps {
    messages: MessageWithMethod[];
    guidelines: MatchedGuideline[];
    isLoading: boolean;
    method: 'text' | 'vector';
    title: string;
    hybridWeight?: number;
    onHybridWeightChange?: (weight: number) => void;
    totalGuidelines: number;
    onRefreshGuidelines: () => void;
}

export default function ChatPane({ 
    messages, 
    guidelines, 
    isLoading, 
    method, 
    title, 
    hybridWeight, 
    onHybridWeightChange,
    totalGuidelines,
    onRefreshGuidelines 
}: ChatPaneProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const [showGuidelines, setShowGuidelines] = useState(true);

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }, [messages]);

    const TypingIndicator = () => (
        <div className="chat chat-start">
            <div className="chat-image avatar">
                <Bot className="w-5 h-5" />
            </div>
            <div className="chat-bubble">
                <div className="flex gap-1 items-center">
                    <span className="loading loading-dots loading-sm"></span>
                    <span className="text-sm opacity-70">AI is thinking...</span>
                </div>
            </div>
        </div>
    );

    const getMethodColor = () => {
        return method === 'vector' ? 'border-success' : 'border-info';
    };

    const getMethodIcon = () => {
        return method === 'vector' ? 
            <Zap className="w-4 h-4" /> : 
            <FileText className="w-4 h-4" />;
    };

    return (
        <div className={`card bg-base-100 shadow-xl h-[750px] flex flex-col border-2 ${getMethodColor()}`}>
            {/* Pane Header */}
            <div className="card-header p-4 pb-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {getMethodIcon()}
                        <h2 className="text-lg font-semibold">{title}</h2>
                        <div className={`badge ${method === 'vector' ? 'badge-success' : 'badge-info'} badge-sm`}>
                            {method === 'vector' ? 'Vector' : 'Text'}
                        </div>
                    </div>
                    <button
                        onClick={() => setShowGuidelines(!showGuidelines)}
                        className="btn btn-ghost btn-sm"
                        title={showGuidelines ? "Hide Guidelines" : "Show Guidelines"}
                    >
                        {showGuidelines ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                        Guidelines ({guidelines.length})
                    </button>
                </div>
            </div>

            <div className="card-body p-4 pt-2 flex flex-col h-full overflow-hidden">
                <div className="flex flex-row flex-1 overflow-hidden">
                    <div className={`flex-1 flex flex-col ${showGuidelines ? 'mr-4' : ''}`}>
                    {/* Hybrid Weight Slider - Only for Vector Method */}
                    {method === 'vector' && hybridWeight !== undefined && onHybridWeightChange && (
                        <div className="mb-4 p-3 bg-base-200 rounded-lg">
                            <div className="flex items-center gap-3">
                                <label className="text-xs font-medium whitespace-nowrap">
                                    Modo Híbrido:
                                </label>
                                <div className="flex-1 flex items-center gap-2">
                                    <span className="text-xs text-base-content/70 min-w-[45px] text-right">
                                        {Math.round((1 - hybridWeight) * 100)}% Texto
                                    </span>
                                    <input 
                                        type="range" 
                                        min="0" 
                                        max="1" 
                                        step="0.1"
                                        value={hybridWeight}
                                        onChange={(e) => {
                                        const target = e.target as HTMLInputElement;
                                        if (target && onHybridWeightChange) {
                                            onHybridWeightChange(parseFloat(target.value));
                                        }
                                    }}
                                        className="range range-sm range-success flex-1"
                                    />
                                    <span className="text-xs text-base-content/70 min-w-[50px]">
                                        {Math.round(hybridWeight * 100)}% Vector
                                    </span>
                                </div>
                                <div className="dropdown dropdown-end">
                                    <label tabIndex={0} className="btn btn-circle btn-ghost btn-xs">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="w-3 h-3 stroke-current">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                        </svg>
                                    </label>
                                    <div tabIndex={0} className="card compact dropdown-content z-[1] shadow bg-base-100 rounded-box w-56">
                                        <div className="card-body">
                                            <p className="text-xs">
                                                <strong>100% Texto:</strong> Solo palabras clave exactas<br/>
                                                <strong>100% Vector:</strong> Solo comprensión semántica<br/>
                                                <strong>Híbrido:</strong> Combina ambos métodos
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* Messages Area */}
                    <div 
                        ref={messagesContainerRef}
                        className="chat-container flex-1 overflow-y-auto space-y-4 p-4 bg-base-200 rounded-lg"
                    >
                        {messages.length === 0 ? (
                            <div className="text-center text-base-content/50">
                                <MessageCircle className="w-12 h-12 mx-auto mb-2" />
                                <p>Esperando mensajes...</p>
                            </div>
                        ) : (
                            <>
                                {messages.map((msg, index) => (
                                    <Message 
                                        key={`${method}-${msg.id || index}`}
                                        message={msg} 
                                        isLatest={index === messages.length - 1}
                                    />
                                ))}
                            </>
                        )}
                        
                        {isLoading && <TypingIndicator />}
                        
                        <div ref={messagesEndRef}></div>
                    </div>

                    {/* Stats Footer */}
                    {messages.length > 0 && (
                        <div className="mt-2 text-xs text-base-content/60 flex justify-between">
                            <span>Mensajes: {messages.filter(m => m.role === 'assistant').length}</span>
                            {messages[messages.length - 1]?.responseTime && (
                                <span>Tiempo: {messages[messages.length - 1].responseTime}ms</span>
                            )}
                        </div>
                    )}
                </div>

                {/* Guidelines Panel - Collapsible */}
                {showGuidelines && (
                    <div className="w-72 lg:w-80 flex flex-col gap-4 overflow-y-auto">
                        <GuidelineUsageStats
                            guidelines={guidelines}
                            totalGuidelines={totalGuidelines}
                            appliedGuidelines={guidelines.length}
                            onRefresh={onRefreshGuidelines}
                        />
                    </div>
                )}
                </div>
                
                {/* Method Statistics - Full Width Bottom */}
                {messages.length > 0 && (
                    <div className="mt-3">
                        <MethodStats
                            messages={messages}
                            guidelines={guidelines}
                            method={method}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}