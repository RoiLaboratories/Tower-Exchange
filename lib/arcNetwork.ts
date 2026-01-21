// Arc Testnet Configuration and utilities
export const ARC_TESTNET_CONFIG = {
  chainId: 5042002,
  rpcUrl: "https://rpc.testnet.arc.network",
  currency: "USDC",
  decimals: 18,
  explorerUrl: "https://testnet.arcscan.app",
  faucetUrl: "https://faucet.circle.com",
};

/**
 * Fetch wallet balance from Arc testnet
 * @param walletAddress - The wallet address to fetch balance for
 * @returns Balance in USDC (as string)
 */
export const fetchArcBalance = async (
  walletAddress: string
): Promise<string | null> => {
  try {
    const response = await fetch(ARC_TESTNET_CONFIG.rpcUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getBalance",
        params: [walletAddress, "latest"],
      }),
    });

    const data = await response.json();
    if (data.result) {
      // Convert from wei to USDC (18 decimals)
      const balanceInWei = BigInt(data.result);
      const balanceInUsdc = balanceInWei / BigInt(10 ** ARC_TESTNET_CONFIG.decimals);
      return balanceInUsdc.toString();
    }
    return null;
  } catch (error) {
    console.error("Error fetching Arc wallet balance:", error);
    return null;
  }
};

/**
 * Format balance for display
 * @param balance - Balance as string
 * @param decimals - Number of decimal places to show
 * @returns Formatted balance string
 */
export const formatBalance = (balance: string, decimals: number = 2): string => {
  try {
    const num = parseFloat(balance);
    return num.toFixed(decimals);
  } catch {
    return "0";
  }
};
