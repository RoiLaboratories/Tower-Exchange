import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  bitgetWallet,
  coinbaseWallet,
  injectedWallet,
  metaMaskWallet,
  safeWallet,
  trustWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import {
  coinbaseWallet as coinbaseWalletConnector,
  injected,
} from "wagmi/connectors";
import {
  arbitrum,
  base,
  mainnet,
  optimism,
  polygon,
  sepolia,
} from "wagmi/chains";

const rpcProxyUrl = (chainId: number) => `/api/rpc/${chainId}`;
const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ??
  process.env.NEXT_PUBLIC_REOWN_PROJECT_ID;
const appName = "Tower Exchange";

if (!walletConnectProjectId && process.env.NODE_ENV !== "production") {
  console.warn(
    "WalletConnect project ID is missing. RainbowKit will fall back to injected and Coinbase connectors, and mobile wallet selection will stay limited until NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is configured.",
  );
}

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

const connectors = walletConnectProjectId
  ? connectorsForWallets(
      [
        {
          groupName: "Popular wallets",
          wallets: [
            metaMaskWallet,
            trustWallet,
            bitgetWallet,
            coinbaseWallet,
          ],
        },
        {
          groupName: "Other wallets",
          wallets: [walletConnectWallet, injectedWallet, safeWallet],
        },
      ],
      {
        appName,
        projectId: walletConnectProjectId,
      },
    )
  : [
      injected({ shimDisconnect: true }),
      coinbaseWalletConnector({ appName }),
    ];

export const wagmiConfig = createConfig({
  chains: [ethereumMainnet, polygon, arbitrum, base, optimism, sepolia, arcTestnet],
  connectors,
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
