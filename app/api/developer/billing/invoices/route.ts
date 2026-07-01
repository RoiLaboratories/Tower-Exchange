import { NextRequest, NextResponse } from "next/server";
import { getDeveloperUser } from "@/lib/server/developerAuth";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";

export async function GET(request: NextRequest) {
  try {
    const user = await getDeveloperUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: invoices, error } = await supabaseAdmin
      .from("invoices")
      .select("id, subscription_id, amount, currency, status, pdf_url, created_at, updated_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error || !invoices) {
      console.error("Fetch invoices error:", error);
      return NextResponse.json({ error: "Failed to fetch invoices" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      invoices,
    });
  } catch (error) {
    console.error("GET developer invoices error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
