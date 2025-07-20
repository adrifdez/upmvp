# MidHome Rentals AI Agent MVP

<div align="center">
  <h3>🤖 Dynamic AI Behavior Through Database-Driven Guidelines</h3>
  <p>An advanced AI agent system that adapts its responses based on contextual rules stored in a database, inspired by Parlant.io's approach</p>
  <p>
    <strong>MHR Agent</strong> | 
    <a href="#overview">Overview</a> • 
    <a href="#features">Features</a> • 
    <a href="#architecture">Architecture</a> • 
    <a href="#quick-start">Quick Start</a> • 
  </p>
</div>

---

## 🎯 Project Overview {#overview}

This MVP demonstrates a sophisticated approach to AI agent customization where behavioral guidelines are:
- **Dynamically loaded** from a PostgreSQL database (Supabase)
- **Contextually matched** using both semantic search (vector embeddings) and text matching
- **Intelligently applied** based on conversation context and priority
- **Tracked and optimized** to prevent repetitive responses

### Real-World Use Case: MidHome Rentals
The system is demonstrated through a Spanish mid-term rental company (1-6 months stays) with guidelines for:
- Sales conversations (pricing, availability, benefits)
- Property management (maintenance, check-in/out)
- General customer service

### Key Innovation: Dual Matching System
The MVP features a unique comparison interface showing two guideline matching approaches side-by-side:
1. **Text Matching**: Traditional keyword and pattern matching
2. **Vector/Semantic Matching**: AI-powered understanding using OpenAI embeddings

This allows real-time comparison of both methods' effectiveness.

## ✨ Core Features {#features}

### 1. Dynamic Guideline System
- Guidelines follow "When [condition], then [action]" format
- Priority-based selection (0-10 scale)
- Category organization (sales, management, general)
- Active/inactive status for easy management

### 2. Advanced Matching Capabilities
- **Hybrid Matching**: Configurable blend of semantic and text matching (default 80/20)
- **Context Awareness**: Considers conversation flow and previous messages
- **Category Continuity**: Boosts guidelines in the same category as previous ones

### 3. Intelligent Fatigue System
- Prevents guideline overuse within sessions
- 5% score reduction per use
- Session-based tracking
- Detailed usage analytics

### 4. Professional UI
- Split-screen comparison of matching methods
- Real-time response generation
- Usage statistics visualization
- Response time tracking
- Tab and split view modes

### 5. Comprehensive API
- RESTful endpoints for all operations
- Session management
- Guideline CRUD operations
- Analytics and monitoring
- Embedding management

## 🏗️ Technical Architecture {#architecture}

### Technology Stack

#### Backend
- **Framework**: Hono (lightweight, fast web framework)
- **Language**: TypeScript with Node.js
- **Database**: Supabase (PostgreSQL + pgvector for embeddings)
- **AI Integration**: OpenAI API
- **Embeddings**: OpenAI text-embedding-3-small model

#### Frontend
- **Framework**: Preact with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS + DaisyUI
- **Icons**: Lucide React

## 🚀 Quick Start {#quick-start}

### Prerequisites

- Node.js 22.x or higher
- Docker (for Supabase local development)
- OpenAI API key

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/adrifdez/upmvp.git
   cd upmvp
   ```

2. **Install dependencies:**
   ```bash
   # Backend dependencies
   npm install
   
   # Frontend dependencies
   cd client && npm install && cd ..
   ```

3. **Set up the database with pgvector:**
   ```bash
   npm run setup
   ```
   This will:
   - Start Supabase local development stack
   - Create all tables with pgvector support
   - Load sample guidelines

   You need to copy anon key to .env SUPABASE_ANON_KEY and service_role key to .env SUPABASE_SERVICE_ROLE_KEY

5. **Start the development servers:**
   ```bash
   # Terminal 1: Backend server (port 3001)
   npm run dev
   
   # Terminal 2: Frontend dev server (port 5173)
   npm run dev:client
   ```
   
   1. Access to http://localhost:3001 and click 'Generate All Embeddings'
   2. Access the app at http://localhost:5173

## 🔍 Project Overview

This MVP demonstrates a guideline-aware AI system with:

- **Dynamic Guidelines**: AI behavior rules stored in a database
- **Semantic Search**: Vector embeddings for better guideline matching
- **Context Awareness**: Guidelines applied based on user message content
- **Hybrid Matching**: Combines semantic search with keyword matching
- **Usage Tracking**: Prevention of repetitive responses

## 🛠️ Available Scripts

```bash
npm run dev          # Start backend development server
npm run dev:client   # Start frontend development server
npm run build        # Build both backend and frontend
npm run start        # Start production server
npm run setup        # Complete database setup with pgvector
npm run db:reset     # Reset database and apply migrations
npm run db:seed      # Load sample guidelines
npm run typecheck    # Run TypeScript type checking
```

## 📁 Project Structure

```
upmvp/
├── src/
│   ├── server.ts         # Main server file
│   ├── services/         # Core business logic
│   ├── routes/           # API endpoints
│   └── types/            # TypeScript types
├── client/
│   ├── src/              # React frontend
│   └── public/           # Static assets
├── supabase/
│   ├── migrations/       # Database schema
│   └── seed.sql          # Sample data
├── scripts/
│   └── setup-db.sh       # Database setup script
└── public/               # Frontend files (Phase 3)
```

## 🔌 API Reference

- `GET /health` - Health check
- `POST /api/chat` - Main chat endpoint
  ```json
  {
    "message": "Your message here",
    "sessionId": "optional-session-id"
  }
  ```
- `GET /api/guidelines` - List all guidelines
- `POST /api/guidelines` - Create new guideline

### Embeddings API
- `GET /api/embeddings/status` - Check embeddings system status
- `POST /api/embeddings/generate` - Generate embeddings for guidelines
- `POST /api/embeddings/test` - Test vector search

## 💾 Database Schema

### Guidelines Table
- Stores behavioral rules with conditions and actions
- Includes priority and category
- Full-text search enabled on conditions

### Conversations Table
- Tracks chat sessions and message history
- Maintains list of used guidelines per session

### Guideline Usage Table
- Analytics for guideline activation
- Tracks scoring and actual application

## 🧪 Testing the System

1. **Basic chat test:**
   ```bash
   curl -X POST http://localhost:3001/api/chat \
     -H "Content-Type: application/json" \
     -d '{"message": "What are your prices?"}'
   ```

2. **View guidelines:**
   ```bash
   curl http://localhost:3001/api/guidelines
   ```

3. **Access Supabase Studio:**
   Open http://localhost:54323 in your browser

## 🔧 Troubleshooting

### Supabase not starting?
```bash
# Check if Docker is running
docker ps

# Reset Supabase
npm run supabase:stop
npm run supabase:start
```

### Database connection issues?
```bash
# Check Supabase status
npm run supabase:status

# Reset database
npm run db:reset
```

### Port conflicts?
- API runs on port 3001 (configurable in .env)
- Supabase Studio: 54323
- PostgreSQL: 54322

## 📝 Development Notes

- Guidelines use a "When X, then Y" format
- Priority ranges from 0-10 (higher = more important)
- Guidelines can have relationships (requires/excludes)
- Sessions prevent guideline repetition

## 📄 License

ISC

---
