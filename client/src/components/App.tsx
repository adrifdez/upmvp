import { useState, useEffect } from 'preact/hooks';
import DualChatContainer from './DualChatContainer';
import { api } from '@/services/api';
import { generateSessionId, getOrCreateSessionId } from '@/utils/helpers';
import type { MessageWithMethod, MatchedGuideline, SessionMetrics, MethodMetrics } from '@/types';

export default function App() {
    const [textMessages, setTextMessages] = useState<MessageWithMethod[]>([]);
    const [vectorMessages, setVectorMessages] = useState<MessageWithMethod[]>([]);
    const [textGuidelines, setTextGuidelines] = useState<MatchedGuideline[]>([]);
    const [vectorGuidelines, setVectorGuidelines] = useState<MatchedGuideline[]>([]);
    const [isLoadingText, setIsLoadingText] = useState(false);
    const [isLoadingVector, setIsLoadingVector] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [totalGuidelines, setTotalGuidelines] = useState(0);
    const [hybridWeight, setHybridWeight] = useState(() => {
        const saved = localStorage.getItem('hybridWeight');
        return saved ? parseFloat(saved) : 0.8;
    });
    const [sessionMetrics, setSessionMetrics] = useState<SessionMetrics | null>(null);

    useEffect(() => {
        const id = getOrCreateSessionId();
        setSessionId(id);
        
        // Initialize session metrics
        setSessionMetrics({
            sessionId: id,
            startTime: new Date(),
            lastActive: new Date(),
            textMetrics: [],
            vectorMetrics: [],
            totalMessages: { text: 0, vector: 0 }
        });
        
        api.getGuidelines()
            .then(data => {
                setTotalGuidelines(data.guidelines?.length || 0);
            })
            .catch(err => console.error('Failed to fetch guidelines:', err));
    }, []);

    useEffect(() => {
        localStorage.setItem('hybridWeight', hybridWeight.toString());
    }, [hybridWeight]);

    const updateMetrics = (method: 'text' | 'vector', responseTime: number, guidelines: MatchedGuideline[]) => {
        const avgScore = guidelines.length > 0
            ? guidelines.reduce((acc, g) => acc + (g.score || 0), 0) / guidelines.length
            : 0;

        const metric: MethodMetrics = {
            timestamp: new Date(),
            method,
            responseTime,
            guidelinesApplied: guidelines.length,
            avgScore
        };

        setSessionMetrics(prev => {
            if (!prev) return prev;
            
            const updated = { ...prev };
            updated.lastActive = new Date();
            
            if (method === 'text') {
                updated.textMetrics = [...updated.textMetrics, metric];
                updated.totalMessages.text += 1;
            } else {
                updated.vectorMetrics = [...updated.vectorMetrics, metric];
                updated.totalMessages.vector += 1;
            }
            
            // Store in localStorage for persistence
            localStorage.setItem(`sessionMetrics_${prev.sessionId}`, JSON.stringify(updated));
            
            return updated;
        });
    };

    const sendMessage = async (userMessage: string) => {
        if (!userMessage.trim() || isLoadingText || isLoadingVector) return;
        
        setIsLoadingText(true);
        setIsLoadingVector(true);
        
        const userMessageId = Date.now();
        const userMessageData: MessageWithMethod = { 
            id: userMessageId, 
            role: 'user', 
            content: userMessage,
            timestamp: new Date()
        };
        
        setTextMessages(prev => [...prev, userMessageData]);
        setVectorMessages(prev => [...prev, userMessageData]);
        
        try {
            console.log('Analyzing message with both methods...');
            
            const dualResponse = await api.sendMessageDual(userMessage, sessionId, hybridWeight);
            
            // Process text response
            if (dualResponse.text) {
                const textResponseTime = dualResponse.responseTimes?.text || 0;
                setTextMessages(prev => {
                    const updated = [...prev, { 
                        id: Date.now() + 1,
                        role: 'assistant' as const, 
                        content: dualResponse.text!.response,
                        guidelines: dualResponse.text!.guidelines_used || [],
                        timestamp: new Date(),
                        method: 'text' as 'text',
                        responseTime: textResponseTime
                    }];
                    return updated;
                });
                setIsLoadingText(false);
                
                // Update guidelines from text method
                updateGuidelines(dualResponse.text.guidelines_used || [], 'text');
                
                // Update metrics
                updateMetrics('text', textResponseTime, dualResponse.text.guidelines_used || []);
            } else {
                setIsLoadingText(false);
                if (dualResponse.error?.text) {
                    setTextMessages(prev => [...prev, { 
                        id: Date.now() + 3,
                        role: 'system', 
                        content: 'Error with text method: ' + dualResponse.error!.text,
                        timestamp: new Date()
                    }]);
                }
            }
            
            // Process vector response
            if (dualResponse.vector) {
                const vectorResponseTime = dualResponse.responseTimes?.vector || 0;
                setVectorMessages(prev => {
                    const updated = [...prev, { 
                        id: Date.now() + 2,
                        role: 'assistant' as const, 
                        content: dualResponse.vector!.response,
                        guidelines: dualResponse.vector!.guidelines_used || [],
                        timestamp: new Date(),
                        method: 'vector' as 'vector',
                        responseTime: vectorResponseTime
                    }];
                    return updated;
                });
                setIsLoadingVector(false);
                
                // Update guidelines from vector method
                updateGuidelines(dualResponse.vector.guidelines_used || [], 'vector');
                
                // Update metrics
                updateMetrics('vector', vectorResponseTime, dualResponse.vector.guidelines_used || []);
            } else {
                setIsLoadingVector(false);
                if (dualResponse.error?.vector) {
                    setVectorMessages(prev => [...prev, { 
                        id: Date.now() + 4,
                        role: 'system', 
                        content: 'Error with vector method: ' + dualResponse.error!.vector,
                        timestamp: new Date()
                    }]);
                }
            }
            
            console.log('Responses received from both methods');
        } catch (error) {
            console.error('Chat error:', error);
            console.error(`Error: ${(error as Error).message}`);
            
            const errorMessage: MessageWithMethod = { 
                id: Date.now() + 5,
                role: 'system', 
                content: 'Sorry, there was an error processing your message. Please try again.',
                timestamp: new Date()
            };
            
            setTextMessages(prev => [...prev, errorMessage]);
            setVectorMessages(prev => [...prev, errorMessage]);
            setIsLoadingText(false);
            setIsLoadingVector(false);
        }
    };

    const updateGuidelines = (matchedGuidelines: MatchedGuideline[], method: 'text' | 'vector') => {
        if (matchedGuidelines.length > 0) {
            const setterFunction = method === 'text' ? setTextGuidelines : setVectorGuidelines;
            
            setterFunction(prev => {
                const newGuidelines = [...prev];
                matchedGuidelines.forEach(g => {
                    const existing = newGuidelines.find(eg => eg.id === g.id);
                    if (existing) {
                        // Update with latest score and increment usage count
                        existing.score = g.score || existing.score;
                        existing.usageCount = (existing.usageCount || 0) + 1;
                        existing.lastApplied = new Date();
                    } else {
                        newGuidelines.push({
                            ...g,
                            score: g.score || 0.5,
                            usageCount: 1,
                            lastApplied: new Date()
                        });
                    }
                });
                return newGuidelines.sort((a, b) => 
                    (b.lastApplied?.getTime() || 0) - (a.lastApplied?.getTime() || 0)
                );
            });
        }
    };

    const clearChat = () => {
        setTextMessages([]);
        setVectorMessages([]);
        setTextGuidelines([]);
        setVectorGuidelines([]);
        const newId = generateSessionId();
        sessionStorage.setItem('chatSessionId', newId);
        setSessionId(newId);
        
        // Reset session metrics
        setSessionMetrics({
            sessionId: newId,
            startTime: new Date(),
            lastActive: new Date(),
            textMetrics: [],
            vectorMetrics: [],
            totalMessages: { text: 0, vector: 0 }
        });
        
        console.log('Chat cleared');
    };

    const refreshGuidelines = async () => {
        try {
            const data = await api.getGuidelines();
            setTotalGuidelines(data.guidelines?.length || 0);
            console.log('Guidelines refreshed');
        } catch (err) {
            console.error('Failed to refresh guidelines:', err);
            console.error('Failed to refresh guidelines');
        }
    };

    return (
        <div className="w-full px-4 py-4">

            {/* Main Content */}
            <div className="flex flex-col gap-6">
                {/* Dual Chat Interface */}
                <div className="flex-1">
                    <DualChatContainer
                        textMessages={textMessages}
                        vectorMessages={vectorMessages}
                        textGuidelines={textGuidelines}
                        vectorGuidelines={vectorGuidelines}
                        isLoadingText={isLoadingText}
                        isLoadingVector={isLoadingVector}
                        onSendMessage={sendMessage}
                        onClearChat={clearChat}
                        hybridWeight={hybridWeight}
                        onHybridWeightChange={setHybridWeight}
                        totalGuidelines={totalGuidelines}
                        onRefreshGuidelines={refreshGuidelines}
                    />
                </div>

            </div>
        </div>
    );
}