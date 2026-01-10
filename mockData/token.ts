// config/tokens.ts
import { StaticImageData } from "next/image";
import arcLogo from "@/public/assets/arc_logo_1-removebg-preview.png";
import usdcLogo from "@/public/assets/USDC-fotor-bg-remover-2025111075935.png";
import usdtLogo from "@/public/assets/usdt_logo-removebg-preview.png";
import ethLogo from "@/public/assets/Eth_logo_3-removebg-preview.png";
import uniLogo from "@/public/assets/uniswap-removebg-preview.png";
import hypeLogo from "@/public/assets/hype.png";

export interface Token {
  symbol: string;
  price: string;
  change: string;
  icon: StaticImageData;
  color?: string;
}

export const tokens: Token[] = [
  {
    symbol: "USDC",
    price: "$3.21",
    change: "+16.0%",
    icon: usdcLogo,
    color: "text-primary",
  },
  {
    symbol: "USDT",
    price: "$1.00",
    change: "+16.0%",
    icon: usdtLogo,
    color: "text-success",
  },
  {
    symbol: "ETH",
    price: "$3,021",
    change: "+16.0%",
    icon: ethLogo,
    color: "text-primary",
  },
  {
    symbol: "HYPE",
    price: "$42.1",
    change: "+16.0%",
    icon: hypeLogo,
    color: "text-success",
  },
  {
    symbol: "ARC",
    price: "$1.00",
    change: "+16.0%",
    icon: arcLogo,
    color: "text-success",
  },
  {
    symbol: "UNI",
    price: "$1.00",
    change: "+16.0%",
    icon: uniLogo,
    color: "text-success",
  },
];

export default tokens;
