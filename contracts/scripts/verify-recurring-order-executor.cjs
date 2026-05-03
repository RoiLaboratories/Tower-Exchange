const fs = require("fs");
const path = require("path");
const { ethers, network, run } = require("hardhat");
require("dotenv").config();

const ARC_TESTNET_EXPLORER_URL =
  process.env.ARC_TESTNET_EXPLORER_URL || "https://testnet.arcscan.app";

async function main() {
  const deployment = readDeployment();
  const [deployer] = await ethers.getSigners();
  const executorAddress =
    process.env.RECURRING_ORDER_EXECUTOR_ADDRESS ||
    process.env.NEXT_PUBLIC_RECURRING_ORDER_EXECUTOR_ADDRESS ||
    deployment?.address;
  const ownerAddress =
    process.env.OWNER_ADDRESS || deployment?.owner || deployer.address;

  if (!executorAddress || executorAddress === ethers.ZeroAddress) {
    throw new Error(
      "Set RECURRING_ORDER_EXECUTOR_ADDRESS in contracts/.env, or deploy before verifying."
    );
  }

  console.log("Verifying RecurringOrderExecutor");
  console.log("Network:", network.name);
  console.log("Address:", executorAddress);
  console.log("Constructor owner:", ownerAddress);
  console.log("Explorer:", getExplorerAddressUrl(executorAddress));

  await run("verify:verify", {
    address: executorAddress,
    constructorArguments: [ownerAddress],
  });

  console.log("RecurringOrderExecutor verified:", executorAddress);
  console.log("View contract:", getExplorerAddressUrl(executorAddress));
}

function readDeployment() {
  const deploymentPath = path.join(
    __dirname,
    "..",
    "deployments",
    "recurring-order-executor-deployment.json"
  );

  if (!fs.existsSync(deploymentPath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
}

function getExplorerAddressUrl(address) {
  return `${ARC_TESTNET_EXPLORER_URL.replace(/\/$/, "")}/address/${address}`;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
