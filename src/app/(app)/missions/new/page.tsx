import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

export default function NewMissionPage() {
  async function create(formData: FormData) {
    "use server";
    const title = String(formData.get("title") || "").trim();
    const due = String(formData.get("due_date") || "").trim();

    if (!title) return;

    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profile?.role !== "ADMIN") throw new Error("Forbidden");

    const { data, error } = await supabase
      .from("missions")
      .insert({ title, created_by: user.id, due_date: due || null })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    redirect(`/missions/${data.id}`);
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-semibold tracking-tight">New mission</h1>
      <form action={create} className="mt-4 flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-700">Title</span>
          <input
            name="title"
            className="rounded-md border border-zinc-200 px-3 py-2 text-sm"
            placeholder="e.g., Launch Feb content batch"
            required
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-700">Due date</span>
          <input name="due_date" type="date" className="rounded-md border border-zinc-200 px-3 py-2 text-sm" />
        </label>
        <button className="mt-2 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white">Create</button>
      </form>
    </div>
  );
}
