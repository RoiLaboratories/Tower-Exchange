export const ARC_RPC_ENDPOINTS = [
  "https://rpc.drpc.testnet.arc.network",
  "https://rpc.quicknode.testnet.arc.network",
  "https://rpc.blockdaemon.testnet.arc.network",
  "https://rpc.testnet.arc.network",
] as const;

export const ARC_RPC_PROXY_PATH = "/api/rpc/5042002";

export const getArcRpcUrls = (preferredRpcUrl?: string | null) =>
  Array.from(
    new Set(
      [preferredRpcUrl, ...ARC_RPC_ENDPOINTS].filter(
        (rpcUrl): rpcUrl is string => Boolean(rpcUrl),
      ),
    ),
  );