const { ethers, network, run } = require("hardhat");

const DEFAULT_TOKENS = {
  USDC: "0x3600000000000000000000000000000000000000",
  EURC: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
  USDT: "0x175CdB1D338945f0D851A741ccF787D343E57952",
  CIRBTC: "0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF",
  CNGN: "0x9a9c18A371d98200FE910f62c45875f1abb68d20",
  QCAD: "0x23d7CFFd0876f3ABb6B074287ba2aeefBc83825d",
};

function parseBoolean(value, fallback) {
  if (value == null || value === "") {
    return fallback;
  }

  return value.toLowerCase() === "true";
}

function parseAllowedPairs(rawPairs) {
  if (!rawPairs) {
    return [
      ["USDC", "EURC"],
      ["USDC", "CIRBTC"],
      ["EURC", "CIRBTC"],
      ["USDC", "USDT"],
      ["EURC", "USDT"],
      ["USDT", "CIRBTC"],
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
  }

  return rawPairs
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [base, quote] = entry.split("/").map((symbol) => symbol.trim().toUpperCase());
      if (!base || !quote) {
        throw new Error(`Invalid pair definition: ${entry}`);
      }
      return [base, quote];
    });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function verifyContract(address, constructorArguments = [], contract) {
  try {
    await run("verify:verify", {
      address,
      constructorArguments,
      contract,
    });
    console.log(`Verified ${contract} at ${address}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const normalized = message.toLowerCase();

    if (
      normalized.includes("already verified") ||
      normalized.includes("source code already verified")
    ) {
      console.log(`Already verified: ${address}`);
      return;
    }

    console.warn(`Verification failed for ${address}: ${message}`);
  }
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying Tower AMM from:", deployer.address);
  const createdPairs = [];

  const TowerFactory = await ethers.getContractFactory("TowerFactory");
  const factory = await TowerFactory.deploy(deployer.address);
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("Factory:", factoryAddress);

  const TowerRouter = await ethers.getContractFactory("TowerRouter");
  const router = await TowerRouter.deploy(factoryAddress);
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();
  console.log("Router:", routerAddress);

  const tokenMap = {
    USDC: process.env.USDC_ADDRESS || DEFAULT_TOKENS.USDC,
    EURC: process.env.EURC_ADDRESS || DEFAULT_TOKENS.EURC,
    USDT: process.env.USDT_ADDRESS || DEFAULT_TOKENS.USDT,
    CIRBTC: process.env.CIRBTC_ADDRESS || DEFAULT_TOKENS.CIRBTC,
    CNGN: process.env.CNGN_ADDRESS || DEFAULT_TOKENS.CNGN,
    QCAD: process.env.QCAD_ADDRESS || DEFAULT_TOKENS.QCAD,
  };

  const supportedSymbols = Object.keys(tokenMap).filter(
    (symbol) => tokenMap[symbol] && tokenMap[symbol] !== ethers.ZeroAddress,
  );

  const supportedAddresses = supportedSymbols.map((symbol) => tokenMap[symbol]);
  console.log("Registering supported tokens:", supportedSymbols.join(", "));
  await (await factory.batchSetSupportedTokens(supportedAddresses, true)).wait();

  const allowedPairs = parseAllowedPairs(process.env.TOWER_ALLOWED_PAIRS);
  for (const [baseSymbol, quoteSymbol] of allowedPairs) {
    const base = tokenMap[baseSymbol];
    const quote = tokenMap[quoteSymbol];

    if (!base || !quote) {
      throw new Error(`Missing token address for allowed pair ${baseSymbol}/${quoteSymbol}`);
    }

    await (await factory.setPairAllowed(base, quote, true)).wait();
    console.log(`Allowed pair: ${baseSymbol}/${quoteSymbol}`);
  }

  const enforceAllowlist = parseBoolean(process.env.TOWER_ENFORCE_PAIR_ALLOWLIST, true);
  await (await factory.setEnforcePairAllowlist(enforceAllowlist)).wait();
  console.log("Pair allowlist enforcement:", enforceAllowlist);

  const treasury = process.env.TOWER_TREASURY_ADDRESS;
  if (treasury && treasury !== ethers.ZeroAddress) {
    await (await factory.setFeeTo(treasury)).wait();
    console.log("Treasury fee recipient:", treasury);
  } else {
    console.log("Treasury fee recipient: disabled");
  }

  const createInitialPairs = parseBoolean(process.env.CREATE_INITIAL_PAIRS, true);
  if (createInitialPairs) {
    console.log("Creating initial pairs...");
    for (const [baseSymbol, quoteSymbol] of allowedPairs) {
      const base = tokenMap[baseSymbol];
      const quote = tokenMap[quoteSymbol];
      const pairAddress = await factory.getPair(base, quote);

      if (pairAddress === ethers.ZeroAddress) {
        await (await factory.createPair(base, quote)).wait();
        const createdPair = await factory.getPair(base, quote);
        createdPairs.push({
          symbols: `${baseSymbol}/${quoteSymbol}`,
          address: createdPair,
        });
        console.log(`Pair ${baseSymbol}/${quoteSymbol}:`, createdPair);
      }
    }
  }

  const finalFeeToSetter = process.env.TOWER_FINAL_FEE_TO_SETTER;
  if (
    finalFeeToSetter &&
    finalFeeToSetter !== ethers.ZeroAddress &&
    finalFeeToSetter.toLowerCase() !== deployer.address.toLowerCase()
  ) {
    await (await factory.setFeeToSetter(finalFeeToSetter)).wait();
    console.log("Final feeToSetter:", finalFeeToSetter);
  }

  console.log("\nTower AMM deployment complete");
  console.log("----------------------------------------");
  console.log("Factory:", factoryAddress);
  console.log("Router: ", routerAddress);
  console.log("Tokens: ", tokenMap);
  console.log("Pairs:  ", allowedPairs.map(([a, b]) => `${a}/${b}`).join(", "));

  const shouldVerify = parseBoolean(process.env.VERIFY_CONTRACTS, network.name !== "hardhat");
  if (shouldVerify && network.name !== "hardhat") {
    const verificationDelayMs = Number(process.env.VERIFICATION_DELAY_MS || "30000");
    if (verificationDelayMs > 0) {
      console.log(`Waiting ${verificationDelayMs}ms before verification...`);
      await wait(verificationDelayMs);
    }

    console.log("\nVerifying contracts on explorer...");
    await verifyContract(
      factoryAddress,
      [deployer.address],
      "contracts/core/TowerFactory.sol:TowerFactory",
    );
    await verifyContract(
      routerAddress,
      [factoryAddress],
      "contracts/periphery/TowerRouter.sol:TowerRouter",
    );

    for (const pair of createdPairs) {
      await verifyContract(
        pair.address,
        [],
        "contracts/core/TowerPair.sol:TowerPair",
      );
      console.log(`Verification attempted for pair ${pair.symbols}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
