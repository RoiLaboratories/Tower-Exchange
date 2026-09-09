import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve("C:/Users/Chidozie Collins/Documents/GitHub/Tower-Finance/.env.local");
const envText = fs.readFileSync(envPath, "utf8");
const get = (key) => {
  const match = envText.match(new RegExp(`^${key}=(.*)$`, "m"));
  return match ? match[1].trim().replace(/^["']|["']$/g, "") : "";
};

const base = get("TOWER_AI_API") || get("TOWER_AI_API_URL");
const key = get("TOWER_AI_API_KEY");
const chatUrl = /\/api\/v1\/chat$/i.test(base.replace(/\/+$/, ""))
  ? base.replace(/\/+$/, "")
  : `${base.replace(/\/+$/, "")}/api/v1/chat`;

console.log(
  JSON.stringify({
    apiSet: Boolean(base),
    keySet: Boolean(key),
    keyLen: key.length,
    host: base ? new URL(base).host : null,
    chatUrlHost: new URL(chatUrl).host,
    chatPath: new URL(chatUrl).pathname,
  }),
);

const extraBody = {
  message: "ping from probe",
  userid: "0x0000000000000000000000000000000000000001",
  session_id: "probe-session",
  wallet_address: "0x0000000000000000000000000000000000000001",
  walletAddress: "0x0000000000000000000000000000000000000001",
  userId: "0x0000000000000000000000000000000000000001",
  solana_wallet_address: undefined,
  chain_id: 5042002,
  enable_wallet_access: false,
  enable_swap_execution: false,
  enable_bridge_execution: false,
  enable_portfolio_analysis: false,
};

const started = Date.now();
try {
  const response = await fetch(chatUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      endpoint_auth: key,
    },
    body: JSON.stringify(extraBody),
  });
  const text = await response.text();
  console.log(
    JSON.stringify({
      status: response.status,
      ms: Date.now() - started,
      contentType: response.headers.get("content-type"),
      bodyPreview: text.slice(0, 400),
    }),
  );
} catch (error) {
  console.log(
    JSON.stringify({
      fetchThrew: true,
      ms: Date.now() - started,
      name: error?.name,
      message: error?.message,
      cause: error?.cause ? String(error.cause) : null,
    }),
  );
}
