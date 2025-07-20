import { useMemo } from 'preact/hooks';
import { Clock, Target, Award } from 'lucide-react';
import type { MessageWithMethod, MatchedGuideline } from '@/types';

interface MethodStatsProps {
    messages: MessageWithMethod[];
    guidelines: MatchedGuideline[];
    method: 'text' | 'vector';
}

interface Stats {
    totalMessages: number;
    avgResponseTime: number;
    totalGuidelines: number;
    avgGuidelinesPerMessage: number;
    avgScore: number;
}

export default function MethodStats({ messages, guidelines, method }: MethodStatsProps) {
    const stats = useMemo<Stats>(() => {
        const assistantMessages = messages.filter(m => m.role === 'assistant');
        const totalMessages = assistantMessages.length;
        
        // Calculate average response time
        const responseTimes = assistantMessages
            .map(m => m.responseTime)
            .filter((t): t is number => t !== undefined);
        const avgResponseTime = responseTimes.length > 0 
            ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
            : 0;
        
        // Calculate guidelines stats
        const totalGuidelines = guidelines.length;
        const avgGuidelinesPerMessage = totalMessages > 0 
            ? (guidelines.length / totalMessages).toFixed(1)
            : '0';
        
        // Calculate average score
        const scores = guidelines.map(g => g.score).filter(s => s !== undefined);
        const avgScore = scores.length > 0
            ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
            : 0;
        
        // Calculate recent trend (compare last 3 messages with previous 3)
        let recentTrend: 'up' | 'down' | 'stable' = 'stable';
        if (responseTimes.length >= 6) {
            const recent = responseTimes.slice(-3).reduce((a, b) => a + b, 0) / 3;
            const previous = responseTimes.slice(-6, -3).reduce((a, b) => a + b, 0) / 3;
            if (recent < previous * 0.9) recentTrend = 'up';
            else if (recent > previous * 1.1) recentTrend = 'down';
        }
        
        return {
            totalMessages,
            avgResponseTime,
            totalGuidelines,
            avgGuidelinesPerMessage: parseFloat(avgGuidelinesPerMessage),
            avgScore,
            recentTrend
        };
    }, [messages, guidelines]);
    
    const getMethodColor = () => method === 'vector' ? 'text-success' : 'text-info';
    
    return (
        <div className="stats shadow-sm w-full bg-base-200">
            <div className="stat py-2 px-3">
                <div className="stat-figure text-secondary">
                    <Clock className={`w-4 h-4 ${getMethodColor()}`} />
                </div>
                <div className="stat-title text-xs">Avg Response</div>
                <div className="stat-value text-sm">{stats.avgResponseTime}ms</div>
            </div>
            
            <div className="stat py-2 px-3">
                <div className="stat-figure text-secondary">
                    <Target className={`w-4 h-4 ${getMethodColor()}`} />
                </div>
                <div className="stat-title text-xs">Guidelines</div>
                <div className="stat-value text-sm">{stats.totalGuidelines}</div>
                <div className="stat-desc text-xs">{stats.avgGuidelinesPerMessage}/msg</div>
            </div>
            
            <div className="stat py-2 px-3">
                <div className="stat-figure text-secondary">
                    <Award className={`w-4 h-4 ${getMethodColor()}`} />
                </div>
                <div className="stat-title text-xs">Avg Score</div>
                <div className="stat-value text-sm">{stats.avgScore}%</div>
            </div>
        </div>
    );
}