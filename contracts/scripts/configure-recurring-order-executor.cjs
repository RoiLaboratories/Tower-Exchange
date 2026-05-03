const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  const executorAddress = process.env.RECURRING_ORDER_EXECUTOR_ADDRESS;
  const relayerAddress = process.env.RECURRING_ORDER_RELAYER_ADDRESS;
  const routeTargets = splitAddresses(process.env.RECURRING_ORDER_ROUTE_TARGETS);
  const approvalSpenders = splitAddresses(process.env.RECURRING_ORDER_APPROVAL_SPENDERS);

  validateAddress("RECURRING_ORDER_EXECUTOR_ADDRESS", executorAddress);
  if (relayerAddress) {
    validateAddress("RECURRING_ORDER_RELAYER_ADDRESS", relayerAddress);
  }
  routeTargets.forEach((target, index) =>
    validateAddress(`RECURRING_ORDER_ROUTE_TARGETS[${index}]`, target)
  );
  approvalSpenders.forEach((spender, index) =>
    validateAddress(`RECURRING_ORDER_APPROVAL_SPENDERS[${index}]`, spender)
  );

  const executor = await ethers.getContractAt(
    "RecurringOrderExecutor",
    executorAddress
  );

  console.log("Configuring RecurringOrderExecutor:", executorAddress);

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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
