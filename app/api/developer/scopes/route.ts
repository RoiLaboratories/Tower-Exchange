import { NextRequest, NextResponse } from "next/server";
import { getDeveloperUser } from "@/lib/server/developerAuth";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";

export async function GET(request: NextRequest) {
  try {
    const user = await getDeveloperUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: scopes, error } = await supabaseAdmin
      .from("scopes")
      .select("id, label, description, product_id")
      .order("id", { ascending: true });

    if (error || !scopes) {
      console.error("Fetch scopes error:", error);
      return NextResponse.json({ error: "Failed to fetch scopes catalog" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      scopes,
    });
  } catch (error) {
    console.error("GET scopes catalog error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
