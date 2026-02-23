import type { Metadata } from "next";
import { Sora, Cinzel } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { PrivyProvider } from "@/components/providers/PrivyProvider";

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
  title: "Tower Exchange - An AI powered DEX aggregator and portfolio management tool",
  description: "Trade cryptocurrencies with ease on Tower Exchange",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${sora.variable} ${cinzel.variable}  antialiased`} suppressHydrationWarning>
        <PrivyProvider>
          <div className="flex flex-col min-h-screen relative">
            <Header />
            <div className="flex-1 pt-20">
              {children}
            </div>
            <Footer />
          </div>
        </PrivyProvider>
      </body>
    </html>
  );
}
