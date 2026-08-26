/**
 * Register cNGN + QCAD as supported Tower assets and create their pairs.
 *
 * Required env:
 *   PRIVATE_KEY              // must be feeToSetter
 *   TOWER_FACTORY_ADDRESS    // default: live Arc Tower factory
 *   TOWER_ROUTER_ADDRESS     // default: live Arc Tower DEX router
 *
 * Optional:
 *   ARC_TESTNET_RPC_URL
 *   CNGN_ADDRESS / QCAD_ADDRESS
 *   DRY_RUN=true             // only print planned actions
 *
 * Usage:
 *   npm run add:cngn-qcad-pairs
 */

let ethers;
try {
  ({ ethers } = require("ethers"));
} catch (error) {
  ({ ethers } = require("../../contracts/node_modules/ethers"));
}

try {
  require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
} catch (error) {
  // ignore
}
try {
  require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env.local") });
} catch (error) {
  // ignore
}

const DEFAULT_RPC_URL = "https://rpc.testnet.arc.network";
const DEFAULT_FACTORY = "0x9DE50a654531CD72533098a9c2De4239c121821D";
const DEFAULT_ROUTER = "0xDf115b4f2F22B9255B2E63348423B6C5B379Bce2";

const TOKENS = {
  USDC: process.env.USDC_ADDRESS || "0x3600000000000000000000000000000000000000",
  EURC: process.env.EURC_ADDRESS || "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
  USDT: process.env.USDT_ADDRESS || "0x175CdB1D338945f0D851A741ccF787D343E57952",
  CIRBTC: process.env.CIRBTC_ADDRESS || "0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF",
  CNGN: process.env.CNGN_ADDRESS || "0x9a9c18A371d98200FE910f62c45875f1abb68d20",
  QCAD: process.env.QCAD_ADDRESS || "0x23d7CFFd0876f3ABb6B074287ba2aeefBc83825d",
};

const NEW_TOKENS = ["CNGN", "QCAD"];

const NEW_PAIRS = [
  ["USDC", "CNGN"],
  ["USDT", "CNGN"],
  ["EURC", "CNGN"],
  ["CIRBTC", "CNGN"],
  ["USDC", "QCAD"],
  ["USDT", "QCAD"],
  ["EURC", "QCAD"],
  ["CIRBTC", "QCAD"],
  ["CNGN", "QCAD"],
];

const FACTORY_ABI = [
  "function feeToSetter() view returns (address)",
  "function supportedToken(address) view returns (bool)",
  "function pairAllowed(address,address) view returns (bool)",
  "function getPair(address,address) view returns (address)",
  "function batchSetSupportedTokens(address[] calldata tokens, bool allowed) external",
  "function batchSetPairAllowed(address[] calldata tokenAs, address[] calldata tokenBs, bool allowed) external",
  "function createPair(address tokenA, address tokenB) external returns (address pair)",
];

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientRpcError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  const code = String(error?.code || "").toUpperCase();

  return (
    code.includes("SSL") ||
    code.includes("NETWORK") ||
    code.includes("TIMEOUT") ||
    code.includes("SERVER_ERROR") ||
    code.includes("ECONNRESET") ||
    code.includes("ETIMEDOUT") ||
    message.includes("ssl") ||
    message.includes("bad record mac") ||
    message.includes("econnreset") ||
    message.includes("etimedout") ||
    message.includes("socket hang up") ||
    message.includes("network") ||
    message.includes("timeout")
  );
}

async function waitForReceipt(provider, txHash, label, attempts = 8) {
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const receipt = await provider.getTransactionReceipt(txHash);
      if (receipt) {
        if (receipt.status !== 1) {
          throw new Error(`${label} reverted in block ${receipt.blockNumber}`);
        }
        console.log(`${label} confirmed in block ${receipt.blockNumber}`);
        return receipt;
      }
    } catch (error) {
      lastError = error;
      if (!isTransientRpcError(error) || attempt === attempts) {
        throw error;
      }
      console.warn(
        `${label} receipt check failed (attempt ${attempt}/${attempts}): ${error.code || error.message}`,
      );
    }

    await sleep(1500 * attempt);
  }

  throw lastError || new Error(`${label} receipt not found for ${txHash}`);
}

async function submitAndWait(txPromise, label) {
  const tx = await txPromise;
  console.log(`${label} submitted: ${tx.hash}`);

  try {
    const receipt = await tx.wait();
    console.log(`${label} confirmed in block ${receipt.blockNumber}`);
    return receipt;
  } catch (error) {
    if (!isTransientRpcError(error)) {
      throw error;
    }

    console.warn(
      `${label} wait interrupted by RPC error (${error.code || error.message}); retrying receipt lookup...`,
    );
    return waitForReceipt(tx.provider, tx.hash, label);
  }
}

async function main() {
  const dryRun = String(process.env.DRY_RUN || "").toLowerCase() === "true";
  const provider = new ethers.JsonRpcProvider(
    process.env.ARC_TESTNET_RPC_URL || DEFAULT_RPC_URL,
    5042002,
  );
  const factoryAddress = process.env.TOWER_FACTORY_ADDRESS || DEFAULT_FACTORY;
  const routerAddress = process.env.TOWER_ROUTER_ADDRESS || DEFAULT_ROUTER;

  console.log("Tower factory:", factoryAddress);
  console.log("Tower router:", routerAddress);
  console.log("Dry run:", dryRun);

  const readFactory = new ethers.Contract(factoryAddress, FACTORY_ABI, provider);
  const feeToSetter = await readFactory.feeToSetter();
  console.log("feeToSetter:", feeToSetter);

  let signer = null;
  let factory = readFactory;

  if (!dryRun) {
    signer = new ethers.Wallet(requireEnv("PRIVATE_KEY"), provider);
    console.log("Signer:", signer.address);

    if (signer.address.toLowerCase() !== feeToSetter.toLowerCase()) {
      throw new Error(
        `PRIVATE_KEY wallet ${signer.address} is not feeToSetter ${feeToSetter}`,
      );
    }

    factory = new ethers.Contract(factoryAddress, FACTORY_ABI, signer);
  }

  const tokensToEnable = [];
  for (const symbol of NEW_TOKENS) {
    const address = TOKENS[symbol];
    const already = await readFactory.supportedToken(address);
    console.log(`supportedToken[${symbol}] (${address}): ${already}`);
    if (!already) {
      tokensToEnable.push(address);
    }
  }

  if (tokensToEnable.length > 0) {
    console.log("Enabling supported tokens:", NEW_TOKENS.join(", "));
    if (!dryRun) {
      await submitAndWait(
        factory.batchSetSupportedTokens(tokensToEnable, true),
        "batchSetSupportedTokens",
      );
    }
  } else {
    console.log("All new tokens already supported");
  }

  const pairAs = [];
  const pairBs = [];
  for (const [base, quote] of NEW_PAIRS) {
    const tokenA = TOKENS[base];
    const tokenB = TOKENS[quote];
    const allowed = await readFactory.pairAllowed(tokenA, tokenB);
    console.log(`pairAllowed[${base}/${quote}]: ${allowed}`);
    if (!allowed) {
      pairAs.push(tokenA);
      pairBs.push(tokenB);
    }
  }

  if (pairAs.length > 0) {
    console.log(`Allowing ${pairAs.length} pairs`);
    if (!dryRun) {
      await submitAndWait(
        factory.batchSetPairAllowed(pairAs, pairBs, true),
        "batchSetPairAllowed",
      );
    }
  } else {
    console.log("All pairs already allowed");
  }

  console.log("\nPair addresses:");
  for (const [base, quote] of NEW_PAIRS) {
    const tokenA = TOKENS[base];
    const tokenB = TOKENS[quote];
    let pair = await readFactory.getPair(tokenA, tokenB);

    if (pair === ethers.ZeroAddress) {
      console.log(`Creating ${base}/${quote}...`);
      if (!dryRun) {
        await submitAndWait(
          factory.createPair(tokenA, tokenB),
          `createPair ${base}/${quote}`,
        );
        pair = await readFactory.getPair(tokenA, tokenB);
      } else {
        pair = "(not created yet)";
      }
    }

    console.log(`${base}/${quote}: ${pair}`);
  }

  console.log("\nDone. Frontend already lists these pairs for Tower DEX/router.");
  console.log("Next: seed liquidity with router add-liquidity for each pair.");
  console.log(`Router: ${routerAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
