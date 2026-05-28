-- Project Memory OS database schema
-- Execute this SQL script in your Supabase SQL Editor.

-- Enable UUID generation extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgvector extension for semantic vector search
CREATE EXTENSION IF NOT EXISTS "vector";

-- 1. PROFILES Table (Extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. PROJECTS Table
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. CONVERSATIONS Table
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    source_type TEXT NOT NULL, -- 'uploaded_chat', 'markdown', 'pdf', 'pasted_text'
    raw_content TEXT NOT NULL, -- Store raw original uploaded data
    processed_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. CONVERSATION CHUNKS Table (For pgvector embeddings)
CREATE TABLE IF NOT EXISTS public.conversation_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    content_chunk TEXT NOT NULL,
    embedding vector(384) NOT NULL, -- dimensions match all-MiniLM-L6-v2 (384)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. SUMMARIES Table
CREATE TABLE IF NOT EXISTS public.summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID UNIQUE NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    summary_text TEXT NOT NULL,
    key_takeaways JSONB NOT NULL DEFAULT '[]'::jsonb,
    technical_insights JSONB NOT NULL DEFAULT '[]'::jsonb,
    conversation_type TEXT, -- 'debugging', 'architecture', 'retro', 'planning', etc.
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. TASKS Table
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'todo', -- 'todo', 'in_progress', 'completed', 'blocked'
    priority TEXT NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    deadline TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. TAGS Table
CREATE TABLE IF NOT EXISTS public.tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#3B82F6', -- tailwind blue-500
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. CONVERSATION_TAGS Join Table
CREATE TABLE IF NOT EXISTS public.conversation_tags (
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES public.tags(id) ON DELETE CASCADE,
    PRIMARY KEY (conversation_id, tag_id)
);

-- 9. SESSIONS Table (Track user interactions and resumption states)
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    last_conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
    session_metadata JSONB NOT NULL DEFAULT '{}'::jsonb, -- Store UI state, scroll positions, resume context
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

---

-- INDEXING STRATEGY
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_project_id ON public.conversations(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_conversation_id ON public.tasks(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_chunks_conversation_id ON public.conversation_chunks(conversation_id);
CREATE INDEX IF NOT EXISTS idx_sessions_project_id ON public.sessions(project_id);

-- Create HNSW Index for pgvector
CREATE INDEX IF NOT EXISTS idx_conversation_chunks_embedding ON public.conversation_chunks 
USING hnsw (embedding vector_cosine_ops);

-- TRIGGERS FOR UPDATED_AT TIMESTAMP
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Helper to apply trigger if not exists
CREATE OR REPLACE FUNCTION public.create_trigger_if_not_exists(
    trigger_name TEXT,
    table_name TEXT,
    function_name TEXT
) RETURNS VOID AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = trigger_name
    ) THEN
        EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE PROCEDURE %I()', 
            trigger_name, table_name, function_name);
    END IF;
END;
$$ LANGUAGE plpgsql;

SELECT public.create_trigger_if_not_exists('update_profiles_modtime', 'profiles', 'update_modified_column');
SELECT public.create_trigger_if_not_exists('update_projects_modtime', 'projects', 'update_modified_column');
SELECT public.create_trigger_if_not_exists('update_conversations_modtime', 'conversations', 'update_modified_column');
SELECT public.create_trigger_if_not_exists('update_summaries_modtime', 'summaries', 'update_modified_column');
SELECT public.create_trigger_if_not_exists('update_tasks_modtime', 'tasks', 'update_modified_column');
SELECT public.create_trigger_if_not_exists('update_sessions_modtime', 'sessions', 'update_modified_column');

-- TRIGGER TO AUTOMATICALLY INSERT PROFILE FROM AUTH.USERS
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'full_name', ''),
        COALESCE(new.raw_user_meta_data->>'avatar_url', '')
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        avatar_url = EXCLUDED.avatar_url,
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger creation for handle_new_user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
