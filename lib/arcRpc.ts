const ARC_ALCHEMY_RPC_URL =
  process.env.ARC_ALCHEMY_RPC_URL ||
  process.env.NEXT_PUBLIC_ARC_ALCHEMY_RPC_URL ||
  null;

export const ARC_RPC_ENDPOINTS = [
  ARC_ALCHEMY_RPC_URL,
  "https://rpc.drpc.testnet.arc.network",
  "https://rpc.quicknode.testnet.arc.network",
  "https://rpc.blockdaemon.testnet.arc.network",
  "https://rpc.testnet.arc.network",
].filter((rpcUrl): rpcUrl is string => Boolean(rpcUrl));

export const ARC_RPC_PROXY_PATH = "/api/rpc/5042002";

export const getArcRpcUrls = (preferredRpcUrl?: string | null) =>
  Array.from(
    new Set(
      [preferredRpcUrl, ...ARC_RPC_ENDPOINTS].filter(
        (rpcUrl): rpcUrl is string => Boolean(rpcUrl),
      ),
    ),
  );