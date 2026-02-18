import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";

export default async function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServer();

  const { data: run, error } = await supabase
    .from("runs")
    .select("id,mission_id,executor,status,input,output,created_at,started_at,finished_at")
    .eq("id", id)
    .single();

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
        Failed to load run: {error.message}
      </div>
    );
  }

  const { data: logs } = await supabase
    .from("run_logs")
    .select("id,level,message,meta,ts")
    .eq("run_id", id)
    .order("ts", { ascending: true })
    .limit(500);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/runs" className="text-sm text-zinc-600 hover:text-zinc-900">
          ← Runs
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">Run {run.id.slice(0, 8)}</h1>
        <p className="mt-1 text-sm text-zinc-600">
          {run.executor} · {run.status}
          {run.mission_id ? (
            <>
              {" "}· mission <Link className="text-blue-700 hover:underline" href={`/missions/${run.mission_id}`}>{run.mission_id.slice(0, 8)}</Link>
            </>
          ) : null}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 px-4 py-2 text-sm font-medium">Input</div>
          <pre className="overflow-auto p-4 text-xs">{JSON.stringify(run.input, null, 2)}</pre>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 px-4 py-2 text-sm font-medium">Output</div>
          <pre className="overflow-auto p-4 text-xs">{JSON.stringify(run.output, null, 2)}</pre>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-4 py-2 text-sm font-medium">Logs</div>
        <div className="divide-y divide-zinc-100">
          {(logs || []).map((l) => (
            <div key={l.id} className="px-4 py-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{l.level}</span>
                <span className="text-xs text-zinc-500">{new Date(l.ts).toLocaleString()}</span>
              </div>
              <div className="mt-1 whitespace-pre-wrap font-mono text-xs text-zinc-800">{l.message}</div>
              {l.meta ? <pre className="mt-1 overflow-auto text-xs text-zinc-600">{JSON.stringify(l.meta, null, 2)}</pre> : null}
            </div>
          ))}
          {(logs || []).length === 0 ? <div className="px-4 py-6 text-sm text-zinc-500">No logs for this run.</div> : null}
        </div>
      </div>
    </div>
  );
}
