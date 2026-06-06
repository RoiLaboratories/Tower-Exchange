import { createPublicClient, createWalletClient, formatUnits, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const originalEnvKeys = new Set(Object.keys(process.env));
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const parseEnvValue = (value) => {
  const trimmed = value.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
};

const loadEnvFile = (path) => {
  if (!existsSync(path)) {
    return;
  }

  const content = readFileSync(path, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = parseEnvValue(trimmed.slice(separatorIndex + 1));

    if (key && !originalEnvKeys.has(key)) {
      process.env[key] = value;
    }
  }
};

loadEnvFile(resolve(projectRoot, ".env"));
loadEnvFile(resolve(projectRoot, ".env.local"));
loadEnvFile(resolve(projectRoot, "contracts", ".env"));
loadEnvFile(resolve(projectRoot, "contracts", ".env.local"));

const ARC_TESTNET = {
  id: Number(process.env.ARC_CHAIN_ID || 5042002),
  name: "Arc Testnet",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 6,
  },
  rpcUrls: {
    default: {
      http: [process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network"],
    },
  },
};

const FEE_COLLECTOR_ADDRESS =
  process.env.FEE_COLLECTOR_ADDRESS ||
  "0xE71e5baDb9528647F0dd42298bC543D493FC9E40";

const TOKEN_METADATA = {
  "0x3600000000000000000000000000000000000000": {
    symbol: "USDC",
    decimals: 6,
  },
  "0x175cdb1d338945f0d851a741ccf787d343e57952": {
    symbol: "USDT",
    decimals: 18,
  },
  "0x89b50855aa3be2f677cd6303cec089b5f319d72a": {
    symbol: "EURC",
    decimals: 6,
  },
};

const feeCollectorAbi = [
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "treasury",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "getFeeTokens",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address[]" }],
  },
  {
    type: "function",
    name: "getAccumulatedFees",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "withdrawToTreasury",
    stateMutability: "nonpayable",
    inputs: [{ name: "token", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "withdrawAllToTreasury",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "withdrawMultipleToTreasury",
    stateMutability: "nonpayable",
    inputs: [{ name: "tokens", type: "address[]" }],
    outputs: [],
  },
];

const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
];

const normalizePrivateKey = (value) => {
  if (!value) {
    return "";
  }

  return value.startsWith("0x") ? value : `0x${value}`;
};

const privateKeyEnvNames = [
  "FEE_COLLECTOR_OWNER_PRIVATE_KEY",
  "PRIVATE_KEY",
  "OWNER_PRIVATE_KEY",
  "DEPLOYER_PRIVATE_KEY",
  "BACKEND_PRIVATE_KEY",
];

const getPrivateKeyFromEnv = () => {
  for (const name of privateKeyEnvNames) {
    if (process.env[name]) {
      return {
        name,
        value: normalizePrivateKey(process.env[name]),
      };
    }
  }

  return { name: "", value: "" };
};

const assertPrivateKey = (value) => {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(
      `Set one of ${privateKeyEnvNames.join(
        ", "
      )} to the FeeCollector owner wallet private key.`
    );
  }
};

const sameAddress = (a, b) => a.toLowerCase() === b.toLowerCase();

const tokenLabel = (tokenAddress) => {
  const metadata = TOKEN_METADATA[tokenAddress.toLowerCase()];
  return metadata || { symbol: tokenAddress, decimals: 18 };
};

const tokenAliases = Object.fromEntries(
  Object.entries(TOKEN_METADATA).map(([address, metadata]) => [
    metadata.symbol.toUpperCase(),
    address,
  ])
);

const getArgValues = (name) => {
  const values = [];

  for (let i = 0; i < process.argv.length; i++) {
    const arg = process.argv[i];

    if (arg === name && process.argv[i + 1]) {
      values.push(process.argv[i + 1]);
      i++;
      continue;
    }

    if (arg.startsWith(`${name}=`)) {
      values.push(arg.slice(name.length + 1));
    }
  }

  return values;
};

const getRequestedTokenInputs = () => [
  ...getArgValues("--token"),
  ...getArgValues("--tokens").flatMap((value) => value.split(",")),
];

const resolveTokenInput = (value) => {
  const trimmed = value.trim();

  if (/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
    return trimmed;
  }

  const alias = tokenAliases[trimmed.toUpperCase()];
  if (alias) {
    return alias;
  }

  throw new Error(
    `Unknown token "${value}". Use a token address or one of ${Object.keys(
      tokenAliases
    ).join(", ")}.`
  );
};

const uniqueAddresses = (addresses) => {
  const seen = new Set();
  const unique = [];

  for (const address of addresses) {
    const normalized = address.toLowerCase();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      unique.push(address);
    }
  }

  return unique;
};

const readFeeCollectorTokenBalance = async (publicClient, token) => {
  try {
    return await publicClient.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [FEE_COLLECTOR_ADDRESS],
    });
  } catch {
    return null;
  }
};

const main = async () => {
  const execute = process.argv.includes("--execute");
  const requestedTokenInputs = getRequestedTokenInputs().filter(Boolean);
  const requestedTokens = uniqueAddresses(
    requestedTokenInputs.map(resolveTokenInput)
  );
  const { name: privateKeyEnvName, value: privateKey } = getPrivateKeyFromEnv();
  assertPrivateKey(privateKey);

  const rpcUrl = ARC_TESTNET.rpcUrls.default.http[0];
  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({
    chain: ARC_TESTNET,
    transport: http(rpcUrl),
  });
  const walletClient = createWalletClient({
    account,
    chain: ARC_TESTNET,
    transport: http(rpcUrl),
  });

  const [owner, treasury, feeTokens] = await Promise.all([
    publicClient.readContract({
      address: FEE_COLLECTOR_ADDRESS,
      abi: feeCollectorAbi,
      functionName: "owner",
    }),
    publicClient.readContract({
      address: FEE_COLLECTOR_ADDRESS,
      abi: feeCollectorAbi,
      functionName: "treasury",
    }),
    publicClient.readContract({
      address: FEE_COLLECTOR_ADDRESS,
      abi: feeCollectorAbi,
      functionName: "getFeeTokens",
    }),
  ]);

  console.log("FeeCollector withdrawal check");
  console.log("--------------------------------");
  console.log(`RPC: ${rpcUrl}`);
  console.log(`FeeCollector: ${FEE_COLLECTOR_ADDRESS}`);
  console.log(`Treasury: ${treasury}`);
  console.log(`Owner: ${owner}`);
  console.log(`Signer: ${account.address}`);
  console.log(`Private key env: ${privateKeyEnvName}`);

  if (!sameAddress(account.address, owner)) {
    throw new Error(
      "The supplied private key does not belong to the FeeCollector owner. withdrawAllToTreasury is onlyOwner."
    );
  }

  const tokenRows = [];
  const tokensToInspect =
    requestedTokens.length > 0 ? requestedTokens : uniqueAddresses(feeTokens);

  if (tokensToInspect.length === 0) {
    console.log("No fee tokens are currently tracked by this contract.");
  } else {
    console.log("");
    console.log(
      requestedTokens.length > 0
        ? "Selected accumulated fees:"
        : "Accumulated fees:"
    );

    for (const token of tokensToInspect) {
      const [amount, contractBalance] = await Promise.all([
        publicClient.readContract({
          address: FEE_COLLECTOR_ADDRESS,
          abi: feeCollectorAbi,
          functionName: "getAccumulatedFees",
          args: [token],
        }),
        readFeeCollectorTokenBalance(publicClient, token),
      ]);
      const metadata = tokenLabel(token);
      const canWithdraw =
        contractBalance !== null && amount > 0n && contractBalance >= amount;
      const deficit =
        contractBalance !== null && amount > contractBalance
          ? amount - contractBalance
          : 0n;

      tokenRows.push({
        token,
        metadata,
        amount,
        contractBalance,
        canWithdraw,
        deficit,
      });

      console.log(
        `- ${metadata.symbol} (${token}): accumulated ${formatUnits(
          amount,
          metadata.decimals
        )}; contract balance ${
          contractBalance === null
            ? "unreadable"
            : formatUnits(contractBalance, metadata.decimals)
        }; ${canWithdraw ? "withdrawable" : "blocked"}`
      );
    }
  }

  const blockedRows = tokenRows.filter(
    (row) => row.amount > 0n && !row.canWithdraw
  );
  const withdrawableRows = tokenRows.filter((row) => row.canWithdraw);

  if (blockedRows.length > 0) {
    console.log("");
    console.log("These tokens are blocked and will be skipped:");
    for (const row of blockedRows) {
      console.log(
        `- ${row.metadata.symbol}: accumulated ${formatUnits(
          row.amount,
          row.metadata.decimals
        )}, contract balance ${
          row.contractBalance === null
            ? "unreadable"
            : formatUnits(row.contractBalance, row.metadata.decimals)
        }${
          row.deficit > 0n
            ? `, deficit ${formatUnits(row.deficit, row.metadata.decimals)}`
            : ""
        }`
      );
    }
  }

  if (withdrawableRows.length === 0) {
    throw new Error("No selected fee token is currently safe to withdraw.");
  }

  console.log("");
  console.log(
    `Using withdrawToTreasury(token) for ${withdrawableRows.length} token(s).`
  );

  const simulations = [];
  for (const row of withdrawableRows) {
    console.log(`Simulating withdrawToTreasury(${row.metadata.symbol})...`);
    const simulation = await publicClient.simulateContract({
      account,
      address: FEE_COLLECTOR_ADDRESS,
      abi: feeCollectorAbi,
      functionName: "withdrawToTreasury",
      args: [row.token],
    });
    simulations.push({ row, simulation });
  }
  console.log("Simulation passed.");

  if (!execute) {
    console.log("");
    console.log("Dry run only. Re-run with --execute to broadcast the transaction.");
    return;
  }

  console.log("");
  for (const { row, simulation } of simulations) {
    console.log(`Broadcasting withdrawToTreasury(${row.metadata.symbol})...`);
    const hash = await walletClient.writeContract(simulation.request);
    console.log(`Transaction hash: ${hash}`);

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`Confirmed in block: ${receipt.blockNumber}`);
    console.log(`Status: ${receipt.status}`);
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
