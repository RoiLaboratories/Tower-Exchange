import { NextRequest } from "next/server";
import { verifyToken, signToken } from "./jwt";
import { supabaseAdmin } from "./supabaseAdmin";

const JWT_SECRET = process.env.JWT_SECRET || "tower_developer_dashboard_jwt_secret_key_safe_fallback";
const SESSION_COOKIE_NAME = "dev_session";
const SESSION_EXPIRY_SECONDS = 604800; // 7 days

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  email_verified: boolean;
}

/**
 * Retrieves the current authenticated developer user from the request session.
 */
export async function getDeveloperUser(request: NextRequest): Promise<AuthenticatedUser | null> {
  try {
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!sessionCookie) return null;

    const payload = verifyToken(sessionCookie, JWT_SECRET);
    if (!payload || !payload.userId) return null;

    const { data: user, error } = await supabaseAdmin
      .from("users")
      .select("id, name, email, email_verified")
      .eq("id", payload.userId)
      .single();

    if (error || !user) return null;

    return user as AuthenticatedUser;
  } catch (error) {
    console.error("Error retrieving authenticated developer user:", error);
    return null;
  }
}

/**
 * Helper to generate session token for a given user ID.
 */
export function createSessionToken(userId: string): string {
  return signToken({ userId }, JWT_SECRET, SESSION_EXPIRY_SECONDS);
}

/**
 * Cookie options for the dev session.
 */
export const sessionCookieOptions = {
  name: SESSION_COOKIE_NAME,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_EXPIRY_SECONDS,
  sameSite: "lax" as const,
};

/**
 * Extracts the client IP address from the request headers and next-provided request context.
 */
export function getClientIp(request: NextRequest): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }
  return (request as any).ip || null;
}

