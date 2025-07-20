import { useEffect, useState } from 'preact/hooks';
import { formatRelativeTime, parseMarkdown } from '@/utils/helpers';
import { User, AlertCircle, Bot, Sparkles, ChevronDown, ChevronRight } from 'lucide-react';
import type { Message as MessageType } from '@/types';

interface MessageProps {
    message: MessageType;
    isLatest: boolean;
}

export default function Message({ message, isLatest }: MessageProps) {
    const [fadeIn, setFadeIn] = useState(false);
    const [expandedGuidelines, setExpandedGuidelines] = useState<Set<string>>(new Set());
    const isUser = message.role === 'user';
    const isSystem = message.role === 'system';
    const isAssistant = message.role === 'assistant';

    useEffect(() => {
        if (isLatest) {
            setTimeout(() => setFadeIn(true), 50);
        } else {
            setFadeIn(true);
        }
    }, [isLatest]);

    const getIcon = () => {
        if (isUser) return <User className="w-5 h-5 text-primary" />;
        if (isSystem) return <AlertCircle className="w-5 h-5 text-error" />;
        return <Bot className="w-5 h-5 text-secondary" />;
    };

    const getBubbleClass = (): string => {
        const baseClass = 'chat-bubble';
        const userClass = isUser ? ' chat-bubble-primary' : '';
        const systemClass = isSystem ? ' chat-bubble-error' : '';
        return baseClass + userClass + systemClass;
    };

    const toggleGuideline = (guidelineId: string) => {
        setExpandedGuidelines(prev => {
            const newSet = new Set(prev);
            if (newSet.has(guidelineId)) {
                newSet.delete(guidelineId);
            } else {
                newSet.add(guidelineId);
            }
            return newSet;
        });
    };

    return (
        <div className={`chat ${isUser ? 'chat-end' : 'chat-start'} transition-opacity duration-300 ${
            fadeIn ? 'opacity-100' : 'opacity-0'
        }`}>
            <div className="chat-image avatar">
                    {getIcon()}
            </div>
            
            <div className="chat-header">
                <span className="text-xs opacity-50">
                    {isUser ? 'You' : isSystem ? 'System' : 'AI Assistant'}
                </span>
                <time className="text-xs opacity-50 ml-2">
                    {formatRelativeTime(message.timestamp || new Date())}
                </time>
            </div>
            
            <div className={`${getBubbleClass()} max-w-lg prose prose-sm`}>
                <div dangerouslySetInnerHTML={{ __html: parseMarkdown(message.content) }}></div>
                
                {message.guidelines && message.guidelines.length > 0 && (
                    <div className="text-xs mt-2 pt-2 border-t border-base-content/10 opacity-70">
                        <div className="flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            <span>{message.guidelines.length} guideline{message.guidelines.length > 1 ? 's' : ''} applied</span>
                        </div>
                        <div className="mt-2 space-y-1">
                            {message.guidelines.map(g => {
                                const isExpanded = expandedGuidelines.has(g.id);
                                return (
                                    <div 
                                        key={g.id} 
                                        className="text-xs bg-base-200 rounded cursor-pointer hover:bg-base-300 transition-colors"
                                        onClick={() => toggleGuideline(g.id)}
                                    >
                                        <div className="p-2">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2 flex-1">
                                                    <span className="opacity-50">
                                                        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                    </span>
                                                    <span className="font-mono text-xs opacity-60">{g.id}</span>
                                                    <span className="flex-1">{g.condition}</span>
                                                </div>
                                                {g.score && (
                                                    <span className={`badge badge-xs shrink-0 ${
                                                        g.score >= 80 ? 'badge-success' : 
                                                        g.score >= 50 ? 'badge-warning' : 
                                                        'badge-ghost'
                                                    }`}>
                                                        {Math.round(g.score)}%
                                                    </span>
                                                )}
                                            </div>
                                            {isExpanded && (
                                                <div className="mt-2 pl-5 text-xs opacity-70 border-l-2 border-base-content/20">
                                                    <span className="text-success">→</span> {g.action}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
            
            <div className="chat-footer opacity-50">
                {isUser ? 'Delivered' : isAssistant ? 'Processed' : ''}
            </div>
        </div>
    );
}