// config/portfolioData.ts
import { StaticImageData } from "next/image";
import usdcLogo from "@/public/assets/USDC-fotor-bg-remover-2025111075935.png";
import ethLogo from "@/public/assets/Eth_logo_3-removebg-preview.png";
import hypeLogo from "@/public/assets/hype.png";

export interface Holding {
  token: string;
  icon: StaticImageData;
  balance: string;
  price: string;
  value: string;
}

export interface Activity {
  type: string;
  source: {
    token: string;
    icon: StaticImageData;
    network: string;
  };
  destination: {
    token: string;
    icon: StaticImageData;
    network: string;
  };
  status: "Successful" | "Failed";
  date: string;
  time: string;
}

export const holdingsData: Holding[] = [
  {
    token: "HYPE",
    icon: hypeLogo,
    balance: "0.0011",
    price: "$120",
    value: "$1.42",
  },
  {
    token: "ETH",
    icon: ethLogo,
    balance: "0.1012",
    price: "$120",
    value: "$1.42",
  },
  {
    token: "USDC",
    icon: usdcLogo,
    balance: "0.1012",
    price: "$120",
    value: "$1.42",
  },
];

export const activitiesData: Activity[] = [
  {
    type: "Swap",
    source: { token: "USDC", icon: usdcLogo, network: "Arc" },
    destination: { token: "ETH", icon: ethLogo, network: "Arc" },
    status: "Successful",
    date: "Aug 08, 2025",
    time: "12:29 PM UTC",
  },
  {
    type: "Swap",
    source: { token: "USDC", icon: usdcLogo, network: "Arc" },
    destination: { token: "ETH", icon: ethLogo, network: "Arc" },
    status: "Failed",
    date: "Aug 08, 2025",
    time: "12:29 PM UTC",
  },
  {
    type: "Swap",
    source: { token: "USDC", icon: usdcLogo, network: "Arc" },
    destination: { token: "ETH", icon: ethLogo, network: "Arc" },
    status: "Successful",
    date: "Aug 08, 2025",
    time: "12:29 PM UTC",
  },
];
