import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Boxes, ClipboardCheck, FilePlus2, Info } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/auth/sign-out-button";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const supabase = await createServerSupabaseClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) redirect("/login");

  const { data: store, error: storeError } = await supabase
    .from("stores").select("id,name").eq("owner_user_id", auth.user.id).maybeSingle();

  const { data: deliveries, error: deliveriesError } = store
    ? await supabase.from("deliveries")
      .select("id,reference_number,delivery_date,status,created_at")
      .eq("store_id", store.id).order("created_at", { ascending: false }).limit(10)
    : { data: [], error: null };

  return (
    <div className="min-h-screen">
      <header className="border-b border-[#e5eae7] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4">
          <Link href="/" className="flex items-center gap-3 text-xl font-extrabold tracking-[-.045em]">
            <span className="brand-mark"><Boxes size={20}/></span>
            Kirana<span className="text-[#d46b2b]">Proof</span>
          </Link>
          <SignOutButton/>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-10">
        <p className="kicker">Private retailer workspace</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-[-.04em]">{store?.name ?? "Your delivery dashboard"}</h1>
            <p className="mt-2 text-sm text-[#6c7d85]">Signed in as {auth.user.email}</p>
          </div>
          <Link href="/deliveries/new" className="btn btn-primary"><FilePlus2 size={17}/> Open manual workbench <ArrowRight size={16}/></Link>
        </div>
        <div className="surface mt-7 rounded-[22px] p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <ClipboardCheck className="text-[#3f7363]"/>
            <h2 className="text-lg font-bold">Saved deliveries</h2>
          </div>
          {storeError || deliveriesError ? (
            <p className="mt-5 text-sm text-[#a74b35]">Couldn't load deliveries. Please try again.</p>
          ) : !store ? (
            <p className="mt-5 text-sm leading-6 text-[#6d7983]">Your account is ready. Store onboarding and saved deliveries are being implemented in this milestone.</p>
          ) : (deliveries?.length ?? 0) === 0 ? (
            <p className="mt-5 text-sm leading-6 text-[#6d7983]">No saved deliveries yet. Use the workbench to practice a complete comparison while persistence is being connected.</p>
          ) : (
            <div className="mt-5 divide-y divide-[#e9eded]">
              {(deliveries ?? []).map((delivery) => (
                <div key={delivery.id} className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm">
                  <div><strong>{delivery.reference_number}</strong><p className="mt-1 text-xs text-[#85939a]">{delivery.delivery_date}</p></div>
                  <span className="rounded-full bg-[#f3f6f4] px-3 py-1.5 text-xs font-bold text-[#4e685c]">{delivery.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-[#d9e4e7] bg-[#eef6f8] px-4 py-3 text-xs leading-5 text-[#536d78]">
          <Info size={18} className="shrink-0"/> This dashboard reads live account-scoped Supabase data. The manual workbench remains in-memory until authenticated saving is completed.
        </div>
      </main>
    </div>
  );
}
