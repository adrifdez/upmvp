import { supabase } from '../config/supabase.js';
import type { Guideline, GuidelineInput, GuidelineUsage, GuidelineStatistics } from '../types/index.js';

export class GuidelineService {
  async searchGuidelines(query: string, limit: number = 10): Promise<Guideline[]> {
    const { data, error } = await supabase
      .from('guidelines')
      .select('*')
      .or(`condition.ilike.%${query}%,action.ilike.%${query}%,category.ilike.%${query}%`)
      .eq('active', true)
      .order('priority', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error searching guidelines:', error);
      throw new Error(`Failed to search guidelines: ${error.message}`);
    }

    return data || [];
  }

  async getByCategory(category: string): Promise<Guideline[]> {
    const { data, error } = await supabase
      .from('guidelines')
      .select('*')
      .eq('category', category)
      .eq('active', true)
      .order('priority', { ascending: false });

    if (error) {
      console.error('Error fetching guidelines by category:', error);
      throw new Error(`Failed to fetch guidelines by category: ${error.message}`);
    }

    return data || [];
  }

  async create(guideline: GuidelineInput): Promise<Guideline> {
    const { data, error } = await supabase
      .from('guidelines')
      .insert({
        ...guideline,
        priority: guideline.priority ?? 0,
        active: guideline.active ?? true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating guideline:', error);
      throw new Error(`Failed to create guideline: ${error.message}`);
    }

    return data;
  }

  async getAll(): Promise<Guideline[]> {
    const { data, error } = await supabase
      .from('guidelines')
      .select('*')
      .order('priority', { ascending: false });

    if (error) {
      console.error('Error fetching all guidelines:', error);
      throw new Error(`Failed to fetch all guidelines: ${error.message}`);
    }

    return data || [];
  }

  async getActiveGuidelines(): Promise<Guideline[]> {
    const { data, error } = await supabase
      .from('guidelines')
      .select('*')
      .eq('active', true)
      .order('priority', { ascending: false });

    if (error) {
      console.error('Error fetching active guidelines:', error);
      throw new Error(`Failed to fetch active guidelines: ${error.message}`);
    }

    return data || [];
  }

  // Alias for searchGuidelines for backward compatibility
  async search(query: string, limit: number = 10): Promise<Guideline[]> {
    return this.searchGuidelines(query, limit);
  }

  async getUsageStatistics(conversationId?: number): Promise<GuidelineStatistics> {
    try {
      const baseQuery = supabase
        .from('guideline_usage')
        .select(`
          id,
          guideline_id,
          score,
          applied,
          created_at,
          guidelines (
            id,
            condition,
            action,
            category,
            priority
          )
        `);

      const query = conversationId 
        ? baseQuery.eq('conversation_id', conversationId)
        : baseQuery;

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching usage statistics:', error);
        throw new Error(`Failed to fetch usage statistics: ${error.message}`);
      }

      const usageData = data as GuidelineUsage[] | null;

      if (!usageData || usageData.length === 0) {
        return {
          totalUsages: 0,
          uniqueGuidelines: 0,
          averageScore: 0,
          appliedCount: 0,
          topGuidelines: [],
          usagesByCategory: {}
        };
      }

      // Calculate statistics
      const totalUsages = usageData.length;
      const appliedCount = usageData.filter(u => u.applied).length;
      const averageScore = usageData.reduce((sum, u) => sum + u.score, 0) / totalUsages;

      // Count unique guidelines and their usage frequency
      const guidelineUsageCounts = new Map<number, number>();
      const categoryUsageCounts = new Map<string, number>();
      
      usageData.forEach(usage => {
        const gId = usage.guideline_id;
        guidelineUsageCounts.set(gId, (guidelineUsageCounts.get(gId) || 0) + 1);
        
        const category = usage.guidelines?.category || 'uncategorized';
        categoryUsageCounts.set(category, (categoryUsageCounts.get(category) || 0) + 1);
      });

      const uniqueGuidelines = guidelineUsageCounts.size;

      // Get top 5 most used guidelines
      const topGuidelines = Array.from(guidelineUsageCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([guidelineId, count]) => {
          const usageWithGuideline = usageData.find(u => u.guideline_id === guidelineId);
          const guideline = usageWithGuideline?.guidelines;
          return {
            guidelineId,
            count,
            guideline: guideline ? {
              condition: guideline.condition,
              action: guideline.action,
              category: guideline.category
            } : null
          };
        });

      // Convert category usage counts to object
      const usagesByCategory = Object.fromEntries(categoryUsageCounts);

      return {
        totalUsages,
        uniqueGuidelines,
        averageScore: Math.round(averageScore * 100) / 100,
        appliedCount,
        applicationRate: Math.round((appliedCount / totalUsages) * 100) / 100,
        topGuidelines,
        usagesByCategory
      };
    } catch (error) {
      console.error('Error in getUsageStatistics:', error);
      throw error;
    }
  }
}