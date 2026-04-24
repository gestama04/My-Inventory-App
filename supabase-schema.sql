-- ============================================
-- SCHEMA DO SUPABASE PARA MY INVENTORY APP
-- Execute este SQL no SQL Editor do Supabase
-- NOTA: Se der erro, executa cada secção separadamente
-- ============================================

-- ============================================
-- PARTE 1: CRIAR TABELAS
-- ============================================

-- 1) Perfil do utilizador
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  display_name TEXT,
  avatar_url TEXT,
  birth_date DATE,
  expo_push_token TEXT,
  last_token_update TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2) Itens do inventário
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  category TEXT,
  description TEXT,
  price NUMERIC,
  low_stock_threshold INTEGER,
  photo_url TEXT,
  photo_public_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3) Configurações do utilizador
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  global_low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4) Configurações de notificação
CREATE TABLE IF NOT EXISTS public.user_notification_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  interval_minutes INTEGER NOT NULL DEFAULT 60,
  low_stock_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  out_of_stock_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5) Histórico de itens
CREATE TABLE IF NOT EXISTS public.item_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  name TEXT,
  category TEXT,
  quantity INTEGER,
  action TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6) Notificações
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'general',
  read BOOLEAN NOT NULL DEFAULT FALSE,
  data JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- PARTE 2: CRIAR ÍNDICES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_inventory_user_created ON public.inventory_items (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_user_updated ON public.inventory_items (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_user_category ON public.inventory_items (user_id, category);
CREATE INDEX IF NOT EXISTS idx_history_user_timestamp ON public.item_history (user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_timestamp ON public.notifications (user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications (user_id, read);

-- ============================================
-- PARTE 3: HABILITAR ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PARTE 4: CRIAR POLICIES (RLS)
-- Se der erro "policy already exists", ignora
-- ============================================

-- Policies para profiles
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Policies para inventory_items
DROP POLICY IF EXISTS "inv_select_own" ON public.inventory_items;
CREATE POLICY "inv_select_own" ON public.inventory_items FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "inv_insert_own" ON public.inventory_items;
CREATE POLICY "inv_insert_own" ON public.inventory_items FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "inv_update_own" ON public.inventory_items;
CREATE POLICY "inv_update_own" ON public.inventory_items FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "inv_delete_own" ON public.inventory_items;
CREATE POLICY "inv_delete_own" ON public.inventory_items FOR DELETE USING (auth.uid() = user_id);

-- Policies para user_settings
DROP POLICY IF EXISTS "settings_select_own" ON public.user_settings;
CREATE POLICY "settings_select_own" ON public.user_settings FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "settings_insert_own" ON public.user_settings;
CREATE POLICY "settings_insert_own" ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "settings_update_own" ON public.user_settings;
CREATE POLICY "settings_update_own" ON public.user_settings FOR UPDATE USING (auth.uid() = user_id);

-- Policies para user_notification_settings
DROP POLICY IF EXISTS "notif_settings_select_own" ON public.user_notification_settings;
CREATE POLICY "notif_settings_select_own" ON public.user_notification_settings FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notif_settings_insert_own" ON public.user_notification_settings;
CREATE POLICY "notif_settings_insert_own" ON public.user_notification_settings FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notif_settings_update_own" ON public.user_notification_settings;
CREATE POLICY "notif_settings_update_own" ON public.user_notification_settings FOR UPDATE USING (auth.uid() = user_id);

-- Policies para item_history
DROP POLICY IF EXISTS "hist_select_own" ON public.item_history;
CREATE POLICY "hist_select_own" ON public.item_history FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "hist_insert_own" ON public.item_history;
CREATE POLICY "hist_insert_own" ON public.item_history FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "hist_delete_own" ON public.item_history;
CREATE POLICY "hist_delete_own" ON public.item_history FOR DELETE USING (auth.uid() = user_id);

-- Policies para notifications
DROP POLICY IF EXISTS "notif_select_own" ON public.notifications;
CREATE POLICY "notif_select_own" ON public.notifications FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notif_insert_own" ON public.notifications;
CREATE POLICY "notif_insert_own" ON public.notifications FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notif_update_own" ON public.notifications;
CREATE POLICY "notif_update_own" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notif_delete_own" ON public.notifications;
CREATE POLICY "notif_delete_own" ON public.notifications FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- PARTE 5: TRIGGER PARA ATUALIZAR updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_inventory_items_updated_at ON public.inventory_items;
CREATE TRIGGER update_inventory_items_updated_at
    BEFORE UPDATE ON public.inventory_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_settings_updated_at ON public.user_settings;
CREATE TRIGGER update_user_settings_updated_at
    BEFORE UPDATE ON public.user_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_notification_settings_updated_at ON public.user_notification_settings;
CREATE TRIGGER update_user_notification_settings_updated_at
    BEFORE UPDATE ON public.user_notification_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- PARTE 6: FUNÇÃO PARA CRIAR PERFIL AUTO
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- PARTE 7: HABILITAR REALTIME
-- Executa isto SEPARADAMENTE se der erro
-- ============================================
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_items;

-- ============================================
-- FEITO! Configurações adicionais:
-- 1. Authentication > Settings > Enable email confirmations
-- 2. Database > Replication > Habilitar inventory_items
-- ============================================
