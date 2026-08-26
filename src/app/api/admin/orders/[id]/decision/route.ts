import { NextRequest, NextResponse } from "next/server";
import { decideOrder } from "@/lib/orders";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { action, note } = await req.json().catch(() => ({}));
  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "إجراء غير صالح" }, { status: 400 });
  }

  try {
    const order = await decideOrder(params.id, action === "approve" ? "approved" : "rejected", note);
    return NextResponse.json({ order });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "تعذّر تنفيذ الإجراء" }, { status: 500 });
  }
}
