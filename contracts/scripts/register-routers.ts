const hardhat = require("hardhat");
const { ethers: ethersLib } = hardhat;

// DEX Router Addresses on Arc Testnet
const DEXES = [
  {
    id: "synthra",
    name: "Synthra",
    address: "0xbf4479c07dc6fdc6daa764a0cca06969e894275f",
  },
  {
    id: "swaparc",
    name: "Swaparc (StableSwapPool)",
    address: "0x2F4490e7c6F3DaC23ffEe6e71bFcb5d1CCd7d4eC",
  },
  {
    id: "quantum-exchange",
    name: "Quantum Exchange",
    address: "0x9d52b6c810d6F95e3d44ca64af3B55F7F66448FF",
  },
];

// TowerRouter ABI (minimal - only registerRouter function)
const TOWER_ROUTER_ABI = [
  {
    inputs: [{ internalType: "address", name: "router", type: "address" }],
    name: "registerRouter",
    outputs: [],
    stateMutability: "nonpayable",
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

  console.log("\nRegistering DEX routers...\n");

  // Register each DEX
  for (const dex of DEXES) {
    try {
      console.log(`Registering ${dex.name} (${dex.address})...`);

      const tx = await towerRouter.registerRouter(dex.address);
      const receipt = await tx.wait();

      console.log(
        `✅ ${dex.name} registered successfully in block ${receipt.blockNumber}`
      );
      console.log(`   Transaction: ${receipt.transactionHash}\n`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.log(`❌ Error registering ${dex.name}: ${errorMessage}\n`);
    }
  }

  console.log("✅ Registration complete!");
}

registerRouters()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
