const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TowerSwapExecutor", function () {
  const feeBps = 25n;
  const bpsDenominator = 10000n;

  async function deployFixture() {
    const [owner, user, treasury, other] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const tokenIn = await MockERC20.deploy("USD Coin", "USDC", 6);
    const tokenOut = await MockERC20.deploy("Tether", "USDT", 18);

    const MockSwapRouter = await ethers.getContractFactory("MockSwapRouter");
    const router = await MockSwapRouter.deploy();

    const TowerSwapExecutor = await ethers.getContractFactory("TowerSwapExecutor");
    const executor = await TowerSwapExecutor.deploy(
      treasury.address,
      owner.address,
      feeBps,
    );

    await executor.setRouteTarget(await router.getAddress(), true);
    await executor.setApprovalSpender(await router.getAddress(), true);

    return { owner, user, treasury, other, tokenIn, tokenOut, router, executor };
  }

  async function fundAndApprove({ user, tokenIn, tokenOut, router, executor }) {
    const amountIn = 1_000_000_000n;
    const amountOut = ethers.parseUnits("2000", 18);

    await tokenIn.mint(user.address, amountIn);
    await tokenOut.mint(await router.getAddress(), amountOut * 10n);
    await tokenIn.connect(user).approve(await executor.getAddress(), amountIn);

    return { amountIn, amountOut };
  }

  async function buildSwapParams({
    tokenIn,
    tokenOut,
    router,
    executor,
    user,
    amountIn,
    amountOut,
    minAmountOut = amountOut,
    amountToSpend,
    recipient,
    routeTarget,
    approvalSpender,
  }) {
    const tokenInAddress = await tokenIn.getAddress();
    const tokenOutAddress = await tokenOut.getAddress();
    const routerAddress = await router.getAddress();
    const executorAddress = await executor.getAddress();
    const swapAmountIn = amountIn - ((amountIn * feeBps) / bpsDenominator);
    const callAmount = amountToSpend ?? swapAmountIn;
    const outputRecipient = recipient ?? executorAddress;
    const routeCalldata = amountToSpend
      ? router.interface.encodeFunctionData("swapPartialInput", [
          tokenInAddress,
          tokenOutAddress,
          callAmount,
          amountOut,
          outputRecipient,
        ])
      : router.interface.encodeFunctionData("swapExactInput", [
          tokenInAddress,
          tokenOutAddress,
          callAmount,
          amountOut,
          outputRecipient,
        ]);

    return {
      tokenIn: tokenInAddress,
      tokenOut: tokenOutAddress,
      amountIn,
      minAmountOut,
      recipient: user.address,
      routeTarget: routeTarget ?? routerAddress,
      approvalSpender: approvalSpender ?? routerAddress,
      routeCalldata,
    };
  }

  it("sends the platform fee to treasury and output to the user atomically", async function () {
    const fixture = await deployFixture();
    const { user, treasury, tokenIn, tokenOut, router, executor } = fixture;
    const { amountIn, amountOut } = await fundAndApprove(fixture);
    const params = await buildSwapParams({
      tokenIn,
      tokenOut,
      router,
      executor,
      user,
      amountIn,
      amountOut,
    });

    const feeAmount = (amountIn * feeBps) / bpsDenominator;
    const swapAmountIn = amountIn - feeAmount;

    await expect(executor.connect(user).executeSwap(params))
      .to.emit(executor, "SwapExecuted")
      .withArgs(
        user.address,
        user.address,
        await tokenIn.getAddress(),
        await tokenOut.getAddress(),
        amountIn,
        swapAmountIn,
        amountOut,
        feeAmount,
        0n,
        await router.getAddress(),
        await router.getAddress(),
      );

    expect(await tokenIn.balanceOf(treasury.address)).to.equal(feeAmount);
    expect(await tokenIn.balanceOf(await router.getAddress())).to.equal(swapAmountIn);
    expect(await tokenIn.balanceOf(await executor.getAddress())).to.equal(0n);
    expect(await tokenOut.balanceOf(user.address)).to.equal(amountOut);
    expect(await tokenOut.balanceOf(await executor.getAddress())).to.equal(0n);
  });

  it("refunds input that an allowlisted route does not spend", async function () {
    const fixture = await deployFixture();
    const { user, treasury, tokenIn, tokenOut, router, executor } = fixture;
    const { amountIn, amountOut } = await fundAndApprove(fixture);
    const amountToSpend = 500_000_000n;
    const params = await buildSwapParams({
      tokenIn,
      tokenOut,
      router,
      executor,
      user,
      amountIn,
      amountOut,
      amountToSpend,
    });

    const feeAmount = (amountIn * feeBps) / bpsDenominator;
    const swapAmountIn = amountIn - feeAmount;
    const refund = swapAmountIn - amountToSpend;

    await executor.connect(user).executeSwap(params);

    expect(await tokenIn.balanceOf(treasury.address)).to.equal(feeAmount);
    expect(await tokenIn.balanceOf(await router.getAddress())).to.equal(amountToSpend);
    expect(await tokenIn.balanceOf(user.address)).to.equal(refund);
    expect(await tokenIn.balanceOf(await executor.getAddress())).to.equal(0n);
    expect(await tokenOut.balanceOf(user.address)).to.equal(amountOut);
  });

  it("rejects non-allowlisted route targets", async function () {
    const fixture = await deployFixture();
    const { user, tokenIn, tokenOut, router, executor, other } = fixture;
    const { amountIn, amountOut } = await fundAndApprove(fixture);
    const params = await buildSwapParams({
      tokenIn,
      tokenOut,
      router,
      executor,
      user,
      amountIn,
      amountOut,
      routeTarget: other.address,
    });

    await expect(executor.connect(user).executeSwap(params)).to.be.revertedWith(
      "Route target not allowed",
    );
  });

  it("rejects non-allowlisted approval spenders", async function () {
    const fixture = await deployFixture();
    const { user, tokenIn, tokenOut, router, executor, other } = fixture;
    const { amountIn, amountOut } = await fundAndApprove(fixture);
    const params = await buildSwapParams({
      tokenIn,
      tokenOut,
      router,
      executor,
      user,
      amountIn,
      amountOut,
      approvalSpender: other.address,
    });

    await expect(executor.connect(user).executeSwap(params)).to.be.revertedWith(
      "Approval spender not allowed",
    );
  });

  it("reverts when route output is below minAmountOut", async function () {
    const fixture = await deployFixture();
    const { user, tokenIn, tokenOut, router, executor } = fixture;
    const { amountIn, amountOut } = await fundAndApprove(fixture);
    const params = await buildSwapParams({
      tokenIn,
      tokenOut,
      router,
      executor,
      user,
      amountIn,
      amountOut,
      minAmountOut: amountOut + 1n,
    });

    await expect(executor.connect(user).executeSwap(params)).to.be.revertedWith(
      "Insufficient output amount",
    );
  });

  it("requires route output to be sent to the executor before user payout", async function () {
    const fixture = await deployFixture();
    const { user, tokenIn, tokenOut, router, executor } = fixture;
    const { amountIn, amountOut } = await fundAndApprove(fixture);
    const params = await buildSwapParams({
      tokenIn,
      tokenOut,
      router,
      executor,
      user,
      amountIn,
      amountOut,
      recipient: user.address,
    });

    await expect(executor.connect(user).executeSwap(params)).to.be.revertedWith(
      "Insufficient output amount",
    );
  });

  it("can be paused by the owner", async function () {
    const fixture = await deployFixture();
    const { user, tokenIn, tokenOut, router, executor } = fixture;
    const { amountIn, amountOut } = await fundAndApprove(fixture);
    const params = await buildSwapParams({
      tokenIn,
      tokenOut,
      router,
      executor,
      user,
      amountIn,
      amountOut,
    });

    await executor.pause();

    await expect(executor.connect(user).executeSwap(params)).to.be.revertedWith(
      "Pausable: paused",
    );
  });

  it("bubbles route revert reasons", async function () {
    const fixture = await deployFixture();
    const { user, tokenIn, tokenOut, router, executor } = fixture;
    const { amountIn, amountOut } = await fundAndApprove(fixture);
    const params = await buildSwapParams({
      tokenIn,
      tokenOut,
      router,
      executor,
      user,
      amountIn,
      amountOut,
    });
    params.routeCalldata = router.interface.encodeFunctionData("revertWithReason");

    await expect(executor.connect(user).executeSwap(params)).to.be.revertedWith(
      "Mock route failed",
    );
  });
});
