import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

if (!supabaseUrl) {
  console.warn("⚠️ NEXT_PUBLIC_SUPABASE_URL is missing.");
}

function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("supabaseAdmin must only be used on the server.");
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

let adminClient: ReturnType<typeof createAdminClient> | null = null;

export const supabaseAdmin = new Proxy(
  {} as ReturnType<typeof createAdminClient>,
  {
    get(_target, prop) {
      if (!adminClient) {
        adminClient = createAdminClient();
      }
      const value = Reflect.get(adminClient, prop);
      return typeof value === "function" ? value.bind(adminClient) : value;
    },
  }
);
