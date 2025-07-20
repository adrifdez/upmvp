import { useMemo } from 'preact/hooks';
import { BarChart3, TrendingUp, Award, Hash } from 'lucide-react';
import type { MatchedGuideline, GuidelineUsage } from '@/types';

interface GuidelineUsageStatsProps {
    guidelines: MatchedGuideline[];
    totalGuidelines: number;
    appliedGuidelines: number;
    onRefresh: () => void;
}

export default function GuidelineUsageStats({ 
    guidelines, 
    totalGuidelines, 
    appliedGuidelines, 
    onRefresh 
}: GuidelineUsageStatsProps) {
    
    // Calculate usage statistics from guidelines
    const usageStats = useMemo<GuidelineUsage[]>(() => {
        const usageMap = new Map<string, GuidelineUsage>();
        
        guidelines.forEach(g => {
            const existing = usageMap.get(g.id);
            if (existing) {
                // Use the usageCount from the guideline if available
                existing.useCount = g.usageCount || existing.useCount + 1;
                existing.totalScore += g.score;
                existing.avgScore = g.score; // Use latest score instead of average
                existing.lastUsed = g.lastApplied || new Date();
            } else {
                usageMap.set(g.id, {
                    guideline: g,
                    useCount: g.usageCount || 1,
                    totalScore: g.score,
                    avgScore: g.score,
                    firstUsed: g.lastApplied || new Date(),
                    lastUsed: g.lastApplied || new Date()
                });
            }
        });
        
        // Convert to array and sort by use count
        return Array.from(usageMap.values())
            .sort((a, b) => b.useCount - a.useCount);
    }, [guidelines]);
    
    const maxUseCount = Math.max(...usageStats.map(s => s.useCount), 1);
    
    const getBarWidth = (count: number) => {
        return `${(count / maxUseCount) * 100}%`;
    };
    
    const getScoreBadgeClass = (score: number) => {
        if (score >= 70) return 'badge-success';
        if (score >= 40) return 'badge-warning';
        return 'badge-ghost';
    };

    return (
        <div className="card bg-base-100 shadow-xl h-full flex flex-col">
            <div className="card-body p-3 flex flex-col h-full">
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-sm font-semibold flex items-center gap-2">
                        <BarChart3 className="w-4 h-4" />
                        Guideline Usage Stats
                    </h2>
                    <div className="text-xs opacity-60" title="El score disminuye 5% con cada uso">
                        {usageStats.length} guidelines únicas
                    </div>
                </div>
                
                {/* Usage List */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                    {usageStats.length === 0 ? (
                        <div className="text-center text-base-content/50 p-4">
                            <Hash className="w-8 h-8 mx-auto mb-2" />
                            <p className="text-sm">No guidelines used yet</p>
                            <p className="text-xs mt-2">Guidelines usage will appear here</p>
                        </div>
                    ) : (
                        <>
                            {usageStats.slice(0, 10).map((stat, index) => (
                                <div key={stat.guideline.id} className="space-y-1">
                                    <div className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <span className="font-mono opacity-50 shrink-0">
                                                #{index + 1}
                                            </span>
                                            <span className="truncate" title={`${stat.guideline.condition} (ID: ${stat.guideline.id})`}>
                                                {stat.guideline.condition}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="opacity-60">{stat.useCount}x</span>
                                            <span className={`badge badge-xs ${getScoreBadgeClass(stat.avgScore)}`} title="Score de relevancia con fatiga del 5% por uso">
                                                {stat.avgScore.toFixed(1)}%
                                            </span>
                                        </div>
                                    </div>
                                    <div className="w-full bg-base-200 rounded-full h-1.5">
                                        <div 
                                            className="bg-primary h-1.5 rounded-full transition-all duration-500"
                                            style={{ width: getBarWidth(stat.useCount) }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                </div>
                
                {/* Summary Stats */}
                <div className="flex justify-between text-xs text-base-content/70 mt-2 p-2 bg-base-200 rounded">
                    <div className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        <span>Total uses: {guidelines.length}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Award className="w-3 h-3 text-primary" />
                        <span>Unique: {usageStats.length}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}