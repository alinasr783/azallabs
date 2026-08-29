-- =========================================================
-- Azal Labs AI Agent - Complete Supabase Schema
-- =========================================================

-- 1. تفعيل الإضافات اللازمة (UUID Generation)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. جدول إعدادات الـ AI Agent والـ System Prompt ونماذج الـ LLM والذاكرة الدائمة
CREATE TABLE IF NOT EXISTS public.agent_settings (
    id TEXT PRIMARY KEY DEFAULT 'default_config',
    system_prompt TEXT NOT NULL,
    permanent_memory TEXT,
    llm_config JSONB DEFAULT '{
        "activeProvider": "gemini",
        "gemini": { "apiKey": "", "model": "gemini-2.5-flash" },
        "openai": { "apiKey": "", "model": "gpt-4o-mini" },
        "deepseek": { "apiKey": "", "model": "deepseek-chat", "endpoint": "https://api.deepseek.com/chat/completions" },
        "custom": { "apiKey": "", "model": "llama-3.3-70b-versatile", "endpoint": "https://api.groq.com/openai/v1/chat/completions" }
    }'::jsonb,
    temperature NUMERIC DEFAULT 0.7,
    max_steps INTEGER DEFAULT 12,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- إضافة الأعمدة إذا كان الجدول موجوداً مسبقاً
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='agent_settings' AND column_name='permanent_memory') THEN
        ALTER TABLE public.agent_settings ADD COLUMN permanent_memory TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='agent_settings' AND column_name='llm_config') THEN
        ALTER TABLE public.agent_settings ADD COLUMN llm_config JSONB;
    END IF;
END $$;

-- إدراج الإعدادات الافتراضية الأولية
INSERT INTO public.agent_settings (id, system_prompt, permanent_memory, is_active)
VALUES (
    'default_config',
    'أنت مساعد رقمي ووكيل ذكي متقدم لنظام Azal Labs، تعمل بدقة وتجيب بوضوح ومباشرة على استفسارات ومهام المستخدمين بدون هلوسة.',
    '# 🧠 ملف الذاكرة الدائمة للمستخدم (User Memory)

## 1. البيانات الشخصية (Personal Profile)
- الدور: مطور ومؤسس مشاريع برمجية
- اللغة المفضلة: العربية (مع كتابة المصطلحات التقنية بدقة)

## 2. تفضيلات أسلوب العمل (Preferences & Working Style)
- يفضل الإجابات المباشرة والعملية ذات النتائج المؤكدة بدون حشو.
- يفضل تنظيم المهام عبر قوائم ToDo List التفاعلية (Claude Code style).
- تطبيق مبدأ الصدق التام وعدم الهلوسة نهائياً (Zero Hallucination).

## 3. المشاريع النشطة (Active Projects)
- **800 Academy**: منصة تعليمية رقمية متكاملة لتدريس ومتابعة اختبارات EST و SAT.
- **TickTick Integration**: إدارة وجدولة المهام ومزامنتها فورياً مع تطبيق الهاتف.
- **Azal Labs**: النظام الأساسي للوكيل الذكي وإدارة خوادم الـ MCP ومزودي الذكاء الاصطناعي.',
    TRUE
)
ON CONFLICT (id) DO UPDATE SET
    updated_at = NOW();

-- 3. جدول خوادم بروتوكول MCP (Model Context Protocol)
CREATE TABLE IF NOT EXISTS public.mcp_servers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    service TEXT DEFAULT 'custom',
    auth_token TEXT,
    status TEXT DEFAULT 'connected',
    is_enabled BOOLEAN DEFAULT TRUE,
    tools JSONB DEFAULT '[]'::jsonb,
    connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- إضافة الأعمدة لخوادم الـ MCP إن لم تكن موجودة
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='mcp_servers' AND column_name='auth_token') THEN
        ALTER TABLE public.mcp_servers ADD COLUMN auth_token TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='mcp_servers' AND column_name='is_enabled') THEN
        ALTER TABLE public.mcp_servers ADD COLUMN is_enabled BOOLEAN DEFAULT TRUE;
    END IF;
END $$;

-- 4. جدول قوائم المهام التفاعلية (Claude Code ToDo Lists)
CREATE TABLE IF NOT EXISTS public.todo_lists (
    id TEXT PRIMARY KEY DEFAULT 'current_todo',
    title TEXT NOT NULL,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. جدول جلسات المهام والمحادثات (Task Sessions / Conversations)
CREATE TABLE IF NOT EXISTS public.conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'مهمة عمل جديدة',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. جدول الرسائل (Messages)
CREATE TABLE IF NOT EXISTS public.messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT REFERENCES public.conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. تفعيل وتأمين سياسات الأمان (Row Level Security - RLS)
ALTER TABLE public.agent_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.todo_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- سياسات الوصول العام المباشر (للتشغيل السلس مع المفتاح العام anon key)
DROP POLICY IF EXISTS "Allow all for agent_settings" ON public.agent_settings;
CREATE POLICY "Allow all for agent_settings" ON public.agent_settings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for mcp_servers" ON public.mcp_servers;
CREATE POLICY "Allow all for mcp_servers" ON public.mcp_servers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for todo_lists" ON public.todo_lists;
CREATE POLICY "Allow all for todo_lists" ON public.todo_lists FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for conversations" ON public.conversations;
CREATE POLICY "Allow all for conversations" ON public.conversations FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for messages" ON public.messages;
CREATE POLICY "Allow all for messages" ON public.messages FOR ALL USING (true) WITH CHECK (true);

-- 8. جدول المشاريع (Projects)
CREATE TABLE IF NOT EXISTS public.projects (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    website_url TEXT,
    logo_url TEXT,
    project_memory TEXT DEFAULT '',
    files JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for projects" ON public.projects;
CREATE POLICY "Allow all for projects" ON public.projects FOR ALL USING (true) WITH CHECK (true);

