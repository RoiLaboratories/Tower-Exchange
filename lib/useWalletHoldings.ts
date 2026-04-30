import { useState, useEffect } from "react";
import { StaticImageData } from "next/image";
import { getTokenIcon } from "./tokenIcons";
import { ARC_TESTNET_CONFIG } from "./arcNetwork";

export interface WalletHolding {
  token: string;
  icon: StaticImageData | null;
  balance: string;
  price: string;
  value: string;
  rawBalance: number;
}

const COMMON_ERC20_TOKENS = {
  WUSDC: "0xD40fCAa5d2cE963c5dABC2bf59E268489ad7BcE4",
  QTM: "0xCD304d2A421BFEd31d45f0054AF8E8a6a4cF3EaE",
  EURC: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
  SWPRC: "0xBE7477BF91526FC9988C8f33e91B6db687119D45",
};

const TOKEN_DECIMALS: Record<string, number> = {
  USDC: 18,
  WUSDC: 18,
  QTM: 18,
  EURC: 6,
  SWPRC: 6,
};

const RPC_URL = ARC_TESTNET_CONFIG.rpcUrl;

const formatBigIntUnits = (value: bigint, decimals: number): number => {
  return Number(value) / Math.pow(10, decimals);
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
        // Helper function to make JSON-RPC calls
        const jsonRpcCall = async (method: string, params: unknown[]) => {
          const response = await fetch(RPC_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              method,
              params,
              id: 1,
            }),
          });
          const data = await response.json();
          if (data.error) {
            throw new Error(data.error.message);
          }
          return data.result;
        };

        // Fetch native balance (USDC on Arc)
        const nativeBalance = await jsonRpcCall("eth_getBalance", [
          walletAddress,
          "latest",
        ]);
        const nativeBalanceFormatted = formatBigIntUnits(
          BigInt(nativeBalance || "0x0"),
          TOKEN_DECIMALS.USDC
        );

        // Fetch token balances using eth_call to balanceOf function
        const tokenPromises = Object.entries(COMMON_ERC20_TOKENS).map(
          async ([tokenName, tokenAddress]) => {
            try {
              // Encode balanceOf function call
              // balanceOf(address) = 0x70a08231 + padded address
              const data =
                "0x70a08231" +
                walletAddress.slice(2).padStart(64, "0");

              const result = await jsonRpcCall("eth_call", [
                {
                  to: tokenAddress,
                  data,
                },
                "latest",
              ]);

              // Handle empty result
              if (!result || result === "0x") {
                console.log(`No balance found for ${tokenName}`);
                return { tokenName, balance: 0n };
              }

              const balance = BigInt(result);
              console.log(`${tokenName} balance (raw): ${balance.toString()}`);
              return { tokenName, balance };
            } catch (err) {
              console.error(`Error fetching ${tokenName} balance:`, err);
              return { tokenName, balance: 0n };
            }
          }
        );

        const tokenBalances = await Promise.all(tokenPromises);

        // Get token prices from CoinGecko
        let priceMap: Record<string, number> = {
          USDC: 1,
          WUSDC: 1,
          QTM: 0,
          EURC: 1,
          SWPRC: 0,
        };

        try {
          const priceResponse = await fetch(
            "https://api.coingecko.com/api/v3/simple/price?ids=usd-coin,stasis-eur-coin&vs_currencies=usd"
          );
          const prices = await priceResponse.json();
          priceMap = {
            USDC: prices["usd-coin"]?.usd || 1,
            WUSDC: prices["usd-coin"]?.usd || 1,
            QTM: 0,
            EURC: prices["stasis-eur-coin"]?.usd || 1,
            SWPRC: 0,
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
          if (balance > 0n) {
            const formattedBalance = formatBigIntUnits(
              balance,
              TOKEN_DECIMALS[tokenName] ?? 18
            );
            
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
