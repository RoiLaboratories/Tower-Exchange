import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_TOWER_AI_API ||
  "https://tower-exchange-ai-production-5811.up.railway.app";
const API_KEY = process.env.TOWER_AI_API_KEY || "";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Add API key using Bearer token format
    if (API_KEY) {
      headers["Authorization"] = `Bearer ${API_KEY}`;
    }

    const chatUrl = `${BACKEND_URL}/api/v1/chat`;

    console.log("Sending request to:", chatUrl);
    console.log("Headers:", { 
      "Content-Type": "application/json",
      "Authorization": "Bearer ***REDACTED***"
    });

    const response = await fetch(chatUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "Tower AI Agent Error Response:",
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
