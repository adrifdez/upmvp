import 'dotenv/config'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { chatRoutes } from './routes/chat'
import { guidelineRoutes } from './routes/guidelines'
import { conversationRoutes } from './routes/conversations'
import { embeddingsRoutes } from './routes/embeddings'

const app = new Hono()

app.onError((err, c) => {
  console.error(`${err}`)
  return c.json(
    { 
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined
    },
    500
  )
})

app.use('*', cors())
app.use('*', logger())

// Serve static files
// In production, serve the built client app
if (process.env.NODE_ENV === 'production') {
  app.use('/*', serveStatic({ root: './client/dist' }))
} else {
  // In development, serve the legacy public directory
  app.use('/*', serveStatic({ root: './public' }))
}

app.get('/health', (c) => {
  return c.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'guideline-agent'
  })
})

app.route('/api/chat', chatRoutes)
app.route('/api/guidelines', guidelineRoutes)
app.route('/api/conversations', conversationRoutes)
app.route('/api/embeddings', embeddingsRoutes)

const port = process.env.PORT ? parseInt(process.env.PORT) : 3001

// Log configuration info
console.log(`🚀 Server is running on port ${port}`)
console.log(`🤖 LLM Provider: OpenAI`)
console.log(`📡 Model: ${process.env.LLM_MODEL}`)
console.log(`🔒 API Key: ${process.env.OPENAI_API_KEY ? '✓ Configured' : '✗ Missing'}`)

serve({
  fetch: app.fetch,
  port
})