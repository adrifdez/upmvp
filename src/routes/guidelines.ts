import { Hono } from 'hono'
import { GuidelineService } from '../services/GuidelineService'
import { supabase } from '../config/supabase'
import { z } from 'zod'

const guidelineRoutes = new Hono()

const createGuidelineSchema = z.object({
  condition: z.string().min(1, 'Condition is required'),
  action: z.string().min(1, 'Action is required'),
  priority: z.number().int().min(0).max(10).default(5),
  active: z.boolean().default(true),
  category: z.string().optional()
})

guidelineRoutes.get('/', async (c) => {
  try {
    const guidelineService = new GuidelineService()
    const guidelines = await guidelineService.getAll()
    
    return c.json({
      guidelines,
      count: guidelines.length
    })
  } catch (error) {
    console.error('Error fetching guidelines:', error)
    throw error
  }
})

guidelineRoutes.post('/', async (c) => {
  try {
    const body = await c.req.json()
    const validatedData = createGuidelineSchema.parse(body)
    
    const guidelineService = new GuidelineService()
    const guideline = await guidelineService.create(validatedData)
    
    return c.json({
      message: 'Guideline created successfully',
      guideline
    }, 201)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid request', details: error.errors }, 400)
    }
    throw error
  }
})

guidelineRoutes.get('/search', async (c) => {
  try {
    const query = c.req.query('q')
    
    if (!query) {
      return c.json({ error: 'Query parameter "q" is required' }, 400)
    }
    
    const guidelineService = new GuidelineService()
    const guidelines = await guidelineService.search(query)
    
    return c.json({
      query,
      guidelines,
      count: guidelines.length
    })
  } catch (error) {
    console.error('Error searching guidelines:', error)
    throw error
  }
})

// GET /api/guidelines/usage - estadísticas básicas
guidelineRoutes.get('/usage', async (c) => {
  try {
    // Get usage statistics from guideline_usage table
    const { data: usageData, error } = await supabase
      .from('guideline_usage')
      .select(`
        guideline_id,
        guidelines (
          id,
          condition,
          action,
          category
        ),
        applied,
        score
      `)
    
    if (error) {
      throw error
    }
    
    // Process statistics
    const stats = {
      totalUsageRecords: usageData?.length || 0,
      appliedCount: usageData?.filter(u => u.applied).length || 0,
      notAppliedCount: usageData?.filter(u => !u.applied).length || 0,
      averageScore: usageData && usageData.length > 0 
        ? usageData.reduce((sum, u) => sum + u.score, 0) / usageData.length 
        : 0,
      guidelineStats: {} as Record<number, {
        guideline: any,
        usageCount: number,
        appliedCount: number,
        averageScore: number
      }>
    }
    
    // Calculate per-guideline statistics
    if (usageData) {
      for (const usage of usageData) {
        const guidelineId = usage.guideline_id
        
        if (!stats.guidelineStats[guidelineId]) {
          stats.guidelineStats[guidelineId] = {
            guideline: usage.guidelines,
            usageCount: 0,
            appliedCount: 0,
            averageScore: 0
          }
        }
        
        const stat = stats.guidelineStats[guidelineId]
        stat.usageCount++
        if (usage.applied) stat.appliedCount++
        
        // Update average score
        stat.averageScore = ((stat.averageScore * (stat.usageCount - 1)) + usage.score) / stat.usageCount
      }
    }
    
    // Convert guidelineStats to array for easier consumption
    const guidelineStatsArray = Object.values(stats.guidelineStats)
      .sort((a, b) => b.usageCount - a.usageCount) // Sort by usage count
    
    return c.json({
      summary: {
        totalUsageRecords: stats.totalUsageRecords,
        appliedCount: stats.appliedCount,
        notAppliedCount: stats.notAppliedCount,
        averageScore: stats.averageScore
      },
      guidelines: guidelineStatsArray
    })
  } catch (error) {
    console.error('Error fetching guideline usage:', error)
    return c.json({ 
      error: 'Failed to fetch guideline usage statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

export { guidelineRoutes }