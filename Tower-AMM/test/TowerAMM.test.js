const { expect } = require("../../contracts/node_modules/chai");
const { ethers } = require("../../contracts/node_modules/hardhat");

describe("Tower AMM", function () {
  async function deployFixture() {
    const [owner, lp1, lp2, trader, treasury, other] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc = await MockERC20.deploy("USD Coin", "USDC", 6);
    const eurc = await MockERC20.deploy("Euro Coin", "EURC", 6);
    const cirbtc = await MockERC20.deploy("Circle Bitcoin", "CIRBTC", 8);
    const outsider = await MockERC20.deploy("Outside Token", "OUT", 18);

    const TowerFactory = await ethers.getContractFactory("TowerFactory");
    const factory = await TowerFactory.deploy(owner.address);

    const TowerRouter = await ethers.getContractFactory("TowerRouter");
    const router = await TowerRouter.deploy(await factory.getAddress());

    return {
      owner,
      lp1,
      lp2,
      trader,
      treasury,
      other,
      usdc,
      eurc,
      cirbtc,
      outsider,
      factory,
      router,
    };
  }

  async function enableSupportedTokens(factory, tokens) {
    await factory.batchSetSupportedTokens(
      await Promise.all(tokens.map((token) => token.getAddress())),
      true,
    );
  }

  async function approveAndAddLiquidity({
    user,
    router,
    tokenA,
    tokenB,
    amountA,
    amountB,
    deadline,
  }) {
    await tokenA.mint(user.address, amountA);
    await tokenB.mint(user.address, amountB);
    await tokenA.connect(user).approve(await router.getAddress(), amountA);
    await tokenB.connect(user).approve(await router.getAddress(), amountB);

    await router.connect(user).addLiquidity(
      await tokenA.getAddress(),
      await tokenB.getAddress(),
      amountA,
      amountB,
      0,
      0,
      user.address,
      deadline,
    );
  }

  it("requires tokens to be registered before creating pairs", async function () {
    const { factory, usdc, eurc } = await deployFixture();

    await expect(
      factory.createPair(await usdc.getAddress(), await eurc.getAddress()),
    ).to.be.revertedWith("Tower: PAIR_NOT_ALLOWED");

    await enableSupportedTokens(factory, [usdc, eurc]);

    await expect(factory.createPair(await usdc.getAddress(), await eurc.getAddress()))
      .to.emit(factory, "PairCreated");
  });

  it("supports optional pair allowlisting for approved assets", async function () {
    const { factory, usdc, eurc, cirbtc } = await deployFixture();

    await enableSupportedTokens(factory, [usdc, eurc, cirbtc]);
    await factory.setEnforcePairAllowlist(true);

    await expect(
      factory.createPair(await usdc.getAddress(), await eurc.getAddress()),
    ).to.be.revertedWith("Tower: PAIR_NOT_ALLOWED");

    await factory.setPairAllowed(await usdc.getAddress(), await eurc.getAddress(), true);
    await expect(factory.createPair(await usdc.getAddress(), await eurc.getAddress()))
      .to.emit(factory, "PairCreated");

    await expect(
      factory.createPair(await usdc.getAddress(), await cirbtc.getAddress()),
    ).to.be.revertedWith("Tower: PAIR_NOT_ALLOWED");
  });

  it("auto-creates an allowed pair through the router and mints LP tokens", async function () {
    const { factory, router, usdc, eurc, lp1 } = await deployFixture();
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 600;

    await enableSupportedTokens(factory, [usdc, eurc]);
    await factory.setPairAllowed(await usdc.getAddress(), await eurc.getAddress(), true);
    await factory.setEnforcePairAllowlist(true);

    await approveAndAddLiquidity({
      user: lp1,
      router,
      tokenA: usdc,
      tokenB: eurc,
      amountA: 1_000_000_000n,
      amountB: 1_000_000_000n,
      deadline,
    });

    const pairAddress = await factory.getPair(await usdc.getAddress(), await eurc.getAddress());
    expect(pairAddress).to.not.equal(ethers.ZeroAddress);

    const pair = await ethers.getContractAt("TowerPair", pairAddress);
    expect(await pair.balanceOf(lp1.address)).to.be.gt(0);
  });

  it("swaps exact tokens through the router for an allowed path", async function () {
    const { factory, router, usdc, eurc, lp1, trader } = await deployFixture();
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 600;

    await enableSupportedTokens(factory, [usdc, eurc]);
    await factory.setPairAllowed(await usdc.getAddress(), await eurc.getAddress(), true);
    await factory.setEnforcePairAllowlist(true);

    await approveAndAddLiquidity({
      user: lp1,
      router,
      tokenA: usdc,
      tokenB: eurc,
      amountA: 2_000_000_000n,
      amountB: 2_000_000_000n,
      deadline,
    });

    const amountIn = 100_000_000n;
    await usdc.mint(trader.address, amountIn);
    await usdc.connect(trader).approve(await router.getAddress(), amountIn);

    const amounts = await router.getAmountsOut(amountIn, [
      await usdc.getAddress(),
      await eurc.getAddress(),
    ]);

    await router.connect(trader).swapExactTokensForTokens(
      amountIn,
      amounts[1],
      [await usdc.getAddress(), await eurc.getAddress()],
      trader.address,
      deadline,
    );

    expect(await eurc.balanceOf(trader.address)).to.equal(amounts[1]);
  });

  it("mints protocol LP fees when feeTo is enabled", async function () {
    const { factory, router, usdc, eurc, lp1, lp2, trader, treasury } = await deployFixture();
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 600;

    await enableSupportedTokens(factory, [usdc, eurc]);
    await factory.setPairAllowed(await usdc.getAddress(), await eurc.getAddress(), true);
    await factory.setEnforcePairAllowlist(true);
    await factory.setFeeTo(treasury.address);

    await approveAndAddLiquidity({
      user: lp1,
      router,
      tokenA: usdc,
      tokenB: eurc,
      amountA: 5_000_000_000n,
      amountB: 5_000_000_000n,
      deadline,
    });

    const pairAddress = await factory.getPair(await usdc.getAddress(), await eurc.getAddress());
    const pair = await ethers.getContractAt("TowerPair", pairAddress);

    const amountIn = 500_000_000n;
    await usdc.mint(trader.address, amountIn);
    await usdc.connect(trader).approve(await router.getAddress(), amountIn);
    const amounts = await router.getAmountsOut(amountIn, [
      await usdc.getAddress(),
      await eurc.getAddress(),
    ]);

    await router.connect(trader).swapExactTokensForTokens(
      amountIn,
      amounts[1],
      [await usdc.getAddress(), await eurc.getAddress()],
      trader.address,
      deadline,
    );

    await approveAndAddLiquidity({
      user: lp2,
      router,
      tokenA: usdc,
      tokenB: eurc,
      amountA: 2_000_000_000n,
      amountB: 2_000_000_000n,
      deadline,
    });

    expect(await pair.balanceOf(treasury.address)).to.be.gt(0);
  });

  it("supports skim and sync on the pair", async function () {
    const { factory, router, usdc, eurc, lp1, other } = await deployFixture();
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 600;

    await enableSupportedTokens(factory, [usdc, eurc]);
    await factory.setPairAllowed(await usdc.getAddress(), await eurc.getAddress(), true);
    await factory.setEnforcePairAllowlist(true);

    await approveAndAddLiquidity({
      user: lp1,
      router,
      tokenA: usdc,
      tokenB: eurc,
      amountA: 1_000_000_000n,
      amountB: 1_000_000_000n,
      deadline,
    });

    const pairAddress = await factory.getPair(await usdc.getAddress(), await eurc.getAddress());
    const pair = await ethers.getContractAt("TowerPair", pairAddress);

    const extraUsdc = 25_000_000n;
    await usdc.mint(other.address, extraUsdc);
    await usdc.connect(other).transfer(pairAddress, extraUsdc);
    await pair.connect(other).skim(other.address);
    expect(await usdc.balanceOf(other.address)).to.equal(extraUsdc);

    const beforeReserves = await pair.getReserves();
    const token0Address = await pair.token0();
    const extraEurc = 40_000_000n;
    await eurc.mint(other.address, extraEurc);
    await eurc.connect(other).transfer(pairAddress, extraEurc);
    await pair.connect(other).sync();

    const afterReserves = await pair.getReserves();
    const eurcAddress = await eurc.getAddress();
    const eurcReserveIndex = token0Address.toLowerCase() === eurcAddress.toLowerCase() ? 0 : 1;
    expect(afterReserves[eurcReserveIndex]).to.equal(beforeReserves[eurcReserveIndex] + extraEurc);
  });

  it("exposes quote helpers for add and remove liquidity", async function () {
    const { factory, router, usdc, eurc, lp1 } = await deployFixture();
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 600;

    await enableSupportedTokens(factory, [usdc, eurc]);
    await factory.setPairAllowed(await usdc.getAddress(), await eurc.getAddress(), true);
    await factory.setEnforcePairAllowlist(true);

    const initialQuote = await router.quoteAddLiquidity(
      await usdc.getAddress(),
      await eurc.getAddress(),
      1_000_000_000n,
      1_000_000_000n,
    );
    expect(initialQuote[2]).to.be.gt(0);

    await approveAndAddLiquidity({
      user: lp1,
      router,
      tokenA: usdc,
      tokenB: eurc,
      amountA: 1_000_000_000n,
      amountB: 1_000_000_000n,
      deadline,
    });

    const pairAddress = await factory.getPair(await usdc.getAddress(), await eurc.getAddress());
    const pair = await ethers.getContractAt("TowerPair", pairAddress);
    const lpBalance = await pair.balanceOf(lp1.address);

    const removalQuote = await router.quoteRemoveLiquidity(
      await usdc.getAddress(),
      await eurc.getAddress(),
      lpBalance / 2n,
    );
    expect(removalQuote[0]).to.be.gt(0);
    expect(removalQuote[1]).to.be.gt(0);
  });
});
