import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { Profile } from "@/types/database";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase.from("profiles").select("initial_savings").eq("id", user.id).single();
  return NextResponse.json((data as Pick<Profile, "initial_savings"> | null) ?? { initial_savings: 0 });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { initial_savings } = await request.json();
  if (initial_savings == null || Number(initial_savings) < 0)
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("profiles") as any)
    .upsert({ id: user.id, initial_savings: Number(initial_savings) })
    .select("initial_savings")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data as Pick<Profile, "initial_savings">);
}
