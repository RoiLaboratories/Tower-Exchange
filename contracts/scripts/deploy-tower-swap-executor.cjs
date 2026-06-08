const hre = require("hardhat");
const { ethers } = hre;
const fs = require("fs");
const path = require("path");

function splitAddresses(value) {
  return String(value || "")
    .split(",")
    .map((address) => address.trim())
    .filter((address) => ethers.isAddress(address));
}

async function saveDeploymentInfo(deployment) {
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const filename = path.join(deploymentsDir, "tower-swap-executor-deployment.json");
  fs.writeFileSync(filename, JSON.stringify(deployment, null, 2));
  return filename;
}

async function sleepMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function verifyContractWithRetry(contractAddress, constructorArgs, maxRetries = 3, delayMs = 5000) {
  if (process.env.TOWER_SWAP_EXECUTOR_VERIFY === "false") {
    console.log("Contract verification skipped because TOWER_SWAP_EXECUTOR_VERIFY=false.");
    return "skipped";
  }

  console.log("Verifying TowerSwapExecutor on block explorer...");
  console.log("Address:", contractAddress);
  console.log("Constructor args:", constructorArgs);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Verification attempt ${attempt}/${maxRetries}...`);
      await hre.run("verify:verify", {
        address: contractAddress,
        constructorArguments: constructorArgs,
      });
      console.log("Contract verified successfully.");
      return "verified";
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (/already verified/i.test(message)) {
        console.log("Contract is already verified.");
        return "verified";
      }

      console.warn(`Verification attempt ${attempt} failed:`, message);

      if (attempt < maxRetries) {
        const waitMs = delayMs * attempt;
        console.log(`Waiting ${waitMs}ms before retry...`);
        await sleepMs(waitMs);
      }
    }
  }

  console.warn("Verification failed after all retries. You can verify manually later.");
  return "failed";
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const treasury = process.env.TOWER_SWAP_EXECUTOR_TREASURY || process.env.TREASURY_ADDRESS;
  const owner = process.env.OWNER_ADDRESS || deployer.address;
  const feeBps = Number(process.env.TOWER_SWAP_EXECUTOR_FEE_BPS || "25");
  const routeTargets = splitAddresses(process.env.TOWER_SWAP_EXECUTOR_ROUTE_TARGETS);
  const approvalSpenders = splitAddresses(process.env.TOWER_SWAP_EXECUTOR_APPROVAL_SPENDERS);

  if (!ethers.isAddress(treasury || "")) {
    throw new Error("Set TOWER_SWAP_EXECUTOR_TREASURY or TREASURY_ADDRESS to a valid address.");
  }

  if (!ethers.isAddress(owner)) {
    throw new Error("OWNER_ADDRESS must be a valid address when provided.");
  }

  console.log("Deploying TowerSwapExecutor");
  console.log("Deployer:", deployer.address);
  console.log("Treasury:", treasury);
  console.log("Owner:", owner);
  console.log("Fee BPS:", feeBps);

  const TowerSwapExecutor = await ethers.getContractFactory("TowerSwapExecutor");
  const constructorArgs = [treasury, owner, feeBps];
  const executor = await TowerSwapExecutor.deploy(...constructorArgs);
  await executor.waitForDeployment();
  const executorAddress = await executor.getAddress();

  console.log("TowerSwapExecutor deployed:", executorAddress);

  for (const target of routeTargets) {
    console.log("Allowlisting route target:", target);
    const tx = await executor.setRouteTarget(target, true);
    await tx.wait();
  }

  for (const spender of approvalSpenders) {
    console.log("Allowlisting approval spender:", spender);
    const tx = await executor.setApprovalSpender(spender, true);
    await tx.wait();
  }

  const verificationStatus = await verifyContractWithRetry(
    executorAddress,
    constructorArgs,
    Number(process.env.TOWER_SWAP_EXECUTOR_VERIFY_MAX_RETRIES || "3"),
    Number(process.env.TOWER_SWAP_EXECUTOR_VERIFY_RETRY_DELAY_MS || "5000"),
  );

  const deployment = {
    contract: "TowerSwapExecutor",
    network: hre.network.name,
    executor: executorAddress,
    treasury,
    owner,
    feeBps,
    routeTargets,
    approvalSpenders,
    verificationStatus,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    blockExplorerUrl:
      hre.network.name === "arc-testnet"
        ? `https://testnet.arcscan.app/address/${executorAddress}`
        : null,
  };

  const savedFile = await saveDeploymentInfo(deployment);

  console.log("Deployment summary:");
  console.log(JSON.stringify(deployment, null, 2));
  console.log("Deployment info saved to:", savedFile);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
