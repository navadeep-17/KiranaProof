"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Boxes, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const supabase = createBrowserSupabaseClient();
      if (mode === "sign-up") {
        const { data, error: signupError } = await supabase.auth.signUp({ email, password });
        if (signupError) throw signupError;
        if (!data.session) {
          setMessage("Check your email for a confirmation link, then sign in.");
          return;
        }
      } else {
        const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
        if (loginError) throw loginError;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to authenticate.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f7f2] px-5 py-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="mb-14 inline-flex items-center gap-2 text-sm font-semibold text-[#6c7a83]">
          <ArrowLeft size={16}/> Back to KiranaProof
        </Link>
        <div className="mx-auto max-w-[450px]">
          <Link href="/" className="mb-6 flex items-center gap-3 text-2xl font-extrabold tracking-[-.06em]">
            <span className="brand-mark"><Boxes size={20}/></span>
            Kirana<span className="text-[#d46b2b]">Proof</span>
          </Link>
          <div className="surface rounded-[24px] p-6 sm:p-9">
            <p className="kicker">Retailer account</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-.05em]">
              {mode === "sign-in" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="mt-2 text-sm leading-6 text-[#6b7b89]">Your invoices and delivery records will belong only to your store.</p>
            <form onSubmit={submit} className="mt-7 space-y-4">
              <label className="block">
                <span className="field-label flex items-center gap-2"><Mail size={14}/> Email address</span>
                <input className="input" type="email" autoComplete="email" required
                  value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@shop.com"/>
              </label>
              <label className="block">
                <span className="field-label flex items-center gap-2"><LockKeyhole size={14}/> Password</span>
                <input className="input" type="password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} minLength={6} required
                  value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 6 characters"/>
              </label>
              {message && <p role="status" className="rounded-lg bg-[#edf8f0] px-3 py-2.5 text-sm text-[#21663b]">{message}</p>}
              {error && <p role="alert" className="rounded-lg bg-[#fff0e9] px-3 py-2.5 text-sm text-[#a1432a]">{error}</p>}
              <button disabled={busy} type="submit" className="btn btn-primary w-full">
                {busy ? "Please wait..." : mode === "sign-in" ? "Sign in" : "Create account"} <ArrowRight size={16}/>
              </button>
            </form>
            <div className="mt-6 border-t border-[#e9eeee] pt-5 text-center text-sm text-[#647483]">
              {mode === "sign-in" ? "New to KiranaProof?" : "Already have an account?"}{" "}
              <button type="button" className="font-bold text-[#a95327] underline underline-offset-4"
                onClick={() => { setMode(mode === "sign-in" ? "sign-up" : "sign-in"); setError(null); setMessage(null); }}>
                {mode === "sign-in" ? "Sign up" : "Sign in"}
              </button>
            </div>
          </div>
          <p className="mt-6 flex items-center justify-center gap-2 text-xs text-[#83918b]">
            <ShieldCheck size={16}/> Store data is isolated by account access controls.
          </p>
        </div>
      </div>
    </main>
  );
}
