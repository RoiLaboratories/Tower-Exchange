"use client";
import {
  ArrowDown,
  BarChart3,
  Settings,
  ChevronDown,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { 
  fetchArcBalance, 
  fetchERC20Balance,
  fetchERC20Allowance,
  formatBalance, 
  getRevertReasonViaPublicRpc,
  TOKEN_CONTRACTS,
  TOKEN_DECIMALS,
  NATIVE_TOKENS,
  ERC20_TOKENS,
  ARC_CHAIN_HEX,
  ARC_ADD_NETWORK_PARAMS,
  ARC_POOLS,
} from "@/lib/arcNetwork";
import { useTowerSwap } from "@/lib/hooks/useTowerSwap";

import usdcLogo from "@/public/assets/USDC-fotor-bg-remover-2025111075935.png";
import usdtLogo from "@/public/assets/usdt_logo-removebg-preview.png";
import ethLogo from "@/public/assets/Eth_logo_3-removebg-preview.png";
import uniLogo from "@/public/assets/uniswap-removebg-preview.png";
import hypeLogo from "@/public/assets/hype.png";
import eurcLogo from "@/public/assets/Euro_Coin logo.png";
import swprcLogo from "@/public/assets/swapr_logo.png";
import syntharaLogo from "@/public/assets/synthra logo.png";
import quantumLogo from "@/public/assets/quantum-logo.png";
import TokenModal from "./TokenModal";
import SettingsModal from "./SettingsModal";
import ChartModal from "./ChartModal";
import TokenInput from "./reusable/TokenInput";
import SwapNotification from "./SwapNotification";

// Tokens available on frontend (supported by Tower Finance DEX Aggregator)
const tokens = [
  { symbol: "USDC", icon: usdcLogo, name: "USD Coin", balance: 1000 },
  { symbol: "ETH", icon: ethLogo, name: "Ethereum", balance: 2.5 },
  { symbol: "USDT", icon: usdtLogo, name: "Tether", balance: 500 },
  { symbol: "EURC", icon: eurcLogo, name: "Euro Coin", balance: 750 },
  { symbol: "SYN", icon: syntharaLogo, name: "Synthra", balance: 100 },
  { symbol: "SWPRC", icon: swprcLogo, name: "Swaparc Token", balance: 300 },
  { symbol: "UNI", icon: uniLogo, name: "Uniswap", balance: 50 },
  { symbol: "HYPE", icon: hypeLogo, name: "Hyperliquid", balance: 100 },
  { symbol: "WUSDC", icon: usdcLogo, name: "Wrapped USDC", balance: 500 },
  { symbol: "QTM", icon: quantumLogo, name: "Quantum", balance: 100 },
];

interface TokenSelectorProps {
  selected: (typeof tokens)[0];
  onSelect: (token: (typeof tokens)[0]) => void;
  excludeSymbol?: string;
  onOpenModal: () => void;
}

const TokenSelector = ({ selected, onOpenModal }: TokenSelectorProps) => {
  return (
    <motion.button
      onClick={onOpenModal}
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="w-6 h-6 rounded-full bg-primary/30 flex items-center justify-center overflow-hidden">
        <Image
          src={selected.icon}
          alt={`${selected.symbol} logo`}
          width={24}
          height={24}
          className="object-contain w-full h-full"
        />
      </div>
      <span className="font-medium text-white">{selected.symbol}</span>
      <ChevronDown className="w-4 h-4 text-muted-foreground" />
    </motion.button>
  );
};

const SwapCard = () => {
  // Privy hook
  const { user, login, authenticated } = usePrivy();
  const { wallets } = useWallets();
  
  // Tower Finance DEX Aggregator hook
  const { getQuote, buildSwapTransaction, error: towerError } = useTowerSwap();

  // Wallet and transaction states
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [chainId, setChainId] = useState<string | null>(null);
  const [swapState, setSwapState] = useState<
    "idle" | "loading" | "success" | "failed"
  >("idle");
  const [notification, setNotification] = useState<"success" | "failed" | null>(
    null
  );
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [revertReason, setRevertReason] = useState<string | null>(null);
  const [slippageTolerance, setSlippageTolerance] = useState(1); // 1% default to reduce "execution reverted" from slippage
  const [resetApprovalLoading, setResetApprovalLoading] = useState(false);

  // Monitor chain ID changes
  useEffect(() => {
    if (!authenticated || typeof window === "undefined") return;

    const checkChainId = async () => {
      try {
        const connectedWallet = wallets.find(
          (w) => w.address?.toLowerCase() === user?.wallet?.address?.toLowerCase()
        );
        
        if (connectedWallet) {
          const provider = await connectedWallet.getEthereumProvider();
          if (provider) {
            const currentChainId = await provider.request({ method: "eth_chainId" });
            setChainId(currentChainId as string);
          }
        }
      } catch (error) {
        console.error("Error checking chain ID:", error);
      }
    };

    checkChainId();

    // Listen for chain changes
    const handleChainChanged = (newChainId: string) => {
      setChainId(newChainId);
    };

    if (typeof window !== "undefined" && (window as any).ethereum) {
      const { ethereum } = window as any;
      ethereum.on?.("chainChanged", handleChainChanged);
      return () => ethereum.removeListener?.("chainChanged", handleChainChanged);
    }
  }, [authenticated, user, wallets]);

  // Check if on Arc Testnet
  const isOnArcTestnet = chainId === ARC_CHAIN_HEX;

  // Function to switch/add Arc Testnet network
  const switchToArcTestnet = async () => {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      throw new Error("No Ethereum provider found");
    }

    try {
      const { ethereum } = window as any;
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: ARC_CHAIN_HEX }],
      });
    } catch (switchError: any) {
      // This error code indicates that the chain has not been added to MetaMask
      if (switchError.code === 4902) {
        try {
          await (window as any).ethereum.request({
            method: "wallet_addEthereumChain",
            params: ARC_ADD_NETWORK_PARAMS,
          });
        } catch (addError) {
          throw new Error("Failed to add Arc Testnet network");
        }
      } else {
        throw switchError;
      }
    }
  };

  const toHexQuantity = (value: bigint | number | string) => {
    const v = typeof value === "bigint" ? value : BigInt(value);
    return "0x" + v.toString(16);
  };

  // Minimal calldata encoding for ERC20 approve(spender, amount)
  // approve(address,uint256) selector = 0x095ea7b3
  const encodeErc20Approve = (spender: string, amountWei: string) => {
    const selector = "0x095ea7b3";
    const spenderNo0x = spender.toLowerCase().replace(/^0x/, "");
    const spenderPadded = spenderNo0x.padStart(64, "0");
    const amountHex = BigInt(amountWei).toString(16).padStart(64, "0");
    return selector + spenderPadded + amountHex;
  };

  // Token and amount states
  const [sellAmount, setSellAmount] = useState("0.00");
  const [receiveAmount, setReceiveAmount] = useState("0.00");
  const [sellToken, setSellToken] = useState(tokens[0]);
  const [receiveToken, setReceiveToken] = useState(tokens[1]);

  // Actual wallet balances
  const [tokenBalances, setTokenBalances] = useState<Record<string, number>>({
    USDC: 0,
    WUSDC: 0,
    ETH: 0,
    USDT: 0,
    EURC: 0,
    SYN: 0,
    SWPRC: 0,
    QTM: 0,
    UNI: 0,
    HYPE: 0,
  });
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);

  // Modal states
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isChartOpen, setIsChartOpen] = useState(false);
  const [isSellTokenModalOpen, setIsSellTokenModalOpen] = useState(false);
  const [isReceiveTokenModalOpen, setIsReceiveTokenModalOpen] = useState(false);

  // Fetch actual wallet balances from Arc testnet
  const fetchUserBalances = useCallback(async () => {
    if (!user?.wallet?.address) {
      console.log("Wallet address not available");
      return;
    }

    console.log("Fetching balances for wallet:", user.wallet.address);
    setIsLoadingBalances(true);
    try {
      // Fetch USDC balance from Arc testnet (native balance)
      const usdcBalance = await fetchArcBalance(user.wallet.address);
      console.log("USDC balance:", usdcBalance);
      
      if (usdcBalance) {
        setTokenBalances((prev) => ({
          ...prev,
          USDC: parseFloat(formatBalance(usdcBalance)),
        }));
      }

      // Fetch WUSDC balance
      if (TOKEN_CONTRACTS.WUSDC) {
        console.log("Fetching WUSDC balance from:", TOKEN_CONTRACTS.WUSDC);
        const wusdcBalanceWei = await fetchERC20Balance(
          user.wallet.address,
          TOKEN_CONTRACTS.WUSDC
        );
        console.log("WUSDC balance (wei):", wusdcBalanceWei);
        if (wusdcBalanceWei && wusdcBalanceWei !== "0x0") {
          try {
            const wusdcBalanceBigInt = BigInt(wusdcBalanceWei || "0");
            const wusdcBalance = Number(wusdcBalanceBigInt) / 10 ** (TOKEN_DECIMALS.WUSDC || 6);
            console.log("WUSDC balance (converted):", wusdcBalance);
            setTokenBalances((prev) => ({
              ...prev,
              WUSDC: wusdcBalance,
            }));
          } catch (e) {
            console.error("Error converting WUSDC balance:", e);
          }
        }
      }

      // Fetch QTM balance
      if (TOKEN_CONTRACTS.QTM) {
        console.log("Fetching QTM balance from:", TOKEN_CONTRACTS.QTM);
        const qtmBalanceWei = await fetchERC20Balance(
          user.wallet.address,
          TOKEN_CONTRACTS.QTM
        );
        console.log("QTM balance (wei):", qtmBalanceWei);
        if (qtmBalanceWei && qtmBalanceWei !== "0x0") {
          try {
            const qtmBalanceBigInt = BigInt(qtmBalanceWei || "0");
            const qtmBalance = Number(qtmBalanceBigInt) / 10 ** (TOKEN_DECIMALS.QTM || 18);
            console.log("QTM balance (converted):", qtmBalance);
            setTokenBalances((prev) => ({
              ...prev,
              QTM: qtmBalance,
            }));
          } catch (e) {
            console.error("Error converting QTM balance:", e);
          }
        }
      }

      // Fetch EURC balance
      if (TOKEN_CONTRACTS.EURC) {
        console.log("Fetching EURC balance from:", TOKEN_CONTRACTS.EURC);
        const eurcBalanceWei = await fetchERC20Balance(
          user.wallet.address,
          TOKEN_CONTRACTS.EURC
        );
        console.log("EURC balance (wei):", eurcBalanceWei);
        if (eurcBalanceWei && eurcBalanceWei !== "0x0") {
          try {
            const eurcBalanceBigInt = BigInt(eurcBalanceWei || "0");
            const eurcBalance = Number(eurcBalanceBigInt) / 10 ** (TOKEN_DECIMALS.EURC || 6);
            console.log("EURC balance (converted):", eurcBalance);
            setTokenBalances((prev) => ({
              ...prev,
              EURC: eurcBalance,
            }));
          } catch (e) {
            console.error("Error converting EURC balance:", e);
          }
        }
      }

      // Fetch SWPRC balance
      if (TOKEN_CONTRACTS.SWPRC) {
        console.log("Fetching SWPRC balance from:", TOKEN_CONTRACTS.SWPRC);
        const swprcBalanceWei = await fetchERC20Balance(
          user.wallet.address,
          TOKEN_CONTRACTS.SWPRC
        );
        console.log("SWPRC balance (wei):", swprcBalanceWei);
        if (swprcBalanceWei && swprcBalanceWei !== "0x0") {
          try {
            const swprcBalanceBigInt = BigInt(swprcBalanceWei || "0");
            const swprcBalance = Number(swprcBalanceBigInt) / 10 ** (TOKEN_DECIMALS.SWPRC || 6);
            console.log("SWPRC balance (converted):", swprcBalance);
            setTokenBalances((prev) => ({
              ...prev,
              SWPRC: swprcBalance,
            }));
          } catch (e) {
            console.error("Error converting SWPRC balance:", e);
          }
        }
      }

      // Fetch USDT balance
      if (TOKEN_CONTRACTS.USDT) {
        console.log("Fetching USDT balance from:", TOKEN_CONTRACTS.USDT);
        const usdtBalanceWei = await fetchERC20Balance(
          user.wallet.address,
          TOKEN_CONTRACTS.USDT
        );
        console.log("USDT balance (wei):", usdtBalanceWei);
        if (usdtBalanceWei && usdtBalanceWei !== "0x0") {
          try {
            const usdtBalanceBigInt = BigInt(usdtBalanceWei || "0");
            const usdtBalance = Number(usdtBalanceBigInt) / 10 ** (TOKEN_DECIMALS.USDT || 6);
            console.log("USDT balance (converted):", usdtBalance);
            setTokenBalances((prev) => ({
              ...prev,
              USDT: usdtBalance,
            }));
          } catch (e) {
            console.error("Error converting USDT balance:", e);
          }
        }
      }

      // Fetch SYN balance
      if (TOKEN_CONTRACTS.SYN) {
        console.log("Fetching SYN balance from:", TOKEN_CONTRACTS.SYN);
        const synBalanceWei = await fetchERC20Balance(
          user.wallet.address,
          TOKEN_CONTRACTS.SYN
        );
        console.log("SYN balance (wei):", synBalanceWei);
        if (synBalanceWei && synBalanceWei !== "0x0") {
          try {
            const synBalanceBigInt = BigInt(synBalanceWei || "0");
            const synBalance = Number(synBalanceBigInt) / 10 ** (TOKEN_DECIMALS.SYN || 18);
            console.log("SYN balance (converted):", synBalance);
            setTokenBalances((prev) => ({
              ...prev,
              SYN: synBalance,
            }));
          } catch (e) {
            console.error("Error converting SYN balance:", e);
          }
        }
      }

      // TODO: Fetch other token balances (ETH, UNI, HYPE)
      // Add token contract addresses to TOKEN_CONTRACTS and use fetchERC20Balance
    } catch (error) {
      console.error("Failed to fetch wallet balances:", error);
    } finally {
      setIsLoadingBalances(false);
    }
  }, [user?.wallet?.address]);

  // Sync wallet connection with Privy authentication
  useEffect(() => {
    if (authenticated && user) {
      setIsWalletConnected(true);
      fetchUserBalances();
    } else {
      setIsWalletConnected(false);
      setTokenBalances({
        USDC: 0,
        WUSDC: 0,
        ETH: 0,
        USDT: 0,
        EURC: 0,
        SYN: 0,
        SWPRC: 0,
        QTM: 0,
        UNI: 0,
        HYPE: 0,
      });
    }
  }, [authenticated, user, fetchUserBalances]);

  // Get display balance for a token (actual if available, mock otherwise)
  const getTokenBalance = (symbol: string): number => {
    return tokenBalances[symbol] || 0;
  };

  // Check if swap button should be active
  const isSwapActive =
    isWalletConnected &&
    parseFloat(sellAmount) > 0 &&
    sellAmount !== "0.00" &&
    parseFloat(receiveAmount) > 0 &&
    receiveAmount !== "0.00";

  const handleSwapTokens = () => {
    const tempToken = sellToken;
    setSellToken(receiveToken);
    setReceiveToken(tempToken);
    const tempAmount = sellAmount;
    setSellAmount(receiveAmount);
    setReceiveAmount(tempAmount);
  };

  // Simulate DEX aggregator calculation
  const handleSellAmountChange = (value: string) => {
    setSellAmount(value);
    if (value && parseFloat(value) > 0) {
      // Get quote from Arc pool for actual exchange rate
      getQuoteForSwap(value);
    } else {
      setReceiveAmount("0.00");
    }
  };

  // Get swap quote from Tower Finance backend
  const getQuoteForSwap = async (sellAmountValue: string) => {
    try {
      // Get token addresses for the swap
      let tokenInAddress: string | null = null;
      let tokenOutAddress: string | null = null;

      // Map token symbols to contract addresses
      const addressMap: Record<string, string> = TOKEN_CONTRACTS;
      
      if (addressMap[sellToken.symbol]) {
        tokenInAddress = addressMap[sellToken.symbol];
      }

      if (addressMap[receiveToken.symbol]) {
        tokenOutAddress = addressMap[receiveToken.symbol];
      }

      if (!tokenInAddress || !tokenOutAddress) {
        console.warn(
          `Token address not found for ${sellToken.symbol} or ${receiveToken.symbol}`
        );
        calculateMockRate(sellAmountValue);
        return;
      }

      // Convert sell amount to wei using correct decimals for the sell token
      const sellTokenDecimals = TOKEN_DECIMALS[sellToken.symbol] || 18;
      const amountInWei = BigInt(
        parseFloat(sellAmountValue) * 10 ** sellTokenDecimals
      ).toString();

      console.log("Getting quote from Tower Finance:", {
        sellToken: sellToken.symbol,
        receiveToken: receiveToken.symbol,
        tokenInAddress,
        tokenOutAddress,
        amountInWei,
      });

      // Get quote from Tower Exchange backend
      const quoteData = await getQuote(
        tokenInAddress,
        tokenOutAddress,
        amountInWei,
        slippageTolerance
      );

      if (!quoteData) {
        throw new Error(towerError || "Failed to get quote from Tower Exchange");
      }

      console.log("Quote received from Tower Exchange:", quoteData);

      // Convert quote back from wei using correct decimals for the receive token
      const receiveTokenDecimals = TOKEN_DECIMALS[receiveToken.symbol] || 18;
      const quoteAmount = parseFloat(quoteData.outputAmount || "0") / 10 ** receiveTokenDecimals;
      
      // Convert priceImpact from basis points to percentage (50 = 0.50%)
      const priceImpactPercent = typeof quoteData.priceImpact === 'number' 
        ? (quoteData.priceImpact / 100).toFixed(2)
        : quoteData.priceImpact;

      // Debug logging with detailed breakdown
      console.log("Quote conversion details:", {
        outputAmount_wei: quoteData.outputAmount,
        receiveTokenDecimals,
        quoteAmount_tokens: quoteAmount,
        priceImpact: priceImpactPercent,
        calculation: `${quoteData.outputAmount} / 10^${receiveTokenDecimals} = ${quoteAmount}`,
      });

      setReceiveAmount(quoteAmount.toString());
    } catch (error) {
      console.error("Error getting swap quote:", error);
      // Fallback to mock calculation on error
      calculateMockRate(sellAmountValue);
    }
  };

  // Helper function to calculate using mock rates
  const calculateMockRate = (sellAmountValue: string) => {
    const mockRate =
      sellToken.symbol === "ETH"
        ? 1500
        : sellToken.symbol === "USDC"
        ? 1
        : sellToken.symbol === "USDT"
        ? 1
        : sellToken.symbol === "UNI"
        ? 12
        : sellToken.symbol === "EURC"
        ? 1.05
        : sellToken.symbol === "SWPRC"
        ? 0.5
        : 8;
    const calculated = (parseFloat(sellAmountValue) * mockRate).toFixed(2);
    setReceiveAmount(calculated);
  };

  // Handle 50% button click
  const handle50Percent = () => {
    const balance = getTokenBalance(sellToken.symbol);
    const fiftyPercent = (balance * 0.5).toFixed(2);
    handleSellAmountChange(fiftyPercent);
  };

  // Handle Max button click
  const handleMaxAmount = () => {
    const balance = getTokenBalance(sellToken.symbol);
    const maxAmount = balance.toFixed(2);
    handleSellAmountChange(maxAmount);
  };

  // Handle wallet connection
  const handleConnectWallet = async () => {
    if (authenticated) {
      setIsWalletConnected(true);
      setSwapState("idle");
      return;
    }

    try {
      setSwapState("loading");
      // Trigger Privy login modal
      await login();
      setIsWalletConnected(true);
      setSwapState("idle");
    } catch (error) {
      console.error("Wallet connection failed:", error);
      setSwapState("idle");
    }
  };

  // Reset token approval for the swap router (sets allowance to 0 so next swap will ask for approval again)
  const handleResetApproval = async () => {
    if (!user?.wallet?.address || !TOKEN_CONTRACTS[sellToken.symbol]) return;
    setResetApprovalLoading(true);
    try {
      const connectedWallet = wallets.find(
        (w) => w.address?.toLowerCase() === user.wallet?.address?.toLowerCase()
      );
      if (!connectedWallet) throw new Error("Wallet not found");
      const provider = await connectedWallet.getEthereumProvider();
      if (!provider) throw new Error("Failed to get wallet provider");
      const chainId = await provider.request({ method: "eth_chainId" });
      if (chainId !== ARC_CHAIN_HEX) throw new Error("Switch to Arc Testnet first");
      const tokenAddress = TOKEN_CONTRACTS[sellToken.symbol];
      const spender = ARC_POOLS.routerQuantum;
      const calldata = encodeErc20Approve(spender, "0");
      const toHexQuantity = (n: number) => "0x" + n.toString(16);
      await provider.request({
        method: "eth_sendTransaction",
        params: [{
          from: user.wallet.address,
          to: tokenAddress,
          value: "0x0",
          data: calldata,
          gas: toHexQuantity(80000),
        }],
      });
      fetchUserBalances();
      alert("Approval reset for " + sellToken.symbol + ". Next swap will ask for approval again.");
    } catch (e) {
      console.error("Reset approval failed:", e);
      setNotification("failed");
      setRevertReason(e instanceof Error ? e.message : "Reset approval failed");
      setTimeout(() => { setNotification(null); setRevertReason(null); }, 5000);
    } finally {
      setResetApprovalLoading(false);
    }
  };

  // Handle swap transaction
  const handleSwap = async () => {
    setSwapState("loading");
    setRevertReason(null);

    try {
      if (!user?.wallet?.address) {
        throw new Error("Wallet not connected");
      }

      // Check if on correct network
      if (!isOnArcTestnet) {
        try {
          await switchToArcTestnet();
          // Wait a moment for chain switch to complete
          await new Promise((resolve) => setTimeout(resolve, 1000));
          // Re-check chain ID
          const connectedWallet = wallets.find(
            (w) => w.address?.toLowerCase() === user.wallet?.address?.toLowerCase()
          );
          if (connectedWallet) {
            const provider = await connectedWallet.getEthereumProvider();
            if (provider) {
              const currentChainId = await provider.request({ method: "eth_chainId" });
              if (currentChainId !== ARC_CHAIN_HEX) {
                throw new Error("Please switch to Arc Testnet to continue");
              }
            }
          }
        } catch (networkError: any) {
          throw new Error(
            networkError.message || "Please switch to Arc Testnet network to perform swaps"
          );
        }
      }

      // Get the connected wallet
      const connectedWallet = wallets.find(
        (w) => w.address?.toLowerCase() === user.wallet?.address?.toLowerCase()
      );

      if (!connectedWallet) {
        throw new Error("Connected wallet not found. Please reconnect your wallet.");
      }

      // Get the provider from the connected wallet
      const eip1193Provider = await connectedWallet.getEthereumProvider();
      
      if (!eip1193Provider) {
        throw new Error("Failed to get wallet provider");
      }

      // Use the EIP1193 provider directly to send transactions
      const userAddress = user.wallet?.address;
      if (!userAddress) {
        throw new Error("User wallet address not available");
      }

      const sendTransactionViaProvider = async (
        txData: { to: string; value: string; data: string; gas?: number | string },
        txType: string = "transaction"
      ) => {
        try {
          console.log(`[${txType}] Sending to provider:`, {
            from: userAddress,
            to: txData.to,
            value: txData.value,
            dataLength: txData.data?.length || 0,
            data: txData.data?.substring(0, 100) + "...",
            gas: txData.gas,
          });

          // Get current chain ID to include in transaction
          const currentChainId = await eip1193Provider.request({ method: "eth_chainId" });
          
          if (currentChainId !== ARC_CHAIN_HEX) {
            throw new Error(
              `Invalid chain ID. Expected ${ARC_CHAIN_HEX} (Arc Testnet), got ${currentChainId}. Please switch to Arc Testnet.`
            );
          }

          const result = await eip1193Provider.request({
            method: 'eth_sendTransaction',
            params: [{
              from: userAddress, // Use the validated address
              to: txData.to,
              value: txData.value?.startsWith("0x")
                ? txData.value
                : toHexQuantity(txData.value || "0"),
              data: txData.data,
              // NOTE: Do NOT pass chainId here; wallets derive it from the connected network.
              ...(txData.gas ? { gas: typeof txData.gas === "string" ? txData.gas : toHexQuantity(txData.gas) } : {}),
            }],
          });

          console.log(`[${txType}] Successfully sent, hash:`, result);
          return result as string;
        } catch (error: unknown) {
          // Better error serialization
          let errorDetails: Record<string, unknown> = {
            type: txType,
            timestamp: new Date().toISOString(),
          };

          if (error instanceof Error) {
            errorDetails.message = error.message;
            errorDetails.stack = error.stack;
            errorDetails.name = error.name;
          } else if (typeof error === "string") {
            errorDetails.message = error;
          } else if (error && typeof error === "object") {
            // Handle EIP-1193 errors and other structured errors
            const err = error as Record<string, unknown>;
            errorDetails = {
              ...errorDetails,
              message: err.message || err.reason || String(error),
              code: err.code,
              data: err.data,
              // Common EIP-1193 error properties
              shortMessage: err.shortMessage,
              cause: err.cause,
            };
          } else {
            errorDetails.message = String(error);
          }

          console.error(`[${txType}] Failed with error:`, errorDetails);
          throw error;
        }
      };

      // Get token addresses for the swap
      let tokenInAddress: string | null = null;
      let tokenOutAddress: string | null = null;

      const addressMap: Record<string, string> = TOKEN_CONTRACTS;
      
      if (addressMap[sellToken.symbol]) {
        tokenInAddress = addressMap[sellToken.symbol];
      }

      if (addressMap[receiveToken.symbol]) {
        tokenOutAddress = addressMap[receiveToken.symbol];
      }

      if (!tokenInAddress || !tokenOutAddress) {
        throw new Error(
          `Token address not found for ${sellToken.symbol} or ${receiveToken.symbol}`
        );
      }

      // Step 1: Validate balance before proceeding
      const sellAmountNum = parseFloat(sellAmount);
      const balance = getTokenBalance(sellToken.symbol);
      
      if (sellAmountNum <= 0) {
        throw new Error("Swap amount must be greater than 0");
      }
      
      if (sellAmountNum > balance) {
        throw new Error(
          `Insufficient balance. You have ${balance.toFixed(6)} ${sellToken.symbol}, but trying to swap ${sellAmount} ${sellToken.symbol}`
        );
      }

      // Step 2: Convert amounts to wei using correct decimals
      const sellTokenDecimals = TOKEN_DECIMALS[sellToken.symbol] || 18;

      const amountInWei = BigInt(
        Math.floor(sellAmountNum * 10 ** sellTokenDecimals)
      ).toString();

      console.log("Preparing swap via Tower Exchange:", {
        sellToken: sellToken.symbol,
        receiveToken: receiveToken.symbol,
        tokenInAddress,
        tokenOutAddress,
        amountInWei,
        amountInHuman: sellAmount,
        walletAddress: user.wallet.address,
        balanceOfSellToken: balance,
        sellTokenDecimals,
      });

      // Step 3: Get swap quote from Tower Finance backend
      const quote = await getQuote(
        tokenInAddress,
        tokenOutAddress,
        amountInWei,
        slippageTolerance
      );

      if (!quote) {
        throw new Error(towerError || "Failed to get swap quote from Tower Exchange");
      }

      console.log("Swap quote received:", {
        inputAmount: quote.inputAmount,
        outputAmount: quote.outputAmount,
        minOut: quote.minOut,
        priceImpact: quote.priceImpact,
        routeType: quote.route.type,
        hopsCount: quote.route.hops.length,
      });

      // Step 4: Get swap transaction (which includes approval if needed)
      console.log("Building swap transaction with automatic approval detection...");
      const transaction = await buildSwapTransaction(quote, user.wallet.address);

      if (!transaction) {
        throw new Error(towerError || "Failed to build swap transaction");
      }

      const { approval: approvalTx, swap: swapTx } = transaction;

      // Step 5: If approval is needed, submit approval transaction first
      if (approvalTx) {
        console.log("Approval required - submitting approval transaction...");
        try {
          console.log("Sending approval transaction to MetaMask...");
          const approveTxHash = await sendTransactionViaProvider(
            {
              to: approvalTx.to,
              data: approvalTx.data,
              value: "0x0",
              gas: approvalTx.gasLimit,
            },
            "APPROVAL"
          );

          console.log("Approval transaction sent:", approveTxHash);

          // Wait for approval confirmation - poll until receipt is found
          let approvalReceipt = null;
          let approvalRetries = 0;
          const maxApprovalRetries = 30; // Wait up to 30 seconds

          while (approvalReceipt === null && approvalRetries < maxApprovalRetries) {
            await new Promise((resolve) => setTimeout(resolve, 1000));

            try {
              approvalReceipt = await eip1193Provider.request({
                method: "eth_getTransactionReceipt",
                params: [approveTxHash],
              });

              if (approvalReceipt) {
                if (approvalReceipt.status === "0x0") {
                  throw new Error("Approval transaction failed on-chain");
                }
                console.log("Approval transaction confirmed:", approvalReceipt);
                break;
              }
            } catch (err) {
              // Continue polling
            }

            approvalRetries++;
          }

          if (!approvalReceipt) {
            throw new Error("Approval transaction not confirmed after 30 seconds");
          }

          // Additional wait to ensure block is finalized
          await new Promise((resolve) => setTimeout(resolve, 2000));

          console.log("Approval transaction confirmed successfully!");
          
          // CRITICAL: Rebuild swap transaction after approval to get fresh deadline
          // Using old swap data will cause "execution reverted" due to stale deadline
          console.log("Rebuilding swap transaction with fresh deadline after approval...");
          const freshQuote = await getQuote(
            tokenInAddress,
            tokenOutAddress,
            amountInWei,
            slippageTolerance
          );

          if (!freshQuote) {
            throw new Error(towerError || "Failed to get fresh quote after approval");
          }

          const freshTransaction = await buildSwapTransaction(freshQuote, user.wallet.address);
          if (!freshTransaction) {
            throw new Error(towerError || "Failed to build fresh swap transaction after approval");
          }

          // Update swapTx to the fresh one with new deadline
          Object.assign(swapTx, freshTransaction.swap);
          
          console.log("Fresh swap transaction ready:", {
            to: swapTx.to,
            dataLength: swapTx.data?.length,
            gasLimit: swapTx.gasLimit,
          });
        } catch (approvalError: unknown) {
          let approvalErrorDetails: Record<string, unknown> = {
            context: "tokenApproval",
            timestamp: new Date().toISOString(),
            token: sellToken.symbol,
          };

          if (approvalError instanceof Error) {
            approvalErrorDetails.message = approvalError.message;
            approvalErrorDetails.stack = approvalError.stack;
            approvalErrorDetails.name = approvalError.name;
          } else if (typeof approvalError === "string") {
            approvalErrorDetails.message = approvalError;
          } else if (approvalError && typeof approvalError === "object") {
            const err = approvalError as Record<string, unknown>;
            approvalErrorDetails = {
              ...approvalErrorDetails,
              message: err.message || err.reason || String(approvalError),
              code: err.code,
              data: err.data,
            };
          } else {
            approvalErrorDetails.message = String(approvalError);
          }

          console.error("Approval transaction error details:", approvalErrorDetails);
          throw new Error(
            `Token approval failed: ${approvalErrorDetails.message || "Unknown error"}. Please try again.`
          );
        }
      } else {
        console.log("No approval needed - proceeding with swap");
      }

      // Step 6: Send swap transaction
      const swapDataToSend = {
        to: swapTx.to,
        value: swapTx.value,
        data: swapTx.data,
        gasLimit: swapTx.gasLimit,
      };

      // Step 7: Send swap transaction via provider
      console.log("Sending swap transaction...");
      console.log("Swap transaction data:", {
        to: swapDataToSend.to,
        value: swapDataToSend.value,
        dataLength: swapDataToSend.data?.length || 0,
        sellToken: sellToken.symbol,
        receiveToken: receiveToken.symbol,
        amountIn: amountInWei,
        slippage: slippageTolerance,
      });

      // Try to estimate gas, but don't block if it fails
      // (some RPC endpoints have issues with gas estimation on complex transactions)
      try {
        console.log("Estimating gas...");
        const gasEstimate = await eip1193Provider.request({
          method: 'eth_estimateGas',
          params: [{
            from: userAddress,
            to: swapDataToSend.to,
            value: swapDataToSend.value,
            data: swapDataToSend.data,
          }],
        });
        console.log("Gas estimate successful:", gasEstimate);
      } catch (estimateError: unknown) {
        // Log the error but continue - the wallet will provide its own gas estimation
        let estimateErrorDetails: Record<string, unknown> = {
          context: "gasEstimation",
          timestamp: new Date().toISOString(),
          note: "Continuing with swap - wallet will estimate gas",
        };

        if (estimateError instanceof Error) {
          estimateErrorDetails.message = estimateError.message;
          estimateErrorDetails.stack = estimateError.stack;
          estimateErrorDetails.name = estimateError.name;
        } else if (typeof estimateError === "string") {
          estimateErrorDetails.message = estimateError;
        } else if (estimateError && typeof estimateError === "object") {
          const err = estimateError as Record<string, unknown>;
          estimateErrorDetails = {
            ...estimateErrorDetails,
            message: err.message || err.reason || String(estimateError),
            code: err.code,
            data: err.data,
            shortMessage: err.shortMessage,
            cause: err.cause,
          };
        } else {
          estimateErrorDetails.message = String(estimateError);
        }

        console.error("Gas estimation error details:", estimateErrorDetails);
        console.warn("Gas estimation failed (wallet will estimate)");
      }

      // Ensure value is properly formatted (should be hex string)
      const swapValue = swapDataToSend.value?.startsWith("0x")
        ? swapDataToSend.value
        : swapDataToSend.value
        ? toHexQuantity(swapDataToSend.value)
        : "0x0";

      // CRITICAL FIX: Only zero out value for pure ERC-20 token swaps (no native tokens)
      // Native tokens (like USDC) REQUIRE non-zero ETH value via payable functions
      // ERC-20 tokens should NEVER have a non-zero value
      const isNativeInputFinal = NATIVE_TOKENS.includes(sellToken.symbol);
      const isNativeOutputFinal = NATIVE_TOKENS.includes(receiveToken.symbol);
      const finalSwapValue = (!isNativeInputFinal && !isNativeOutputFinal) ? "0x0" : swapValue;

      if (finalSwapValue !== swapValue) {
        console.warn("Corrected swap value to 0x0 for pure ERC-20 token swap", {
          originalValue: swapValue,
          correctedValue: finalSwapValue,
          sellToken: sellToken.symbol,
          receiveToken: receiveToken.symbol,
        });
      }

      console.log("Final swap transaction parameters:", {
        to: swapDataToSend.to,
        value: finalSwapValue,
        dataLength: swapDataToSend.data?.length,
        gasLimit: swapDataToSend.gasLimit,
      });

      const txHash = await sendTransactionViaProvider(
        {
          to: swapDataToSend.to,
          value: finalSwapValue,
          data: swapDataToSend.data,
          // Per Tower Router convention, use the provided gasLimit when available
          gas: swapDataToSend.gasLimit ?? undefined,
        },
        "SWAP"
      );

      console.log("Swap transaction executed with hash:", txHash);
      
      // Wait for transaction receipt to verify success
      let receipt = null;
      let retries = 0;
      const maxRetries = 30; // Try for up to 30 seconds (1 second intervals)
      
      while (receipt === null && retries < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        
        try {
          receipt = await eip1193Provider.request({
            method: 'eth_getTransactionReceipt',
            params: [txHash],
          });
          
          if (receipt) {
            console.log("Transaction receipt received:", receipt);
            
            // Check if transaction was successful (status === '0x1')
            if (receipt.status === '0x0') {
              console.error("Transaction failed! Getting revert reason...");
              let decodedReason: string | null = null;

              try {
                const tx = await eip1193Provider.request({
                  method: 'eth_getTransactionByHash',
                  params: [txHash],
                }) as { from?: string; to?: string; value?: string; input?: string } | null;

                if (tx?.from && tx?.to && tx?.input) {
                  console.log("Failed transaction data:", JSON.stringify({ from: tx.from, to: tx.to, value: tx.value, inputLength: tx.input?.length }, null, 2));
                  // Use public RPC for eth_call so we get revert data instead of "Internal JSON-RPC error"
                  decodedReason = await getRevertReasonViaPublicRpc({
                    from: tx.from,
                    to: tx.to,
                    value: tx.value ?? "0x0",
                    data: tx.input,
                  });
                  if (decodedReason) {
                    setRevertReason(decodedReason);
                    console.error("Revert reason (decoded):", decodedReason);
                  }
                }
              } catch (callError: unknown) {
                const callErrorObj = callError instanceof Error ? callError : new Error(String(callError));
                console.error("Revert reason extraction error:", {
                  message: callErrorObj.message,
                  error: callError,
                });
              }

              throw new Error(
                decodedReason
                  ? `Transaction failed: ${decodedReason}`
                  : "Transaction failed on-chain (status: 0x0)"
              );
            }
            break;
          }
        } catch (receiptError: unknown) {
          const receiptErrorObj = receiptError instanceof Error ? receiptError : new Error(String(receiptError));
          // Rethrow our "Transaction failed" errors so the outer catch can show the decoded reason
          if (receiptErrorObj.message.startsWith("Transaction failed")) {
            throw receiptError;
          }
          console.error("Error fetching receipt:", receiptError);
        }
        
        retries++;
      }
      
      if (receipt === null) {
        console.warn("Transaction receipt not received after 30 seconds, but hash was confirmed");
      } else if (receipt.status === '0x0') {
        throw new Error("Transaction failed on-chain");
      }
      
      // Store the transaction hash
      setTransactionHash(txHash);
      setRevertReason(null);
      setSwapState("success");
      setNotification("success");

      // Auto-dismiss notification after 5 seconds
      setTimeout(() => {
        setNotification(null);
      }, 5000);

      // Reset amounts after success
      setTimeout(() => {
        setSellAmount("0.00");
        setReceiveAmount("0.00");
        setSwapState("idle");
        setTransactionHash(null);
        // Refresh wallet balances after successful swap
        fetchUserBalances();
      }, 3000);
    } catch (error: unknown) {
      // Better error serialization for swap errors
      let errorDetails: Record<string, unknown> = {
        context: "handleSwap",
        timestamp: new Date().toISOString(),
        sellToken: sellToken.symbol,
        receiveToken: receiveToken.symbol,
        sellAmount,
        revertReason: revertReason ?? undefined,
      };

      if (error instanceof Error) {
        errorDetails.message = error.message;
        errorDetails.stack = error.stack;
        errorDetails.name = error.name;
      } else if (typeof error === "string") {
        errorDetails.message = error;
      } else if (error && typeof error === "object") {
        // Handle EIP-1193 errors and other structured errors
        const err = error as Record<string, unknown>;
        errorDetails = {
          ...errorDetails,
          message: err.message || err.reason || String(error),
          code: err.code,
          data: err.data,
          shortMessage: err.shortMessage,
          cause: err.cause,
        };
      } else {
        errorDetails.message = String(error);
      }

      // Ensure UI shows decoded revert reason (state may not have updated yet)
      const msg = errorDetails.message as string | undefined;
      const decodedFromMessage = msg?.startsWith("Transaction failed: ") ? msg.slice("Transaction failed: ".length) : null;
      if (decodedFromMessage) {
        const displayReason =
          decodedFromMessage.toLowerCase() === "execution reverted"
            ? "Execution reverted (check allowance, slippage, or liquidity)"
            : decodedFromMessage;
        setRevertReason(displayReason);
        errorDetails.revertReason = decodedFromMessage;
        if (decodedFromMessage.toLowerCase() === "execution reverted") {
          errorDetails.hint = "Try: approve the sell token again, or increase slippage in Settings.";
        }
      }

      console.error("Swap transaction error - Full details:", JSON.stringify(errorDetails, null, 2));
      
      setSwapState("failed");
      setNotification("failed");
      setTransactionHash(null);

      // Auto-dismiss notification after 5 seconds
      setTimeout(() => {
        setNotification(null);
      }, 5000);

      setTimeout(() => {
        setSwapState("idle");
        setRevertReason(null);
      }, 3000);
    }
  };

  // Get button content based on state
  const getButtonContent = () => {
    if (!isWalletConnected) {
      return "Connect Wallet";
    }

    if (swapState === "loading") {
      return (
        <div className="flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
          <span>Loading</span>
        </div>
      );
    }

    if (!isSwapActive) {
      return "Swap";
    }

    return "Swap";
  };

  // Get button styles based on state
  const getButtonStyles = () => {
    const baseStyles =
      "w-full rounded-xl h-14 text-base font-semibold text-black transition-all";

    if (swapState === "loading") {
      return `${baseStyles} bg-[#2a2d31] hover:bg-[#2a2d31] cursor-not-allowed text-gray-500`;
    }

    if (isWalletConnected && !isSwapActive) {
      return `${baseStyles} bg-[#2a2d31] hover:bg-[#2a2d31] cursor-not-allowed text-gray-500`;
    }

    return `${baseStyles} bg-primary hover:opacity-90`;
  };

  return (
    <div className="flex gap-6 items-start w-full justify-center">
      {/* Swap Notification */}
      <AnimatePresence>
        {notification && (
          <SwapNotification
            type={notification}
            sellAmount={sellAmount}
            sellToken={sellToken.symbol}
            receiveAmount={receiveAmount}
            receiveToken={receiveToken.symbol}
            onClose={() => setNotification(null)}
            transactionHash={transactionHash}
            revertReason={revertReason}
          />
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <motion.div
          className="bg-[#191A1C] border border-border rounded-2xl p-6"
          whileHover={{ boxShadow: "0 0 30px rgba(59, 130, 246, 0.1)" }}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-foreground">Swap</h2>
            <div className="flex items-center gap-2">
              <motion.button
                onClick={() => setIsChartOpen(!isChartOpen)}
                className="p-2 rounded-lg hover:bg-secondary transition-colors cursor-pointer"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <BarChart3 className="w-5 h-5 text-muted-foreground" />
              </motion.button>
              <motion.button
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 rounded-lg hover:bg-secondary transition-colors cursor-pointer"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <Settings className="w-5 h-5 text-muted-foreground" />
              </motion.button>
            </div>
          </div>

          {/* Sell Section */}
          <div className="bg-[#151617] rounded-xl p-4 mb-2">
            <div className="flex items-center justify-between mb-2 ">
              <span className="text-sm text-muted-foreground">Sell</span>
              <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                <Wallet className="w-4 h-4" />
                <span>
                  {isLoadingBalances ? "Loading..." : `${formatBalance(getTokenBalance(sellToken.symbol).toString())} ${sellToken.symbol}`}
                </span>
                <button 
                  onClick={handle50Percent}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  50%
                </button>
                <button 
                  onClick={handleMaxAmount}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Max
                </button>
                {isWalletConnected && TOKEN_CONTRACTS[sellToken.symbol] && (
                  <button
                    type="button"
                    onClick={handleResetApproval}
                    disabled={resetApprovalLoading}
                    className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    {resetApprovalLoading ? "Resetting…" : "Reset approval"}
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <TokenSelector
                selected={sellToken}
                onSelect={setSellToken}
                excludeSymbol={receiveToken.symbol}
                onOpenModal={() => setIsSellTokenModalOpen(true)}
              />
              <TokenInput
                value={sellAmount}
                onChange={handleSellAmountChange}
                onClear={() => {
                  setSellAmount("0.00");
                  setReceiveAmount("0.00");
                }}
              />
            </div>
          </div>

          {/* Swap Arrow Button */}
          <div className="flex justify-center -my-6 relative z-10">
            <motion.button
              onClick={handleSwapTokens}
              className="w-10 h-10 rounded-xl bg-secondary border border-border flex items-center justify-center hover:bg-accent transition-colors"
              whileHover={{ scale: 1.1, rotate: 180 }}
              whileTap={{ scale: 0.9 }}
              transition={{ duration: 0.2 }}
            >
              <ArrowDown className="w-5 h-5 text-muted-foreground" />
            </motion.button>
          </div>

          {/* Receive Section */}
          <div className="bg-[#151617] rounded-xl p-4 mt-2 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Receive</span>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Wallet className="w-4 h-4" />
                <span>{isLoadingBalances ? "Loading..." : `${formatBalance(getTokenBalance(receiveToken.symbol).toString())} ${receiveToken.symbol}`}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <TokenSelector
                selected={receiveToken}
                onSelect={setReceiveToken}
                excludeSymbol={sellToken.symbol}
                onOpenModal={() => setIsReceiveTokenModalOpen(true)}
              />
              <TokenInput
                value={receiveAmount}
                onChange={setReceiveAmount}
                onClear={() => setReceiveAmount("0.00")}
              />
            </div>
          </div>

          {/* Action Button */}
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              onClick={isWalletConnected ? handleSwap : handleConnectWallet}
              disabled={
                swapState === "loading" || (isWalletConnected && !isSwapActive)
              }
              className={getButtonStyles()}
            >
              {getButtonContent()}
            </Button>
          </motion.div>
        </motion.div>

        {/* Token Quick Access Buttons */}
        <div className="flex items-center justify-center gap-4 mt-6">
          <motion.button
            onClick={() => setSellToken(sellToken)}
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-[#191A1C] border border-border hover:bg-secondary transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <div className="w-6 h-6 rounded-full bg-primary/30 flex items-center justify-center overflow-hidden">
              <Image
                src={sellToken.icon}
                alt={`${sellToken.symbol} logo`}
                width={24}
                height={24}
                className="object-contain w-full h-full"
              />
            </div>
            <span className="font-medium text-foreground">
              {sellToken.symbol}
            </span>
            <span className="text-muted-foreground">$1</span>
          </motion.button>
          <motion.button
            onClick={() => setReceiveToken(receiveToken)}
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-[#191A1C] border border-border hover:bg-secondary transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <div className="w-6 h-6 rounded-full bg-primary/30 flex items-center justify-center overflow-hidden">
              <Image
                src={receiveToken.icon}
                alt={`${receiveToken.symbol} logo`}
                width={24}
                height={24}
                className="object-contain w-full h-full"
              />
            </div>
            <span className="font-medium text-foreground">
              {receiveToken.symbol}
            </span>
            <span className="text-muted-foreground">$1</span>
          </motion.button>
        </div>

        {/* Modals */}
        <TokenModal
          isOpen={isSellTokenModalOpen}
          onClose={() => setIsSellTokenModalOpen(false)}
          selected={sellToken}
          onSelect={setSellToken}
          excludeSymbol={receiveToken.symbol}
          tokenBalances={tokenBalances}
        />

        <TokenModal
          isOpen={isReceiveTokenModalOpen}
          onClose={() => setIsReceiveTokenModalOpen(false)}
          selected={receiveToken}
          onSelect={setReceiveToken}
          excludeSymbol={sellToken.symbol}
          tokenBalances={tokenBalances}
        />

        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          slippageTolerance={slippageTolerance}
          onSlippageChange={setSlippageTolerance}
        />
      </motion.div>

      <AnimatePresence>
        {isChartOpen && (
          <ChartModal
            isOpen={isChartOpen}
            onClose={() => setIsChartOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default SwapCard;
