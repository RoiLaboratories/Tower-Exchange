const { ethers } = require("hardhat");
const hre = require("hardhat");

async function deployRouter() {
  console.log("Deploying TowerRouter to Arc testnet...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // WUSDC on Arc testnet (wrapped stablecoin, can be used for future ETH wrapping)
  // If you need true ETH wrapping, check Arc's bridge tokens
  const WUSDC_ADDRESS = "0xD40fCAa5d2cE963c5dABC2bf59E268489ad7BcE4";

  // Deploy TowerRouter
  const TowerRouter = await ethers.getContractFactory("TowerRouter");
  const towerRouter = await TowerRouter.deploy(WUSDC_ADDRESS, deployer.address);
  await towerRouter.waitForDeployment();
  const towerRouterAddress = await towerRouter.getAddress();
  console.log("TowerRouter deployed to:", towerRouterAddress);

  // Save deployment addresses
  const deployments = {
    towerRouter: towerRouterAddress,
    deployer: deployer.address,
    wusdc: WUSDC_ADDRESS,
    timestamp: new Date().toISOString(),
  };

  console.log("\nDeployment Summary:");
  console.log(JSON.stringify(deployments, null, 2));

  // Wait for block confirmation before verification
  console.log("\nWaiting for block confirmation before verification...");
  await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay

  // Auto-verify contract
  console.log("\nAttempting to verify contract on Arcscan...");
  try {
    await hre.run("verify:verify", {
      address: towerRouterAddress,
      constructorArguments: [WUSDC_ADDRESS, deployer.address],
      network: "arc-testnet",
    });
    console.log("✅ Contract verified successfully!");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log("⚠️  Verification pending or already verified:", errorMessage);
  }

  console.log(
    "\n✅ Deployment complete! No FeeController needed - fees accumulate in TowerRouter contract."
  );
}

deployRouter()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
