import { NextRequest, NextResponse } from "next/server";

const FORBIDDEN = NextResponse.json(
  { error: "Forbidden" },
  { status: 403 },
);

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, "");

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

const DEFAULT_FRONTEND_HOSTS = new Set([
  "tower.exchange",
  "www.tower.exchange",
  "app.tower.exchange",
]);

const stripWww = (host: string) => host.replace(/^www\./, "");

const hostFromUrl = (value: string) => {
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
};

const getRequestHost = (request: NextRequest) => {
  const forwarded = request.headers.get("x-forwarded-host");
  const hostHeader = forwarded || request.headers.get("host") || request.nextUrl.host;
  return hostHeader.split(",")[0]?.trim().toLowerCase() || "";
};

const isKnownFrontendHost = (host: string) => {
  if (!host) {
    return false;
  }

  if (DEFAULT_FRONTEND_HOSTS.has(host) || DEFAULT_FRONTEND_HOSTS.has(stripWww(host))) {
    return true;
  }

  const extra = process.env.TOWER_AI_ALLOWED_ORIGINS || "";
  for (const origin of extra.split(",")) {
    const extraHost = hostFromUrl(origin.trim()) || origin.trim().toLowerCase();
    if (extraHost && (extraHost === host || stripWww(extraHost) === stripWww(host))) {
      return true;
    }
  }

  return false;
};

const hostsMatch = (left: string, right: string) =>
  Boolean(left && right && stripWww(left) === stripWww(right));

/**
 * Reject terminal/curl callers that are not a browser request from the
 * Tower frontend. Wallet session is still required on each AI route.
 *
 * On Vercel, `request.nextUrl.origin` is often the *.vercel.app host while
 * the browser Origin is tower.exchange — never require those to be equal.
 */
export function rejectNonFrontendAiRequest(request: NextRequest) {
  const secFetchSite = (request.headers.get("sec-fetch-site") || "").toLowerCase();

  if (secFetchSite === "same-origin") {
    return null;
  }

  const requestHost = getRequestHost(request);
  const originHost = request.headers.get("origin")
    ? hostFromUrl(request.headers.get("origin") || "")
    : null;
  const refererHost = request.headers.get("referer")
    ? hostFromUrl(request.headers.get("referer") || "")
    : null;

  if (originHost && (hostsMatch(originHost, requestHost) || isKnownFrontendHost(originHost))) {
    return null;
  }

  if (
    !originHost &&
    refererHost &&
    (hostsMatch(refererHost, requestHost) || isKnownFrontendHost(refererHost))
  ) {
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
