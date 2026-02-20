const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

async function authorizeBackend() {
  console.log("🔐 Authorizing backend address for fee collection...\n");

  // Get backend address from sources in order of priority:
  // 1. Command line argument: npm run authorize-backend -- 0x...
  // 2. Environment variable: BACKEND_ADDRESS
  // 3. Derive from BACKEND_PRIVATE_KEY if available
  let backendAddress = process.argv[2] || process.env.BACKEND_ADDRESS;

  // If no address specified, try to derive from private key
  if (!backendAddress && process.env.BACKEND_PRIVATE_KEY) {
    try {
      console.log("📝 Deriving backend address from BACKEND_PRIVATE_KEY...");
      const wallet = new ethers.Wallet(process.env.BACKEND_PRIVATE_KEY);
      backendAddress = wallet.address;
      console.log(`✅ Derived address: ${backendAddress}\n`);
    } catch (error) {
      console.error("❌ Error: Invalid BACKEND_PRIVATE_KEY format");
      console.log("Error:", error.message);
      process.exit(1);
    }
  }

  if (!backendAddress) {
    console.error("❌ Error: Backend address not provided");
    console.log("\nUsage options:");
    console.log("  1. npm run authorize-backend -- <backend-address>");
    console.log("  2. Set BACKEND_ADDRESS in .env file");
    console.log("  3. Set BACKEND_PRIVATE_KEY in .env file (will derive address)");
    process.exit(1);
  }

  // Validate address format
  if (!ethers.isAddress(backendAddress)) {
    console.error("❌ Error: Invalid Ethereum address format");
    console.log("Address provided:", backendAddress);
    process.exit(1);
  }

  backendAddress = ethers.getAddress(backendAddress); // Checksum format

  // Load FeeCollector address from deployment file
  const deploymentFile = path.join(
    __dirname,
    "..",
    "deployments",
    "fee-collector-deployment.json"
  );

  if (!fs.existsSync(deploymentFile)) {
    console.error("❌ Error: Deployment file not found");
    console.log("Expected at:", deploymentFile);
    console.log("Please deploy FeeCollector first with: npm run deploy:fee-collector");
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
  const feeCollectorAddress = deployment.feeCollector;

  console.log("📋 Configuration:");
  console.log(`  FeeCollector: ${feeCollectorAddress}`);
  console.log(`  Backend Address: ${backendAddress}`);
  console.log(`  Network: arc-testnet\n`);

  const [deployer] = await ethers.getSigners();
  console.log(`🔐 Using account: ${deployer.address}\n`);

  // Get FeeCollector contract instance
  const FeeCollectorABI = [
    "function setCollectorAuthorization(address collector, bool authorized) external",
    "function isAuthorized(address collector) external view returns (bool)",
  ];

  const feeCollector = new ethers.Contract(
    feeCollectorAddress,
    FeeCollectorABI,
    deployer
  );

  // Check if already authorized
  console.log("🔍 Checking current authorization status...");
  const isAlreadyAuthorized = await feeCollector.isAuthorized(backendAddress);

  if (isAlreadyAuthorized) {
    console.log("✅ Backend is already authorized!\n");
    console.log(`Backend ${backendAddress} can already submit fees.`);
    process.exit(0);
  }

  // Authorize backend
  console.log("⏳ Sending authorization transaction...\n");

  try {
    const tx = await feeCollector.setCollectorAuthorization(backendAddress, true);
    console.log("📤 Transaction sent:", tx.hash);
    console.log("⏳ Waiting for confirmation...\n");

    const receipt = await tx.wait();

    if (receipt && receipt.status === 1) {
      console.log(`
╔════════════════════════════════════════════════════════════╗
║  ✅ Backend Authorization Successful!                     ║
╚════════════════════════════════════════════════════════════╝

📊 Transaction Details:
   Hash: ${tx.hash}
   Block: ${receipt.blockNumber}
   Gas Used: ${receipt.gasUsed.toString()}

🔐 Authorization Status:
   FeeCollector: ${feeCollectorAddress}
   Backend: ${backendAddress}
   Status: ✅ AUTHORIZED

📝 Next Steps:
1. Verify authorization on block explorer:
   https://testnet.arcscan.app/tx/${tx.hash}

2. Configure backend environment:
   FEE_COLLECTOR_ADDRESS="${feeCollectorAddress}"
   BACKEND_ADDRESS="${backendAddress}"

3. Backend is now ready to call:
   feeCollector.collectFee(outputToken, feeAmount)

════════════════════════════════════════════════════════════
`);
    } else {
      console.error("❌ Transaction failed!");
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Authorization failed:", error.message);
    process.exit(1);
  }
}

authorizeBackend().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
