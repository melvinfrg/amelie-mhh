"use client";

import { useEffect, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { hasSupabase, supabase } from "@/lib/supabase";
import { resetCache } from "@/lib/useTable";
import { Button, Card, Field, TextInput } from "./ui";

export function AuthGate({ children }: { children: (session: Session | null) => ReactNode }) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(hasSupabase);

  useEffect(() => {
    if (!hasSupabase) return;
    supabase()
      .auth.getSession()
      .then(({ data }) => {
        setSession(data.session);
        setChecking(false);
      });
    const { data } = supabase().auth.onAuthStateChange((_event, next) => {
      setSession((prev) => {
        if (prev?.user.id !== next?.user.id) resetCache();
        return next;
      });
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Everything below works with browser-only data, so it renders on the client only.
  if (!mounted || checking) return <div className="p-8 text-sm text-stone-500">Lädt …</div>;
  if (hasSupabase && !session) return <Login />;
  return <>{children(session)}</>;
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const auth = supabase().auth;
    const { error } =
      mode === "login"
        ? await auth.signInWithPassword({ email, password })
        : await auth.signUp({ email, password });
    setBusy(false);
    if (error) setMessage(error.message);
    else if (mode === "signup") setMessage("Konto erstellt. Bitte bestätige die E-Mail und melde dich dann an.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <h1 className="text-xl font-semibold">Amelie &amp; Melvin</h1>
        <p className="mb-4 mt-1 text-sm text-stone-500">{mode === "login" ? "Anmelden" : "Konto erstellen"}</p>
        <form onSubmit={submit} className="space-y-3">
          <Field label="E-Mail">
            <TextInput type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Passwort">
            <TextInput type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          {message && <p className="text-sm text-stone-600 dark:text-stone-300">{message}</p>}
          <Button type="submit" disabled={busy} className="w-full">
            {mode === "login" ? "Anmelden" : "Registrieren"}
          </Button>
        </form>
        <button
          className="mt-3 text-xs text-stone-500 underline"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
        >
          {mode === "login" ? "Noch kein Konto? Registrieren" : "Zurück zur Anmeldung"}
        </button>
      </Card>
    </main>
  );
}
