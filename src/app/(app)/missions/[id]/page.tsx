import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";

const STATUSES = [
  "BACKLOG",
  "READY",
  "IN_PROGRESS",
  "REVIEW",
  "APPROVED",
  "SCHEDULED",
  "DONE",
  "BLOCKED",
] as const;

const SUBAGENTS = ["CORE", "VECTOR", "SHIELD", "KERNEL"] as const;

const DELIVERABLE_STATUSES = ["pending", "drafted", "in_review", "approved"] as const;

export default async function MissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const role = (profile?.role as string | undefined) ?? "";

  const { data: mission, error } = await supabase
    .from("missions")
    .select(
      "id,title,status,assigned_to,due_date,scheduled_for,timezone,schedule_notes,audience,objective,cta,internal_notes_en,external_language,created_at,updated_at,created_by",
    )
    .eq("id", id)
    .single();

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
        Failed to load mission: {error.message}
      </div>
    );
  }

  const { data: deliverables } = await supabase
    .from("mission_deliverables")
    .select("id,type,channel,format,language,due_date,status,assigned_to,link,notes,created_at,updated_at")
    .eq("mission_id", id)
    .order("created_at", { ascending: true });

  const { data: comments } = await supabase
    .from("mission_comments")
    .select("id,body,created_at,created_by")
    .eq("mission_id", id)
    .order("created_at", { ascending: true });

  const { data: attachments } = await supabase
    .from("mission_attachments")
    .select("id,url,label,created_at")
    .eq("mission_id", id)
    .order("created_at", { ascending: false });

  const { data: activity } = await supabase
    .from("mission_activity")
    .select("id,kind,before,after,created_at,created_by")
    .eq("mission_id", id)
    .order("created_at", { ascending: false })
    .limit(25);

  const canApprove = role === "ADMIN";
  const canEditMissionFields = role === "ADMIN";
  const canAdminWorkflow = role === "ADMIN";
  const canCreateDeliverables = role === "ADMIN";

  async function updateMission(formData: FormData) {
    "use server";
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

    const role = (profile?.role as string | undefined) ?? "";

    const { data: current } = await supabase
      .from("missions")
      .select("status")
      .eq("id", id)
      .single();

    if (!current) throw new Error("Not found");

    const canEdit = role === "ADMIN";
    if (!canEdit) throw new Error("Forbidden");

    const patch: Record<string, unknown> = {
      title: String(formData.get("title") || "").trim(),
      audience: String(formData.get("audience") || "").trim() || null,
      objective: String(formData.get("objective") || "").trim() || null,
      cta: String(formData.get("cta") || "").trim() || null,
      internal_notes_en: String(formData.get("internal_notes_en") || "").trim() || null,
      external_language: String(formData.get("external_language") || "es").trim() || "es",
      due_date: String(formData.get("due_date") || "").trim() || null,
      scheduled_for: String(formData.get("scheduled_for") || "").trim() || null,
      timezone: String(formData.get("timezone") || "America/Chicago").trim() || "America/Chicago",
      schedule_notes: String(formData.get("schedule_notes") || "").trim() || null,
    };

    // Workflow fields are ADMIN only (MVP) (status + assignment)
    if (role === "ADMIN") {
      const status = String(formData.get("status") || "");
      const assigned_to = String(formData.get("assigned_to") || "");

      if ((STATUSES as readonly string[]).includes(status)) patch.status = status;
      patch.assigned_to = (SUBAGENTS as readonly string[]).includes(assigned_to) ? assigned_to : null;
    }

    const { data: before } = await supabase
      .from("missions")
      .select("status,assigned_to")
      .eq("id", id)
      .single();

    const { error } = await supabase.from("missions").update(patch as never).eq("id", id);
    if (error) throw new Error(error.message);

    await supabase.from("mission_activity").insert({
      mission_id: id,
      kind: "mission.update",
      before,
      after: {
        status: (patch.status ?? before?.status) as unknown,
        assigned_to: (patch.assigned_to ?? before?.assigned_to) as unknown,
      },
      created_by: user.id,
    });

    redirect(`/missions/${id}`);
  }

  async function addComment(formData: FormData) {
    "use server";
    const body = String(formData.get("body") || "").trim();
    if (!body) return;

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

    await supabase.from("mission_comments").insert({ mission_id: id, body, created_by: user.id });
    await supabase.from("mission_activity").insert({
      mission_id: id,
      kind: "comment.add",
      after: { body_preview: body.slice(0, 200) },
      created_by: user.id,
    });

    redirect(`/missions/${id}`);
  }

  async function addAttachment(formData: FormData) {
    "use server";
    const url = String(formData.get("url") || "").trim();
    const label = String(formData.get("label") || "").trim();
    if (!url) return;

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

    const { error } = await supabase
      .from("mission_attachments")
      .insert({ mission_id: id, url, label: label || null, created_by: user.id });
    if (error) throw new Error(error.message);

    await supabase.from("mission_activity").insert({ mission_id: id, kind: "attachment.add", after: { url }, created_by: user.id });

    redirect(`/missions/${id}`);
  }

  async function submitForReview() {
    "use server";
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { error } = await supabase.rpc("submit_mission_for_review", { p_mission_id: id });
    if (error) throw new Error(error.message);

    redirect(`/missions/${id}`);
  }

  async function approve() {
    "use server";
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { error } = await supabase.rpc("approve_mission", { p_mission_id: id });
    if (error) throw new Error(error.message);

    redirect(`/missions/${id}`);
  }

  async function createDeliverable(formData: FormData) {
    "use server";
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

    const role = (profile?.role as string | undefined) ?? "";
    if (role !== "ADMIN") throw new Error("Forbidden");

    const type = String(formData.get("type") || "").trim();
    const assigned_to = String(formData.get("assigned_to") || "").trim();
    if (!(SUBAGENTS as readonly string[]).includes(assigned_to)) throw new Error("Invalid assignee");
    if (!type) return;

    const languageDefault = type === "internal_doc" || type === "engineering_task" ? "en" : "es";

    const { error } = await supabase.from("mission_deliverables").insert({
      mission_id: id,
      type,
      channel: String(formData.get("channel") || "").trim() || null,
      format: String(formData.get("format") || "").trim() || null,
      language: String(formData.get("language") || "").trim() || languageDefault,
      due_date: String(formData.get("due_date") || "").trim() || null,
      status: String(formData.get("status") || "pending").trim() || "pending",
      assigned_to,
      link: String(formData.get("link") || "").trim() || null,
      notes: String(formData.get("notes") || "").trim() || null,
      created_by: user.id,
    });

    if (error) throw new Error(error.message);

    await supabase.from("mission_activity").insert({
      mission_id: id,
      kind: "deliverable.create",
      after: { type, assigned_to },
      created_by: user.id,
    });

    redirect(`/missions/${id}`);
  }

  async function updateDeliverable(formData: FormData) {
    "use server";
    const deliverableId = String(formData.get("deliverable_id") || "").trim();
    if (!deliverableId) return;

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

    const patch = {
      status: String(formData.get("status") || "").trim() || null,
      link: String(formData.get("link") || "").trim() || null,
      notes: String(formData.get("notes") || "").trim() || null,
    } as Record<string, unknown>;

    const { error } = await supabase
      .from("mission_deliverables")
      .update(patch as never)
      .eq("id", deliverableId);

    if (error) throw new Error(error.message);

    await supabase.from("mission_activity").insert({
      mission_id: id,
      kind: "deliverable.update",
      after: { deliverable_id: deliverableId },
      created_by: user.id,
    });

    redirect(`/missions/${id}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/missions" className="text-sm text-zinc-600 hover:text-zinc-900">
            ← Missions
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{mission.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <form action={submitForReview}>
            <button className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50">
              Submit for Review
            </button>
          </form>
          {canApprove ? (
            <form action={approve}>
              <button className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white">Approve</button>
            </form>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <form action={updateMission} className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1 md:col-span-2">
                <span className="text-sm text-zinc-700">Title</span>
                <input
                  name="title"
                  defaultValue={mission.title}
                  className="rounded-md border border-zinc-200 px-3 py-2 text-sm"
                  disabled={!canEditMissionFields}
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm text-zinc-700">Status</span>
                {canAdminWorkflow ? (
                  <select name="status" defaultValue={mission.status} className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm">
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    defaultValue={mission.status}
                    className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
                    disabled
                  />
                )}
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm text-zinc-700">Assigned to (subagent)</span>
                {canAdminWorkflow ? (
                  <select name="assigned_to" defaultValue={mission.assigned_to || ""} className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm">
                    <option value="">Unassigned</option>
                    {SUBAGENTS.map((e) => (
                      <option key={e} value={e}>
                        {e}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    defaultValue={mission.assigned_to || ""}
                    className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
                    disabled
                  />
                )}
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm text-zinc-700">Due date</span>
                <input
                  name="due_date"
                  type="date"
                  defaultValue={mission.due_date || ""}
                  className="rounded-md border border-zinc-200 px-3 py-2 text-sm"
                  disabled={!canEditMissionFields}
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm text-zinc-700">External language (default es)</span>
                <input
                  name="external_language"
                  defaultValue={mission.external_language || "es"}
                  className="rounded-md border border-zinc-200 px-3 py-2 text-sm"
                  disabled={!canEditMissionFields}
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm text-zinc-700">Scheduled for (metadata only)</span>
                <input
                  name="scheduled_for"
                  type="datetime-local"
                  defaultValue={mission.scheduled_for ? new Date(mission.scheduled_for).toISOString().slice(0, 16) : ""}
                  className="rounded-md border border-zinc-200 px-3 py-2 text-sm"
                  disabled={!canAdminWorkflow}
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm text-zinc-700">Timezone</span>
                <input
                  name="timezone"
                  defaultValue={mission.timezone || "America/Chicago"}
                  className="rounded-md border border-zinc-200 px-3 py-2 text-sm"
                  disabled={!canAdminWorkflow}
                />
              </label>

              <label className="flex flex-col gap-1 md:col-span-2">
                <span className="text-sm text-zinc-700">Schedule notes</span>
                <textarea
                  name="schedule_notes"
                  defaultValue={mission.schedule_notes || ""}
                  className="min-h-16 rounded-md border border-zinc-200 px-3 py-2 text-sm"
                  disabled={!canAdminWorkflow}
                />
              </label>

              <label className="flex flex-col gap-1 md:col-span-2">
                <span className="text-sm text-zinc-700">Audience</span>
                <input
                  name="audience"
                  defaultValue={mission.audience || ""}
                  className="rounded-md border border-zinc-200 px-3 py-2 text-sm"
                  disabled={!canEditMissionFields}
                />
              </label>

              <label className="flex flex-col gap-1 md:col-span-2">
                <span className="text-sm text-zinc-700">Objective</span>
                <textarea
                  name="objective"
                  defaultValue={mission.objective || ""}
                  className="min-h-24 rounded-md border border-zinc-200 px-3 py-2 text-sm"
                  disabled={!canEditMissionFields}
                />
              </label>

              <label className="flex flex-col gap-1 md:col-span-2">
                <span className="text-sm text-zinc-700">CTA</span>
                <input
                  name="cta"
                  defaultValue={mission.cta || ""}
                  className="rounded-md border border-zinc-200 px-3 py-2 text-sm"
                  disabled={!canEditMissionFields}
                />
              </label>

              <label className="flex flex-col gap-1 md:col-span-2">
                <span className="text-sm text-zinc-700">Internal notes (English only)</span>
                <textarea
                  name="internal_notes_en"
                  defaultValue={mission.internal_notes_en || ""}
                  className="min-h-24 rounded-md border border-zinc-200 px-3 py-2 text-sm"
                  disabled={!canEditMissionFields}
                />
              </label>
            </div>

            {canEditMissionFields || canAdminWorkflow ? (
              <button className="mt-4 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white">Save</button>
            ) : (
              <div className="mt-4 text-xs text-zinc-500">You do not have permission to edit this mission.</div>
            )}
          </form>

          <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Deliverables</h2>
              <div className="text-xs text-zinc-500">Typed items (MVP)</div>
            </div>

            <div className="mt-3 flex flex-col gap-3">
              {(deliverables || []).map((d) => (
                <form key={d.id} action={updateDeliverable} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                  <input type="hidden" name="deliverable_id" value={d.id} />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-medium text-zinc-900">
                      {d.type} <span className="text-xs text-zinc-600">({d.assigned_to})</span>
                    </div>
                    <select name="status" defaultValue={d.status} className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs">
                      {DELIVERABLE_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-zinc-600">Link</span>
                      <input name="link" defaultValue={d.link || ""} className="rounded-md border border-zinc-200 px-2 py-1 text-xs" />
                    </label>
                    <label className="flex flex-col gap-1 md:col-span-2">
                      <span className="text-xs text-zinc-600">Notes</span>
                      <textarea name="notes" defaultValue={d.notes || ""} className="min-h-16 rounded-md border border-zinc-200 px-2 py-1 text-xs" />
                    </label>
                  </div>

                  <button className="mt-2 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs hover:bg-zinc-100">Update</button>
                </form>
              ))}

              {(deliverables || []).length === 0 ? <div className="text-xs text-zinc-500">No deliverables yet.</div> : null}
            </div>

            {canCreateDeliverables ? (
              <form action={createDeliverable} className="mt-4 grid grid-cols-1 gap-2 rounded-lg border border-dashed border-zinc-200 p-3 md:grid-cols-2">
                <div className="md:col-span-2 text-xs font-medium text-zinc-800">Add deliverable</div>
                <input name="type" className="rounded-md border border-zinc-200 px-2 py-1 text-xs" placeholder="type (e.g., blog)" required />
                <select name="assigned_to" className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs" defaultValue="VECTOR">
                  {SUBAGENTS.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
                <input name="channel" className="rounded-md border border-zinc-200 px-2 py-1 text-xs" placeholder="channel (optional)" />
                <input name="format" className="rounded-md border border-zinc-200 px-2 py-1 text-xs" placeholder="format (optional)" />
                <input name="language" className="rounded-md border border-zinc-200 px-2 py-1 text-xs" placeholder="language (default es, internal en)" />
                <input name="due_date" type="date" className="rounded-md border border-zinc-200 px-2 py-1 text-xs" />
                <select name="status" className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs" defaultValue="pending">
                  {DELIVERABLE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <input name="link" className="rounded-md border border-zinc-200 px-2 py-1 text-xs" placeholder="link (optional)" />
                <textarea name="notes" className="min-h-16 rounded-md border border-zinc-200 px-2 py-1 text-xs md:col-span-2" placeholder="notes (optional)" />
                <button className="self-start rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white">Create</button>
              </form>
            ) : null}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <h2 className="text-sm font-semibold">Comments / Handoffs</h2>
              <div className="mt-3 flex flex-col gap-2">
                {(comments || []).map((c) => (
                  <div key={c.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                    <div className="whitespace-pre-wrap text-sm text-zinc-900">{c.body}</div>
                    <div className="mt-2 text-xs text-zinc-600">{new Date(c.created_at).toLocaleString()}</div>
                  </div>
                ))}
                {(comments || []).length === 0 ? <div className="text-xs text-zinc-500">No comments yet.</div> : null}
              </div>
              <form action={addComment} className="mt-3 flex flex-col gap-2">
                <textarea name="body" className="min-h-20 rounded-md border border-zinc-200 px-3 py-2 text-sm" placeholder="Add a comment…" />
                <button className="self-start rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50">Post</button>
              </form>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <h2 className="text-sm font-semibold">Attachments / Links</h2>
              <div className="mt-3 flex flex-col gap-2">
                {(attachments || []).map((a) => (
                  <a
                    key={a.id}
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm hover:bg-zinc-100"
                  >
                    <div className="font-medium">{a.label || a.url}</div>
                    <div className="mt-1 text-xs text-zinc-600">{a.url}</div>
                  </a>
                ))}
                {(attachments || []).length === 0 ? <div className="text-xs text-zinc-500">No attachments yet.</div> : null}
              </div>
              <form action={addAttachment} className="mt-3 grid grid-cols-1 gap-2">
                <input name="label" className="rounded-md border border-zinc-200 px-3 py-2 text-sm" placeholder="Label (optional)" />
                <input name="url" className="rounded-md border border-zinc-200 px-3 py-2 text-sm" placeholder="https://…" required />
                <button className="self-start rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50">Add link</button>
              </form>
            </div>
          </div>
        </div>

        <aside className="flex flex-col gap-6">
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <h2 className="text-sm font-semibold">Activity (latest)</h2>
            <div className="mt-3 flex flex-col gap-2">
              {(activity || []).map((e) => (
                <div key={e.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                  <div className="text-xs font-medium text-zinc-900">{e.kind}</div>
                  <div className="mt-1 text-xs text-zinc-600">{new Date(e.created_at).toLocaleString()}</div>
                </div>
              ))}
              {(activity || []).length === 0 ? <div className="text-xs text-zinc-500">No activity yet.</div> : null}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <h2 className="text-sm font-semibold">Export</h2>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              <a className="text-blue-700 hover:underline" href={`/api/export/mission/${mission.id}`}>
                JSON export
              </a>
              <a className="text-blue-700 hover:underline" href={`/api/export/calendar.csv`}>
                Content calendar CSV
              </a>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
