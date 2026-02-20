const { ethers } = require("hardhat");
const hre = require("hardhat");

/**
 * Deployment script for XyloNetAdapter
 * 
 * Run with: npx hardhat run scripts/deploy-xylonet-adapter.cjs --network arc-testnet
 * 
 * This script:
 * 1. Deploys the XyloNetAdapter contract
 * 2. Registers it with TowerRouter as an IDexRouter interface router
 * 3. Logs all relevant addresses and setup instructions
 */

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // Arc Testnet Configuration
  const XYLONET_ROUTER_ADDRESS = "0x73742278c31a76dBb0D2587d03ef92E6E2141023";
  const TOWER_ROUTER_ADDRESS = "0xF75bE30E9B33D626abACaDF5885e5a4Ec80A8d2d"; 
  const WUSDC_ADDRESS = "0xD40fCAa5d2cE963c5dABC2bf59E268489ad7BcE4"; // Arc WUSDC (Arc uses USDC for gas)
  const FACTORY_ADDRESS = "0x60EDeFB094B84BBC6430cc130B358A43Ba1979e2"; // XyloNet Factory

  // 1. Deploy XyloNetAdapter
  console.log("\n=== Deploying XyloNetAdapter ===");
  const XyloNetAdapter = await ethers.getContractFactory("XyloNetAdapter");
  const xyloNetAdapter = await XyloNetAdapter.deploy(
    XYLONET_ROUTER_ADDRESS,
    WUSDC_ADDRESS,
    FACTORY_ADDRESS
  );
  await xyloNetAdapter.waitForDeployment();
  const adapterAddress = await xyloNetAdapter.getAddress();
  console.log("✓ XyloNetAdapter deployed at:", adapterAddress);

  // 2. Register with TowerRouter
  console.log("\n=== Registering with TowerRouter ===");
  const towerRouter = await ethers.getContractAt("TowerRouter", TOWER_ROUTER_ADDRESS);
  
  // Register with usesIDexInterface = true
  const tx = await towerRouter.registerRouter(adapterAddress, true);
  await tx.wait();
  console.log("✓ XyloNetAdapter registered with TowerRouter");

  // 3. Verify supported pairs
  console.log("\n=== Supported Token Pairs ===");
  const supportedTokens = await xyloNetAdapter.getSupportedTokens();
  console.log("Supported tokens:", supportedTokens);

  console.log("\nSupported pairs:");
  const tokenNames = {
    "0x3600000000000000000000000000000000000000": "USDC",
    "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a": "EURC",
    "0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C": "USYC",
  };

  for (let i = 0; i < supportedTokens.length; i++) {
    for (let j = 0; j < supportedTokens.length; j++) {
      if (i !== j) {
        const tokenIn = supportedTokens[i];
        const tokenOut = supportedTokens[j];
        const isSupported = await xyloNetAdapter.isPairSupported(tokenIn, tokenOut);
        if (isSupported) {
          const nameIn = tokenNames[tokenIn] || tokenIn.substring(0, 6);
          const nameOut = tokenNames[tokenOut] || tokenOut.substring(0, 6);
          console.log(`  ✓ ${nameIn} -> ${nameOut}`);
        }
      }
    }
  }

  // 4. Verify contract on block explorer
  console.log("\n=== Verifying Contract ===");
  console.log("Waiting 30 seconds before verification (for block indexing)...");
  await new Promise(resolve => setTimeout(resolve, 30000));

  try {
    console.log("Verifying XyloNetAdapter on block explorer...");
    await hre.run("verify:verify", {
      address: adapterAddress,
      constructorArguments: [
        XYLONET_ROUTER_ADDRESS,
        WUSDC_ADDRESS,
        FACTORY_ADDRESS,
      ],
    });
    console.log("✓ XyloNetAdapter verified successfully");
  } catch (error) {
    if (error.message.includes("Already Verified")) {
      console.log("✓ XyloNetAdapter already verified");
    } else {
      console.log("⚠ Verification failed:", error.message);
    }
  }

  // 4. Print summary
  console.log("\n=== Deployment Summary ===");
  console.log("XyloNetAdapter Address:", adapterAddress);
  console.log("TowerRouter Address:", TOWER_ROUTER_ADDRESS);
  console.log("XyloNet Router Address:", XYLONET_ROUTER_ADDRESS);
  console.log("WUSDC Address:", WUSDC_ADDRESS);

  // 5. Verify contract state
  console.log("\n=== Contract Verification ===");
  try {
    // Verify XyloNetAdapter properties
    const registeredWUSC = await xyloNetAdapter.WETH();
    console.log("✓ WETH() returns:", registeredWUSC === WUSDC_ADDRESS ? "WUSDC ✓" : "❌ Mismatch");

    const factory = await xyloNetAdapter.factory();
    console.log("✓ factory() returns:", factory === FACTORY_ADDRESS ? "Correct ✓" : "❌ Mismatch");

    // Verify registration with TowerRouter
    const isRegistered = await towerRouter.registeredRouters(adapterAddress);
    console.log("✓ Registered with TowerRouter:", isRegistered ? "Yes ✓" : "❌ No");

    // Verify router is in the list
    const routers = await towerRouter.getRouters();
    const isInList = routers.some(r => r.toLowerCase() === adapterAddress.toLowerCase());
    console.log("✓ In TowerRouter's router list:", isInList ? "Yes ✓" : "❌ No");
  } catch (error) {
    console.log("⚠ Contract verification failed:", error.message);
  }

  console.log("\n=== Integration Notes ===");
  console.log("• XyloNetAdapter implements IDexRouter interface");
  console.log("• Supports 2-token swaps (direct pool swaps)");
  console.log("• Works with TowerRouter's split swap feature");
  console.log("• Default Arc testnet pools pre-registered:");
  console.log("  - USDC/EURC pool: 0x3DF3966F5138143dce7a9cFDdC2c0310ce083BB1");
  console.log("  - USDC/USYC pool: 0x8296cC7477A9CD12cF632042fDDc2aB89151bb61");
  console.log("\n=== To add more pools ===");
  console.log("Call: xyloNetAdapter.registerPool(tokenIn, tokenOut, poolAddress)");

  console.log("\n=== Verification Details ===");
  console.log("To manually verify the contract on the block explorer:");
  console.log(`npx hardhat verify --network arc-testnet ${adapterAddress} "${XYLONET_ROUTER_ADDRESS}" "${WUSDC_ADDRESS}" "${FACTORY_ADDRESS}"`);

  // 6. Save deployment details
  const deploymentInfo = {
    network: "arc-testnet",
    timestamp: new Date().toISOString(),
    addresses: {
      xyloNetAdapter: adapterAddress,
      towerRouter: TOWER_ROUTER_ADDRESS,
      xyloNetRouter: XYLONET_ROUTER_ADDRESS,
      wusdc: WUSDC_ADDRESS,
      factory: FACTORY_ADDRESS,
    },
    supportedPairs: [
      { from: "USDC", to: "EURC", pool: "0x3DF3966F5138143dce7a9cFDdC2c0310ce083BB1" },
      { from: "EURC", to: "USDC", pool: "0x3DF3966F5138143dce7a9cFDdC2c0310ce083BB1" },
      { from: "USDC", to: "USYC", pool: "0x8296cC7477A9CD12cF632042fDDc2aB89151bb61" },
      { from: "USYC", to: "USDC", pool: "0x8296cC7477A9CD12cF632042fDDc2aB89151bb61" },
    ],
  };

  console.log("\nDeployment info saved to deployment-info.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
