import { NextRequest, NextResponse } from "next/server";
import { getDeveloperUser } from "@/lib/server/developerAuth";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";

export async function GET(request: NextRequest) {
  try {
    const user = await getDeveloperUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: plans, error } = await supabaseAdmin
      .from("subscription_plans")
      .select("id, name, price_monthly, request_limit, rate_limit, features, created_at, updated_at")
      .order("price_monthly", { ascending: true });

    if (error || !plans) {
      console.error("Fetch subscription plans error:", error);
      return NextResponse.json({ error: "Failed to fetch subscription plans catalog" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      plans,
    });
  } catch (error) {
    console.error("GET subscription plans catalog error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
