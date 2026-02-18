import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

function csvEscape(v: unknown) {
  const s = String(v ?? "");
  if (/[\n\r,\"]/g.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

type Deliverable = {
  id: string;
  type: string;
  channel: string | null;
  format: string | null;
  language: string;
  due_date: string | null;
  status: string;
  assigned_to: string;
  link: string | null;
};

type MissionWithDeliverables = {
  id: string;
  title: string;
  status: string;
  assigned_to: string | null;
  due_date: string | null;
  scheduled_for: string | null;
  timezone: string;
  external_language: string;
  updated_at: string;
  mission_deliverables?: Deliverable[];
};

export async function GET() {
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profile?.role !== "ADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("missions")
    .select(
      [
        "id",
        "title",
        "status",
        "assigned_to",
        "due_date",
        "scheduled_for",
        "timezone",
        "external_language",
        "updated_at",
        "mission_deliverables(id,type,channel,format,language,due_date,status,assigned_to,link)",
      ].join(","),
    )
    .order("due_date", { ascending: true, nullsFirst: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const missions = (data ?? []) as unknown as MissionWithDeliverables[];

  const header = [
    "mission_id",
    "mission_title",
    "mission_status",
    "mission_assigned_to",
    "mission_due_date",
    "mission_scheduled_for",
    "mission_timezone",
    "mission_external_language",
    "deliverable_id",
    "deliverable_type",
    "deliverable_channel",
    "deliverable_format",
    "deliverable_language",
    "deliverable_due_date",
    "deliverable_status",
    "deliverable_assigned_to",
    "deliverable_link",
    "mission_updated_at",
  ];

  type Row = Record<(typeof header)[number], unknown>;

  const rows: Row[] = [];

  for (const m of missions) {
    const deliverables = m.mission_deliverables ?? [];

    if (deliverables.length === 0) {
      rows.push({
        mission_id: m.id,
        mission_title: m.title,
        mission_status: m.status,
        mission_assigned_to: m.assigned_to,
        mission_due_date: m.due_date,
        mission_scheduled_for: m.scheduled_for,
        mission_timezone: m.timezone,
        mission_external_language: m.external_language,
        deliverable_id: "",
        deliverable_type: "",
        deliverable_channel: "",
        deliverable_format: "",
        deliverable_language: "",
        deliverable_due_date: "",
        deliverable_status: "",
        deliverable_assigned_to: "",
        deliverable_link: "",
        mission_updated_at: m.updated_at,
      });
      continue;
    }

    for (const d of deliverables) {
      rows.push({
        mission_id: m.id,
        mission_title: m.title,
        mission_status: m.status,
        mission_assigned_to: m.assigned_to,
        mission_due_date: m.due_date,
        mission_scheduled_for: m.scheduled_for,
        mission_timezone: m.timezone,
        mission_external_language: m.external_language,
        deliverable_id: d.id,
        deliverable_type: d.type,
        deliverable_channel: d.channel,
        deliverable_format: d.format,
        deliverable_language: d.language,
        deliverable_due_date: d.due_date,
        deliverable_status: d.status,
        deliverable_assigned_to: d.assigned_to,
        deliverable_link: d.link,
        mission_updated_at: m.updated_at,
      });
    }
  }

  const csvRows = rows.map((r) => header.map((k) => csvEscape(r[k])).join(","));
  const csv = [header.join(","), ...csvRows].join("\n") + "\n";

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=mission-calendar.csv",
    },
  });
}
