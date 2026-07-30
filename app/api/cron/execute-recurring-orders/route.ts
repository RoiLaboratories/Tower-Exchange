import { NextRequest, NextResponse } from "next/server";

const getSupabaseFunctionUrl = () => {
  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    return null;
  }

  return `${supabaseUrl.replace(/\/$/, "")}/functions/v1/execute-recurring-orders`;
};

const isAuthorizedCronRequest = (request: NextRequest) => {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return true;
  }

  const authorization = request.headers.get("authorization");
  return authorization === `Bearer ${cronSecret}`;
};

async function handleRecurringOrderCron(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    console.error("Recurring order cron unauthorized request", {
      hasAuthorization: Boolean(request.headers.get("authorization")),
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const functionUrl = getSupabaseFunctionUrl();
  const invokeKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!functionUrl || !invokeKey) {
    const missing = {
      supabaseUrl: !functionUrl,
      invokeKey: !invokeKey,
    };

    console.error("Recurring order cron missing required environment", missing);

    return NextResponse.json(
      {
        error:
          "Recurring order cron is missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY.",
        missing,
      },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${invokeKey}`,
      },
      body: JSON.stringify({
        trigger: "app-cron",
        requestedAt: new Date().toISOString(),
      }),
    });

    const responseText = await response.text();
    let responseBody: unknown = responseText;

    try {
      responseBody = responseText ? JSON.parse(responseText) : null;
    } catch {
      responseBody = responseText;
    }

    const logPayload = {
      ok: response.ok,
      status: response.status,
      result: responseBody,
    };

    if (response.ok) {
      console.log("Recurring order cron response:", logPayload);
    } else {
      console.error("Recurring order cron failed:", logPayload);
    }

    return NextResponse.json(logPayload, { status: response.ok ? 200 : 502 });
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);

    console.error("Recurring order cron invoke error:", details);

    return NextResponse.json(
      {
        error: "Failed to invoke recurring order executor.",
        details,
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handleRecurringOrderCron(request);
}

export async function POST(request: NextRequest) {
  return handleRecurringOrderCron(request);
}

export async function HEAD() {
  return new Response(null, { status: 204 });
}
