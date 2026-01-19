import { StaticImageData } from "next/image";
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
  // optional fields for the hover overlay
  change24h?: string;
  marketCap?: string;
  chartData?: number[];
}

export const tokens: Token[] = [
  {
    symbol: "USDC",
    price: "$3.21",
    change: "+16.0%",
    icon: usdcLogo,
    color: "text-primary",
    change24h: "+16.0%",
    marketCap: "$32.5B",
    chartData: [2.8, 2.9, 2.85, 3.0, 2.95, 3.1, 3.05, 3.15, 3.21],
  },
  {
    symbol: "USDT",
    price: "$0.98",
    change: "-2.1%",
    icon: usdtLogo,
    color: "text-destructive",
    change24h: "-2.1%",
    marketCap: "$95.5B",
    chartData: [1.0, 0.99, 1.01, 0.985, 0.995, 0.98, 0.99, 0.982, 0.98],
  },
  {
    symbol: "ETH",
    price: "$3,021",
    change: "+12.3%",
    icon: ethLogo,
    color: "text-primary",
    change24h: "+12.3%",
    marketCap: "$363.2B",
    chartData: [2650, 2700, 2680, 2750, 2800, 2850, 2900, 2950, 3021],
  },
  {
    symbol: "HYPE",
    price: "$38.4",
    change: "-8.8%",
    icon: hypeLogo,
    color: "text-destructive",
    change24h: "-8.8%",
    marketCap: "$1.2B",
    chartData: [42.1, 41.5, 42, 40.5, 40, 39.5, 39, 38.8, 38.4],
  },
  {
    symbol: "UNI",
    price: "$1.05",
    change: "+5.2%",
    icon: uniLogo,
    color: "text-success",
    change24h: "+5.2%",
    marketCap: "$7.5B",
    chartData: [0.98, 0.95, 0.97, 0.99, 1.01, 1.0, 1.03, 1.04, 1.05],
  },
];

export default tokens;
