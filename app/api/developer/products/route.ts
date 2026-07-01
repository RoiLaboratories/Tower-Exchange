import { NextRequest, NextResponse } from "next/server";
import { getDeveloperUser } from "@/lib/server/developerAuth";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";

export async function GET(request: NextRequest) {
  try {
    const user = await getDeveloperUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: products, error } = await supabaseAdmin
      .from("api_products")
      .select("id, name, description, created_at, updated_at")
      .order("name", { ascending: true });

    if (error || !products) {
      console.error("Fetch API products error:", error);
      return NextResponse.json({ error: "Failed to fetch API products catalog" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      products,
    });
  } catch (error) {
    console.error("GET API products catalog error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
