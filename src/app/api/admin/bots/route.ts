import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabaseAdmin()
    .from("hosted_bots")
    .select("id,public_code,template_type,bot_username,owner_contact,status,created_at,config,owner_balance")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ bots: [], error: error.message });
  return NextResponse.json({ bots: data ?? [] });
}
