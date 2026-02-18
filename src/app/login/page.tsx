import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import LoginForm from "./ui";

export default async function LoginPage(props: { searchParams: Promise<{ next?: string }> }) {
  const searchParams = await props.searchParams;
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect(searchParams.next || "/missions");

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <main className="mx-auto flex max-w-md flex-col gap-6 px-6 py-16">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mission Control</h1>
          <p className="mt-2 text-sm text-zinc-300">Sign in to continue.</p>
        </div>
        <LoginForm nextPath={searchParams.next || "/missions"} />
      </main>
    </div>
  );
}
