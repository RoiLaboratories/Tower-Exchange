// Token icon mapping utility
// Maps token tickers to their icon paths in /public/assets

import { StaticImageData } from "next/image";
import usdcLogo from "@/public/assets/usdc.svg";
import ethLogo from "@/public/assets/Eth_logo_3-removebg-preview.png";
import eurcLogo from "@/public/assets/eurc.svg";
import usycLogo from "@/public/assets/USYC_LOGO.svg";
import hypeLogo from "@/public/assets/hype.png";
import usdtLogo from "@/public/assets/usdt.svg";
import uniLogo from "@/public/assets/uniswap-removebg-preview.png";
import qtmLogo from "@/public/assets/quantum-logo.png";
import cirbtcLogo from "@/public/assets/cirBTC logo.png";

export const TOKEN_ICONS: Record<string, StaticImageData> = {
  USDC: usdcLogo,
  WUSDC: usdcLogo,
  ETH: ethLogo,
  EURC: eurcLogo,
  USYC: usycLogo,
  HYPE: hypeLogo,
  USDT: usdtLogo,
  CIRBTC: cirbtcLogo,
  cirBTC: cirbtcLogo,
  UNI: uniLogo,
  QTM: qtmLogo,
  SWPRC: usdcLogo, // Default to USDC logo if SWPRC logo not available
  // Add more token icons as needed
};

export const getTokenIcon = (ticker: string): StaticImageData | null => {
  return TOKEN_ICONS[ticker.toUpperCase()] || null;
};
