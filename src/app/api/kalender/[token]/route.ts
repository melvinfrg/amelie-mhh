import { createClient } from "@supabase/supabase-js";
import { matchesFilter, toIcs } from "@/lib/ical";
import type { EventKind, FeedFilter } from "@/lib/types";

interface FeedRow {
  feed_name: string;
  feed_filter: FeedFilter;
  id: string | null;
  title: string | null;
  kind: EventKind;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  location: string | null;
  notes: string | null;
  subject_id: string | null;
  /** Missing until migration 0013 has run. */
  subject_ids?: string[] | null;
  subject_name: string | null;
  done: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Calendar apps poll this address without a login; the secret token in the URL is the only key.
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token.replace(/\.ics$/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !UUID.test(token)) return new Response("Kalender nicht gefunden", { status: 404 });

  const client = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await client.rpc("calendar_feed", { feed_token: token });
  if (error) return new Response("Kalender gerade nicht erreichbar", { status: 503 });
  const rows = (data ?? []) as FeedRow[];
  if (rows.length === 0) return new Response("Kalender nicht gefunden", { status: 404 });

  const { feed_name, feed_filter } = rows[0];
  const events = rows
    .filter((r) => r.id && matchesFilter(r, feed_filter ?? {}))
    .map((r) => ({ ...r, id: r.id!, title: r.title ?? "", subject: r.subject_name }));
  return new Response(toIcs(events, feed_name), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `inline; filename="kalender.ics"`,
      "cache-control": "private, max-age=300",
    },
  });
}
