import test from "node:test";
import assert from "node:assert/strict";

const envKeys = ["BACKEND_URL", "NEXT_PUBLIC_BACKEND_URL", "NODE_ENV"];

const restore = (snapshot) => {
  for (const key of envKeys) {
    const value = snapshot[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
};

const importFresh = async () => {
  const cacheBust = Date.now() + Math.random();
  return import(`./resolveSwapBackendUrl.ts?cacheBust=${cacheBust}`);
};

test("prefers an explicit backend URL over the local dev fallback", async () => {
  const snapshot = { ...process.env };

  try {
    process.env.BACKEND_URL = "https://configured.example";
    process.env.NEXT_PUBLIC_BACKEND_URL = "https://public.example";
    process.env.NODE_ENV = "development";

    const { resolveSwapBackendUrl } = await importFresh();
    assert.equal(resolveSwapBackendUrl(), "https://configured.example");
  } finally {
    restore(snapshot);
  }
});

test("uses the public backend URL before falling back to localhost in development", async () => {
  const snapshot = { ...process.env };

  try {
    delete process.env.BACKEND_URL;
    process.env.NEXT_PUBLIC_BACKEND_URL = "https://public.example";
    process.env.NODE_ENV = "development";

    const { resolveSwapBackendUrl } = await importFresh();
    assert.equal(resolveSwapBackendUrl(), "https://public.example");
  } finally {
    restore(snapshot);
  }
});
