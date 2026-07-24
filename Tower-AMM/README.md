# Tower AMM V1

Tower AMM is a Uniswap V2-style AMM scaffold for Arc Testnet with a Tower-specific asset registry:

- `supportedToken` controls which assets are approved globally
- `pairAllowed` optionally controls which approved asset pairs may form pools
- `enforcePairAllowlist` lets Tower start strict or loose without rewriting contracts

## Included contracts

- `TowerFactory`: pair registry, `supportedToken`, optional `pairAllowed`, fee admin
- `TowerPair`: pool logic, LP mint/burn, swaps, protocol fee minting, `skim`, `sync`
- `TowerLPToken`: LP ERC-20 with `permit`
- `TowerRouter`: add/remove liquidity, swaps, quote helpers
- `TowerLibrary`: reserve and path math

## Initial asset defaults

- `USDC`: `0x3600000000000000000000000000000000000000`
- `EURC`: `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a`
- `USDT`: `0x175CdB1D338945f0D851A741ccF787D343E57952`
- `CIRBTC`: `0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF`

Default allowed pairs:

- `USDC/EURC`
- `USDC/CIRBTC`
- `EURC/CIRBTC`
- `USDC/USDT`
- `EURC/USDT`
- `USDT/CIRBTC`

## Project layout

- `contracts/core`: factory, pair, LP token
- `contracts/periphery`: router
- `contracts/libraries`: math and transfer helpers
- `contracts/interfaces`: router/core interfaces
- `contracts/mocks`: local test tokens
- `scripts/deploy.cjs`: Arc testnet deployment
- `test/TowerAMM.test.js`: registry, allowlist, LP, swap, fee, and quote coverage

## Commands

```bash
npm install
npm run compile
npm run test
npm run deploy:arc-testnet
npm run seed:cirbtc -- 649250 5000
```

If you want to use the already-installed Hardhat toolchain from this repo before running `npm install` here, the config includes a fallback to `../contracts/node_modules`.

## Verification

The deploy script can verify the factory, router, and any initial pairs it creates on Arcscan.

Relevant environment variables:

- `VERIFY_CONTRACTS=true`
- `VERIFICATION_DELAY_MS=30000`
- `ARCSCAN_API_KEY=` if Arcscan requires one for your account or environment

## Direct write script

If Arcscan or wallet connections are down, you can still call the deployed factory and router directly over RPC:

```bash
npm run write -- <factory|router> <action> ...
```

Required environment variables:

- `PRIVATE_KEY`
- `TOWER_FACTORY_ADDRESS`
- `TOWER_ROUTER_ADDRESS`

Examples:

```bash
npm run write -- factory set-supported USDT true
npm run write -- factory set-pair-allowed USDT CIRBTC true
npm run write -- router approve-token USDT 1000
npm run write -- router add-liquidity USDC USDT 100 100 99 99
npm run write -- router approve-lp USDC USDT 10
npm run write -- router remove-liquidity USDC USDT 10 0 0
npm run write -- router swap-exact USDC,EURC 50 49
```

Run help:

```bash
npm run write -- help
```

## cirBTC seeding helper

Use the helper below to align the initial Tower LP ratio for the `USDC/cirBTC`, `EURC/cirBTC`, and `USDT/cirBTC` pools before you seed liquidity:

```bash
npm run seed:cirbtc -- 649250 5000
npm run seed:cirbtc -- 649250 5000 --stable EURC --slippage-bps 100
```

What it prints for each selected pool:

- The live ratio target in `cirBTC` per 1 stablecoin
- The `amountDesired` values to seed
- The matching `amountMin` values after your slippage buffer

Assumptions:

- `USDC = $1.00`
- `USDT = $1.00`
- `EURC = $1.08` by default, override with `--eurc-usd`

## Deployment flow

1. Deploy `TowerFactory`
2. Deploy `TowerRouter`
3. Register supported tokens
4. Register allowed pairs
5. Enable or disable `enforcePairAllowlist`
6. Set `feeTo` if Tower wants protocol fee capture
7. Optionally create initial pairs
8. Optionally verify deployed contracts on Arcscan
9. Transfer `feeToSetter` to a multisig

## V1 notes

- Pool creation is permissionless only for approved assets
- Pair creation can be globally restricted with `enforcePairAllowlist`
- Router is token-to-token only
- Protocol fee minting is implemented in the pair, unlike the earlier `kyros-v2` sample

