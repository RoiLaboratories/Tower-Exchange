const hre = require("hardhat");
const { ethers } = hre;
const fs = require("fs");
const path = require("path");

const DEFAULT_UNITFLOW_FACTORY = "0xAb6A8AAb7d490007634ef59d424b5d89688a1971";
const DEFAULT_NATIVE_USDC = "0x3600000000000000000000000000000000000000";
const DEFAULT_UNITFLOW_WUSDC = "0x911b4000D3422F482F4062a913885f7b035382Df";

async function saveDeploymentInfo(deployment) {
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const filename = path.join(deploymentsDir, "unitflow-adapter-deployment.json");
  fs.writeFileSync(filename, JSON.stringify(deployment, null, 2));
  return filename;
}

async function sleepMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function verifyContractWithRetry(contractAddress, constructorArgs, maxRetries = 3, delayMs = 5000) {
  if (process.env.UNITFLOW_ADAPTER_VERIFY === "false") {
    console.log("Contract verification skipped because UNITFLOW_ADAPTER_VERIFY=false.");
    return "skipped";
  }

  console.log("Verifying UnitFlowAdapter on block explorer...");
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
  const factory = process.env.UNITFLOW_FACTORY_ADDRESS || DEFAULT_UNITFLOW_FACTORY;
  const nativeUsdc = process.env.UNITFLOW_NATIVE_USDC_ADDRESS || DEFAULT_NATIVE_USDC;
  const wusdc = process.env.UNITFLOW_WUSDC_ADDRESS || DEFAULT_UNITFLOW_WUSDC;

  for (const [name, value] of Object.entries({ factory, nativeUsdc, wusdc })) {
    if (!ethers.isAddress(value)) {
      throw new Error(`${name} must be a valid address. Received: ${value}`);
    }
  }

  console.log("Deploying UnitFlowAdapter");
  console.log("Deployer:", deployer.address);
  console.log("Factory:", factory);
  console.log("Native USDC:", nativeUsdc);
  console.log("WUSDC:", wusdc);

  const UnitFlowAdapter = await ethers.getContractFactory("UnitFlowAdapter");
  const constructorArgs = [factory, nativeUsdc, wusdc];
  const adapter = await UnitFlowAdapter.deploy(...constructorArgs);
  await adapter.waitForDeployment();
  const adapterAddress = await adapter.getAddress();

  const verificationStatus = await verifyContractWithRetry(
    adapterAddress,
    constructorArgs,
    Number(process.env.UNITFLOW_ADAPTER_VERIFY_MAX_RETRIES || "3"),
    Number(process.env.UNITFLOW_ADAPTER_VERIFY_RETRY_DELAY_MS || "5000"),
  );

  const deployment = {
    contract: "UnitFlowAdapter",
    network: hre.network.name,
    adapter: adapterAddress,
    factory,
    nativeUsdc,
    wusdc,
    verificationStatus,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    blockExplorerUrl:
      hre.network.name === "arc-testnet"
        ? `https://testnet.arcscan.app/address/${adapterAddress}`
        : null,
  };

  const savedFile = await saveDeploymentInfo(deployment);

  console.log("UnitFlowAdapter deployed:", adapterAddress);
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
