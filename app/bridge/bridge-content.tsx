"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import {
  ArrowDown,
  RefreshCw,
  Settings,
  Lock,
  ChevronDown,
  Plus,
  X,
  Wallet,
} from "lucide-react";
import SettingsModal from "@/components/SettingsModal";
import usdcLogo from "@/public/assets/USDC-fotor-bg-remover-2025111075935.png";
import ethLogo from "@/public/assets/Eth_logo_3-removebg-preview.png";
import penguLogo from "@/public/assets/PenguLogo.svg";
import makerLogo from "@/public/assets/MakerLogo.svg";
import tagbondLogo from "@/public/assets/TagbondLogo.svg";
import usdtLogo from "@/public/assets/usdt_logo-removebg-preview.png";
import arcTestnetLogo from "@/public/assets/Arc Testnet logo.svg";
import baseSepoliaLogo from "@/public/assets/Base Sepolia logo.svg";
import optimismSepoliaLogo from "@/public/assets/Optimism Sepolia logo.svg";
import avalancheFujiLogo from "@/public/assets/Avalanche Fuji logo.svg";
import arbitrumSepoliaLogo from "@/public/assets/Arbitrum Sepolia logo (2).svg";

type BridgeToken = {
  symbol: string;
  label: string;
  usdValue: string;
  logo?: any;
};

type BridgeChain = {
  id: string;
  name: string;
  logo?: any;
};

const BRIDGE_TOKENS: BridgeToken[] = [
  {
    symbol: "USDC",
    label: "USDC",
    usdValue: "$1",
    logo: usdcLogo,
  },
  {
    symbol: "ETH",
    label: "ETH",
    usdValue: "$1",
    logo: ethLogo,
  },
  {
    symbol: "PENGU",
    label: "PENGU",
    usdValue: "$1",
    logo: penguLogo,
  },
  {
    symbol: "MKR",
    label: "MKR",
    usdValue: "$1",
    logo: makerLogo,
  },
  {
    symbol: "TAG",
    label: "TAG",
    usdValue: "$1",
    logo: tagbondLogo,
  },
  {
    symbol: "USDT",
    label: "USDT",
    usdValue: "$1",
    logo: usdtLogo,
  },
];

const BRIDGE_CHAINS: BridgeChain[] = [
  {
    id: "arc-testnet",
    name: "Arc Testnet",
    logo: arcTestnetLogo,
  },
  {
    id: "base-sepolia",
    name: "Base Sepolia",
    logo: baseSepoliaLogo,
  },
  {
    id: "optimism-sepolia",
    name: "Optimism Sepolia",
    logo: optimismSepoliaLogo,
  },
  {
    id: "avalanche-fuji",
    name: "Avalanche Fuji",
    logo: avalancheFujiLogo,
  },
  {
    id: "arbitrum-sepolia",
    name: "Arbitrum Sepolia",
    logo: arbitrumSepoliaLogo,
  },
];

export default function BridgePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [fromAmount, setFromAmount] = useState("0.00");
  const [toAmount, setToAmount] = useState("0.00");
  const [fromToken, setFromToken] = useState<BridgeToken | null>(null);
  const [toToken, setToToken] = useState<BridgeToken | null>(null);
  const [fromChainId, setFromChainId] = useState<string | null>(null);
  const [toChainId, setToChainId] = useState<string | null>(null);
  const [slippageTolerance, setSlippageTolerance] = useState(0.5);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isReceivingOpen, setIsReceivingOpen] = useState(false);
  const [receivingAddress, setReceivingAddress] = useState("");

  useEffect(() => {
    const fromSymbol = searchParams.get("fromToken");
    const toSymbol = searchParams.get("toToken");
    const fromChain = searchParams.get("fromChain");
    const toChain = searchParams.get("toChain");

    if (fromSymbol) {
      const t = BRIDGE_TOKENS.find(
        (token) => token.symbol.toLowerCase() === fromSymbol.toLowerCase()
      );
      if (t) setFromToken(t);
    }

    if (toSymbol) {
      const t = BRIDGE_TOKENS.find(
        (token) => token.symbol.toLowerCase() === toSymbol.toLowerCase()
      );
      if (t) setToToken(t);
    }

    if (fromChain) setFromChainId(fromChain);
    if (toChain) setToChainId(toChain);
  }, [searchParams]);

  const fromDisplayToken = fromToken ?? BRIDGE_TOKENS[0];
  const toDisplayToken = toToken ?? BRIDGE_TOKENS[1];
  const fromChain = fromChainId
    ? BRIDGE_CHAINS.find((c) => c.id === fromChainId) ?? null
    : null;
  const toChain = toChainId
    ? BRIDGE_CHAINS.find((c) => c.id === toChainId) ?? null
    : null;

  return (
    <main className="flex-1 flex items-center justify-center py-12 px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="relative rounded-3xl border border-border/70 bg-[#111214] px-6 pt-5 pb-6 shadow-xl overflow-hidden">
          {/* Header */}
          <div className="mb-5 flex items-center justify-between">
            <div className="inline-flex items-center gap-1 rounded-full bg-[#111214] p-1">
              <button
                type="button"
                onClick={() => router.push("/")}
                className="px-3 py-1.5 text-xs font-medium rounded-full text-muted-foreground hover:text-foreground hover:bg-[#1b1d21] transition-colors"
              >
                Swap
              </button>
            <button
                type="button"
                className="px-3 py-1.5 text-xs font-medium rounded-full bg-[#1f2125] text-foreground"
              >
                Bridge
              </button>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <button
                type="button"
                onClick={() => {
                  setFromAmount("0.00");
                  setToAmount("0.00");
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#18191c] hover:bg-[#202225] transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#18191c] hover:bg-[#202225] transition-colors"
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Bridge from */}
          <section className="rounded-2xl bg-[#151618] px-4 py-3 mb-2 border border-border/50">
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium">Bridge from</span>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  <span>0 —</span>
                </div>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  50%
                </button>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Max
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              {/* Token selector */}
              <button
                type="button"
                onClick={() => {
                  const current = new URLSearchParams(
                    Array.from(searchParams.entries())
                  );
                  current.set("side", "from");
                  router.push(`/bridge/select?${current.toString()}`);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1b1c1f] px-3 py-2 text-sm font-medium text-foreground hover:bg-[#222327] transition-colors"
              >
                <span className="relative inline-flex h-6 w-6 items-center justify-center">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#232428] overflow-hidden">
                    {fromToken?.logo && (
                      <Image
                        src={fromToken.logo}
                        alt={`${fromToken.symbol} logo`}
                        width={24}
                        height={24}
                        className="h-6 w-6 object-contain"
                      />
                    )}
                  </span>
                  {fromChain?.logo && (
                    <span className="absolute -bottom-1 right-0 inline-flex h-3 w-3 items-center justify-center rounded-full border border-[#111214] bg-[#111214] overflow-hidden">
                      <Image
                        src={fromChain.logo}
                        alt={`${fromChain.name} logo`}
                        width={12}
                        height={12}
                        className="h-3 w-3 object-contain"
                      />
                    </span>
                  )}
                </span>
                <span className="truncate">
                  {fromToken ? fromToken.label : "Select Token"}
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>

              {/* Amount */}
              <div className="text-right flex-1">
                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={fromAmount}
                  onChange={(e) => setFromAmount(e.target.value)}
                  className="w-full bg-transparent text-right text-2xl font-semibold text-foreground outline-none border-0 focus:ring-0"
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground">-$0</p>
              </div>
            </div>
          </section>

          {/* Arrow separator */}
          <div className="flex justify-center my-1">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#151618] border border-border/60">
              <ArrowDown className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          {/* Bridge to */}
          <section className="rounded-2xl bg-[#151618] px-4 py-3 mb-3 border border-border/50">
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium">Bridge to</span>
              <div className="flex items-center gap-1">
                <Lock className="h-3 w-3" />
                <span>—</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              {/* Token selector */}
              <button
                type="button"
                onClick={() => {
                  const current = new URLSearchParams(
                    Array.from(searchParams.entries())
                  );
                  current.set("side", "to");
                  router.push(`/bridge/select?${current.toString()}`);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1b1c1f] px-3 py-2 text-sm font-medium text-foreground hover:bg-[#222327] transition-colors"
              >
                <span className="relative inline-flex h-6 w-6 items-center justify-center">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#232428] overflow-hidden">
                    {toToken?.logo && (
                      <Image
                        src={toToken.logo}
                        alt={`${toToken.symbol} logo`}
                        width={24}
                        height={24}
                        className="h-6 w-6 object-contain"
                      />
                    )}
                  </span>
                  {toChain?.logo && (
                    <span className="absolute -bottom-1 right-0 inline-flex h-3 w-3 items-center justify-center rounded-full border border-[#111214] bg-[#111214] overflow-hidden">
                      <Image
                        src={toChain.logo}
                        alt={`${toChain.name} logo`}
                        width={12}
                        height={12}
                        className="h-3 w-3 object-contain"
                      />
                    </span>
                  )}
                </span>
                <span className="truncate">
                  {toToken ? toToken.label : "Select Token"}
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>

              {/* Amount */}
              <div className="text-right flex-1">
                <p className="text-2xl font-semibold text-foreground">
                  {toAmount}
                </p>
                <p className="text-xs text-muted-foreground">-$0</p>
              </div>
            </div>
          </section>

          {/* Add / show receiving address */}
          <button
            type="button"
            onClick={() => setIsReceivingOpen(true)}
            className="mb-4 inline-flex w-full items-center gap-2 rounded-xl border border-dashed border-border/70 bg-transparent px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-[#151618] hover:text-foreground transition-colors"
          >
            <Plus className="h-3 w-3" />
            <span>
              {receivingAddress
                ? `Receiving Address: ${
                    receivingAddress.length > 10
                      ? `${receivingAddress.slice(0, 6)}...${receivingAddress.slice(-4)}`
                      : receivingAddress
                  }`
                : "Add receiving address"}
            </span>
          </button>

          {/* Primary bridge button */}
          <button
            type="button"
            disabled
            className="inline-flex w-full items-center justify-center rounded-2xl bg-[#1b1c1f] py-3 text-sm font-semibold text-muted-foreground opacity-60 cursor-not-allowed"
          >
            Bridge
          </button>

          {/* Bottom token pills (reflect current selection, not interactive) */}
          <div className="mt-5 flex items-center justify-center gap-3">
            {[fromDisplayToken, toDisplayToken].map((token, idx) => (
              <div
                key={`${token.symbol}-${idx}`}
                className="inline-flex items-center gap-2 rounded-full bg-[#151618] px-3 py-1.5 text-xs font-medium text-foreground/90 border border-border/60"
              >
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#232428] overflow-hidden">
                  {token.logo ? (
                    <Image
                      src={token.logo}
                      alt={`${token.symbol} logo`}
                      width={20}
                      height={20}
                      className="h-5 w-5 object-contain"
                    />
                  ) : null}
                </span>
                <span>{token.symbol}</span>
                <span className="text-muted-foreground text-[11px]">
                  {token.usdValue}
                </span>
              </div>
            ))}
          </div>

          {/* Soft background glow */}
          <div className="pointer-events-none absolute inset-0 -z-10 rounded-3xl bg-gradient-to-br from-primary/10 via-transparent to-primary/5 opacity-60" />
        </div>
      </motion.div>

      {/* Slippage settings modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        slippageTolerance={slippageTolerance}
        onSlippageChange={setSlippageTolerance}
        title="Bridge Settings"
      />

      {/* Receiving address modal */}
      {isReceivingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-sm rounded-2xl bg-[#111214] border border-border/70 shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
              <h2 className="text-sm font-semibold text-foreground">
                Receiving Address
              </h2>
              <button
                type="button"
                onClick={() => setIsReceivingOpen(false)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#18191c] hover:bg-[#202225] text-muted-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 pt-4 pb-3 space-y-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-2">
                  Enter Destination Address
                </label>
                <input
                  type="text"
                  value={receivingAddress}
                  onChange={(e) => setReceivingAddress(e.target.value)}
                  placeholder="0x..."
                  className="w-full rounded-xl bg-[#18191c] px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 border border-border/70 focus:outline-none focus:border-border"
                />
              </div>
              <button
                type="button"
                disabled={!receivingAddress.trim()}
                onClick={() => setIsReceivingOpen(false)}
                className="mt-1 inline-flex w-full items-center justify-center rounded-full bg-[#1b1c1f] py-2.5 text-xs font-semibold text-muted-foreground disabled:opacity-60 disabled:cursor-not-allowed hover:bg-[#222327] hover:text-foreground transition-colors"
              >
                Done
              </button>
            </div>

            <div className="px-5 pt-1 pb-4">
              <p className="text-[11px] font-medium text-muted-foreground mb-2">
                Recent Addresses
              </p>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs hover:bg-[#18191c] transition-colors"
                onClick={() => setReceivingAddress("0x22...2111")}
              >
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#232428]">
                    <Wallet className="h-3.5 w-3.5 text-foreground" />
                  </span>
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-medium text-foreground">
                      Wallet 1
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      0x22...2111
                    </span>
                  </div>
                </div>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </main>
  );
}
