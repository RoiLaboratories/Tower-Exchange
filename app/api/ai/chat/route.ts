import { NextRequest, NextResponse } from "next/server";
import { TOKEN_CONTRACTS, TOKEN_DECIMALS } from "@/lib/arcNetwork";

const DEFAULT_TOWER_AI_API =
  "https://tower-exchange-ai-production-3248.up.railway.app";
const BACKEND_URL =
  process.env.NEXT_PUBLIC_TOWER_AI_API || DEFAULT_TOWER_AI_API;
const API_KEY = process.env.TOWER_AI_API_KEY || "";
const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const EVM_ADDRESS_IN_TEXT_PATTERN = /0x[a-fA-F0-9]{40}/g;
const AI_QUOTE_SYMBOLS = ["USDT", "USDC", "EURC", "CIRBTC"] as const;
const AI_QUOTE_SYMBOL_SET = new Set<string>(AI_QUOTE_SYMBOLS);
const AI_SWAP_DEX_IDS = ["synthra", "xylonet-adapter", "unitflow"] as const;

type AiQuoteSymbol = (typeof AI_QUOTE_SYMBOLS)[number];
type AiSwapDexId = (typeof AI_SWAP_DEX_IDS)[number];

const AI_SWAP_DEX_LABELS: Record<AiSwapDexId, string> = {
  synthra: "Synthra",
  "xylonet-adapter": "Xylonet",
  unitflow: "UnitFlow",
};

const AI_SWAP_DEX_ALIASES: Record<AiSwapDexId, string[]> = {
  synthra: ["synthra", "synthra dex", "synthra-v3"],
  "xylonet-adapter": [
    "xylonet",
    "xylo net",
    "xylo",
    "xylonet dex",
    "xylonet adapter",
    "xylonet-adapter",
  ],
  unitflow: ["unitflow", "unit flow", "unitflow dex", "unitflow-v3"],
};
const AI_QUOTE_TOKEN_PATTERN = "(USDT|USDC|EURC|CIRBTC)";
const AI_QUOTE_TOKEN_LABELS: Record<string, string> = {
  CIRBTC: "cirBTC",
};

type AiQuote = {
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  outputAmount: string;
  minOut?: string;
  priceImpact?: string | number;
  route?: {
    hops?: Array<{
      dexName?: string;
      dexId?: string;
      dex?: string;
    }>;
  };
  routeOptions?: Array<{
    outputAmount?: string;
    quote?: AiQuote;
  }>;
};

type AiChatPayload = Record<string, unknown> & {
  message?: string;
  enable_swap_execution?: boolean;
  enable_bridge_execution?: boolean;
};

type AiChatResponsePayload = Record<string, unknown> & {
  reply?: unknown;
  data?: unknown;
};

type AiChatErrorPayload = AiChatResponsePayload & {
  error?: unknown;
  message?: unknown;
  detail?: unknown;
};

type SwapQuoteIntent = {
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  dexId?: AiSwapDexId;
};

type BridgeExecutionRequest = {
  fromChain: string;
  toChain: string;
  amount: string;
  token: "USDC";
  sourceAddress: string;
  toAddress: string;
  slippageTolerance?: number;
};

type LocalSwapTransactionBundle = {
  approval?: unknown;
  swap: Record<string, unknown>;
};

type LocalExecutableSwapRoute = {
  quote: AiQuote;
  transactionBundle: LocalSwapTransactionBundle;
};

const SUPPORTED_BRIDGE_CHAINS = [
  "arc-testnet",
  "base-sepolia",
  "optimism-sepolia",
  "avalanche-fuji",
  "arbitrum-sepolia",
  "ethereum-sepolia",
  "linea-sepolia",
  "polygon-amoy",
  "sonic-testnet",
  "unichain-sepolia",
] as const;

type SupportedBridgeChain = (typeof SUPPORTED_BRIDGE_CHAINS)[number];

const BRIDGE_CHAIN_NAMES: Record<SupportedBridgeChain, string> = {
  "arc-testnet": "Arc Testnet",
  "base-sepolia": "Base Sepolia",
  "optimism-sepolia": "Optimism Sepolia",
  "avalanche-fuji": "Avalanche Fuji",
  "arbitrum-sepolia": "Arbitrum Sepolia",
  "ethereum-sepolia": "Ethereum Sepolia",
  "linea-sepolia": "Linea Sepolia",
  "polygon-amoy": "Polygon Amoy",
  "sonic-testnet": "Sonic Testnet",
  "unichain-sepolia": "Unichain Sepolia",
};

const BRIDGE_CHAIN_ALIASES: Record<SupportedBridgeChain, string[]> = {
  "arc-testnet": ["arc-testnet", "arc testnet", "arc"],
  "base-sepolia": ["base-sepolia", "base sepolia", "base"],
  "optimism-sepolia": [
    "optimism-sepolia",
    "optimism sepolia",
    "optimism",
    "op sepolia",
  ],
  "avalanche-fuji": ["avalanche-fuji", "avalanche fuji", "fuji", "avalanche"],
  "arbitrum-sepolia": [
    "arbitrum-sepolia",
    "arbitrum sepolia",
    "arbitrum",
  ],
  "ethereum-sepolia": [
    "ethereum-sepolia",
    "ethereum sepolia",
    "eth sepolia",
    "sepolia",
  ],
  "linea-sepolia": ["linea-sepolia", "linea sepolia", "linea"],
  "polygon-amoy": ["polygon-amoy", "polygon amoy", "amoy", "polygon"],
  "sonic-testnet": ["sonic-testnet", "sonic testnet", "sonic"],
  "unichain-sepolia": [
    "unichain-sepolia",
    "unichain sepolia",
    "unichain",
  ],
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const readResponsePayload = async (
  response: Response,
): Promise<AiChatResponsePayload> => {
  const text = await response.text();

  if (!text.trim()) {
    return {};
  }

  try {
    return JSON.parse(text) as AiChatResponsePayload;
  } catch {
    return {
      error: "Tower AI backend returned a non-JSON response",
      message: response.ok
        ? "Tower AI backend returned an invalid response."
        : "Tower AI backend returned an error response.",
      detail: text.slice(0, 500),
    };
  }
};

const getErrorMessage = (
  payload: AiChatErrorPayload,
  fallback: string,
) => {
  for (const field of ["message", "error", "detail"]) {
    const value = payload[field];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return fallback;
};

const getStringField = (
  record: Record<string, unknown> | null,
  fields: string[],
) => {
  if (!record) {
    return undefined;
  }

  for (const field of fields) {
    const value = record[field];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
};

const getNumberField = (
  record: Record<string, unknown> | null,
  fields: string[],
) => {
  if (!record) {
    return undefined;
  }

  for (const field of fields) {
    const value = record[field];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) {
      return Number(value);
    }
  }

  return undefined;
};

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeSwapDexId = (dexId?: string | null): AiSwapDexId | undefined => {
  const normalized = dexId?.trim().toLowerCase().replace(/[\s_]+/g, "-");

  if (!normalized) {
    return undefined;
  }

  if (normalized === "synthra-v3" || normalized.includes("synthra")) {
    return "synthra";
  }

  if (
    normalized === "unitflow-v3" ||
    normalized.includes("unitflow") ||
    normalized.includes("unit-flow")
  ) {
    return "unitflow";
  }

  if (
    normalized === "xylonet" ||
    normalized === "xylo" ||
    normalized === "xylo-net" ||
    normalized.includes("xylonet")
  ) {
    return "xylonet-adapter";
  }

  return AI_SWAP_DEX_IDS.includes(normalized as AiSwapDexId)
    ? (normalized as AiSwapDexId)
    : undefined;
};

const formatSwapDexName = (dexId?: string | null) => {
  const normalizedDexId = normalizeSwapDexId(dexId);
  return normalizedDexId ? AI_SWAP_DEX_LABELS[normalizedDexId] : dexId?.trim();
};

const getDirectSwapDexPreference = (
  ...records: Array<Record<string, unknown> | null>
) => {
  const fields = [
    "dexId",
    "dex",
    "dexName",
    "route",
    "routeId",
    "routeName",
    "router",
    "routerId",
    "preferredDex",
    "preferredDexId",
    "preferredRoute",
  ];

  for (const record of records) {
    const directDexId = normalizeSwapDexId(getStringField(record, fields));
    if (directDexId) {
      return directDexId;
    }

    const route = asRecord(record?.route);
    const routeDexId = normalizeSwapDexId(getStringField(route, fields));
    if (routeDexId) {
      return routeDexId;
    }
  }

  return undefined;
};

const extractSwapDexPreference = (
  payload: AiChatPayload,
  message: string,
  directIntent?: Record<string, unknown> | null,
) => {
  const directDexId = getDirectSwapDexPreference(payload, directIntent ?? null);
  if (directDexId) {
    return directDexId;
  }

  for (const dexId of AI_SWAP_DEX_IDS) {
    const aliases = AI_SWAP_DEX_ALIASES[dexId];
    if (
      aliases.some((alias) =>
        new RegExp(`\\b${escapeRegExp(alias)}\\b`, "i").test(message),
      )
    ) {
      return dexId;
    }
  }

  return undefined;
};

const normalizeBridgeChain = (chain?: string | null): SupportedBridgeChain | null => {
  const normalizedChain = chain?.trim().toLowerCase();

  if (!normalizedChain) {
    return null;
  }

  for (const chainId of SUPPORTED_BRIDGE_CHAINS) {
    if (chainId === normalizedChain) {
      return chainId;
    }

    const aliases = BRIDGE_CHAIN_ALIASES[chainId];
    if (aliases.some((alias) => alias.toLowerCase() === normalizedChain)) {
      return chainId;
    }
  }

  return null;
};

const findBridgeChainMentions = (message: string) => {
  const mentions: Array<{ chain: SupportedBridgeChain; index: number }> = [];

  for (const chainId of SUPPORTED_BRIDGE_CHAINS) {
    for (const alias of BRIDGE_CHAIN_ALIASES[chainId]) {
      const pattern = new RegExp(`\\b${escapeRegExp(alias)}\\b`, "i");
      const match = message.match(pattern);

      if (match?.index != null) {
        mentions.push({ chain: chainId, index: match.index });
        break;
      }
    }
  }

  return mentions.sort((left, right) => left.index - right.index);
};

const extractBridgeChainAfterKeyword = (
  message: string,
  keyword: "from" | "to",
) => {
  const keywordPattern =
    keyword === "from"
      ? /\bfrom\s+(.+?)(?=\s+\b(?:to|into|onto|for)\b|$)/i
      : /\b(?:to|into|onto)\s+(.+?)(?=$|\s+\b(?:using|with|for|address|wallet)\b)/i;
  const match = message.match(keywordPattern);

  if (!match?.[1]) {
    return null;
  }

  const segmentMentions = findBridgeChainMentions(match[1]);
  return segmentMentions[0]?.chain ?? normalizeBridgeChain(match[1]);
};

const extractBridgeIntent = (
  payload: AiChatPayload,
): BridgeExecutionRequest | null => {
  const message = typeof payload.message === "string" ? payload.message : "";
  const directIntent =
    asRecord(payload.bridge_intent) ||
    asRecord(payload.bridgeIntent) ||
    asRecord(payload.parameters);
  const walletAddress = getWalletAddress(payload);

  if (!walletAddress) {
    return null;
  }

  const messageLooksLikeBridge =
    /\b(bridge|bridging|cross-chain|cross chain)\b/i.test(message) ||
    /\b(?:send|transfer|move)\b.+\b(?:from|to|into|onto)\b/i.test(message);

  if (!directIntent && (!message || !messageLooksLikeBridge)) {
    return null;
  }

  const amountFromIntent = getStringField(directIntent, ["amount", "inputAmount"]);
  const amountFromMessage = message.match(
    /\b(\d[\d,]*(?:\.\d+)?)\s*(USDC)\b/i,
  )?.[1];
  const amount = (amountFromIntent || amountFromMessage || "")
    .replace(/,/g, "")
    .trim();
  const token = (
    getStringField(directIntent, ["token", "tokenSymbol"]) ||
    message.match(/\b(USDC)\b/i)?.[1] ||
    ""
  ).toUpperCase();

  if (!amount || !/^\d+(\.\d+)?$/.test(amount) || token !== "USDC") {
    return null;
  }

  const fromChain =
    normalizeBridgeChain(getStringField(directIntent, ["fromChain", "sourceChain"])) ||
    extractBridgeChainAfterKeyword(message, "from");
  const toChain =
    normalizeBridgeChain(getStringField(directIntent, ["toChain", "destinationChain"])) ||
    extractBridgeChainAfterKeyword(message, "to");
  const orderedMentions = findBridgeChainMentions(message);
  const fallbackFromChain = orderedMentions[0]?.chain ?? null;
  const fallbackToChain =
    orderedMentions.find((mention) => mention.chain !== fallbackFromChain)?.chain ??
    null;
  const resolvedFromChain = fromChain || fallbackFromChain;
  const resolvedToChain = toChain || fallbackToChain;
  const explicitToAddress = getStringField(directIntent, [
    "toAddress",
    "recipientAddress",
    "destinationAddress",
  ]);
  const messageAddresses = Array.from(
    message.matchAll(EVM_ADDRESS_IN_TEXT_PATTERN),
    (match) => match[0],
  );
  const toAddress =
    explicitToAddress ||
    messageAddresses.find(
      (address) => address.toLowerCase() !== walletAddress.toLowerCase(),
    ) ||
    walletAddress;

  if (!resolvedFromChain || !resolvedToChain || resolvedFromChain === resolvedToChain) {
    return null;
  }

  if (!EVM_ADDRESS_PATTERN.test(toAddress)) {
    return null;
  }

  return {
    fromChain: resolvedFromChain,
    toChain: resolvedToChain,
    amount,
    token: "USDC",
    sourceAddress: walletAddress,
    toAddress,
    slippageTolerance:
      getNumberField(directIntent, ["slippageTolerance", "slippage"]) ?? 0.5,
  };
};

const resolveTokenAddress = (token?: string | null) => {
  const normalizedToken = token?.trim();

  if (!normalizedToken) {
    return null;
  }

  const symbolAddress = TOKEN_CONTRACTS[normalizedToken.toUpperCase()];

  if (symbolAddress) {
    return symbolAddress;
  }

  return EVM_ADDRESS_PATTERN.test(normalizedToken) ? normalizedToken : null;
};

const getTokenSymbol = (token?: string | null) => {
  const normalizedToken = token?.trim();

  if (!normalizedToken) {
    return null;
  }

  const upperToken = normalizedToken.toUpperCase();

  if (AI_QUOTE_SYMBOL_SET.has(upperToken)) {
    return upperToken as AiQuoteSymbol;
  }

  const resolvedAddress = resolveTokenAddress(normalizedToken);

  if (!resolvedAddress) {
    return null;
  }

  const match = Object.entries(TOKEN_CONTRACTS).find(
    ([, address]) => address.toLowerCase() === resolvedAddress.toLowerCase(),
  );

  return match?.[0] ?? null;
};

const getTokenDisplaySymbol = (token?: string | null) => {
  const symbol = getTokenSymbol(token);
  return symbol ? AI_QUOTE_TOKEN_LABELS[symbol] || symbol : null;
};

const getTokenDecimals = (tokenAddress: string) => {
  const symbol = getTokenSymbol(tokenAddress);

  return symbol ? TOKEN_DECIMALS[symbol] ?? 18 : 18;
};

const parseDecimalAmount = (amount: string, decimals: number) => {
  const normalizedAmount = amount.replace(/,/g, "").trim();

  if (!/^\d+(\.\d+)?$/.test(normalizedAmount)) {
    return null;
  }

  const [wholePart, fractionPart = ""] = normalizedAmount.split(".");
  const normalizedWhole = wholePart || "0";
  const normalizedFraction = fractionPart
    .slice(0, decimals)
    .padEnd(decimals, "0");
  const whole = BigInt(normalizedWhole) * 10n ** BigInt(decimals);
  const fraction = normalizedFraction ? BigInt(normalizedFraction) : 0n;

  return (whole + fraction).toString();
};

const normalizeAmountForQuote = (
  amount: string | undefined,
  tokenAddress: string,
) => {
  if (!amount) {
    return null;
  }

  const normalizedAmount = amount.trim();

  if (normalizedAmount.startsWith("0x")) {
    try {
      return BigInt(normalizedAmount).toString();
    } catch {
      return null;
    }
  }

  if (normalizedAmount.includes(".")) {
    return parseDecimalAmount(normalizedAmount, getTokenDecimals(tokenAddress));
  }

  return /^\d+$/.test(normalizedAmount) ? normalizedAmount : null;
};

const extractMessageSwapIntent = (
  payload: AiChatPayload,
): SwapQuoteIntent | null => {
  const message = typeof payload.message === "string" ? payload.message : "";
  const directIntent =
    asRecord(payload.swap_intent) ||
    asRecord(payload.swapIntent) ||
    asRecord(payload.quote_intent) ||
    asRecord(payload.quoteIntent) ||
    asRecord(payload.parameters);

  if (!message || !/\b(swap|exchange|trade|quote|convert)\b/i.test(message)) {
    return null;
  }

  const amountTokenMatch = message.match(
    new RegExp(`\\b(\\d[\\d,]*(?:\\.\\d+)?)\\s*${AI_QUOTE_TOKEN_PATTERN}\\b`, "i"),
  );

  if (!amountTokenMatch || amountTokenMatch.index == null) {
    return null;
  }

  const inputSymbol = amountTokenMatch[2].toUpperCase() as AiQuoteSymbol;
  const inputToken = resolveTokenAddress(inputSymbol);

  if (!inputToken) {
    return null;
  }

  const inputAmount = parseDecimalAmount(
    amountTokenMatch[1],
    getTokenDecimals(inputToken),
  );

  if (!inputAmount) {
    return null;
  }

  const afterInputToken = message.slice(
    amountTokenMatch.index + amountTokenMatch[0].length,
  );
  const outputAfterInputMatch = afterInputToken.match(
    new RegExp(
      `\\b(?:to|for|into|receive|receiving|get|buy)\\s+(?:about\\s+|approximately\\s+|approx\\.?\\s+)?(?:\\d[\\d,]*(?:\\.\\d+)?\\s*)?${AI_QUOTE_TOKEN_PATTERN}\\b`,
      "i",
    ),
  );
  const tokenMatches = Array.from(
    message.matchAll(new RegExp(`\\b${AI_QUOTE_TOKEN_PATTERN}\\b`, "gi")),
  );
  const fallbackOutputSymbol = tokenMatches
    .map((match) => match[1].toUpperCase() as AiQuoteSymbol)
    .find((symbol) => symbol !== inputSymbol);
  const outputSymbol =
    (outputAfterInputMatch?.[1]?.toUpperCase() as AiQuoteSymbol | undefined) ||
    fallbackOutputSymbol;
  const outputToken = resolveTokenAddress(outputSymbol);

  if (!outputToken || outputToken.toLowerCase() === inputToken.toLowerCase()) {
    return null;
  }

  return {
    inputToken,
    outputToken,
    inputAmount,
    dexId: extractSwapDexPreference(payload, message, directIntent),
  };
};

const getQuoteDexPreference = (quote: Record<string, unknown> | null) => {
  const route = asRecord(quote?.route);
  const hops = Array.isArray(route?.hops) ? route.hops : [];
  const firstHop = asRecord(hops[0]);

  return getDirectSwapDexPreference(quote, firstHop);
};

const getExistingQuote = (response: AiChatResponsePayload) => {
  const dataRecord = asRecord(response.data);
  const swapExecution = asRecord(dataRecord?.swap_execution);

  return (
    asRecord(swapExecution?.quote) ||
    asRecord(dataRecord?.quote)
  );
};

const extractResponseSwapIntent = (
  response: AiChatResponsePayload,
): SwapQuoteIntent | null => {
  const dataRecord = asRecord(response.data);
  const swapExecution = asRecord(dataRecord?.swap_execution);
  const transaction = asRecord(swapExecution?.transaction);
  const quote = getExistingQuote(response);
  const inputToken = resolveTokenAddress(
    getStringField(quote, ["inputToken", "tokenIn"]) ||
      getStringField(transaction, ["inputToken", "tokenIn"]),
  );
  const outputToken = resolveTokenAddress(
    getStringField(quote, ["outputToken", "tokenOut"]) ||
      getStringField(transaction, ["outputToken", "tokenOut"]),
  );

  if (!inputToken || !outputToken) {
    return null;
  }

  const inputAmount = normalizeAmountForQuote(
    getStringField(quote, ["inputAmount", "amountIn"]) ||
      getStringField(transaction, ["inputAmount", "amountIn"]),
    inputToken,
  );

  if (!inputAmount) {
    return null;
  }

  return {
    inputToken,
    outputToken,
    inputAmount,
    dexId: getQuoteDexPreference(quote),
  };
};

const isSupportedStableQuotePair = (intent: SwapQuoteIntent) => {
  const inputSymbol = getTokenSymbol(intent.inputToken);
  const outputSymbol = getTokenSymbol(intent.outputToken);

  if (!inputSymbol || !outputSymbol || inputSymbol === outputSymbol) {
    return false;
  }

  return AI_QUOTE_SYMBOL_SET.has(inputSymbol) && AI_QUOTE_SYMBOL_SET.has(outputSymbol);
};

const isUsableQuote = (quote: Record<string, unknown> | null) => {
  const inputToken = resolveTokenAddress(getStringField(quote, ["inputToken", "tokenIn"]));
  const outputToken = resolveTokenAddress(getStringField(quote, ["outputToken", "tokenOut"]));
  const outputAmount = getStringField(quote, ["outputAmount", "amountOut"]);

  if (!inputToken || !outputToken || !outputAmount) {
    return false;
  }

  try {
    return BigInt(outputAmount) > 0n;
  } catch {
    return false;
  }
};

const formatNormalizedQuoteAmount = (amount: string) => {
  try {
    const value = BigInt(amount);
    const divisor = 10n ** 18n;
    const whole = value / divisor;
    const fraction = value % divisor;

    if (fraction === 0n) {
      return whole.toString();
    }

    const fractionText = fraction
      .toString()
      .padStart(18, "0")
      .slice(0, 6)
      .replace(/0+$/, "");

    return fractionText ? `${whole}.${fractionText}` : whole.toString();
  } catch {
    return amount;
  }
};

const buildQuoteLine = (quote: AiQuote) => {
  const inputSymbol = getTokenDisplaySymbol(quote.inputToken) || "input token";
  const outputSymbol = getTokenDisplaySymbol(quote.outputToken) || "output token";
  const dexName =
    formatSwapDexName(
      quote.route?.hops?.[0]?.dexName ||
        quote.route?.hops?.[0]?.dexId ||
        quote.route?.hops?.[0]?.dex,
    ) ||
    "best route";

  return `Quote: ${formatNormalizedQuoteAmount(quote.inputAmount)} ${inputSymbol} -> approximately ${formatNormalizedQuoteAmount(quote.outputAmount)} ${outputSymbol} via ${dexName}.`;
};

const buildSwapReadyReply = (quote: AiQuote) => {
  const inputSymbol = getTokenDisplaySymbol(quote.inputToken) || "input token";
  const outputSymbol = getTokenDisplaySymbol(quote.outputToken) || "output token";

  return [
    `The swap of ${formatNormalizedQuoteAmount(quote.inputAmount)} ${inputSymbol} for ${outputSymbol} is ready for execution.`,
    "",
    "Here's the summary:",
    `- You'll receive approximately ${formatNormalizedQuoteAmount(quote.outputAmount)} ${outputSymbol}.`,
    "- The transaction is prepared and ready for you to sign with your wallet.",
    "- Once you sign, it will be broadcast to the Arc testnet.",
    "",
    "Please proceed to sign the transaction with your wallet to complete the swap.",
    "",
    buildQuoteLine(quote),
  ].join("\n");
};

const sanitizeWalletBranding = (reply: string) =>
  reply
    .replace(/\s*\(Privy\)/gi, "")
    .replace(/\bPrivy wallet\b/gi, "wallet")
    .replace(/\bPrivy\b/gi, "wallet");

const hasStaleSwapQuoteError = (reply: string) =>
  [
    /\berror preparing the swap transaction\b/i,
    /\berror while attempting to execute\b/i,
    /\btechnical issue while attempting to execute\b/i,
    /\b(?:error|issue|problem)\b.*\battempting to execute the swap\b/i,
    /\bmissing route path\b/i,
    /\bbackend issue\b/i,
    /\bformatting issue\b/i,
    /\bfailed to (?:fetch|get)(?: a)? quote\b/i,
    /\bunable to (?:fetch|get)(?: a)? quote\b/i,
    /\bplease try again later\b/i,
    /\blet'?s try that again\b/i,
    /\bwould you like me to (?:proceed with another attempt|try again)\b/i,
  ].some((pattern) => pattern.test(reply));

const attachQuoteToResponse = (
  response: AiChatResponsePayload,
  quote: AiQuote,
  shouldAppendQuoteLine: boolean,
  transactionBundle?: LocalSwapTransactionBundle | null,
  suppressStaleErrors = true,
  transactionReady = false,
): AiChatResponsePayload => {
  const dataRecord = asRecord(response.data) ?? {};
  const swapExecution = asRecord(dataRecord.swap_execution);
  const nextData: Record<string, unknown> = {
    ...dataRecord,
    quote,
  };

  if (swapExecution) {
    nextData.swap_execution = {
      ...swapExecution,
      quote,
    };
  }

  if (transactionBundle) {
    nextData.swap_execution = {
      ...swapExecution,
      quote,
      transaction: {
        ...transactionBundle.swap,
        approval: transactionBundle.approval ?? null,
      },
    };
  }

  const quoteLine = buildQuoteLine(quote);
  const reply =
    typeof response.reply === "string" && shouldAppendQuoteLine
      ? transactionReady
        ? buildSwapReadyReply(quote)
        : suppressStaleErrors && hasStaleSwapQuoteError(response.reply)
        ? quoteLine
        : /\bquote\s*:/i.test(response.reply)
        ? sanitizeWalletBranding(response.reply)
        : `${sanitizeWalletBranding(response.reply).trim()}\n\n${quoteLine}`.trim()
      : response.reply;

  return {
    ...response,
    reply,
    data: nextData,
  };
};

const fetchLocalQuote = async (
  request: NextRequest,
  intent: SwapQuoteIntent,
): Promise<AiQuote | null> => {
  try {
    const quoteUrl = new URL("/api/swap/quote", request.url);
    const quoteResponse = await fetch(quoteUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inputToken: intent.inputToken,
        outputToken: intent.outputToken,
        inputAmount: intent.inputAmount,
        slippageTolerance: 50,
        dexId: intent.dexId,
      }),
      cache: "no-store",
    });

    if (!quoteResponse.ok) {
      console.warn("[ai/chat] Local quote fetch failed:", quoteResponse.status);
      return null;
    }

    const quoteData = await quoteResponse.json();
    return (quoteData.data || quoteData) as AiQuote;
  } catch (error) {
    console.warn("[ai/chat] Local quote fetch unavailable:", error);
    return null;
  }
};

const getWalletAddress = (payload: AiChatPayload) => {
  for (const field of ["wallet_address", "walletAddress", "userid", "userId"]) {
    const value = payload[field];

    if (typeof value === "string" && EVM_ADDRESS_PATTERN.test(value.trim())) {
      return value.trim();
    }
  }

  return null;
};

const hasUsableSwapTransaction = (response: AiChatResponsePayload) => {
  const dataRecord = asRecord(response.data);
  const swapExecution = asRecord(dataRecord?.swap_execution);
  const transaction = asRecord(swapExecution?.transaction);
  const to = getStringField(transaction, ["to"]);
  const data = getStringField(transaction, ["data"]);

  return Boolean(
    to &&
      EVM_ADDRESS_PATTERN.test(to) &&
      data &&
      data.startsWith("0x"),
  );
};

const fetchLocalSwapTransaction = async (
  request: NextRequest,
  quote: AiQuote,
  userAddress: string,
): Promise<LocalSwapTransactionBundle | null> => {
  try {
    const buildTxUrl = new URL("/api/swap/build-tx", request.url);
    const buildTxResponse = await fetch(buildTxUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quote,
        userAddress,
      }),
      cache: "no-store",
    });

    const buildTxData = await buildTxResponse.json();

    if (!buildTxResponse.ok) {
      console.warn("[ai/chat] Local swap transaction build failed:", buildTxData);
      return null;
    }

    const dataRecord = asRecord(buildTxData.data) ?? asRecord(buildTxData);
    const swap = asRecord(dataRecord?.swap);

    if (!swap) {
      console.warn("[ai/chat] Local swap transaction response missing swap data:", buildTxData);
      return null;
    }

    return {
      approval: dataRecord?.approval ?? null,
      swap,
    };
  } catch (error) {
    console.warn("[ai/chat] Local swap transaction build unavailable:", error);
    return null;
  }
};

const getQuoteBuildCandidates = (quote: AiQuote) => {
  const routeOptionQuotes =
    quote.routeOptions
      ?.map((option) => option.quote)
      .filter((optionQuote): optionQuote is AiQuote =>
        Boolean(optionQuote?.inputToken && optionQuote.outputToken && optionQuote.inputAmount),
      )
      .sort((left, right) => {
        try {
          return Number(BigInt(right.outputAmount || "0") - BigInt(left.outputAmount || "0"));
        } catch {
          return 0;
        }
      }) ?? [];
  const candidates = [quote, ...routeOptionQuotes];
  const seen = new Set<string>();

  return candidates.filter((candidate) => {
    const dexId =
      candidate.route?.hops?.[0]?.dexId ||
      candidate.route?.hops?.[0]?.dex ||
      candidate.route?.hops?.[0]?.dexName ||
      "unknown";
    const key = `${dexId}:${candidate.outputAmount}:${candidate.route?.hops?.[0]?.dexName || ""}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const fetchLocalExecutableSwapRoute = async (
  request: NextRequest,
  quote: AiQuote,
  userAddress: string,
): Promise<LocalExecutableSwapRoute | null> => {
  for (const quoteCandidate of getQuoteBuildCandidates(quote)) {
    const transactionBundle = await fetchLocalSwapTransaction(
      request,
      quoteCandidate,
      userAddress,
    );

    if (transactionBundle) {
      return {
        quote: quoteCandidate,
        transactionBundle,
      };
    }
  }

  return null;
};

const enrichStableSwapQuote = async (
  request: NextRequest,
  payload: AiChatPayload,
  response: AiChatResponsePayload,
) => {
  const messageIntent = extractMessageSwapIntent(payload);
  const responseIntent = extractResponseSwapIntent(response);
  const intent = messageIntent || responseIntent;

  if (!intent || !isSupportedStableQuotePair(intent)) {
    return response;
  }

  const existingQuote = getExistingQuote(response);
  const shouldRefreshQuote = !isUsableQuote(existingQuote) || Boolean(messageIntent);

  if (!shouldRefreshQuote && existingQuote) {
    return response;
  }

  const quote = await fetchLocalQuote(request, intent);

  if (!quote) {
    return response;
  }

  const staleReply =
    typeof response.reply === "string" && hasStaleSwapQuoteError(response.reply);
  const existingTransactionReady = hasUsableSwapTransaction(response);
  const shouldBuildLocalTransaction =
    payload.enable_swap_execution === true &&
    (!existingTransactionReady || staleReply);
  const userAddress = getWalletAddress(payload);
  const executableRoute =
    shouldBuildLocalTransaction && userAddress
      ? await fetchLocalExecutableSwapRoute(request, quote, userAddress)
      : null;
  const responseQuote = executableRoute?.quote ?? quote;
  const transactionBundle = executableRoute?.transactionBundle ?? null;
  const transactionReady = existingTransactionReady || Boolean(transactionBundle);
  const suppressStaleErrors =
    !shouldBuildLocalTransaction || Boolean(transactionBundle);

  return attachQuoteToResponse(
    response,
    responseQuote,
    true,
    transactionBundle,
    suppressStaleErrors,
    transactionReady,
  );
};

const estimateBridgeTime = (toChain: string) => {
  const timeMap: Record<string, string> = {
    "arc-testnet": "1-2 minutes",
    "base-sepolia": "2-5 minutes",
    "optimism-sepolia": "3-7 minutes",
    "avalanche-fuji": "2-5 minutes",
    "arbitrum-sepolia": "2-5 minutes",
  };

  return timeMap[toChain] || "2-5 minutes";
};

const buildBridgeReadyReply = (bridgeRequest: BridgeExecutionRequest) => {
  const fromName =
    BRIDGE_CHAIN_NAMES[bridgeRequest.fromChain as SupportedBridgeChain] ||
    bridgeRequest.fromChain;
  const toName =
    BRIDGE_CHAIN_NAMES[bridgeRequest.toChain as SupportedBridgeChain] ||
    bridgeRequest.toChain;

  return [
    `The bridge of ${bridgeRequest.amount} ${bridgeRequest.token} from ${fromName} to ${toName} is ready.`,
    "Please sign the wallet prompts to submit the bridge transaction.",
    `Estimated completion time: ${estimateBridgeTime(bridgeRequest.toChain)}.`,
  ].join("\n");
};

const enrichBridgeExecution = (
  payload: AiChatPayload,
  response: AiChatResponsePayload,
): AiChatResponsePayload => {
  if (payload.enable_bridge_execution !== true) {
    return response;
  }

  const dataRecord = asRecord(response.data);
  const existingBridgeExecution = asRecord(dataRecord?.bridge_execution);

  if (existingBridgeExecution) {
    return response;
  }

  const bridgeRequest = extractBridgeIntent(payload);

  if (!bridgeRequest) {
    return response;
  }

  return {
    ...response,
    reply: buildBridgeReadyReply(bridgeRequest),
    data: {
      ...(dataRecord ?? {}),
      action: "bridge",
      bridge_execution: {
        request: bridgeRequest,
        estimatedFee: "0.000130",
        estimatedTime: estimateBridgeTime(bridgeRequest.toChain),
        message: "Bridge request prepared for wallet signing.",
      },
    },
  };
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AiChatPayload;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Add API key in the correct header
    if (API_KEY) {
      headers["endpoint_auth"] = API_KEY;
    }

    const chatUrl = `${BACKEND_URL}/api/v1/chat`;

    console.log("Sending request to:", chatUrl);
    console.log("Headers:", {
      "Content-Type": "application/json",
      ...(API_KEY ? { endpoint_auth: "***REDACTED***" } : {}),
    });

    const response = await fetch(chatUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const data = await readResponsePayload(response);

    if (!response.ok) {
      const message = getErrorMessage(
        data,
        `Tower AI backend request failed with status ${response.status}`,
      );

      console.error(
        "Tower AI Agent Error Response:",
        JSON.stringify(
          {
            status: response.status,
            statusText: response.statusText,
            body: data,
          },
          null,
          2,
        ),
      );

      return NextResponse.json(
        {
          ...data,
          error:
            typeof data.error === "string" && data.error.trim()
              ? data.error
              : "Tower AI backend request failed",
          message,
          upstreamStatus: response.status,
        },
        { status: response.status },
      );
    }

    let enrichedData = data;

    try {
      const enrichedSwapData = await enrichStableSwapQuote(request, body, data);
      enrichedData = enrichBridgeExecution(body, enrichedSwapData);
    } catch (enrichmentError) {
      console.error("[ai/chat] Response enrichment failed:", enrichmentError);
    }

    return NextResponse.json(enrichedData);
  } catch (error) {
    console.error("Error sending message to AI agent:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
