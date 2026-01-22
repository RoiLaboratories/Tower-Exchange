// Arc Testnet Configuration and utilities
export const ARC_TESTNET_CONFIG = {
  chainId: 5042002,
  rpcUrl: "https://rpc.testnet.arc.network",
  currency: "USDC",
  decimals: 18,
  explorerUrl: "https://testnet.arcscan.app",
  faucetUrl: "https://faucet.circle.com",
};

// Token Contract Addresses on Arc Testnet
export const TOKEN_CONTRACTS = {
  EURC: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
  SWPRC: "0xBE7477BF91526FC9988C8f33e91B6db687119D45",
  // Add other token addresses as needed
  // USDC: "0x...",
  // USDT: "0x...",
  // UNI: "0x...",
  // HYPE: "0x...",
};

// Token Decimals Configuration
export const TOKEN_DECIMALS: Record<string, number> = {
  USDC: 6,
  EURC: 6,
  SWPRC: 6,
  USDT: 6,
  UNI: 18,
  HYPE: 18,
  ETH: 18,
};

// Arc Pool Configuration
export const ARC_POOLS = {
  router: "0x2F4490e7c6F3DaC23ffEe6e71bFcb5d1CCd7d4eC",
  pools: {
    "USDC/EURC": "0xd22e4fB80E21e8d2C91131eC2D6b0C000491934B",
    "USDC/SWPRC": "0x613bc8A188a571e7Ffe3F884FabAB0F43ABB8282",
    "EURC/SWPRC": "0x9463DE67E73B42B2cE5e45cab7e32184B9c24939",
  },
};

// Minimal Pool ABI for swaps and quotes
export const POOL_ABI = [
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
      { name: "min_dy", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getBalances",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256[]" }],
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
  };

  let typeList: string[] = [];
  if (functionName === "get_dy") {
    typeList = typeMap["get_dy(uint256,uint256,uint256)"];
  } else if (functionName === "swap") {
    typeList = typeMap["swap(uint256,uint256,uint256,uint256)"];
  } else if (functionName === "getBalances") {
    typeList = typeMap["getBalances()"];
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
 * Get a quote for swapping between two tokens
 * @param poolAddress - Address of the pool
 * @param tokenInIndex - Index of input token (0 or 1)
 * @param tokenOutIndex - Index of output token (0 or 1)
 * @param amountIn - Amount to swap (in wei)
 * @returns Amount out (in wei)
 */
export async function getSwapQuote(
  poolAddress: string,
  tokenInIndex: number,
  tokenOutIndex: number,
  amountIn: string
): Promise<string> {
  try {
    const data = encodeFunctionData("get_dy", [
      BigInt(tokenInIndex).toString(),
      BigInt(tokenOutIndex).toString(),
      BigInt(amountIn).toString(),
    ]);

    const result = await makeJsonRpcCall("eth_call", [
      {
        to: poolAddress,
        data,
      },
      "latest",
    ]);

    // Parse the result (32 bytes for uint256)
    const amount = BigInt(result).toString();
    return amount;
  } catch (error) {
    console.error("Error getting swap quote:", error);
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
 * Prepare a swap transaction
 * @param poolAddress - Address of the pool
 * @param tokenInIndex - Index of input token (0 or 1)
 * @param tokenOutIndex - Index of output token (0 or 1)
 * @param amountIn - Amount to swap (in wei)
 * @param minAmountOut - Minimum amount to receive (slippage protection, in wei)
 * @returns Transaction data object ready to sign
 */
export function prepareSwapTransaction(
  poolAddress: string,
  tokenInIndex: number,
  tokenOutIndex: number,
  amountIn: string,
  minAmountOut: string
): {
  to: string;
  data: string;
  value: string;
} {
  const data = encodeFunctionData("swap", [
    BigInt(tokenInIndex).toString(),
    BigInt(tokenOutIndex).toString(),
    BigInt(amountIn).toString(),
    BigInt(minAmountOut).toString(),
  ]);

  return {
    to: poolAddress,
    data,
    value: "0x0",
  };
}

/**
 * Get pool info for a specific pool pair
 * @param pairName - Pool pair name (e.g., "USDC/EURC")
 * @returns Pool address and info
 */
export function getPoolInfo(
  pairName: string
): { address: string; pair: string } | null {
  const address = ARC_POOLS.pools[pairName as keyof typeof ARC_POOLS.pools];
  if (!address) {
    return null;
  }
  return { address, pair: pairName };
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
