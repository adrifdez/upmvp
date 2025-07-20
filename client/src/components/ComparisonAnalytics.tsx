import { useMemo } from 'preact/hooks';
import { GitCompare, Sparkles, TrendingUp, BarChart, AlertCircle } from 'lucide-react';
import type { MatchedGuideline } from '@/types';

interface ComparisonAnalyticsProps {
    textGuidelines: MatchedGuideline[];
    vectorGuidelines: MatchedGuideline[];
}

interface ComparisonStats {
    textOnly: MatchedGuideline[];
    vectorOnly: MatchedGuideline[];
    shared: {
        id: string;
        condition: string;
        textScore: number;
        vectorScore: number;
        textCount: number;
        vectorCount: number;
    }[];
}

export default function ComparisonAnalytics({ textGuidelines, vectorGuidelines }: ComparisonAnalyticsProps) {
    const stats = useMemo<ComparisonStats>(() => {
        const textIds = new Set(textGuidelines.map(g => g.id));
        const vectorIds = new Set(vectorGuidelines.map(g => g.id));
        
        // Find unique guidelines
        const textOnly = textGuidelines.filter(g => !vectorIds.has(g.id));
        const vectorOnly = vectorGuidelines.filter(g => !textIds.has(g.id));
        
        // Find shared guidelines and calculate stats
        const sharedMap = new Map<string, any>();
        
        textGuidelines.forEach(g => {
            if (vectorIds.has(g.id)) {
                const existing = sharedMap.get(g.id) || {
                    id: g.id,
                    condition: g.condition,
                    textScore: 0,
                    vectorScore: 0,
                    textCount: 0,
                    vectorCount: 0
                };
                existing.textScore += g.score;
                existing.textCount += 1;
                sharedMap.set(g.id, existing);
            }
        });
        
        vectorGuidelines.forEach(g => {
            if (textIds.has(g.id) && sharedMap.has(g.id)) {
                const existing = sharedMap.get(g.id);
                existing.vectorScore += g.score;
                existing.vectorCount += 1;
            }
        });
        
        const shared = Array.from(sharedMap.values()).map(s => ({
            ...s,
            textScore: s.textCount > 0 ? s.textScore / s.textCount : 0,
            vectorScore: s.vectorCount > 0 ? s.vectorScore / s.vectorCount : 0
        }));
        
        return { textOnly, vectorOnly, shared };
    }, [textGuidelines, vectorGuidelines]);
    
    const getScoreDifference = (textScore: number, vectorScore: number) => {
        const diff = Math.abs(textScore - vectorScore);
        if (diff < 5) return 'Similar';
        if (textScore > vectorScore) return `Text +${Math.round(diff)}%`;
        return `Vector +${Math.round(diff)}%`;
    };
    
    const getScoreDiffClass = (textScore: number, vectorScore: number) => {
        const diff = Math.abs(textScore - vectorScore);
        if (diff < 5) return 'badge-ghost';
        if (textScore > vectorScore) return 'badge-info';
        return 'badge-success';
    };

    return (
        <div className="card bg-base-100 shadow-xl mt-4">
            <div className="card-body p-4">
                <div className="flex items-center gap-2 mb-4">
                    <GitCompare className="w-5 h-5" />
                    <h2 className="card-title text-lg">Comparison Analytics</h2>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Text Only */}
                    <div className="bg-base-200 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold text-sm text-info">Text Method Only</h3>
                            <span className="badge badge-info badge-sm">{stats.textOnly.length}</span>
                        </div>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                            {stats.textOnly.length === 0 ? (
                                <p className="text-xs opacity-60">None found exclusively</p>
                            ) : (
                                stats.textOnly.slice(0, 5).map(g => (
                                    <div key={g.id} className="text-xs opacity-70">
                                        <span className="font-mono opacity-50">{g.id}</span>
                                        <span className="ml-2 truncate">{g.condition}</span>
                                    </div>
                                ))
                            )}
                            {stats.textOnly.length > 5 && (
                                <p className="text-xs opacity-50 mt-1">
                                    +{stats.textOnly.length - 5} more...
                                </p>
                            )}
                        </div>
                    </div>
                    
                    {/* Vector Only */}
                    <div className="bg-base-200 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold text-sm text-success">Vector Method Only</h3>
                            <span className="badge badge-success badge-sm">{stats.vectorOnly.length}</span>
                        </div>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                            {stats.vectorOnly.length === 0 ? (
                                <p className="text-xs opacity-60">None found exclusively</p>
                            ) : (
                                stats.vectorOnly.slice(0, 5).map(g => (
                                    <div key={g.id} className="text-xs opacity-70">
                                        <span className="font-mono opacity-50">{g.id}</span>
                                        <span className="ml-2 truncate">{g.condition}</span>
                                    </div>
                                ))
                            )}
                            {stats.vectorOnly.length > 5 && (
                                <p className="text-xs opacity-50 mt-1">
                                    +{stats.vectorOnly.length - 5} more...
                                </p>
                            )}
                        </div>
                    </div>
                    
                    {/* Shared Guidelines */}
                    <div className="bg-base-200 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold text-sm">Shared Guidelines</h3>
                            <span className="badge badge-primary badge-sm">{stats.shared.length}</span>
                        </div>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                            {stats.shared.length === 0 ? (
                                <p className="text-xs opacity-60">No shared guidelines yet</p>
                            ) : (
                                stats.shared.slice(0, 3).map(s => (
                                    <div key={s.id} className="text-xs">
                                        <div className="flex items-center justify-between">
                                            <span className="truncate flex-1" title={s.condition}>
                                                {s.condition}
                                            </span>
                                            <span className={`badge badge-xs ml-2 ${getScoreDiffClass(s.textScore, s.vectorScore)}`}>
                                                {getScoreDifference(s.textScore, s.vectorScore)}
                                            </span>
                                        </div>
                                        <div className="flex gap-2 mt-1 opacity-60">
                                            <span>T: {s.textCount}x</span>
                                            <span>V: {s.vectorCount}x</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
                
                {/* Summary Insights */}
                <div className="mt-4 p-3 bg-base-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4" />
                        <h4 className="font-semibold text-sm">Key Insights</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="w-3 h-3 text-primary" />
                            <span>
                                Total unique: {new Set([...textGuidelines.map(g => g.id), ...vectorGuidelines.map(g => g.id)]).size}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <BarChart className="w-3 h-3 text-primary" />
                            <span>
                                Overlap rate: {stats.shared.length > 0 
                                    ? Math.round((stats.shared.length / (stats.shared.length + stats.textOnly.length + stats.vectorOnly.length)) * 100)
                                    : 0}%
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <AlertCircle className="w-3 h-3 text-primary" />
                            <span>
                                Method variance: {stats.textOnly.length + stats.vectorOnly.length} unique
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}