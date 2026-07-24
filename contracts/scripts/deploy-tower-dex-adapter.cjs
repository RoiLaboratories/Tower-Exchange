const { ethers, run, network } = require("hardhat");

const DEFAULT_TOWER_DEX_ROUTER = "0xDf115b4f2F22B9255B2E63348423B6C5B379Bce2";
const TOWER_DEX_ADAPTER_CONTRACT =
  "contracts/adapters/TowerDexAdapter.sol:TowerDexAdapter";

async function verifyContract(address, constructorArguments) {
  if (process.env.TOWER_DEX_ADAPTER_VERIFY === "false") {
    console.log("Skipping verification because TOWER_DEX_ADAPTER_VERIFY=false");
    return;
  }

  try {
    await run("verify:verify", {
      address,
      constructorArguments,
      contract: TOWER_DEX_ADAPTER_CONTRACT,
      network: network.name,
    });
    console.log("Adapter verified successfully.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log("Verification skipped or pending:", message);
  }
}

async function maybeAllowlistAdapter(executorAddress, adapterAddress) {
  if (!executorAddress || !ethers.isAddress(executorAddress)) {
    return;
  }

  const executor = await ethers.getContractAt("TowerSwapExecutor", executorAddress);

  console.log("Allowlisting adapter in TowerSwapExecutor:", executorAddress);

  const routeTargetTx = await executor.setRouteTarget(adapterAddress, true);
  await routeTargetTx.wait();
  console.log("  Route target allowed.");

  const spenderTx = await executor.setApprovalSpender(adapterAddress, true);
  await spenderTx.wait();
  console.log("  Approval spender allowed.");
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const rawRouterAddress =
    process.env.TOWER_DEX_ROUTER_ADDRESS ||
    process.env.NEXT_PUBLIC_TOWER_DEX_ROUTER_ADDRESS ||
    DEFAULT_TOWER_DEX_ROUTER;
  const executorAddress =
    process.env.TOWER_SWAP_EXECUTOR_ADDRESS ||
    process.env.NEXT_PUBLIC_TOWER_SWAP_EXECUTOR_ADDRESS ||
    "";

  if (!ethers.isAddress(rawRouterAddress)) {
    throw new Error("TOWER_DEX_ROUTER_ADDRESS must be a valid address.");
  }

  console.log("Deploying TowerDexAdapter");
  console.log("Network:", network.name);
  console.log("Deployer:", deployer.address);
  console.log("Raw Tower router:", rawRouterAddress);
  if (executorAddress) {
    console.log("Executor for allowlisting:", executorAddress);
  }

  const TowerDexAdapter = await ethers.getContractFactory(
    TOWER_DEX_ADAPTER_CONTRACT,
  );
  const adapter = await TowerDexAdapter.deploy(rawRouterAddress);
  await adapter.waitForDeployment();

  const adapterAddress = await adapter.getAddress();

  console.log("TowerDexAdapter deployed:", adapterAddress);

  await maybeAllowlistAdapter(executorAddress, adapterAddress);

  console.log("Waiting briefly before verification...");
  await new Promise((resolve) => setTimeout(resolve, 5000));

  await verifyContract(adapterAddress, [rawRouterAddress]);

  console.log("\nSet this in the frontend environment:");
  console.log(`NEXT_PUBLIC_TOWER_DEX_ADAPTER_ADDRESS=${adapterAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
