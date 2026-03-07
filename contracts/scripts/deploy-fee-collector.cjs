const { ethers } = require("hardhat");
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Main deployment function for FeeCollector contract
 */
async function deployFeeCollector() {
  console.log("🚀 Deploying FeeCollector to Arc testnet...");

  const [deployer] = await ethers.getSigners();
  console.log("🔐 Deploying with account:", deployer.address);

  // Treasury address - should receive accumulated platform fees
  // For testnet, using deployer; for production, use dedicated treasury wallet
  const TREASURY_ADDRESS = deployer.address;
  const OWNER_ADDRESS = deployer.address;

  console.log("💰 Treasury address:", TREASURY_ADDRESS);
  console.log("👤 Owner address:", OWNER_ADDRESS);

  // ═══════════════════════════════════════════════════════════
  // STEP 1: Deploy FeeCollector Contract
  // ═══════════════════════════════════════════════════════════
  console.log("\n⛓️  Deploying FeeCollector contract...");
  const FeeCollector = await ethers.getContractFactory("FeeCollector");
  const feeCollector = await FeeCollector.deploy(TREASURY_ADDRESS, OWNER_ADDRESS);
  await feeCollector.waitForDeployment();
  const feeCollectorAddress = await feeCollector.getAddress();
  console.log("✅ FeeCollector deployed to:", feeCollectorAddress);

  // ═══════════════════════════════════════════════════════════
  // STEP 2: Save Deployment Information
  // ═══════════════════════════════════════════════════════════
  // Save deployment addresses
  const deployments = {
    contract: "FeeCollector",
    version: "1.0.0",
    network: "arc-testnet",
    feeCollector: feeCollectorAddress,
    treasury: TREASURY_ADDRESS,
    owner: OWNER_ADDRESS,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    blockExplorerUrl: `https://testnet.arcscan.app/address/${feeCollectorAddress}`,
  };

  console.log("\n📋 Deployment Summary:");
  console.log(JSON.stringify(deployments, null, 2));

  // Save to file for reference
  const savedFile = await saveDeploymentInfo(deployments);

  // ═══════════════════════════════════════════════════════════
  // STEP 3: Wait for Block Confirmation
  // ═══════════════════════════════════════════════════════════
  console.log("\n⏳ Waiting 8 blocks for confirmation before verification...");
  await sleepMs(8000); // ~8 second delay for block confirmation

  // ═══════════════════════════════════════════════════════════
  // STEP 4: Verify Contract on Arcscan
  // ═══════════════════════════════════════════════════════════
  // Attempt to verify contract with retry logic
  const verificationSuccess = await verifyContractWithRetry(
    feeCollectorAddress,
    [TREASURY_ADDRESS, OWNER_ADDRESS],
    3, // maxRetries
    3000 // delayMs between retries
  );

  // ═══════════════════════════════════════════════════════════
  // Summary & Next Steps
  // ═══════════════════════════════════════════════════════════
  console.log(`
╔════════════════════════════════════════════════════════════╗
║  🎉 FeeCollector Deployment Complete!                     ║
╚════════════════════════════════════════════════════════════╝

📌 Contract Address:
   ${feeCollectorAddress}

🔗 Block Explorer:
   ${deployments.blockExplorerUrl}

📝 Next Steps:

1️⃣  Authorize backend address for fee collection:
   $ npx hardhat run scripts/authorize-backend.cjs --network arc-testnet
   
   OR manually:
   feeCollector.setCollectorAuthorization("<BACKEND_ADDRESS>", true)

2️⃣  Update backend environment config:
   FEE_COLLECTOR_ADDRESS="${feeCollectorAddress}"
   TREASURY_ADDRESS="${TREASURY_ADDRESS}"

3️⃣  Verify contract setup:
   - Check deployments/fee-collector-deployment.json
   - Contract verification status: ${verificationSuccess ? "✅ Verified" : "⏳ Pending"}

💾 Deployment info saved to: ${savedFile}

════════════════════════════════════════════════════════════
`);
}

/**
 * Helper Functions
 */

async function sleepMs(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function verifyContractWithRetry(
  contractAddress,
  constructorArgs,
  maxRetries = 3,
  delayMs = 2000
) {
  console.log("\n🔍 Attempting to verify contract on Arcscan...");
  console.log(`Address: ${contractAddress}`);
  console.log(`Constructor args: [${constructorArgs.join(", ")}]`);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`\n📋 Verification attempt ${attempt}/${maxRetries}...`);
      
      await hre.run("verify:verify", {
        address: contractAddress,
        constructorArguments: constructorArgs,
        network: "arc-testnet",
      });
      
      console.log("✅ Contract verified successfully on Arcscan!");
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Check if contract is already verified
      if (errorMessage.includes("Already Verified")) {
        console.log("✅ Contract is already verified on Arcscan!");
        return true;
      }
      
      // Check if verification is pending
      if (errorMessage.includes("pending") || errorMessage.includes("rate limit")) {
        console.log(`⏳ Verification is pending or rate-limited. Attempt ${attempt}/${maxRetries}`);
        
        if (attempt < maxRetries) {
          const waitTime = delayMs * attempt;
          console.log(`⏸️  Waiting ${waitTime}ms before retry...`);
          await sleepMs(waitTime);
        }
      } else {
        console.log(`⚠️  Verification attempt ${attempt} failed:`, errorMessage);
        
        if (attempt < maxRetries) {
          console.log(`Retrying in ${delayMs}ms...`);
          await sleepMs(delayMs);
        }
      }
    }
  }
  
  console.log("\n⚠️  Verification failed after all retries. Manual verification may be needed.");
  return false;
}

async function saveDeploymentInfo(deployments) {
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  
  // Create deployments directory if it doesn't exist
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  const filename = path.join(deploymentsDir, "fee-collector-deployment.json");
  const content = JSON.stringify(deployments, null, 2);
  
  fs.writeFileSync(filename, content);
  console.log(`\n💾 Deployment info saved to: ${filename}`);
  
  return filename;
}


// Execute deployment
deployFeeCollector()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
