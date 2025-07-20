-- Combined migrations for the Guideline-Aware AI Agent MVP
-- This file contains all migrations in chronological order

-- ========================================================================
-- Migration 1: Initial schema (20240101000000_initial_schema.sql)
-- ========================================================================

-- Initial schema migration
-- This creates the complete database structure with pgvector support

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create guidelines table with vector support
CREATE TABLE IF NOT EXISTS guidelines (
  id SERIAL PRIMARY KEY,
  condition TEXT NOT NULL,
  action TEXT NOT NULL,
  category VARCHAR(100),
  priority INTEGER DEFAULT 5 CHECK (priority >= 0 AND priority <= 10),
  active BOOLEAN DEFAULT true,
  condition_embedding vector(1536),
  embedding_model VARCHAR(50) DEFAULT 'text-embedding-3-small',
  embedding_generated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255) UNIQUE NOT NULL,
  messages JSONB DEFAULT '[]',
  used_guideline_ids INTEGER[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create guideline_usage table
CREATE TABLE IF NOT EXISTS guideline_usage (
  id SERIAL PRIMARY KEY,
  guideline_id INTEGER REFERENCES guidelines(id) ON DELETE CASCADE,
  conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
  score FLOAT,
  vector_score FLOAT,
  text_score FLOAT,
  hybrid_score FLOAT,
  applied BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create message embeddings cache table
CREATE TABLE IF NOT EXISTS message_embeddings (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL,
  message_hash VARCHAR(64) NOT NULL,
  message_text TEXT NOT NULL,
  embedding vector(1536),
  embedding_model VARCHAR(50) DEFAULT 'text-embedding-3-small',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(message_hash)
);

-- Create all indexes
CREATE INDEX IF NOT EXISTS idx_guidelines_condition ON guidelines USING GIN (to_tsvector('english', condition));
CREATE INDEX IF NOT EXISTS idx_guidelines_category ON guidelines(category);
CREATE INDEX IF NOT EXISTS idx_guidelines_active ON guidelines(active);
CREATE INDEX IF NOT EXISTS idx_guidelines_priority ON guidelines(priority DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_session_id ON conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_guideline_usage_guideline_id ON guideline_usage(guideline_id);
CREATE INDEX IF NOT EXISTS idx_guideline_usage_conversation_id ON guideline_usage(conversation_id);
CREATE INDEX IF NOT EXISTS idx_guideline_usage_applied ON guideline_usage(applied);

CREATE INDEX IF NOT EXISTS idx_message_embeddings_session ON message_embeddings(session_id);
CREATE INDEX IF NOT EXISTS idx_message_embeddings_hash ON message_embeddings(message_hash);

-- Vector similarity indexes
CREATE INDEX IF NOT EXISTS idx_guidelines_embedding 
ON guidelines USING ivfflat (condition_embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_message_embeddings_vector 
ON message_embeddings USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers
CREATE TRIGGER update_guidelines_updated_at BEFORE UPDATE ON guidelines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create functions
CREATE OR REPLACE FUNCTION search_guidelines_by_vector(
  query_embedding vector(1536),
  similarity_threshold FLOAT DEFAULT 0.7,
  max_results INT DEFAULT 20
)
RETURNS TABLE (
  id INTEGER,
  condition TEXT,
  action TEXT,
  category VARCHAR(100),
  priority INTEGER,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    g.id,
    g.condition,
    g.action,
    g.category,
    g.priority,
    1 - (g.condition_embedding <=> query_embedding) as similarity
  FROM guidelines g
  WHERE 
    g.active = true
    AND g.condition_embedding IS NOT NULL
    AND 1 - (g.condition_embedding <=> query_embedding) > similarity_threshold
  ORDER BY g.condition_embedding <=> query_embedding
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Function to get or create message embedding
CREATE OR REPLACE FUNCTION get_or_create_message_embedding(
  p_session_id VARCHAR(255),
  p_message_text TEXT,
  p_message_hash VARCHAR(64)
)
RETURNS message_embeddings AS $$
DECLARE
  v_result message_embeddings;
BEGIN
  SELECT * INTO v_result
  FROM message_embeddings
  WHERE message_hash = p_message_hash;
  
  IF NOT FOUND THEN
    INSERT INTO message_embeddings (session_id, message_hash, message_text)
    VALUES (p_session_id, p_message_hash, p_message_text)
    RETURNING * INTO v_result;
  END IF;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- View for analyzing guideline performance
CREATE OR REPLACE VIEW guideline_performance_analysis AS
SELECT 
  g.id,
  g.condition,
  g.category,
  g.priority,
  COUNT(DISTINCT gu.conversation_id) as total_uses,
  COUNT(CASE WHEN gu.applied = true THEN 1 END) as successful_uses,
  AVG(gu.score) as avg_total_score,
  CASE 
    WHEN COUNT(gu.id) > 0 
    THEN COUNT(CASE WHEN gu.applied = true THEN 1 END)::FLOAT / COUNT(gu.id) 
    ELSE 0 
  END as success_rate
FROM guidelines g
LEFT JOIN guideline_usage gu ON g.id = gu.guideline_id
WHERE g.active = true
GROUP BY g.id, g.condition, g.category, g.priority
ORDER BY total_uses DESC;

-- Function to clean up old embeddings
CREATE OR REPLACE FUNCTION cleanup_old_embeddings(days_to_keep INT DEFAULT 7)
RETURNS INT AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM message_embeddings
  WHERE created_at < NOW() - INTERVAL '1 day' * days_to_keep;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ========================================================================
-- Migration 2: Guideline usage tracking (20240102000000_guideline_usage_tracking.sql)
-- ========================================================================

-- Migration to change guideline tracking from simple IDs to usage counts
-- This enables fatigue system for guideline reuse

-- Add new column for tracking guideline usage counts
ALTER TABLE conversations 
ADD COLUMN guideline_usage JSONB DEFAULT '{}';

-- Migrate existing data from used_guideline_ids to guideline_usage
-- Convert array of IDs to object with counts (all set to 1)
UPDATE conversations
SET guideline_usage = (
  SELECT jsonb_object_agg(id::text, 1)
  FROM unnest(used_guideline_ids) AS id
)
WHERE used_guideline_ids IS NOT NULL AND array_length(used_guideline_ids, 1) > 0;

-- Drop the old column
ALTER TABLE conversations
DROP COLUMN used_guideline_ids;

-- Add index for better performance
CREATE INDEX idx_conversations_guideline_usage ON conversations USING GIN (guideline_usage);

-- Update the view to work with new structure
DROP VIEW IF EXISTS guideline_performance_analysis;

CREATE OR REPLACE VIEW guideline_performance_analysis AS
SELECT 
  g.id,
  g.condition,
  g.category,
  g.priority,
  COUNT(DISTINCT gu.conversation_id) as total_uses,
  COUNT(CASE WHEN gu.applied = true THEN 1 END) as successful_uses,
  AVG(gu.score) as avg_total_score,
  CASE 
    WHEN COUNT(gu.id) > 0 
    THEN COUNT(CASE WHEN gu.applied = true THEN 1 END)::FLOAT / COUNT(gu.id) 
    ELSE 0 
  END as success_rate,
  -- New: Average usage count per conversation
  COALESCE(
    AVG(
      CASE 
        WHEN c.guideline_usage ? g.id::text 
        THEN (c.guideline_usage->>(g.id::text))::int 
        ELSE 0 
      END
    ), 0
  ) as avg_uses_per_conversation
FROM guidelines g
LEFT JOIN guideline_usage gu ON g.id = gu.guideline_id
LEFT JOIN conversations c ON gu.conversation_id = c.id
WHERE g.active = true
GROUP BY g.id, g.condition, g.category, g.priority
ORDER BY total_uses DESC;

-- ========================================================================
-- Migration 3: Schema simplification (removing unused columns)
-- ========================================================================

-- Migration to simplify schema by removing unused columns

-- First drop the view that depends on these columns
DROP VIEW IF EXISTS guideline_performance_analysis;

-- Remove unused score breakdown columns from guideline_usage table
ALTER TABLE guideline_usage 
DROP COLUMN IF EXISTS vector_score,
DROP COLUMN IF EXISTS text_score,
DROP COLUMN IF EXISTS hybrid_score;

-- Recreate the view without the dropped columns
CREATE OR REPLACE VIEW guideline_performance_analysis AS
SELECT 
  g.id,
  g.condition,
  g.category,
  g.priority,
  COUNT(DISTINCT gu.conversation_id) as total_uses,
  COUNT(CASE WHEN gu.applied = true THEN 1 END) as successful_uses,
  AVG(gu.score) as avg_total_score,
  CASE 
    WHEN COUNT(gu.id) > 0 
    THEN COUNT(CASE WHEN gu.applied = true THEN 1 END)::FLOAT / COUNT(gu.id) 
    ELSE 0 
  END as success_rate,
  -- Average usage count per conversation
  COALESCE(
    AVG(
      CASE 
        WHEN c.guideline_usage ? g.id::text 
        THEN (c.guideline_usage->>(g.id::text))::int 
        ELSE 0 
      END
    ), 0
  ) as avg_uses_per_conversation
FROM guidelines g
LEFT JOIN guideline_usage gu ON g.id = gu.guideline_id
LEFT JOIN conversations c ON gu.conversation_id = c.id
WHERE g.active = true
GROUP BY g.id, g.condition, g.category, g.priority
ORDER BY total_uses DESC;

-- The remaining columns we keep are:
-- Guidelines table: All columns are used except timestamps could be dropped if not needed
-- Conversations table: All columns are actively used
-- Message_embeddings table: All columns are used for caching
-- Guideline_usage table: After removal will have id, guideline_id, conversation_id, score, applied, created_at

-- Optional: If timestamps are not needed:
-- ALTER TABLE guidelines DROP COLUMN IF EXISTS created_at, DROP COLUMN IF EXISTS updated_at;

-- ========================================================================
-- Migration 4: Remove unused relationships and metadata fields
-- ========================================================================

-- Remove the relationships field that was implemented but never used
ALTER TABLE guidelines DROP COLUMN IF EXISTS relationships;

-- Remove the metadata field that is stored but never used
ALTER TABLE guidelines DROP COLUMN IF EXISTS metadata;