import { useState, useEffect } from "react";
import type { StaticImageData } from "next/image";

import { getTokenIcon } from "./tokenIcons";
import { ARC_TESTNET_CONFIG, TOKEN_CONTRACTS } from "./arcNetwork";
import { fetchArcTokenUsdPrices } from "./tokenUsdPrices";

export interface WalletHolding {
  token: string;
  icon: StaticImageData | null;
  balance: string;
  price: string;
  value: string;
  rawBalance: number;
}

const ARC_HOLDINGS_CHAIN_ID = "arc-testnet";
const SUPPORTED_PROFILE_TOKENS = [
  { symbol: "EURC", address: TOKEN_CONTRACTS.EURC },
  { symbol: "USDT", address: TOKEN_CONTRACTS.USDT },
  { symbol: "cirBTC", address: TOKEN_CONTRACTS.CIRBTC },
  { symbol: "cNGN", address: TOKEN_CONTRACTS.cNGN },
  { symbol: "QCAD", address: TOKEN_CONTRACTS.QCAD },
] as const;

export const useWalletHoldings = (walletAddress: string | null) => {
  const [holdings, setHoldings] = useState<WalletHolding[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!walletAddress) {
      setHoldings([]);
      return;
    }

    const fetchHoldings = async () => {
      setLoading(true);
      setError(null);
      try {
        const fetchBalance = async ({
          tokenAddress,
          balanceType,
        }: {
          tokenAddress?: string;
          balanceType?: "native";
        }) => {
          const response = await fetch("/api/wallet/balance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              address: walletAddress,
              chainId: ARC_HOLDINGS_CHAIN_ID,
              rpcUrl: ARC_TESTNET_CONFIG.rpcUrl,
              tokenAddress,
              balanceType,
            }),
          });

          if (!response.ok) {
            throw new Error("Failed to fetch wallet balance.");
          }

          const data = (await response.json()) as {
            balance?: string;
            error?: string;
          };

          const parsedBalance = Number.parseFloat(data.balance ?? "0");
          return Number.isFinite(parsedBalance) ? parsedBalance : 0;
        };

        const [nativeBalanceFormatted, tokenBalances, priceMap] = await Promise.all([
          fetchBalance({
            balanceType: "native",
          }),
          Promise.all(
            SUPPORTED_PROFILE_TOKENS.map(async ({ symbol, address }) => {
              try {
                const balance = await fetchBalance({ tokenAddress: address });
                return { tokenName: symbol, balance };
              } catch (err) {
                console.error(`Error fetching ${symbol} balance:`, err);
                return { tokenName: symbol, balance: 0 };
              }
            }),
          ),
          fetchArcTokenUsdPrices(),
        ]);

        const newHoldings: WalletHolding[] = [];

        if (nativeBalanceFormatted > 0.000001) {
          const price = priceMap.USDC;
          newHoldings.push({
            token: "USDC",
            icon: getTokenIcon("USDC"),
            balance: nativeBalanceFormatted.toFixed(6),
            price: `$${price.toFixed(2)}`,
            value: `$${(nativeBalanceFormatted * price).toFixed(2)}`,
            rawBalance: nativeBalanceFormatted,
          });
        }

        tokenBalances.forEach(({ tokenName, balance }) => {
          if (balance > 0) {
            const formattedBalance = balance;

            if (formattedBalance < 0.000001) return;

            const price = priceMap[tokenName] || 0;
            const value = formattedBalance * price;

            console.log(`Adding ${tokenName}: ${formattedBalance} (price: ${price})`);

            newHoldings.push({
              token: tokenName,
              icon: getTokenIcon(tokenName),
              balance: formattedBalance.toFixed(6),
              price: `$${price.toFixed(2)}`,
              value: `$${value.toFixed(2)}`,
              rawBalance: formattedBalance,
            });
          }
        });

        newHoldings.sort(
          (a, b) =>
            parseFloat(b.value.replace("$", "")) -
            parseFloat(a.value.replace("$", ""))
        );

        setHoldings(newHoldings);
      } catch (err) {
        console.error("Error fetching wallet holdings:", err);
        setError(
          err instanceof Error ? err.message : "Failed to fetch holdings"
        );
        setHoldings([]);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(fetchHoldings, 300);
    return () => clearTimeout(timer);
  }, [walletAddress]);

  return { holdings, loading, error };
};
