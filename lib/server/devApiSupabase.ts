import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("supabaseAdmin must only be used on the server.");
  }

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL.");
  }

  if (!supabaseServiceKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY in environment variables. Server gateway routes require it to query api_keys with RLS bypassed."
    );
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
