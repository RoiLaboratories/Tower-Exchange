const { ethers } = require("hardhat");
require("dotenv").config();

function splitAddresses(value) {
  return String(value || "")
    .split(",")
    .map((address) => address.trim())
    .filter(Boolean);
}

function validateAddress(name, value) {
  if (!ethers.isAddress(value)) {
    throw new Error(`${name} must be a valid 0x address. Received: ${value}`);
  }
}

async function setAllowlist(contract, label, setter, addresses) {
  for (const address of addresses) {
    validateAddress(label, address);
    const isAlreadyAllowed =
      setter === "setRouteTarget"
        ? await contract.routeTargets(address)
        : await contract.approvalSpenders(address);

    if (isAlreadyAllowed) {
      console.log(`${label} already allowed:`, address);
      continue;
    }

    console.log(`Allowlisting ${label}:`, address);
    const tx = await contract[setter](address, true);
    await tx.wait();
    console.log(`${label} allowed:`, address);
  }
}

async function main() {
  const executorAddress = process.env.TOWER_SWAP_EXECUTOR_ADDRESS;
  const routeTargets = splitAddresses(process.env.TOWER_SWAP_EXECUTOR_ROUTE_TARGETS);
  const approvalSpenders = splitAddresses(process.env.TOWER_SWAP_EXECUTOR_APPROVAL_SPENDERS);

  validateAddress("TOWER_SWAP_EXECUTOR_ADDRESS", executorAddress);

  if (routeTargets.length === 0 && approvalSpenders.length === 0) {
    throw new Error(
      "Set TOWER_SWAP_EXECUTOR_ROUTE_TARGETS and/or TOWER_SWAP_EXECUTOR_APPROVAL_SPENDERS."
    );
  }

  const executor = await ethers.getContractAt("TowerSwapExecutor", executorAddress);
  console.log("Configuring TowerSwapExecutor:", executorAddress);

  await setAllowlist(executor, "route target", "setRouteTarget", routeTargets);
  await setAllowlist(executor, "approval spender", "setApprovalSpender", approvalSpenders);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
