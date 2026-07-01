import { NextRequest, NextResponse } from "next/server";
import { getDeveloperUser } from "@/lib/server/developerAuth";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getDeveloperUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: webhookId } = await params;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const offset = (page - 1) * limit;

    // 1. Verify that the webhook exists and is owned by this developer
    const { data: webhook, error: webhookError } = await supabaseAdmin
      .from("webhooks")
      .select("id, user_id")
      .eq("id", webhookId)
      .maybeSingle();

    if (webhookError || !webhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    if (webhook.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden. Ownership mismatch." }, { status: 403 });
    }

    // 2. Fetch deliveries
    const { data: deliveries, count, error: fetchError } = await supabaseAdmin
      .from("webhook_deliveries")
      .select("id, event_type, status_code, response_body, response_time_ms, created_at", { count: "exact" })
      .eq("webhook_id", webhookId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (fetchError || !deliveries) {
      console.error("Fetch webhook deliveries error:", fetchError);
      return NextResponse.json({ error: "Failed to fetch webhook deliveries log" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      deliveries,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("GET webhook deliveries error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
