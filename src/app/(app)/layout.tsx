import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";

async function getProfile() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, engine, email")
    .eq("user_id", user.id)
    .maybeSingle();

  return { user, profile };
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await getProfile();

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <Link href="/missions" className="font-semibold tracking-tight">
              Mission Control
            </Link>
            <nav className="flex items-center gap-4 text-sm text-zinc-700">
              <Link href="/missions" className="hover:text-zinc-900">
                Missions
              </Link>
              <Link href="/runs" className="hover:text-zinc-900">
                Runs & Logs
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3 text-sm text-zinc-600">
            <span className="hidden sm:inline">
              {me?.profile?.role || ""}
              {me?.profile?.engine ? `/${me.profile.engine}` : ""}
            </span>
            <form
              action={async () => {
                "use server";
                const supabase = await createSupabaseServer();
                await supabase.auth.signOut();
              }}
            >
              <button className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm hover:bg-zinc-50">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-6">{children}</main>
    </div>
  );
}
