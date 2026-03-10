"use client";

import { useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { X, Search } from "lucide-react";
import Image from "next/image";

type Chain = {
  id: string;
  name: string;
  badge?: string;
  color: string;
  logo?: any;
};

type TokenRow = {
  symbol: string;
  name: string;
  address: string;
  logo?: any;
};

const CHAINS: Chain[] = [
  {
    id: "all",
    name: "All Chains",
    color: "#4B5563",
    logo: require("@/public/assets/globe-removebg-preview.svg"),
  },
  {
    id: "arc-testnet",
    name: "Arc Testnet",
    color: "#00AEEF",
    logo: require("@/public/assets/Arc Testnet logo.svg"),
  },
  {
    id: "base-sepolia",
    name: "Base Sepolia",
    color: "#0174F0",
    logo: require("@/public/assets/Base Sepolia logo.svg"),
  },
  {
    id: "optimism-sepolia",
    name: "Optimism Sepolia",
    color: "#FF0420",
    logo: require("@/public/assets/Optimism Sepolia logo.svg"),
  },
  {
    id: "avalanche-fuji",
    name: "Avalanche Fuji",
    color: "#E84142",
    logo: require("@/public/assets/Avalanche Fuji logo.svg"),
  },
  {
    id: "arbitrum-sepolia",
    name: "Arbitrum Sepolia",
    color: "#2D374B",
    logo: require("@/public/assets/Arbitrum Sepolia logo (2).svg"),
  },
];

const TOKENS: TokenRow[] = [
  {
    symbol: "ETH",
    name: "ETH",
    address: "0x76fb...9278",
    logo: require("@/public/assets/EthLogo.svg"),
  },
  {
    symbol: "PENGU",
    name: "Pudgy Penguins",
    address: "0x76fb...9278",
    logo: require("@/public/assets/PenguLogo.svg"),
  },
  {
    symbol: "MKR",
    name: "Maker",
    address: "0x76fb...9278",
    logo: require("@/public/assets/MakerLogo.svg"),
  },
  {
    symbol: "TAG",
    name: "TAGBOND",
    address: "0x76fb...9278",
    logo: require("@/public/assets/TagbondLogo.svg"),
  },
  {
    symbol: "USDT",
    name: "USDT",
    address: "0x76fb...9278",
    logo: require("@/public/assets/usdt_logo-removebg-preview.png"),
  },
];

export default function BridgeTokenSelectPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const side = searchParams.get("side") === "to" ? "to" : "from";

  const [chainSearch, setChainSearch] = useState("");
  const [tokenSearch, setTokenSearch] = useState("");
  const [selectedChainId, setSelectedChainId] = useState<string>("arc-testnet");

  const title = useMemo(
    () => (side === "to" ? "Exchange to" : "Exchange from"),
    [side]
  );

  const visibleChains = useMemo(() => {
    const query = chainSearch.toLowerCase().trim();
    if (!query) return CHAINS;
    return CHAINS.filter((chain) =>
      chain.name.toLowerCase().includes(query)
    );
  }, [chainSearch]);

  const filteredTokens = useMemo(() => {
    const q = tokenSearch.toLowerCase().trim();
    if (!q) return TOKENS;
    return TOKENS.filter((token) => {
      return (
        token.symbol.toLowerCase().includes(q) ||
        token.name.toLowerCase().includes(q) ||
        token.address.toLowerCase().includes(q)
      );
    });
  }, [tokenSearch]);

  return (
    <main className="flex-1 flex items-center justify-center py-10 px-4 min-h-screen">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-4xl rounded-3xl border border-border/70 bg-[#111214] shadow-2xl overflow-hidden flex"
      >
        {/* Left: chain list */}
        <aside className="hidden md:flex w-64 flex-col border-r border-border/70 bg-[#101113]">
          <div className="px-4 py-4 border-b border-border/60">
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
                <Search className="h-4 w-4" />
              </span>
              <input
                type="text"
                value={chainSearch}
                onChange={(e) => setChainSearch(e.target.value)}
                placeholder="Search Network"
                className="w-full rounded-xl bg-[#18191c] pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/70 border border-transparent focus:border-border outline-none"
              />
            </div>
          </div>

          <div className="px-4 py-3 text-xs text-muted-foreground uppercase tracking-wide">
            Top Chains
          </div>

          <div className="flex-1 overflow-y-auto pb-4">
            {visibleChains.length === 0 ? (
              <p className="px-4 py-8 text-xs text-muted-foreground">
                Chain not found
              </p>
            ) : (
              visibleChains.map((chain) => (
                <button
                  key={chain.id}
                  type="button"
                  onClick={() => setSelectedChainId(chain.id)}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                    selectedChainId === chain.id
                      ? "bg-[#18191c] text-foreground"
                      : "text-muted-foreground hover:bg-[#18191c]"
                  }`}
                >
                  <span className="inline-flex h-5 w-5 rounded-full overflow-hidden bg-[#232428]">
                    {chain.logo ? (
                      <Image
                        src={chain.logo}
                        alt={`${chain.name} logo`}
                        width={20}
                        height={20}
                        className="h-5 w-5 object-contain"
                      />
                    ) : (
                      <span
                        className="inline-flex h-full w-full rounded-full"
                        style={{ backgroundColor: chain.color }}
                      />
                    )}
                  </span>
                  <span>{chain.name}</span>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Right: token list */}
        <section className="flex-1 flex flex-col bg-[#111214]">
          <header className="flex items-center justify-between px-5 py-4 border-b border-border/60">
            <div className="flex flex-col gap-1">
              <h2 className="text-sm font-semibold text-foreground">
                {title}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#18191c] hover:bg-[#202225] text-muted-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          {/* Search input */}
          <div className="px-5 py-4 border-b border-border/60">
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
                <Search className="h-4 w-4" />
              </span>
              <input
                type="text"
                value={tokenSearch}
                onChange={(e) => setTokenSearch(e.target.value)}
                placeholder="search token name or paste address"
                className="w-full rounded-xl bg-[#18191c] pl-9 pr-3 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/70 border border-transparent focus:border-border outline-none"
              />
            </div>
          </div>

          {/* Token list */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
            {filteredTokens.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                Token not found
              </p>
            ) : (
              filteredTokens.map((token) => (
                <button
                  key={token.symbol}
                  type="button"
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left hover:bg-[#18191c] transition-colors"
                  onClick={() => {
                    const current = new URLSearchParams(
                      Array.from(searchParams.entries())
                    );
                    current.set(`${side}Token`, token.symbol);
                    if (selectedChainId) {
                      current.set(`${side}Chain`, selectedChainId);
                    }
                    router.push(`/bridge?${current.toString()}`);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#232428] overflow-hidden">
                      {token.logo ? (
                        <Image
                          src={token.logo}
                          alt={`${token.symbol} logo`}
                          width={24}
                          height={24}
                          className="h-6 w-6 object-contain"
                        />
                      ) : (
                        <span className="text-xs font-semibold text-foreground">
                          {token.symbol[0]}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-foreground">
                        {token.symbol}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {token.name}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {token.address}
                  </span>
                </button>
              ))
            )}
          </div>
        </section>
      </motion.div>
    </main>
  );
}

