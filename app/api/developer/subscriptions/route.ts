import { NextRequest, NextResponse } from "next/server";
import { getDeveloperUser } from "@/lib/server/developerAuth";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";

export async function GET(request: NextRequest) {
  try {
    const user = await getDeveloperUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch user subscriptions and join with plan details
    const { data: subscriptions, error } = await supabaseAdmin
      .from("user_subscriptions")
      .select(`
        id,
        status,
        current_period_start,
        current_period_end,
        created_at,
        updated_at,
        subscription_plans (
          id,
          name,
          price_monthly,
          request_limit,
          rate_limit,
          features
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error || !subscriptions) {
      console.error("Fetch user subscriptions error:", error);
      return NextResponse.json({ error: "Failed to fetch user subscriptions" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      subscriptions,
    });
  } catch (error) {
    console.error("GET user subscriptions error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
