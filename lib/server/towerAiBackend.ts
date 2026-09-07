import { NextRequest, NextResponse } from "next/server";

const FORBIDDEN = NextResponse.json(
  { error: "Forbidden" },
  { status: 403 },
);

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const normalizeOrigin = (value: string) => {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}`.toLowerCase();
  } catch {
    return null;
  }
};

const getConfiguredBaseUrl = () => {
  const raw = (
    process.env.TOWER_AI_API ||
    process.env.TOWER_AI_API_URL ||
    ""
  ).trim();

  if (!raw) {
    return null;
  }

  return stripTrailingSlash(raw).replace(/\/api\/v1\/chat$/i, "");
};

export function getTowerAiBaseUrl() {
  return getConfiguredBaseUrl();
}

export function getTowerAiChatUrl() {
  const raw = (process.env.TOWER_AI_API || process.env.TOWER_AI_API_URL || "").trim();
  if (!raw) {
    return null;
  }

  const normalized = stripTrailingSlash(raw);
  if (/\/api\/v1\/chat$/i.test(normalized)) {
    return normalized;
  }

  return `${normalized}/api/v1/chat`;
}

export function getTowerAiStreamUrl() {
  const chatUrl = getTowerAiChatUrl();
  return chatUrl ? `${chatUrl}/stream` : null;
}

export function getTowerAiAuthHeaders(): Record<string, string> {
  const apiKey = (process.env.TOWER_AI_API_KEY || "").trim();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (apiKey) {
    headers.endpoint_auth = apiKey;
  }

  return headers;
}

const getAllowedOrigins = (request: NextRequest) => {
  const allowed = new Set<string>();
  const requestOrigin = normalizeOrigin(request.nextUrl.origin);

  if (requestOrigin) {
    allowed.add(requestOrigin);
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    const vercelOrigin = normalizeOrigin(
      vercelUrl.includes("://") ? vercelUrl : `https://${vercelUrl}`,
    );
    if (vercelOrigin) {
      allowed.add(vercelOrigin);
    }
  }

  const extra = process.env.TOWER_AI_ALLOWED_ORIGINS || "";
  for (const origin of extra.split(",")) {
    const normalized = normalizeOrigin(origin.trim());
    if (normalized) {
      allowed.add(normalized);
    }
  }

  return allowed;
};

const originFromReferer = (referer: string) => {
  try {
    const url = new URL(referer);
    return `${url.protocol}//${url.host}`.toLowerCase();
  } catch {
    return null;
  }
};

/**
 * Reject terminal/curl callers that are not a same-origin browser request
 * from the Tower frontend. This is a gate, not a cryptographic proof —
 * wallet session is still required on each AI route.
 */
export function rejectNonFrontendAiRequest(request: NextRequest) {
  const allowedOrigins = getAllowedOrigins(request);
  const originHeader = request.headers.get("origin");
  const refererHeader = request.headers.get("referer");
  const secFetchSite = request.headers.get("sec-fetch-site");
  const origin = originHeader ? normalizeOrigin(originHeader) : null;
  const refererOrigin = refererHeader ? originFromReferer(refererHeader) : null;

  const originAllowed = Boolean(origin && allowedOrigins.has(origin));
  const refererAllowed = Boolean(
    refererOrigin && allowedOrigins.has(refererOrigin),
  );

  if (secFetchSite === "same-origin" && (originAllowed || !originHeader)) {
    return null;
  }

  if (originAllowed) {
    return null;
  }

  if (!originHeader && refererAllowed) {
    return null;
  }

  return FORBIDDEN;
}

export function aiBackendUnconfiguredResponse() {
  return NextResponse.json(
    { error: "AI is temporarily unavailable" },
    { status: 503 },
  );
}
