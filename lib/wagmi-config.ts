import { createConfig, http } from "wagmi";
import { injected, coinbaseWallet } from "wagmi/connectors";
import {
  arbitrum,
  base,
  mainnet,
  optimism,
  polygon,
  sepolia,
} from "wagmi/chains";

const rpcProxyUrl = (chainId: number) => `/api/rpc/${chainId}`;

const ethereumMainnet = {
  ...mainnet,
  rpcUrls: {
    ...mainnet.rpcUrls,
    default: { http: ["https://ethereum.publicnode.com"] },
    public: { http: ["https://ethereum.publicnode.com"] },
  },
} as const;

// Arc Testnet Configuration
const arcTestnet = {
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "Arc",
    symbol: "ARC",
  },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.network"] },
  },
  blockExplorers: {
    default: { name: "Explorer", url: "https://explorer.testnet.arc.network" },
  },
  testnet: true,
} as const;

export const wagmiConfig = createConfig({
  chains: [ethereumMainnet, polygon, arbitrum, base, optimism, sepolia, arcTestnet],
  connectors: [
    injected({ shimDisconnect: true }), // MetaMask and other injected wallets
    coinbaseWallet({ appName: "Tower Exchange" }),
  ],
  transports: {
    [ethereumMainnet.id]: http(rpcProxyUrl(ethereumMainnet.id)),
    [polygon.id]: http(rpcProxyUrl(polygon.id)),
    [arbitrum.id]: http(rpcProxyUrl(arbitrum.id)),
    [base.id]: http(rpcProxyUrl(base.id)),
    [optimism.id]: http(rpcProxyUrl(optimism.id)),
    [sepolia.id]: http(rpcProxyUrl(sepolia.id)),
    [arcTestnet.id]: http(rpcProxyUrl(arcTestnet.id)),
  },
});
