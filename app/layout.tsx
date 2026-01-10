import type { Metadata } from "next";
import { Sora } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tower Finance - Cryptocurrency Trading Platform",
  description: "Trade cryptocurrencies with ease on Tower Finance",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${sora.variable} font-sans antialiased`}>
        <div
          className="min-h-screen flex flex-col"
          style={{
            background:
              "radial-gradient(ellipse 50% 50% at 50% 90%, rgba(123, 184, 255, 0.15), transparent), hsl(220, 20%, 6%)",
          }}
        >
          <Header />
          {children}
          <Footer />
        </div>
      </body>
    </html>
  );
}
