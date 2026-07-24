const STABLE_TOKEN_USD = {
  USDC: 1,
  EURC: 1.08,
  USDT: 1,
};

const DEFAULT_SLIPPAGE_BPS = 100;
const VALID_STABLES = Object.keys(STABLE_TOKEN_USD);

function printHelp() {
  console.log(`
Tower AMM cirBTC seeding helper

Usage:
  node scripts/seed-cirbtc-pairs.cjs <cirbtc-price-usd> <stable-amount> [--stable USDC|EURC|USDT|ALL] [--slippage-bps 100] [--eurc-usd 1.08]

Examples:
  node scripts/seed-cirbtc-pairs.cjs 649250 5000
  node scripts/seed-cirbtc-pairs.cjs 649250 5000 --stable EURC
  node scripts/seed-cirbtc-pairs.cjs 649250 30000 --stable EURC --slippage-bps 50
`);
}

function parseFlags(args) {
  const flags = {};
  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];
    if (!current.startsWith('--')) {
      continue;
    }

    const key = current.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith('--')) {
      flags[key] = true;
      continue;
    }

    flags[key] = next;
    index += 1;
  }

  return flags;
}

function parsePositiveNumber(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return parsed;
}

function formatNumber(value, maximumFractionDigits = 8) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value);
}

function applySlippage(amount, slippageBps) {
  return amount * ((10000 - slippageBps) / 10000);
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('help')) {
    printHelp();
    return;
  }

  const [cirbtcPriceRaw, stableAmountRaw, ...flagArgs] = args;
  const flags = parseFlags(flagArgs);

  const cirbtcPriceUsd = parsePositiveNumber(cirbtcPriceRaw, 'cirBTC price');
  const stableAmount = parsePositiveNumber(stableAmountRaw, 'stable amount');
  const eurcUsd = flags['eurc-usd']
    ? parsePositiveNumber(flags['eurc-usd'], 'EURC USD price')
    : STABLE_TOKEN_USD.EURC;
  const slippageBps = flags['slippage-bps']
    ? parsePositiveNumber(flags['slippage-bps'], 'slippage bps')
    : DEFAULT_SLIPPAGE_BPS;

  if (slippageBps >= 10000) {
    throw new Error(`Invalid slippage bps: ${slippageBps}`);
  }

  const stableFilter = String(flags.stable || 'ALL').toUpperCase();
  const stableTokenUsd = {
    ...STABLE_TOKEN_USD,
    EURC: eurcUsd,
  };

  const selectedStables =
    stableFilter === 'ALL'
      ? VALID_STABLES
      : VALID_STABLES.filter((symbol) => symbol === stableFilter);

  if (selectedStables.length === 0) {
    throw new Error(`Unsupported stable selection: ${stableFilter}`);
  }

  console.log(`Reference cirBTC price: $${formatNumber(cirbtcPriceUsd, 2)}`);
  console.log(`Stable-side seed amount: ${formatNumber(stableAmount, 6)}`);
  console.log(`Slippage buffer: ${(slippageBps / 100).toFixed(2)}%`);
  console.log('');

  for (const stableSymbol of selectedStables) {
    const stableUsd = stableTokenUsd[stableSymbol];
    const cirbtcPerStable = stableUsd / cirbtcPriceUsd;
    const cirbtcAmount = stableAmount * cirbtcPerStable;
    const stableMin = applySlippage(stableAmount, slippageBps);
    const cirbtcMin = applySlippage(cirbtcAmount, slippageBps);

    console.log(`${stableSymbol}/cirBTC`);
    console.log(`  Spot ratio: 1 ${stableSymbol} = ${formatNumber(cirbtcPerStable, 12)} cirBTC`);
    console.log(`  Desired: ${formatNumber(stableAmount, 6)} ${stableSymbol} + ${formatNumber(cirbtcAmount, 8)} cirBTC`);
    console.log(`  amountMin: ${formatNumber(stableMin, 6)} ${stableSymbol} + ${formatNumber(cirbtcMin, 8)} cirBTC`);
    console.log('');
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
