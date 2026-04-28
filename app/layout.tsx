import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Sora, Cinzel } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import InviteGate from "@/components/InviteGate";
import { PrivyProvider } from "@/components/providers/PrivyProvider";
import { CustomRainbowKitProvider } from "@/components/providers/RainbowKitProvider";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});
const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-cinzel",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tower Exchange - The Native Stablecoin DEX Aggregator",
  description: "Trade Stablecoins with ease on Tower Exchange",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "Tower Exchange - The Native Stablecoin DEX Aggregator",
    description: "Trade Stablecoins with ease on Tower Exchange. AI-powered DEX aggregator with portfolio management.",
    images: [
      {
        url: "/assets/og-image.png",
        width: 1200,
        height: 630,
        alt: "Tower Exchange",
      },
    ],
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${sora.variable} ${cinzel.variable}  antialiased`} suppressHydrationWarning>
        <CustomRainbowKitProvider>
          <PrivyProvider>
            <InviteGate>
              <div className="flex flex-col min-h-screen relative">
                <Header />
                <div className="flex-1 pt-20 min-h-0">
                  {children}
                </div>
                <Footer />
              </div>
            </InviteGate>
          </PrivyProvider>
        </CustomRainbowKitProvider>
      </body>
    </html>
  );
}
