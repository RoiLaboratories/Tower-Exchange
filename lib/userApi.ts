/**
 * Browser-safe helpers for wallet-scoped user data APIs.
 * These call Next.js routes that use the service role server-side.
 */

async function parseJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function userApiFetch<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  const payload = (await parseJson(response)) as
    | (T & { error?: string; message?: string; success?: boolean })
    | null;

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      data: null,
      error:
        payload?.error ||
        payload?.message ||
        `Request failed with status ${response.status}`,
    };
  }

  return { ok: true, status: response.status, data: payload as T };
}
