import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True when Supabase is configured. Without it the app runs in demo mode (data stays in this browser). */
export const hasSupabase = Boolean(url && key);

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!hasSupabase) throw new Error("Supabase ist nicht konfiguriert");
  client ??= createClient(url!, key!);
  return client;
}
