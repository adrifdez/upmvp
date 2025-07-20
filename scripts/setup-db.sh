#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "🚀 Setting up Guideline-Aware AI Agent with pgvector..."

# Check if Supabase CLI is available
if ! command -v supabase &> /dev/null && ! npx supabase --version &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found!${NC}"
    echo "Please install Supabase CLI: https://supabase.com/docs/guides/cli/getting-started"
    exit 1
fi

# Use npx if supabase is not globally installed
SUPABASE_CMD="supabase"
if ! command -v supabase &> /dev/null; then
    SUPABASE_CMD="npx supabase"
fi

# Check if Supabase is already initialized
if [ ! -f "supabase/config.toml" ]; then
    echo -e "${YELLOW}📦 Initializing Supabase...${NC}"
    $SUPABASE_CMD init
fi

# Start Supabase if not running
echo -e "${YELLOW}🔧 Starting Supabase local development stack...${NC}"
$SUPABASE_CMD start

# Wait for services to be ready
echo -e "${YELLOW}⏳ Waiting for services to be ready...${NC}"
sleep 5

# Reset database (this will apply schema.sql and seed.sql)
echo -e "${YELLOW}🗄️  Creating database with pgvector support...${NC}"
$SUPABASE_CMD db reset

# Check if .env file exists
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo -e "${YELLOW}📋 Creating .env from .env.example...${NC}"
        cp .env.example .env
        echo -e "${BLUE}ℹ️  Please add your OPENAI_API_KEY to .env file${NC}"
    fi
fi

# Get Supabase status
STATUS=$($SUPABASE_CMD status --output json 2>/dev/null || echo "{}")

echo -e "${GREEN}✅ Database setup complete with pgvector!${NC}"
echo ""
echo "📊 Summary:"
echo "  - Studio URL: http://localhost:54323"
echo "  - Database: postgres://postgres:postgres@localhost:54322/postgres"
echo "  - pgvector: Enabled ✓"
echo ""
echo "🎯 Next steps:"
echo "  1. Copy anon key from supabase and add it to .env"
echo "  2. Copy service role key from supabase and add it to .env"
echo "  3. Add your OpenAI API key to .env"
echo "  4. Run 'npm run dev' to start the server"
echo "  5. Visit http://localhost:3001 and click 'Generate All Embeddings'"
echo "  6. Run 'npm run dev:client' to start the UI"
echo "  7. Visit http://localhost:5173/ to start the UI" 
echo "💡 Tip: Use 'npm run supabase:status' to check service status"