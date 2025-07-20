import { useState } from 'preact/hooks';
import ChatPane from './ChatPane';
import ComparisonAnalytics from './ComparisonAnalytics';
import { Send, Trash2, Loader2, FileText, Zap, HouseWifi } from 'lucide-react';
import type { MessageWithMethod, MatchedGuideline } from '@/types';

interface DualChatContainerProps {
    textMessages: MessageWithMethod[];
    vectorMessages: MessageWithMethod[];
    textGuidelines: MatchedGuideline[];
    vectorGuidelines: MatchedGuideline[];
    isLoadingText: boolean;
    isLoadingVector: boolean;
    onSendMessage: (message: string) => void;
    onClearChat: () => void;
    hybridWeight: number;
    onHybridWeightChange: (weight: number) => void;
    totalGuidelines: number;
    onRefreshGuidelines: () => void;
}

export default function DualChatContainer({ 
    textMessages, 
    vectorMessages,
    textGuidelines,
    vectorGuidelines,
    isLoadingText, 
    isLoadingVector, 
    onSendMessage, 
    onClearChat,
    hybridWeight,
    onHybridWeightChange,
    totalGuidelines,
    onRefreshGuidelines
}: DualChatContainerProps) {
    const [inputValue, setInputValue] = useState('');
    const [viewMode, setViewMode] = useState<'split' | 'tab'>('split');
    const [activeTab, setActiveTab] = useState<'text' | 'vector'>('text');

    const handleSubmit = (e: Event) => {
        e.preventDefault();
        if (!inputValue.trim() || (isLoadingText || isLoadingVector)) return;
        
        onSendMessage(inputValue.trim());
        setInputValue('');
    };

    const isLoading = isLoadingText || isLoadingVector;

    return (
        <>
            <div className="flex flex-col h-full">
            {/* Header with controls */}
            <div className="flex flex-col gap-4 mb-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <HouseWifi className="w-5 h-5" />
                        <h2 className="text-xl font-bold">MidHome Rentals</h2>
                    </div>
                    <div className="flex items-center gap-2">
                    {/* View Mode Toggle */}
                    <div className="btn-group">
                        <button 
                            className={`btn btn-sm ${viewMode === 'split' ? 'btn-active' : ''}`}
                            onClick={() => setViewMode('split')}
                        >
                            Vista Dividida
                        </button>
                        <button 
                            className={`btn btn-sm ${viewMode === 'tab' ? 'btn-active' : ''}`}
                            onClick={() => setViewMode('tab')}
                        >
                            Pestañas
                        </button>
                    </div>
                    <button 
                        onClick={onClearChat} 
                        className="btn btn-sm btn-ghost"
                        disabled={isLoading}
                    >
                        <Trash2 className="w-4 h-4" />
                        Limpiar
                    </button>
                    </div>
                </div>
            </div>

            {/* Chat Views */}
            {viewMode === 'split' ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 mb-4">
                    <ChatPane 
                        messages={textMessages}
                        guidelines={textGuidelines}
                        isLoading={isLoadingText}
                        method="text"
                        title="Coincidencia de Texto"
                        totalGuidelines={totalGuidelines}
                        onRefreshGuidelines={onRefreshGuidelines}
                    />
                    <ChatPane 
                        messages={vectorMessages}
                        guidelines={vectorGuidelines}
                        isLoading={isLoadingVector}
                        method="vector"
                        title="Coincidencia Semántica"
                        hybridWeight={hybridWeight}
                        onHybridWeightChange={onHybridWeightChange}
                        totalGuidelines={totalGuidelines}
                        onRefreshGuidelines={onRefreshGuidelines}
                    />
                </div>
            ) : (
                <div className="flex-1 mb-4">
                    {/* Tab Headers */}
                    <div className="tabs tabs-boxed mb-4">
                        <a 
                            className={`tab ${activeTab === 'text' ? 'tab-active' : ''}`}
                            onClick={() => {
                                setActiveTab('text');
                            }}
                        >
                            <FileText className="w-4 h-4 mr-2" />
                            Texto ({textMessages.filter(m => m.role === 'assistant').length})
                        </a>
                        <a 
                            className={`tab ${activeTab === 'vector' ? 'tab-active' : ''}`}
                            onClick={() => {
                                setActiveTab('vector');
                            }}
                        >
                            <Zap className="w-4 h-4 mr-2" />
                            Vector ({vectorMessages.filter(m => m.role === 'assistant').length})
                        </a>
                    </div>
                    
                    {/* Tab Content */}
                    <div className="h-full">
                        {activeTab === 'text' ? (
                            <ChatPane 
                                messages={textMessages}
                                guidelines={textGuidelines}
                                isLoading={isLoadingText}
                                method="text"
                                title="Coincidencia de Texto"
                                totalGuidelines={totalGuidelines}
                                onRefreshGuidelines={onRefreshGuidelines}
                            />
                        ) : (
                            <ChatPane 
                                messages={vectorMessages}
                                guidelines={vectorGuidelines}
                                isLoading={isLoadingVector}
                                method="vector"
                                title="Coincidencia Semántica"
                                hybridWeight={hybridWeight}
                                onHybridWeightChange={onHybridWeightChange}
                                totalGuidelines={totalGuidelines}
                                onRefreshGuidelines={onRefreshGuidelines}
                            />
                        )}
                    </div>
                </div>
            )}

            {/* Unified Input Area */}
            
            <div className="card bg-base-100 shadow-xl w-full max-w-[60%] mx-auto">
                <div className="card-body p-4">
                    <form onSubmit={handleSubmit} className="flex gap-2">
                        <div className="form-control w-full">
                            <input 
                                type="text" 
                                value={inputValue}
                                onInput={(e) => setInputValue((e.target as HTMLInputElement).value)}
                                placeholder="Escribe tu mensaje para comparar ambos métodos..." 
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
                                    Enviar
                                </>
                            )}
                        </button>
                    </form>
                    
                    {/* Loading Status */}
                    {(isLoadingText || isLoadingVector) && (
                        <div className="flex gap-4 mt-2 text-sm">
                            {isLoadingText && (
                                <span className="text-info flex items-center gap-1">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Procesando texto...
                                </span>
                            )}
                            {isLoadingVector && (
                                <span className="text-success flex items-center gap-1">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Procesando vectores...
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </div>
            
        </div>
        
        {/* Comparison Analytics - Global view */}
        <ComparisonAnalytics
            textGuidelines={textGuidelines}
            vectorGuidelines={vectorGuidelines}
        />
    </>
    );
}