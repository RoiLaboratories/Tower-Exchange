import { useState, useEffect } from "react";
import { StaticImageData } from "next/image";
import { getTokenIcon } from "./tokenIcons";
import { ARC_TESTNET_CONFIG } from "./arcNetwork";
import { DEFAULT_TOKEN_USD_PRICES } from "./tokenUsdPrices";

export interface WalletHolding {
  token: string;
  icon: StaticImageData | null;
  balance: string;
  price: string;
  value: string;
  rawBalance: number;
}

const SUPPORTED_SWAP_ERC20_TOKENS = {
  EURC: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
  USDT: "0x175CdB1D338945f0D851A741ccF787D343E57952",
  cirBTC: "0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF",
};

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
              chainId: String(ARC_TESTNET_CONFIG.chainId),
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

        const nativeBalanceFormatted = await fetchBalance({
          balanceType: "native",
        });

        const tokenPromises = Object.entries(SUPPORTED_SWAP_ERC20_TOKENS).map(
          async ([tokenName, tokenAddress]) => {
            try {
              const balance = await fetchBalance({ tokenAddress });
              return { tokenName, balance };
            } catch (err) {
              console.error(`Error fetching ${tokenName} balance:`, err);
              return { tokenName, balance: 0 };
            }
          }
        );

        const tokenBalances = await Promise.all(tokenPromises);

        // Get token prices from CoinGecko
        let priceMap: Record<string, number> = {
          ...DEFAULT_TOKEN_USD_PRICES,
        };

        try {
          const priceResponse = await fetch(
            "https://api.coingecko.com/api/v3/simple/price?ids=usd-coin,eurc,tether&vs_currencies=usd"
          );
          const prices = await priceResponse.json();
          priceMap = {
            USDC: prices["usd-coin"]?.usd || DEFAULT_TOKEN_USD_PRICES.USDC,
            EURC: prices.eurc?.usd || DEFAULT_TOKEN_USD_PRICES.EURC,
            USDT: prices.tether?.usd || DEFAULT_TOKEN_USD_PRICES.USDT,
            cirBTC: DEFAULT_TOKEN_USD_PRICES.cirBTC,
          };
        } catch (err) {
          console.warn("Failed to fetch prices from CoinGecko, using defaults", err);
        }

        const newHoldings: WalletHolding[] = [];

        // Add native USDC balance
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

        // Add ERC20 tokens
        tokenBalances.forEach(({ tokenName, balance }) => {
          if (balance > 0) {
            const formattedBalance = balance;

            // Skip if balance is too small (dust)
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

        // Sort by value (descending)
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

    // Debounce the fetch to avoid too many API calls
    const timer = setTimeout(fetchHoldings, 300);
    return () => clearTimeout(timer);
  }, [walletAddress]);

  return { holdings, loading, error };
};
