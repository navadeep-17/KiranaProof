"use client";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export function SignOutButton() {
  const router = useRouter();
  async function signOut() {
    const client = createBrowserSupabaseClient();
    const { error } = await client.auth.signOut();
    if (error) { alert(error.message); return; }
    router.replace("/login");
    router.refresh();
  }
  return <button className="btn btn-outline" type="button" onClick={signOut}>
    <LogOut size={16}/> Sign out
  </button>;
}
