import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_AI_AGENT_URL ||
  "https://tower-exchange-ai-production.up.railway.app";
const API_KEY = process.env.AI_AGENT_API_KEY || "";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Add API key using the correct header name
    if (API_KEY) {
      headers["endpoint_auth"] = API_KEY;
    }

    const chatUrl = `${BACKEND_URL}/api/v1/chat`;

    console.log("Sending request to:", chatUrl);
    console.log("Headers:", { 
      "Content-Type": "application/json",
      "endpoint_auth": "***REDACTED***"
    });
    console.log("Body:", body);

    const response = await fetch(chatUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "AI Agent Error Response:",
        JSON.stringify(data, null, 2)
      );
      console.error("Response Status:", response.status);
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error sending message to AI agent:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
