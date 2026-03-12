-- Social Media Integration: social_accounts + social_posts
-- Run in Supabase SQL Editor

-- Store connected social accounts + OAuth tokens
CREATE TABLE IF NOT EXISTS social_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    platform TEXT NOT NULL DEFAULT 'twitter',
    platform_user_id TEXT NOT NULL DEFAULT '',
    platform_username TEXT,
    platform_display_name TEXT,
    platform_avatar_url TEXT,
    client_id TEXT NOT NULL,
    client_secret TEXT NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    connected_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, platform)
);

-- RLS
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own social accounts"
    ON social_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own social accounts"
    ON social_accounts FOR DELETE USING (auth.uid() = user_id);

-- Index
CREATE INDEX IF NOT EXISTS idx_social_accounts_user ON social_accounts(user_id);

-- Queue of AI-generated social posts awaiting approval
CREATE TABLE IF NOT EXISTS social_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    social_account_id UUID REFERENCES social_accounts(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    post_type TEXT DEFAULT 'tweet',
    status TEXT DEFAULT 'draft',
    ai_rationale TEXT,
    posted_at TIMESTAMPTZ,
    platform_post_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own social posts"
    ON social_posts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own social posts"
    ON social_posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own social posts"
    ON social_posts FOR DELETE USING (auth.uid() = user_id);

-- Index
CREATE INDEX IF NOT EXISTS idx_social_posts_user ON social_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_account ON social_posts(social_account_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_status ON social_posts(status);
