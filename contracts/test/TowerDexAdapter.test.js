const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TowerDexAdapter", function () {
  async function deployFixture() {
    const [owner, user, recipient] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const tokenIn = await MockERC20.deploy("Euro Coin", "EURC", 6);
    const tokenOut = await MockERC20.deploy("Tether", "USDT", 6);

    const MockUniswapV2Router = await ethers.getContractFactory("MockUniswapV2Router");
    const rawRouter = await MockUniswapV2Router.deploy(owner.address, owner.address);

    const TowerDexAdapter = await ethers.getContractFactory("TowerDexAdapter");
    const adapter = await TowerDexAdapter.deploy(await rawRouter.getAddress());

    return { owner, user, recipient, tokenIn, tokenOut, rawRouter, adapter };
  }

  it("pulls input from caller and routes swap output to the requested recipient", async function () {
    const { user, recipient, tokenIn, tokenOut, rawRouter, adapter } =
      await deployFixture();
    const amountIn = 50_000_000n;
    const minAmountOut = 49_000_000n;
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 600;

    await tokenIn.mint(user.address, amountIn);
    await tokenOut.mint(await rawRouter.getAddress(), minAmountOut * 10n);
    await tokenIn.connect(user).approve(await adapter.getAddress(), amountIn);

    await expect(
      adapter
        .connect(user)
        .swap(
          await tokenIn.getAddress(),
          await tokenOut.getAddress(),
          amountIn,
          minAmountOut,
          recipient.address,
          deadline,
        ),
    ).to.changeTokenBalances(
      tokenIn,
      [user, rawRouter, adapter],
      [-amountIn, amountIn, 0n],
    );

    expect(await tokenOut.balanceOf(recipient.address)).to.equal(minAmountOut);
    expect(await tokenOut.balanceOf(await adapter.getAddress())).to.equal(0n);
  });

  it("proxies raw router quotes through getAmountOut", async function () {
    const { tokenIn, tokenOut, adapter } = await deployFixture();
    const amountOut = await adapter.getAmountOut(
      await tokenIn.getAddress(),
      await tokenOut.getAddress(),
      1_000_000n,
    );

    expect(amountOut).to.equal(2_000_000n);
  });
});
