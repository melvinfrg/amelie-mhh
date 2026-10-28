// Push-Benachrichtigungen auf diesem Gerät an- und abmelden. Der Server (/api/erinnerungen) schickt damit
// die Erinnerung 3 Monate vor jeder Prüfung. Auf dem iPhone geht das nur in der App vom Home-Bildschirm (ab iOS 16.4).
import { hasSupabase, supabase } from "./supabase";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export type PushState = "unsupported" | "install" | "unconfigured" | "denied" | "off" | "on";

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

function keyBytes(base64url: string) {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

async function registration() {
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

export async function pushState(): Promise<PushState> {
  if (!hasSupabase || !PUBLIC_KEY) return "unconfigured";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return isIos() && !isStandalone() ? "install" : "unsupported";
  }
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "on" : "off";
}

/** Asks for permission (must run from a tap) and stores this device's address for the account. */
export async function enablePush() {
  if ((await Notification.requestPermission()) !== "granted") throw new Error("Benachrichtigungen wurden nicht erlaubt.");
  const reg = await registration();
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(PUBLIC_KEY) }));
  const json = sub.toJSON();
  const { error } = await supabase()
    .from("push_subscriptions")
    .upsert(
      { endpoint: sub.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth, device: navigator.userAgent.slice(0, 200) },
      { onConflict: "user_id,endpoint" },
    );
  if (error) {
    await sub.unsubscribe();
    throw error;
  }
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await supabase().from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
}

function base64url(bytes: ArrayBuffer | Uint8Array) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * One-time setup, all in this browser: a VAPID key pair for sending pushes, the cron secret, and the SQL line that
 * stores the secret's hash in Supabase. Nothing is sent anywhere.
 */
export async function createPushSetup() {
  const pair = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const publicKey = base64url(await crypto.subtle.exportKey("raw", pair.publicKey));
  const privateKey = (await crypto.subtle.exportKey("jwk", pair.privateKey)).d!;
  const cronSecret = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(cronSecret)))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return {
    env: { NEXT_PUBLIC_VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey, CRON_SECRET: cronSecret },
    sql: `insert into cron_secret (hash) values ('${hash}') on conflict (id) do update set hash = excluded.hash;`,
  };
}
