import { type StaticImageData } from "next/image";
import arcTestnetLogo from "@/public/assets/Arc Testnet logo.svg";
import baseSepoliaLogo from "@/public/assets/Base Sepolia logo.svg";
import optimismSepoliaLogo from "@/public/assets/Optimism Sepolia logo.svg";
import avalancheFujiLogo from "@/public/assets/Avalanche Fuji logo.svg";
import arbitrumSepoliaLogo from "@/public/assets/Arbitrum Sepolia logo (2).svg";
import ethereumSepoliaLogo from "@/public/assets/EthLogo.svg";
import lineaSepoliaLogo from "@/public/assets/Linea-Token_Round.svg";
import polygonAmoyLogo from "@/public/assets/polygon.svg";
import sonicTestnetLogo from "@/public/assets/S_token.svg";
import unichainSepoliaLogo from "@/public/assets/Testnet.svg";
import globeLogo from "@/public/assets/globe-removebg-preview.svg";

export type AppChain = {
  id: string;
  name: string;
  color: string;
  logo: StaticImageData;
};

export const CHAINS: AppChain[] = [
  { id: "all", name: "All Chains", color: "#4B5563", logo: globeLogo },
  {
    id: "arc-testnet",
    name: "Arc Testnet",
    color: "#00AEEF",
    logo: arcTestnetLogo,
  },
  {
    id: "base-sepolia",
    name: "Base Sepolia",
    color: "#0174F0",
    logo: baseSepoliaLogo,
  },
  {
    id: "optimism-sepolia",
    name: "Optimism Sepolia",
    color: "#FF0420",
    logo: optimismSepoliaLogo,
  },
  {
    id: "avalanche-fuji",
    name: "Avalanche Fuji",
    color: "#E84142",
    logo: avalancheFujiLogo,
  },
  {
    id: "arbitrum-sepolia",
    name: "Arbitrum Sepolia",
    color: "#2D374B",
    logo: arbitrumSepoliaLogo,
  },
  {
    id: "ethereum-sepolia",
    name: "Ethereum Sepolia",
    color: "#627EEA",
    logo: ethereumSepoliaLogo,
  },
  {
    id: "linea-sepolia",
    name: "Linea Sepolia",
    color: "#121212",
    logo: lineaSepoliaLogo,
  },
  {
    id: "polygon-amoy",
    name: "Polygon Amoy",
    color: "#8247E5",
    logo: polygonAmoyLogo,
  },
  {
    id: "sonic-testnet",
    name: "Sonic Testnet",
    color: "#00D4AA",
    logo: sonicTestnetLogo,
  },
  {
    id: "unichain-sepolia",
    name: "Unichain Sepolia",
    color: "#FF007A",
    logo: unichainSepoliaLogo,
  },
];

/** Look up a chain logo by network name (as stored in the DB), e.g. "Ethereum Sepolia" */
export const getChainLogoByName = (
  networkName: string,
): StaticImageData | null => {
  const match = CHAINS.find(
    (c) => c.name.toLowerCase() === networkName.toLowerCase(),
  );
  return match?.logo ?? null;
};

/** Look up a chain logo by chain ID, e.g. "ethereum-sepolia" */
export const getChainLogoById = (chainId: string): StaticImageData | null => {
  return CHAINS.find((c) => c.id === chainId)?.logo ?? null;
};
