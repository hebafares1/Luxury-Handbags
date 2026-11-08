import { createClient } from '@supabase/supabase-js';

const config = __ROSE_SUPABASE_CONFIG__;

export const isSupabaseConfigured = Boolean(config.url && config.publishableKey);

export const supabaseClient = isSupabaseConfigured
  ? createClient(config.url, config.publishableKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;
