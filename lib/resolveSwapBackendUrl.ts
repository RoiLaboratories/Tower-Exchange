const LOCAL_SWAP_BACKEND_URL = "http://localhost:3001";
const PRODUCTION_SWAP_BACKEND_URL = "https://tower-backend.up.railway.app";

export function resolveSwapBackendUrl() {
  if (process.env.BACKEND_URL) {
    return process.env.BACKEND_URL;
  }

  if (process.env.NODE_ENV !== "production") {
    return LOCAL_SWAP_BACKEND_URL;
  }

  if (process.env.NEXT_PUBLIC_BACKEND_URL) {
    return process.env.NEXT_PUBLIC_BACKEND_URL;
  }

  return PRODUCTION_SWAP_BACKEND_URL;
}
