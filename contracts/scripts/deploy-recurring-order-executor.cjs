const fs = require("fs");
const path = require("path");
const { ethers, run } = require("hardhat");
require("dotenv").config();

async function main() {
  const [deployer] = await ethers.getSigners();
  const ownerAddress = process.env.OWNER_ADDRESS || deployer.address;
  const relayerAddress = process.env.RECURRING_ORDER_RELAYER_ADDRESS;
  const routeTargets = splitAddresses(process.env.RECURRING_ORDER_ROUTE_TARGETS);
  const approvalSpenders = splitAddresses(process.env.RECURRING_ORDER_APPROVAL_SPENDERS);

  validateAddress("OWNER_ADDRESS", ownerAddress);
  if (relayerAddress) {
    validateAddress("RECURRING_ORDER_RELAYER_ADDRESS", relayerAddress);
  }
  routeTargets.forEach((target, index) =>
    validateAddress(`RECURRING_ORDER_ROUTE_TARGETS[${index}]`, target)
  );
  approvalSpenders.forEach((spender, index) =>
    validateAddress(`RECURRING_ORDER_APPROVAL_SPENDERS[${index}]`, spender)
  );

  console.log("Deploying RecurringOrderExecutor");
  console.log("Network:", network.name);
  console.log("Deployer:", deployer.address);
  console.log("Owner:", ownerAddress);

  const Executor = await ethers.getContractFactory("RecurringOrderExecutor");
  const executor = await Executor.deploy(ownerAddress);
  await executor.waitForDeployment();

  const executorAddress = await executor.getAddress();
  console.log("RecurringOrderExecutor deployed:", executorAddress);

  const deployment = {
    contract: "RecurringOrderExecutor",
    network: network.name,
    chainId: network.config.chainId,
    address: executorAddress,
    owner: ownerAddress,
    relayer: relayerAddress || null,
    routeTargets,
    approvalSpenders,
    deployedBy: deployer.address,
    deployedAt: new Date().toISOString(),
  };

  writeDeployment(deployment);

  if (relayerAddress) {
    const tx = await executor.setRelayer(relayerAddress, true);
    await tx.wait();
    console.log("Relayer authorized:", relayerAddress);
  }

  for (const target of routeTargets) {
    const tx = await executor.setRouteTarget(target, true);
    await tx.wait();
    console.log("Route target authorized:", target);
  }

  for (const spender of approvalSpenders) {
    const tx = await executor.setApprovalSpender(spender, true);
    await tx.wait();
    console.log("Approval spender authorized:", spender);
  }

  writeDeployment({
    ...deployment,
    configuredAt: new Date().toISOString(),
  });

  if (process.env.VERIFY_CONTRACT === "true") {
    try {
      await run("verify:verify", {
        address: executorAddress,
        constructorArguments: [ownerAddress],
      });
    } catch (error) {
      console.warn("Verification failed:", error.message);
    }
  }
}

function splitAddresses(value) {
  return (value || "")
    .split(",")
    .map((address) => address.trim())
    .filter(Boolean);
}

function validateAddress(name, value) {
  if (!ethers.isAddress(value)) {
    throw new Error(`${name} must be a valid 0x address. Received: ${value}`);
  }
}

function writeDeployment(deployment) {
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(deploymentsDir, { recursive: true });
  fs.writeFileSync(
    path.join(deploymentsDir, "recurring-order-executor-deployment.json"),
    JSON.stringify(deployment, null, 2)
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
