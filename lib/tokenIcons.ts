// Token icon mapping utility
// Maps token tickers to their icon paths in /public/assets

import { StaticImageData } from "next/image";
import usdcLogo from "@/public/assets/USDC-fotor-bg-remover-2025111075935.png";
import ethLogo from "@/public/assets/Eth_logo_3-removebg-preview.png";
import eurcLogo from "@/public/assets/EURC_logo.png";
import hypeLogo from "@/public/assets/hype.png";
import usdtLogo from "@/public/assets/usdt_logo-removebg-preview.png";
import uniLogo from "@/public/assets/uniswap-removebg-preview.png";

export const TOKEN_ICONS: Record<string, StaticImageData> = {
  USDC: usdcLogo,
  ETH: ethLogo,
  EURC: eurcLogo,
  HYPE: hypeLogo,
  USDT: usdtLogo,
  UNI: uniLogo,
  // Add more token icons as needed
};

export const getTokenIcon = (ticker: string): StaticImageData | null => {
  return TOKEN_ICONS[ticker.toUpperCase()] || null;
};
