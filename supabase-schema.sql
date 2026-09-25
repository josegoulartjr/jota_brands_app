-- ============================================
-- SCHEMA: App Jota Financeiro
-- Execute este SQL no Supabase SQL Editor
-- ============================================

-- Tabela de clientes
CREATE TABLE IF NOT EXISTS clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de jobs
CREATE TABLE IF NOT EXISTS jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('hora', 'fechado')),
  hours NUMERIC(10,2),
  hourly_rate NUMERIC(10,2) NOT NULL DEFAULT 40.00,
  fixed_value NUMERIC(10,2),
  clickup_url TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovacao', 'concluido', 'faturado')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de transações financeiras
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  description TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('entrada', 'saida')),
  amount NUMERIC(10,2) NOT NULL,
  category TEXT NOT NULL DEFAULT 'Geral',
  date DATE NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de configurações
CREATE TABLE IF NOT EXISTS settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pix_key TEXT NOT NULL DEFAULT '',
  pix_key_type TEXT NOT NULL DEFAULT 'cnpj',
  company_name TEXT NOT NULL DEFAULT 'Jota Agência',
  payment_link TEXT,
  hourly_rate NUMERIC(10,2) NOT NULL DEFAULT 40.00
);

-- Inserir configurações padrão
INSERT INTO settings (pix_key, pix_key_type, company_name, hourly_rate)
VALUES ('', 'cnpj', 'Jota Agência', 40.00)
ON CONFLICT DO NOTHING;

-- Clientes de exemplo (opcional - remova se quiser começar vazio)
-- INSERT INTO clients (name, color) VALUES
--   ('Cliente A', '#6366f1'),
--   ('Cliente B', '#f59e0b'),
--   ('Cliente C', '#10b981');

-- Tabela de inscrições de push notification (Web Push)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_jobs_client_id ON jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_jobs_period ON jobs(period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE public.clients      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Acesso total para usuários autenticados (app interno da agência)
CREATE POLICY "Authenticated can do everything on clients"
  ON public.clients FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated can do everything on jobs"
  ON public.jobs FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated can do everything on transactions"
  ON public.transactions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated can do everything on settings"
  ON public.settings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- push_subscriptions: cada usuário só gerencia a própria inscrição,
-- mas qualquer autenticado pode ler todas (necessário para o envio
-- de notificações em grupo, ex: "job mudou de status").
CREATE POLICY "Authenticated can read all push subscriptions"
  ON public.push_subscriptions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users manage their own push subscription"
  ON public.push_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete their own push subscription"
  ON public.push_subscriptions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================
-- MIGRATION: Job tipo "Pacote" (ex: Pack Social Media — 10 conteúdos
-- fechados por um valor único, entregues ao longo de vários meses)
-- Execute este SQL no Supabase SQL Editor
-- ============================================

DO $$
DECLARE
  con_name text;
BEGIN
  -- Localiza a constraint de check existente sobre a coluna "type"
  -- (o nome pode variar) e a substitui por uma que aceita 'pacote'.
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'public.jobs'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%hora%'
    AND pg_get_constraintdef(oid) ILIKE '%fechado%';

  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.jobs DROP CONSTRAINT %I', con_name);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_type_check') THEN
    ALTER TABLE public.jobs ADD CONSTRAINT jobs_type_check CHECK (type IN ('hora', 'fechado', 'pacote'));
  END IF;
END $$;

-- pack_delivered/pack_total: contador de progresso do pacote (ex: 7 de 10)
-- pack_origin_month/pack_origin_year: tag fixa do período de origem do pacote
--   (nunca muda depois de criado, ex: "Jul/2026")
-- completed_at: preenchido automaticamente quando pack_delivered atinge
--   pack_total — é nesse momento que period_month/period_year (usados no
--   faturamento) são ajustados para o mês em que o pacote de fato fechou
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS pack_delivered INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS pack_total INTEGER NOT NULL DEFAULT 10;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS pack_origin_month INTEGER CHECK (pack_origin_month BETWEEN 1 AND 12);
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS pack_origin_year INTEGER;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- ============================================
-- MIGRATION: Comentários em jobs + links dos itens do Pacote
-- Execute este SQL no Supabase SQL Editor
-- ============================================

-- Histórico de comentários por job (uso interno, não aparece na fatura)
CREATE TABLE IF NOT EXISTS public.job_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Links dos conteúdos individuais do ClickUp que compõem um job tipo "pacote".
-- A quantidade de linhas aqui é a própria fonte da verdade do contador
-- pack_delivered (ver computePackProgress em src/lib/utils.ts).
CREATE TABLE IF NOT EXISTS public.pack_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Título do card no ClickUp, exibido no lugar da URL (modal e fatura).
ALTER TABLE public.pack_items ADD COLUMN IF NOT EXISTS title TEXT;

CREATE INDEX IF NOT EXISTS idx_job_comments_job_id ON public.job_comments(job_id);
CREATE INDEX IF NOT EXISTS idx_pack_items_job_id ON public.pack_items(job_id);

ALTER TABLE public.job_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pack_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'job_comments'
      AND policyname = 'Authenticated can do everything on job_comments'
  ) THEN
    CREATE POLICY "Authenticated can do everything on job_comments"
      ON public.job_comments FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pack_items'
      AND policyname = 'Authenticated can do everything on pack_items'
  ) THEN
    CREATE POLICY "Authenticated can do everything on pack_items"
      ON public.pack_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  -- Leitura pública (sem login): permite que a página /fatura/[token] mostre
  -- os links dos conteúdos entregues pro cliente final.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pack_items'
      AND policyname = 'Anyone can view pack_items'
  ) THEN
    CREATE POLICY "Anyone can view pack_items"
      ON public.pack_items FOR SELECT TO anon USING (true);
  END IF;
END $$;
