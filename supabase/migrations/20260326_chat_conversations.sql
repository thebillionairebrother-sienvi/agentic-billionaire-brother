-- Multi-Strategy Chat: Persistent Conversations & Messages
-- Run this in Supabase SQL Editor

-- ─── Chat Conversations ───
CREATE TABLE IF NOT EXISTS chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  execution_contract_id UUID REFERENCES execution_contracts(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'New Conversation',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Chat Messages ───
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'derek')),
  content TEXT NOT NULL,
  reaction TEXT,
  task_updates JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Indexes ───
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id ON chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_contract ON chat_conversations(execution_contract_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);

-- ─── RLS ───
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own conversations"
  ON chat_conversations FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own messages"
  ON chat_messages FOR ALL
  USING (conversation_id IN (SELECT id FROM chat_conversations WHERE user_id = auth.uid()));
