import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const { data: mission, error } = await supabase
    .from("missions")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: deliverables } = await supabase
    .from("mission_deliverables")
    .select("*")
    .eq("mission_id", id)
    .order("created_at", { ascending: true });

  const { data: comments } = await supabase
    .from("mission_comments")
    .select("*")
    .eq("mission_id", id)
    .order("created_at", { ascending: true });

  const { data: attachments } = await supabase
    .from("mission_attachments")
    .select("*")
    .eq("mission_id", id)
    .order("created_at", { ascending: true });

  const { data: activity } = await supabase
    .from("mission_activity")
    .select("*")
    .eq("mission_id", id)
    .order("created_at", { ascending: true });

  return NextResponse.json({ mission, deliverables, comments, attachments, activity });
}
