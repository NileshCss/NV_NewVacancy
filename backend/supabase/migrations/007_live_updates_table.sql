-- Migration 007: Live Updates Table (Real-time Ticker)
-- Purpose: Manage live updates (jobs, exams, deadlines, news) for the ticker
-- Last Updated: April 1, 2026

-- Create live_updates table
CREATE TABLE IF NOT EXISTS public.live_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  link TEXT,
  type TEXT NOT NULL CHECK (type IN ('job', 'exam', 'deadline', 'news')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent')),
  expiry_date TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS live_updates_is_active_idx ON public.live_updates(is_active);
CREATE INDEX IF NOT EXISTS live_updates_type_idx ON public.live_updates(type);
CREATE INDEX IF NOT EXISTS live_updates_priority_idx ON public.live_updates(priority);
CREATE INDEX IF NOT EXISTS live_updates_expiry_date_idx ON public.live_updates(expiry_date);
CREATE INDEX IF NOT EXISTS live_updates_created_at_idx ON public.live_updates(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.live_updates ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can insert, update, delete
CREATE POLICY "Admins can manage live updates" 
  ON public.live_updates 
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Policy: Anyone can SELECT active, non-expired updates (for ticker display)
CREATE POLICY "Anyone can view active updates" 
  ON public.live_updates 
  FOR SELECT 
  USING (
    is_active = true 
    AND (
      expiry_date IS NULL 
      OR expiry_date > NOW()
    )
  );

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_updates TO authenticated;
GRANT SELECT ON public.live_updates TO anon;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_updates;

-- Create helper function to clean expired updates
CREATE OR REPLACE FUNCTION cleanup_expired_updates()
RETURNS void AS $$
BEGIN
  UPDATE public.live_updates
  SET is_active = false
  WHERE expiry_date IS NOT NULL
    AND expiry_date < NOW()
    AND is_active = true;
END;
$$ LANGUAGE plpgsql;

-- Optional: Create trigger to auto-update 'updated_at' field
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_live_updates_updated_at
  BEFORE UPDATE ON public.live_updates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comment on table and columns
COMMENT ON TABLE public.live_updates IS 'Stores live updates (jobs, exams, deadlines, news) for the real-time ticker displayed on frontend';
COMMENT ON COLUMN public.live_updates.title IS 'Update title/content to display in ticker';
COMMENT ON COLUMN public.live_updates.link IS 'Optional URL to redirect when clicked';
COMMENT ON COLUMN public.live_updates.type IS 'Type of update: job, exam, deadline, or news';
COMMENT ON COLUMN public.live_updates.priority IS 'Priority level: normal or urgent (affects styling)';
COMMENT ON COLUMN public.live_updates.expiry_date IS 'When the update should expire and be hidden from ticker';
COMMENT ON COLUMN public.live_updates.is_active IS 'Whether the update is currently active/visible';
COMMENT ON COLUMN public.live_updates.created_at IS 'Timestamp when the update was created';
COMMENT ON COLUMN public.live_updates.updated_at IS 'Timestamp when the update was last modified';
