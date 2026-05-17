-- ============================================================
-- MIGRATION 017: WhatsApp Notification Logs
-- ============================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    vacancy_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE,
    sent_at timestamp with time zone DEFAULT now(),
    status text CHECK (status IN ('pending', 'success', 'failed')),
    error_message text,
    retry_count integer DEFAULT 0
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_vacancy_id ON public.whatsapp_logs(vacancy_id);

-- Enable RLS
ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;

-- Admins can manage whatsapp logs
CREATE POLICY "Admins can manage whatsapp logs" 
ON public.whatsapp_logs 
FOR ALL 
USING (public.is_admin()) 
WITH CHECK (public.is_admin());
