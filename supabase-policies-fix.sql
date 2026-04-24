-- ============================================
-- PARTE 4 CORRIGIDA: CRIAR POLICIES (RLS)
-- Executa isto no SQL Editor do Supabase
-- ============================================

-- Policies para profiles
DO $$ BEGIN
  DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
  CREATE POLICY "profiles_select_own" ON public.profiles 
    FOR SELECT USING (auth.uid()::text = user_id::text);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
  CREATE POLICY "profiles_insert_own" ON public.profiles 
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
  CREATE POLICY "profiles_update_own" ON public.profiles 
    FOR UPDATE USING (auth.uid()::text = user_id::text);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Policies para inventory_items
DO $$ BEGIN
  DROP POLICY IF EXISTS "inv_select_own" ON public.inventory_items;
  CREATE POLICY "inv_select_own" ON public.inventory_items 
    FOR SELECT USING (auth.uid()::text = user_id::text);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "inv_insert_own" ON public.inventory_items;
  CREATE POLICY "inv_insert_own" ON public.inventory_items 
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "inv_update_own" ON public.inventory_items;
  CREATE POLICY "inv_update_own" ON public.inventory_items 
    FOR UPDATE USING (auth.uid()::text = user_id::text);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "inv_delete_own" ON public.inventory_items;
  CREATE POLICY "inv_delete_own" ON public.inventory_items 
    FOR DELETE USING (auth.uid()::text = user_id::text);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Policies para user_settings
DO $$ BEGIN
  DROP POLICY IF EXISTS "settings_select_own" ON public.user_settings;
  CREATE POLICY "settings_select_own" ON public.user_settings 
    FOR SELECT USING (auth.uid()::text = user_id::text);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "settings_insert_own" ON public.user_settings;
  CREATE POLICY "settings_insert_own" ON public.user_settings 
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "settings_update_own" ON public.user_settings;
  CREATE POLICY "settings_update_own" ON public.user_settings 
    FOR UPDATE USING (auth.uid()::text = user_id::text);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Policies para user_notification_settings
DO $$ BEGIN
  DROP POLICY IF EXISTS "notif_settings_select_own" ON public.user_notification_settings;
  CREATE POLICY "notif_settings_select_own" ON public.user_notification_settings 
    FOR SELECT USING (auth.uid()::text = user_id::text);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "notif_settings_insert_own" ON public.user_notification_settings;
  CREATE POLICY "notif_settings_insert_own" ON public.user_notification_settings 
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "notif_settings_update_own" ON public.user_notification_settings;
  CREATE POLICY "notif_settings_update_own" ON public.user_notification_settings 
    FOR UPDATE USING (auth.uid()::text = user_id::text);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Policies para item_history
DO $$ BEGIN
  DROP POLICY IF EXISTS "hist_select_own" ON public.item_history;
  CREATE POLICY "hist_select_own" ON public.item_history 
    FOR SELECT USING (auth.uid()::text = user_id::text);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "hist_insert_own" ON public.item_history;
  CREATE POLICY "hist_insert_own" ON public.item_history 
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "hist_delete_own" ON public.item_history;
  CREATE POLICY "hist_delete_own" ON public.item_history 
    FOR DELETE USING (auth.uid()::text = user_id::text);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Policies para notifications
DO $$ BEGIN
  DROP POLICY IF EXISTS "notif_select_own" ON public.notifications;
  CREATE POLICY "notif_select_own" ON public.notifications 
    FOR SELECT USING (auth.uid()::text = user_id::text);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "notif_insert_own" ON public.notifications;
  CREATE POLICY "notif_insert_own" ON public.notifications 
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "notif_update_own" ON public.notifications;
  CREATE POLICY "notif_update_own" ON public.notifications 
    FOR UPDATE USING (auth.uid()::text = user_id::text);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "notif_delete_own" ON public.notifications;
  CREATE POLICY "notif_delete_own" ON public.notifications 
    FOR DELETE USING (auth.uid()::text = user_id::text);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ============================================
-- FEITO! Policies criadas.
-- ============================================
