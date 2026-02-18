import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";

export default async function RunsPage({
  searchParams,
}: {
  searchParams: Promise<{ executor?: string; status?: string; mission?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createSupabaseServer();

  let q = supabase
    .from("runs")
    .select("id,mission_id,executor,status,created_at,started_at,finished_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (sp.executor) q = q.eq("executor", sp.executor);
  if (sp.status) q = q.eq("status", sp.status);
  if (sp.mission) q = q.eq("mission_id", sp.mission);

  const { data: runs, error } = await q;

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
        Failed to load runs: {error.message}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Runs & Logs</h1>
        <p className="text-sm text-zinc-600">Audit trail (MVP). Click a run for input/output/logs.</p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-4 py-2 text-sm font-medium">Latest runs</div>
        <div className="divide-y divide-zinc-100">
          {(runs || []).map((r) => (
            <Link
              key={r.id}
              href={`/runs/${r.id}`}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-zinc-50"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-zinc-600">{r.id.slice(0, 8)}</span>
                <span className="rounded bg-zinc-900 px-2 py-0.5 text-xs font-medium text-white">{r.executor}</span>
                <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs">{r.status}</span>
              </div>
              <div className="text-xs text-zinc-600">
                {new Date(r.created_at).toLocaleString()} {r.mission_id ? `· mission ${r.mission_id.slice(0, 8)}` : ""}
              </div>
            </Link>
          ))}
          {(runs || []).length === 0 ? <div className="px-4 py-6 text-sm text-zinc-500">No runs yet.</div> : null}
        </div>
      </div>
    </div>
  );
}
