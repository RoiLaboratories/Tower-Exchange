const hardhat = require("hardhat");
const { ethers: ethersLib } = hardhat;

// DEX Router Addresses on Arc Testnet
const DEXES = [
  {
    id: "synthra",
    name: "Synthra",
    address: "0xbf4479c07dc6fdc6daa764a0cca06969e894275f",
    usesIDexInterface: false, // Uniswap V2 style
  },
  {
    id: "swaparc",
    name: "Swaparc (StableSwapPool)",
    address: "0x2F4490e7c6F3DaC23ffEe6e71bFcb5d1CCd7d4eC",
    usesIDexInterface: false, // Uniswap V2 style
  },
  {
    id: "quantum-exchange",
    name: "Quantum Exchange",
    address: "0x9d52b6c810d6F95e3d44ca64af3B55F7F66448FF",
    usesIDexInterface: false, // Uniswap V2 style
  },
  {
    id: "xylonet-adapter",
    name: "XyloNet Adapter",
    address: "0x2e99D469FB7742B26e9BA8B760e1B0FD6752A657",
    usesIDexInterface: true, // IDexRouter interface
    optional: true, // Only register if address is provided
  },
];

// TowerRouter ABI (minimal - only registerRouter and owner functions)
const TOWER_ROUTER_ABI = [
  {
    inputs: [
      { internalType: "address", name: "router", type: "address" },
      { internalType: "bool", name: "usesIDexInterface", type: "bool" },
    ],
    name: "registerRouter",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
];

async function registerRouters() {
  const [deployer] = await ethersLib.getSigners();
  console.log("Registering DEX routers with account:", deployer.address);

  // Get TowerRouter address from environment or input
  const towerRouterAddress = process.env.TOWER_ROUTER_ADDRESS;
  if (!towerRouterAddress) {
    throw new Error("TOWER_ROUTER_ADDRESS not set in environment");
  }

  console.log("TowerRouter address:", towerRouterAddress);

  // Connect to TowerRouter
  const towerRouter = new ethersLib.Contract(
    towerRouterAddress,
    TOWER_ROUTER_ABI,
    deployer
  );

  // Check owner
  try {
    const owner = await towerRouter.owner();
    console.log("TowerRouter owner:", owner);
    
    if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
      console.log(
        `\n⚠️  WARNING: Deployer (${deployer.address}) is NOT the owner of TowerRouter!`
      );
      console.log(`   Owner: ${owner}`);
      console.log(
        `   You must be the owner to register routers.\n`
      );
    } else {
      console.log("✅ Deployer is the owner of TowerRouter\n");
    }
  } catch (error) {
    console.log("⚠️  Could not verify owner (non-standard TowerRouter ABI)\n");
  }

  console.log("Registering DEX routers...\n");

  // Register each DEX
  for (const dex of DEXES) {
    // Skip optional routers without addresses
    if (dex.optional && (dex.address === "0x..." || !dex.address)) {
      console.log(`⏭️  Skipping ${dex.name} (address not configured)\n`);
      continue;
    }

    try {
      console.log(
        `Registering ${dex.name} (${dex.address})... usesIDexInterface: ${dex.usesIDexInterface}`
      );

      const tx = await towerRouter.registerRouter(dex.address, dex.usesIDexInterface);
      const receipt = await tx.wait();

      console.log(
        `✅ ${dex.name} registered successfully in block ${receipt.blockNumber}`
      );
      console.log(`   Transaction: ${receipt.transactionHash}`);
      console.log(`   Interface Type: ${dex.usesIDexInterface ? "IDexRouter" : "Uniswap V2"}\n`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.log(`❌ Error registering ${dex.name}: ${errorMessage}\n`);
    }
  }

  console.log("✅ Registration complete!");
  console.log("\n📋 Summary:");
  console.log("  - Uniswap V2 style routers use: registerRouter(address, false)");
  console.log("  - IDexRouter interface routers use: registerRouter(address, true)");
  console.log("\nTo register XyloNetAdapter after deployment:");
  console.log("  1. Deploy XyloNetAdapter with: npm run deploy:xylonet-adapter");
  console.log("  2. Update XYLONET_ADAPTER_ADDRESS in this script");
  console.log("  3. Run: npm run register-routers");
}

registerRouters()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
