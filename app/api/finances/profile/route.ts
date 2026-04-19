import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const allowed = ["monthly_salary", "initial_savings", "next_salary_date"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if ("monthly_salary" in updates) {
    const val = Number(updates.monthly_salary);
    if (isNaN(val) || val < 0) return NextResponse.json({ error: "Invalid salary" }, { status: 400 });
    updates.monthly_salary = val;
  }
  if ("initial_savings" in updates) {
    const val = Number(updates.initial_savings);
    if (isNaN(val) || val < 0) return NextResponse.json({ error: "Invalid savings amount" }, { status: 400 });
    updates.initial_savings = val;
  }

  const { data, error } = await supabase
    .from("profiles")
    .upsert({ id: user.id, ...updates }, { onConflict: "id" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
