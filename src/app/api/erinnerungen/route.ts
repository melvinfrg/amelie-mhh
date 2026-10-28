import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { reminderMessage } from "@/lib/examReminder";

interface DueRow {
  event_id: string;
  title: string;
  starts_at: string;
  all_day: boolean;
  location: string | null;
  endpoint: string;
  p256dh: string;
  auth: string;
}

// Vercel Cron calls this once a day (vercel.json) with "Authorization: Bearer <CRON_SECRET>". Every exam that is
// now three months or less away gets one push on each of its owner's devices, then counts as reminded.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Nicht erlaubt", { status: 401 });
  if (!url || !key || !publicKey || !privateKey) return new Response("Push ist nicht eingerichtet", { status: 503 });

  webpush.setVapidDetails(`mailto:${process.env.VAPID_CONTACT ?? "noreply@amelie-mhh.vercel.app"}`, publicKey, privateKey);
  const client = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await client.rpc("exam_reminders_due", { cron_token: secret });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as DueRow[];
  const sent = new Set<string>();
  const gone: string[] = [];
  await Promise.all(
    rows.map(async (r) => {
      const message = reminderMessage(r);
      try {
        await webpush.sendNotification(
          { endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } },
          JSON.stringify({ ...message, tag: `pruefung-${r.event_id}`, url: "/termine" }),
          { TTL: 60 * 60 * 24, urgency: "normal" },
        );
        sent.add(r.event_id);
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) gone.push(r.endpoint);
      }
    }),
  );

  // An exam counts as reminded once it reached at least one device; otherwise it is tried again tomorrow.
  if (sent.size) {
    const { error } = await client.rpc("mark_exams_reminded", { cron_token: secret, event_ids: [...sent] });
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }
  if (gone.length) await client.rpc("forget_push_endpoints", { cron_token: secret, endpoints: gone });
  return Response.json({ reminded: sent.size, devicesRemoved: gone.length });
}
