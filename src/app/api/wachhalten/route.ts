import { createClient } from "@supabase/supabase-js";

// Supabase pauses free projects after about a week without database activity. Vercel Cron calls this once a day
// (vercel.json), which runs one tiny query against the database so the project always counts as active.
// No extra setup: it uses the Supabase variables the site already has. If CRON_SECRET is set, Vercel sends it along
// and only those calls are let through.

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Nicht erlaubt", { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return new Response("Supabase ist nicht eingerichtet", { status: 503 });

  const client = createClient(url, key, { auth: { persistSession: false } });
  // Row level security hides every row from this anonymous call, but Postgres still runs the query, and that counts.
  const { error } = await client.from("settings").select("*", { count: "exact", head: true });
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true, at: new Date().toISOString() });
}
