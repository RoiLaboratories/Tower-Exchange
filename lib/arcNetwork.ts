// Arc Testnet Configuration and utilities
export const ARC_TESTNET_CONFIG = {
  chainId: 5042002,
  rpcUrl: "https://rpc.testnet.arc.network",
  currency: "USDC",
  decimals: 18,
  explorerUrl: "https://testnet.arcscan.app",
  faucetUrl: "https://faucet.circle.com",
};

// QuantumExchange API Configuration
export const QUANTUM_EXCHANGE_CONFIG = {
  baseUrl: "https://www.quantumexchange.app/api/v1",
  chainId: 1301,
  rpcUrl: "https://rpc.arc.testnet",
};

// Token Contract Addresses on Arc Testnet
// Note: Only USDC, WUSDC, QTM are supported by QuantumExchange API
export const TOKEN_CONTRACTS: Record<string, string> = {
  USDC: "0x3600000000000000000000000000000000000000",
  WUSDC: "0xD40fCAa5d2cE963c5dABC2bf59E268489ad7BcE4",
  QTM: "0xCD304d2A421BFEd31d45f0054AF8E8a6a4cF3EaE",
  EURC: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
  SWPRC: "0xBE7477BF91526FC9988C8f33e91B6db687119D45",
  // Add other token addresses as needed
  // USDT: "0x...",
  // UNI: "0x...",
  // HYPE: "0x...",
  // ETH: "0x...",
};

// Token Decimals Configuration
// Note: USDC has 18 decimals on Arc Testnet, WUSDC has 6
export const TOKEN_DECIMALS: Record<string, number> = {
  USDC: 18,
  WUSDC: 6,
  QTM: 18,
  EURC: 6,
  SWPRC: 6,
  USDT: 6,
  UNI: 18,
  HYPE: 18,
  ETH: 18,
};

// Arc Pool Configuration - QuantumExchange supported pools
// IMPORTANT: Each pool contract has its own get_dy function with local indices (0, 1)
// Token 0 is always listed first, Token 1 is listed second
export const ARC_POOLS = {
  router: "0x00468f90a40432Fc488C87B0FBe69c2D0fADF0a0", // Uniswap V2 Router (for reference only)
  routerQuantum: "0x9d52b6c810d6f95e3d44ca64af3b55f7f66448ff", // RouterQuantum for wrap/unwrap swaps
  pools: {
    "WUSDC/QTM": {
      address: "0xD330Ae5713AF6507f43420e85C941a68BfbaD9D0",
      tokens: ["WUSDC", "QTM"],
    },
  },
};

/**
 * Get the index of a token in the router
 * DEPRECATED: This is only kept for reference. QuantumExchange API handles all routing.
 * @param routerAddress - Address of the swap router (unused, for future dynamic discovery)
 * @param tokenAddress - Token contract address to find
 * @returns Token index or -1 if not found
 */
export async function getRouterTokenIndex(
  routerAddress: string,
  tokenAddress: string
): Promise<number> {
  const normalizedAddress = tokenAddress.toLowerCase();
  
  // Hardcoded token index mapping for Arc testnet router
  // These indices are based on the router configuration
  const tokenIndexMap: Record<string, number> = {
    "0x3600000000000000000000000000000000000000": 0, // USDC
    "0xd40fcaa5d2ce963c5dabc2bf59e268489ad7bce4": 1, // WUSDC
    "0xcd304d2a421bfed31d45f0054af8e8a6a4cf3eae": 2, // QTM
  };

  const index = tokenIndexMap[normalizedAddress];
  
  if (index !== undefined) {
    console.log(`Token ${tokenAddress} found at index ${index}`);
    return index;
  }

  console.warn(`Token ${tokenAddress} not found in hardcoded mapping`);
  return -1;
}

/**

/**
 * Find token indices for a swap pair in the router
 * @param routerAddress - Address of the swap router
 * @param tokenInAddress - Input token contract address
 * @param tokenOutAddress - Output token contract address
 * @returns Object with token indices or null if either token not found
 */
export async function getRouterTokenIndices(
  routerAddress: string,
  tokenInAddress: string,
  tokenOutAddress: string
): Promise<{ tokenInIndex: number; tokenOutIndex: number } | null> {
  try {
    const tokenInIndex = await getRouterTokenIndex(routerAddress, tokenInAddress);
    const tokenOutIndex = await getRouterTokenIndex(routerAddress, tokenOutAddress);

    if (tokenInIndex === -1 || tokenOutIndex === -1) {
      console.warn(
        `Token not found in router. In: ${tokenInIndex}, Out: ${tokenOutIndex}`
      );
      return null;
    }

    return { tokenInIndex, tokenOutIndex };
  } catch (error) {
    console.error("Error getting router token indices:", error);
    return null;
  }
}

/**
 * Find the pool that contains both tokens
 * @param tokenInSymbol - Symbol of input token
 * @param tokenOutSymbol - Symbol of output token
 * @returns Object with pool address and local indices (0 or 1) or null if not found
 */
function findPoolForTokens(
  tokenInSymbol: string,
  tokenOutSymbol: string
): {
  poolAddress: string;
  tokenInIndex: number;
  tokenOutIndex: number;
} | null {
  const pools = Object.entries(ARC_POOLS.pools);

  for (const [, poolInfo] of pools) {
    const [token0, token1] = poolInfo.tokens;
    
    // Check both directions
    if (token0 === tokenInSymbol && token1 === tokenOutSymbol) {
      return {
        poolAddress: poolInfo.address,
        tokenInIndex: 0,
        tokenOutIndex: 1,
      };
    } else if (token0 === tokenOutSymbol && token1 === tokenInSymbol) {
      return {
        poolAddress: poolInfo.address,
        tokenInIndex: 1,
        tokenOutIndex: 0,
      };
    }
  }

  return null;
}

// Swap Router ABI - this contract handles token swaps with get_dy and swap functions
export const SWAP_ROUTER_ABI = [
  {
    name: "get_dy",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "i", type: "uint256" },
      { name: "j", type: "uint256" },
      { name: "dx", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "swap",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "i", type: "uint256" },
      { name: "j", type: "uint256" },
      { name: "dx", type: "uint256" },
    ],
    outputs: [{ name: "dy", type: "uint256" }],
  },
  {
    name: "getBalances",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    name: "getTokenCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "tokens",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
];

// Liquidity Pool ABI for managing liquidity
export const LIQUIDITY_POOL_ABI = [
  {
    name: "getBalances",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    name: "addLiquidity",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "amounts", type: "uint256[]" }],
    outputs: [],
  },
  {
    name: "removeLiquidity",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "lpAmount", type: "uint256" }],
    outputs: [],
  },
];

// ERC20 ABI for token balance queries
export const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
];

/**
 * Fetch ERC20 token balance from Arc testnet
 * @param walletAddress - The wallet address to fetch balance for
 * @param tokenAddress - The ERC20 token contract address
 * @returns Balance as string (in wei)
 */
export const fetchERC20Balance = async (
  walletAddress: string,
  tokenAddress: string
): Promise<string | null> => {
  try {
    // Ensure addresses are in correct format (with 0x prefix)
    const cleanWalletAddress = walletAddress.startsWith("0x")
      ? walletAddress
      : `0x${walletAddress}`;
    const cleanTokenAddress = tokenAddress.startsWith("0x")
      ? tokenAddress
      : `0x${tokenAddress}`;

    // Encode balanceOf function call: balanceOf(address)
    // Function selector for balanceOf: 0x70a08231
    const functionSelector = "0x70a08231";
    const paddedAddress = cleanWalletAddress.slice(2).padStart(64, "0");
    const encodedData = functionSelector + paddedAddress;

    console.log("Fetching ERC20 balance:", {
      walletAddress: cleanWalletAddress,
      tokenAddress: cleanTokenAddress,
      encodedData,
    });

    const response = await fetch(ARC_TESTNET_CONFIG.rpcUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "eth_call",
        params: [
          {
            to: cleanTokenAddress,
            data: encodedData,
          },
          "latest",
        ],
      }),
    });

    const data = await response.json();

    console.log("ERC20 balance response:", {
      tokenAddress: cleanTokenAddress,
      response: data,
    });

    if (data.error) {
      console.error(
        `RPC Error fetching ERC20 balance for ${cleanTokenAddress}:`,
        data.error
      );
      return null;
    }

    if (data.result && data.result !== "0x") {
      return data.result;
    }

    console.warn(
      `No balance returned for token ${cleanTokenAddress} at ${cleanWalletAddress}`
    );
    return "0x0";
  } catch (error) {
    console.error(
      `Error fetching ERC20 balance for ${tokenAddress}:`,
      error
    );
    return null;
  }
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

/**
 * Encode function data for EVM calls using minimal encoding
 * @param functionName - Name of the function
 * @param inputs - Array of input values
 * @returns Encoded function data
 */
function encodeFunctionData(functionName: string, inputs: string[]): string {
  const functionSignatures: { [key: string]: string } = {
    "get_dy(uint256,uint256,uint256)": "0x50c0e8aa",
    "swap(uint256,uint256,uint256,uint256)": "0xa08cd8e2",
    "getBalances()": "0xe4e61b70",
    "getTokenCount()": "0x0dfe1681",
    "tokens(uint256)": "0xfc735e99",
  };

  const typeMap: Record<string, string[]> = {
    "get_dy(uint256,uint256,uint256)": ["uint256", "uint256", "uint256"],
    "swap(uint256,uint256,uint256,uint256)": [
      "uint256",
      "uint256",
      "uint256",
      "uint256",
    ],
    "getBalances()": [],
    "getTokenCount()": [],
    "tokens(uint256)": ["uint256"],
  };

  let typeList: string[] = [];
  if (functionName === "get_dy") {
    typeList = typeMap["get_dy(uint256,uint256,uint256)"];
  } else if (functionName === "swap") {
    typeList = typeMap["swap(uint256,uint256,uint256,uint256)"];
  } else if (functionName === "getBalances") {
    typeList = typeMap["getBalances()"];
  } else if (functionName === "getTokenCount") {
    typeList = typeMap["getTokenCount()"];
  } else if (functionName === "tokens") {
    typeList = typeMap["tokens(uint256)"];
  }

  const signature = `${functionName}(${typeList.join(",")})`;
  const selector = functionSignatures[signature];

  if (!selector) {
    throw new Error(`Unknown function: ${functionName}`);
  }

  let encoded = selector;

  if (inputs.length > 0) {
    inputs.forEach((input) => {
      const hex = BigInt(input).toString(16).padStart(64, "0");
      encoded += hex;
    });
  }

  return encoded;
}

/**
 * Make a JSON-RPC call to Arc network
 * @param method - JSON-RPC method name
 * @param params - Parameters for the method
 * @returns Response data
 */
async function makeJsonRpcCall(
  method: string,
  params: (string | number | Record<string, string>)[]
): Promise<string> {
  const response = await fetch(ARC_TESTNET_CONFIG.rpcUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params,
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`RPC Error: ${data.error.message}`);
  }

  return data.result;
}

/**
 * Get a quote for swapping between two tokens using the Arc swap router
 * 
 * @param tokenInAddress - Input token contract address
 * @param tokenOutAddress - Output token contract address
 * @param amountIn - Amount to swap (in wei)
 * @returns Amount out (in wei)
 */
export async function getSwapQuote(
  tokenInAddress: string,
  tokenOutAddress: string,
  amountIn: string
): Promise<string> {
  try {
    // Convert token addresses to symbols
    const normalizedInAddress = tokenInAddress.toLowerCase();
    const normalizedOutAddress = tokenOutAddress.toLowerCase();

    const addressToSymbol: Record<string, string> = {
      "0x3600000000000000000000000000000000000000": "USDC",
      "0x89b50855aa3be2f677cd6303cec089b5f319d72a": "EURC",
      "0xbe7477bf91526fc9988c8f33e91b6db687119d45": "SWPRC",
    };

    const tokenInSymbol = addressToSymbol[normalizedInAddress];
    const tokenOutSymbol = addressToSymbol[normalizedOutAddress];

    if (!tokenInSymbol || !tokenOutSymbol) {
      throw new Error(
        `Cannot map token addresses to symbols. In: ${tokenInAddress}, Out: ${tokenOutAddress}`
      );
    }

    // Find the pool that contains both tokens
    const poolInfo = findPoolForTokens(tokenInSymbol, tokenOutSymbol);

    if (!poolInfo) {
      throw new Error(
        `No pool found for tokens ${tokenInSymbol}/${tokenOutSymbol}`
      );
    }

    const { poolAddress, tokenInIndex, tokenOutIndex } = poolInfo;

    const data = encodeFunctionData("get_dy", [
      BigInt(tokenInIndex).toString(),
      BigInt(tokenOutIndex).toString(),
      BigInt(amountIn).toString(),
    ]);

    console.log("Getting swap quote from pool:", {
      poolAddress,
      tokenInSymbol,
      tokenOutSymbol,
      tokenInIndex,
      tokenOutIndex,
      amountIn,
      encodedData: data,
    });

    const result = await makeJsonRpcCall("eth_call", [
      {
        to: poolAddress,
        data,
      },
      "latest",
    ]);

    console.log("Swap quote result:", result);

    // Parse the result (32 bytes for uint256)
    const amount = result.startsWith("0x") ? result : "0x" + result;
    return amount;
  } catch (error) {
    console.error("Error getting swap quote:", {
      tokenInAddress,
      tokenOutAddress,
      amountIn,
      error,
    });
    throw error;
  }
}

/**
 * Get pool balances for both tokens
 * @param poolAddress - Address of the pool
 * @returns Array of [balance0, balance1] in wei
 */
export async function getPoolBalances(
  poolAddress: string
): Promise<[string, string]> {
  try {
    const data = encodeFunctionData("getBalances", []);

    const result = await makeJsonRpcCall("eth_call", [
      {
        to: poolAddress,
        data,
      },
      "latest",
    ]);

    // Parse dynamic array response
    // Format: offset (32 bytes) + length (32 bytes) + data
    const dataHex = result.slice(2);
    const offset = parseInt(dataHex.slice(0, 64), 16);

    const balance0 = "0x" + dataHex.slice(offset * 2 + 64, offset * 2 + 128);
    const balance1 = "0x" + dataHex.slice(offset * 2 + 128, offset * 2 + 192);

    return [balance0, balance1];
  } catch (error) {
    console.error("Error getting pool balances:", error);
    throw error;
  }
}

/**
 * Prepare a swap transaction using the Arc swap router
 * @param tokenInIndex - Index of input token in router's token list
 * @param tokenOutIndex - Index of output token in router's token list
 * @param amountIn - Amount to swap (in wei)
 * @returns Transaction data object ready to sign
 */
export function prepareSwapTransaction(
  tokenInIndex: number,
  tokenOutIndex: number,
  amountIn: string
): {
  to: string;
  data: string;
  value: string;
} {
  const data = encodeFunctionData("swap", [
    BigInt(tokenInIndex).toString(),
    BigInt(tokenOutIndex).toString(),
    BigInt(amountIn).toString(),
  ]);

  return {
    to: ARC_POOLS.router,
    data,
    value: "0x0",
  };
}

/**
 * Get pool info for a specific pool pair
 * @param pairName - Pool pair name (e.g., "USDC/EURC")
 * @returns Pool address and token info
 */
export function getPoolInfo(
  pairName: string
): { address: string; pair: string; tokens: string[] } | null {
  const poolData = ARC_POOLS.pools[pairName as keyof typeof ARC_POOLS.pools];
  if (!poolData) {
    return null;
  }
  return { address: poolData.address, pair: pairName, tokens: poolData.tokens };
}

/**
 * List all available pools
 * @returns Array of available pool pairs
 */
export function listAvailablePools(): string[] {
  return Object.keys(ARC_POOLS.pools);
}

/**
 * Calculate price impact
 * @param amountOut - Output amount
 * @param reserve0 - Reserve of token 0
 * @param reserve1 - Reserve of token 1
 * @returns Price impact as percentage (0-100)
 */
export function calculatePriceImpact(
  amountOut: string,
  reserve0: string,
  reserve1: string
): number {
  try {
    const out = BigInt(amountOut);
    const res0 = BigInt(reserve0);
    const res1 = BigInt(reserve1);

    if (res0 === BigInt(0) || res1 === BigInt(0)) return 0;

    const spotPrice = (res1 * BigInt("1000000")) / res0;
    const executionPrice = (out * BigInt("1000000")) / res0;

    const impact = Number(
      ((spotPrice - executionPrice) * BigInt("100")) / spotPrice
    );
    const denominator = 1000000;
    return Math.max(0, impact) / denominator;
  } catch {
    return 0;
  }
}

/**
 * QuantumExchange API Integration
 * REST API based integration for getting swap quotes
 */

interface QuoteResponse {
  success: boolean;
  data?: {
    fromToken: {
      address: string;
      symbol: string;
      decimals: number;
    };
    toToken: {
      address: string;
      symbol: string;
      decimals: number;
    };
    fromAmount: string;
    toAmount: string;
    priceImpact: number;
    minimumReceived: string;
    route: Array<{
      from: string;
      to: string;
      type: string;
    }>;
    estimatedGas: number;
    protocols: string[];
  };
  error?: {
    code: string;
    message: string;
  };
  timestamp: number;
}

interface SwapDataResponse {
  success: boolean;
  data?: {
    to: string;
    data: string;
    value: string;
    gasLimit: number;
    approvalAddress: string | null;
    approvalAmount: string | null;
  };
  error?: {
    code: string;
    message: string;
  };
  timestamp: number;
}

/**
 * Get a swap quote using QuantumExchange API
 * @param tokenInAddress - Input token contract address
 * @param tokenOutAddress - Output token contract address
 * @param amountIn - Amount to swap (in wei)
 * @param slippage - Slippage tolerance in % (default: 0.5)
 * @returns Quote data with output amount and price impact
 */
export async function getSwapQuoteFromQuantumExchange(
  tokenInAddress: string,
  tokenOutAddress: string,
  amountIn: string,
  slippage: number = 0.5
): Promise<{
  toAmount: string;
  minimumReceived: string;
  priceImpact: number;
  estimatedGas: number;
}> {
  try {
    const params = new URLSearchParams({
      fromToken: tokenInAddress,
      toToken: tokenOutAddress,
      amount: amountIn,
      slippage: slippage.toString(),
    });

    const url = `${QUANTUM_EXCHANGE_CONFIG.baseUrl}/quote?${params.toString()}`;

    console.log("Getting quote from QuantumExchange:", {
      tokenInAddress,
      tokenOutAddress,
      amountIn,
      slippage,
    });

    const response = await fetch(url);
    const result: QuoteResponse = await response.json();

    if (!result.success || !result.data) {
      throw new Error(
        result.error?.message || "Failed to get quote from QuantumExchange"
      );
    }

    console.log("QuantumExchange quote received:", {
      toAmount: result.data.toAmount,
      minimumReceived: result.data.minimumReceived,
      priceImpact: result.data.priceImpact,
      estimatedGas: result.data.estimatedGas,
    });

    return {
      toAmount: result.data.toAmount,
      minimumReceived: result.data.minimumReceived,
      priceImpact: result.data.priceImpact,
      estimatedGas: result.data.estimatedGas,
    };
  } catch (error) {
    console.error("Error getting quote from QuantumExchange:", error);
    throw error;
  }
}

/**
 * Get swap transaction data from QuantumExchange API
 * @param tokenInAddress - Input token contract address
 * @param tokenOutAddress - Output token contract address
 * @param amountIn - Amount to swap (in wei)
 * @param slippage - Slippage tolerance in %
 * @param recipient - Recipient wallet address
 * @param deadline - Transaction deadline in seconds from now (optional)
 * @returns Transaction data ready to sign and broadcast
 */
export async function getSwapTransactionFromQuantumExchange(
  tokenInAddress: string,
  tokenOutAddress: string,
  amountIn: string,
  slippage: number,
  recipient: string,
  deadline: number = 300
): Promise<{
  to: string;
  data: string;
  value: string;
  gasLimit: number;
  approvalAddress: string | null;
  approvalAmount: string | null;
}> {
  try {
    const params = new URLSearchParams({
      fromToken: tokenInAddress,
      toToken: tokenOutAddress,
      amount: amountIn,
      slippage: slippage.toString(),
      recipient: recipient,
      deadline: (Math.floor(Date.now() / 1000) + deadline).toString(),
    });

    const url = `${QUANTUM_EXCHANGE_CONFIG.baseUrl}/swap?${params.toString()}`;

    console.log("Getting swap data from QuantumExchange:", {
      tokenInAddress,
      tokenOutAddress,
      amountIn,
      slippage,
      recipient,
    });

    const response = await fetch(url);
    const result: SwapDataResponse = await response.json();

    if (!result.success || !result.data) {
      throw new Error(
        result.error?.message || "Failed to get swap data from QuantumExchange"
      );
    }

    console.log("QuantumExchange swap data received:", {
      to: result.data.to,
      value: result.data.value,
      gasLimit: result.data.gasLimit,
      approvalAddress: result.data.approvalAddress,
    });

    return {
      to: result.data.to,
      data: result.data.data,
      value: result.data.value,
      gasLimit: result.data.gasLimit,
      approvalAddress: result.data.approvalAddress,
      approvalAmount: result.data.approvalAmount,
    };
  } catch (error) {
    console.error("Error getting swap data from QuantumExchange:", error);
    throw error;
  }
}

/**
 * Get list of supported tokens from QuantumExchange
 * @returns Array of supported tokens with metadata
 */
export async function getQuantumExchangeTokens(): Promise<
  Array<{
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    logoUrl: string;
  }>
> {
  try {
    const url = `${QUANTUM_EXCHANGE_CONFIG.baseUrl}/tokens`;

    const response = await fetch(url);
    const result = await response.json();

    if (!result.success || !result.data?.tokens) {
      throw new Error("Failed to fetch tokens from QuantumExchange");
    }

    console.log("QuantumExchange tokens fetched:", result.data.tokens.length);

    return result.data.tokens;
  } catch (error) {
    console.error("Error fetching tokens from QuantumExchange:", error);
    throw error;
  }
}
