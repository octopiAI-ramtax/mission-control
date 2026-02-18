import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";

const COLUMNS = [
  "BACKLOG",
  "READY",
  "IN_PROGRESS",
  "REVIEW",
  "APPROVED",
  "SCHEDULED",
  "DONE",
  "BLOCKED",
] as const;

export default async function MissionsPage() {
  const supabase = await createSupabaseServer();
  const { data: missions, error } = await supabase
    .from("missions")
    .select("id,title,status,assigned_to,due_date,updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
        Failed to load missions: {error.message}
      </div>
    );
  }

  const grouped = new Map<string, typeof missions>();
  for (const c of COLUMNS) grouped.set(c, []);
  for (const m of missions || []) {
    const key = m.status as string;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(m);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Missions</h1>
          <p className="text-sm text-zinc-600">Kanban board (MVP). Drag/drop next.</p>
        </div>
        <Link
          href="/missions/new"
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white"
        >
          New mission
        </Link>
      </div>

      <div className="grid gap-3 overflow-x-auto" style={{ gridTemplateColumns: `repeat(${COLUMNS.length}, minmax(240px, 1fr))` }}>
        {COLUMNS.map((col) => (
          <div key={col} className="rounded-xl border border-zinc-200 bg-white">
            <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2">
              <h2 className="text-sm font-semibold">{col.replaceAll("_", " ")}</h2>
              <span className="text-xs text-zinc-500">{grouped.get(col)?.length || 0}</span>
            </div>
            <div className="flex flex-col gap-2 p-3">
              {(grouped.get(col) || []).map((m) => (
                <Link
                  key={m.id}
                  href={`/missions/${m.id}`}
                  className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 hover:bg-zinc-100"
                >
                  <div className="text-sm font-medium text-zinc-900">{m.title}</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-600">
                    {m.assigned_to ? (
                      <span className="rounded bg-white px-2 py-0.5 ring-1 ring-zinc-200">
                        {m.assigned_to}
                      </span>
                    ) : null}
                    {m.due_date ? (
                      <span className="rounded bg-white px-2 py-0.5 ring-1 ring-zinc-200">
                        due {m.due_date}
                      </span>
                    ) : null}
                  </div>
                </Link>
              ))}
              {(grouped.get(col) || []).length === 0 ? (
                <div className="rounded-lg border border-dashed border-zinc-200 p-3 text-xs text-zinc-500">
                  Empty
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
