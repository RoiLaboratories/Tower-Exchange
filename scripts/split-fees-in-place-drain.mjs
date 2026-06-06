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

const DEFAULT_FEE_COLLECTOR_ADDRESS =
  "0xB75B3b4f75327276Fa8aD9975cdD2d3B4abf1945";

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
  "0xd40fcaa5d2ce963c5dabc2bf59e268489ad7bce4": {
    symbol: "WUSDC",
    decimals: 18,
  },
  "0x911b4000d3422f482f4062a913885f7b035382df": {
    symbol: "WUSDC_SYNTHRA",
    decimals: 18,
  },
  "0xcd304d2a421bfed31d45f0054af8e8a6a4cf3eae": {
    symbol: "QTM",
    decimals: 18,
  },
  "0xe9185f0c5f296ed1797aae4238d26ccabeadb86c": {
    symbol: "USYC",
    decimals: 6,
  },
  "0xbe7477bf91526fc9988c8f33e91b6db687119d45": {
    symbol: "SWPRC",
    decimals: 6,
  },
  "0xc5124c846c6e6307986988dfb7e743327aa05f19": {
    symbol: "SYN",
    decimals: 18,
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
    name: "isAuthorized",
    stateMutability: "view",
    inputs: [{ name: "collector", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "splitFeesInPlace",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "totalAmount", type: "uint256" },
      { name: "feeBps", type: "uint256" },
      { name: "recipient", type: "address" },
    ],
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

const privateKeyEnvNames = [
  "FEE_COLLECTOR_COLLECTOR_PRIVATE_KEY",
  "FEE_COLLECTOR_OWNER_PRIVATE_KEY",
  "PRIVATE_KEY",
  "OWNER_PRIVATE_KEY",
  "DEPLOYER_PRIVATE_KEY",
  "BACKEND_PRIVATE_KEY",
];

const tokenAliases = Object.fromEntries(
  Object.entries(TOKEN_METADATA).map(([address, metadata]) => [
    metadata.symbol.toUpperCase(),
    address,
  ])
);

const normalizePrivateKey = (value) => {
  if (!value) {
    return "";
  }

  return value.startsWith("0x") ? value : `0x${value}`;
};

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
      )} to an authorized FeeCollector collector private key.`
    );
  }
};

const getArgValue = (name) => {
  for (let i = 0; i < process.argv.length; i++) {
    const arg = process.argv[i];

    if (arg === name && process.argv[i + 1]) {
      return process.argv[i + 1];
    }

    if (arg.startsWith(`${name}=`)) {
      return arg.slice(name.length + 1);
    }
  }

  return undefined;
};

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

const sameAddress = (a, b) => a.toLowerCase() === b.toLowerCase();

const isAddress = (value) => /^0x[0-9a-fA-F]{40}$/.test(value);

const resolveTokenInput = (value) => {
  const trimmed = value.trim();

  if (isAddress(trimmed)) {
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

const tokenLabel = (tokenAddress) => {
  const metadata = TOKEN_METADATA[tokenAddress.toLowerCase()];
  return metadata || { symbol: tokenAddress, decimals: 18 };
};

const readTokenBalance = async (publicClient, token, owner) => {
  try {
    return await publicClient.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [owner],
    });
  } catch {
    return null;
  }
};

const main = async () => {
  const execute = process.argv.includes("--execute");
  const contractAddress =
    getArgValue("--contract") ||
    process.env.FEE_COLLECTOR_SPLIT_ADDRESS ||
    DEFAULT_FEE_COLLECTOR_ADDRESS;
  const feeBps = BigInt(getArgValue("--fee-bps") || "0");

  if (!isAddress(contractAddress)) {
    throw new Error("Invalid FeeCollector contract address.");
  }

  if (feeBps < 0n || feeBps > 10000n) {
    throw new Error("--fee-bps must be between 0 and 10000.");
  }

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

  const [owner, treasury, feeTokens, isAuthorized] = await Promise.all([
    publicClient.readContract({
      address: contractAddress,
      abi: feeCollectorAbi,
      functionName: "owner",
    }),
    publicClient.readContract({
      address: contractAddress,
      abi: feeCollectorAbi,
      functionName: "treasury",
    }),
    publicClient.readContract({
      address: contractAddress,
      abi: feeCollectorAbi,
      functionName: "getFeeTokens",
    }),
    publicClient.readContract({
      address: contractAddress,
      abi: feeCollectorAbi,
      functionName: "isAuthorized",
      args: [account.address],
    }),
  ]);

  const recipient =
    getArgValue("--recipient") ||
    process.env.FEE_DRAIN_RECIPIENT ||
    process.env.TREASURY_ADDRESS ||
    treasury;

  if (!isAddress(recipient)) {
    throw new Error("Invalid recipient address.");
  }

  console.log("FeeCollector splitFeesInPlace drain check");
  console.log("-------------------------------------------");
  console.log(`RPC: ${rpcUrl}`);
  console.log(`FeeCollector: ${contractAddress}`);
  console.log(`Owner: ${owner}`);
  console.log(`Treasury: ${treasury}`);
  console.log(`Recipient: ${recipient}`);
  console.log(`Signer: ${account.address}`);
  console.log(`Signer authorized: ${isAuthorized}`);
  console.log(`Private key env: ${privateKeyEnvName}`);
  console.log(`Fee BPS: ${feeBps.toString()}`);

  if (!isAuthorized) {
    const ownerNote = sameAddress(account.address, owner)
      ? " This signer is the owner, but it still must be authorized as a collector before splitFeesInPlace can run."
      : "";
    throw new Error(
      `The supplied signer is not authorized to call splitFeesInPlace.${ownerNote}`
    );
  }

  if (feeBps > 0n) {
    console.warn(
      "Warning: feeBps is greater than 0, so this will not fully drain balances. Use --fee-bps 0 to send the full token balance to the recipient."
    );
  }

  const requestedTokenInputs = [
    ...getArgValues("--token"),
    ...getArgValues("--tokens").flatMap((value) => value.split(",")),
  ].filter(Boolean);
  const requestedTokens = uniqueAddresses(
    requestedTokenInputs.map(resolveTokenInput)
  );
  const knownTokens = Object.keys(TOKEN_METADATA);
  const tokensToInspect = uniqueAddresses(
    requestedTokens.length > 0 ? requestedTokens : [...feeTokens, ...knownTokens]
  );
  const rows = [];

  console.log("");
  console.log(
    requestedTokens.length > 0
      ? "Selected token balances:"
      : "Tracked/known token balances:"
  );

  for (const token of tokensToInspect) {
    const balance = await readTokenBalance(publicClient, token, contractAddress);
    const metadata = tokenLabel(token);

    rows.push({ token, metadata, balance });

    console.log(
      `- ${metadata.symbol} (${token}): ${
        balance === null ? "unreadable" : formatUnits(balance, metadata.decimals)
      }`
    );
  }

  const drainableRows = rows.filter(
    (row) => row.balance !== null && row.balance > 0n
  );

  if (drainableRows.length === 0) {
    throw new Error("No selected token has a readable non-zero balance to drain.");
  }

  console.log("");
  console.log(
    `Using splitFeesInPlace(token, balance, ${feeBps.toString()}, recipient) for ${drainableRows.length} token(s).`
  );

  const simulations = [];
  for (const row of drainableRows) {
    console.log(`Simulating splitFeesInPlace(${row.metadata.symbol})...`);
    const simulation = await publicClient.simulateContract({
      account,
      address: contractAddress,
      abi: feeCollectorAbi,
      functionName: "splitFeesInPlace",
      args: [row.token, row.balance, feeBps, recipient],
    });
    simulations.push({ row, simulation });
  }
  console.log("Simulation passed.");

  if (!execute) {
    console.log("");
    console.log("Dry run only. Re-run with --execute to broadcast transactions.");
    return;
  }

  console.log("");
  for (const { row, simulation } of simulations) {
    console.log(`Broadcasting splitFeesInPlace(${row.metadata.symbol})...`);
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
