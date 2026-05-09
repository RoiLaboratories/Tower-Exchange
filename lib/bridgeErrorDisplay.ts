import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Clock3,
  Fuel,
  KeyRound,
  Network,
  ShieldAlert,
  Wallet,
} from "lucide-react";

export type BridgeErrorPresentation = {
  category: string;
  title: string;
  summary: string;
  guidance: string[];
  tone: "warning" | "critical";
  icon: LucideIcon;
  rawError: string;
};

type BridgeErrorContext = {
  fromChainName?: string | null;
  toChainName?: string | null;
  fromGasBalance?: string | null;
  toGasBalance?: string | null;
  fromGasTokenSymbol?: string | null;
  toGasTokenSymbol?: string | null;
};

const normalizeBridgeError = (error: string | null | undefined) =>
  typeof error === "string"
    ? error.replace(/\s+/g, " ").replace(/^error:\s*/i, "").trim()
    : "";

const includesAny = (value: string, patterns: string[]) =>
  patterns.some((pattern) => value.includes(pattern));

const isDestinationGasError = (normalized: string) =>
  includesAny(normalized, [
    "destination gas",
    "insufficient gas on destination",
    "not enough gas on destination",
    "insufficient destination gas",
    "destination chain",
    "receiving chain",
    "recipient chain",
    "claim",
  ]);

const isSourceGasError = (normalized: string) =>
  includesAny(normalized, [
    "source gas",
    "source chain",
    "origin chain",
    "from chain",
    "approval gas",
    "submit gas",
    "gas for approval",
    "gas for submission",
    "not enough gas to send",
  ]);

const getNativeTokenLabel = (chainName: string, providedSymbol?: string | null) =>
  providedSymbol ?? "the native gas token";

const parseBalance = (value: string | null | undefined) => {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) ? parsed : null;
};

const hasInsufficientGasBalance = (value: string | null | undefined) => {
  const parsed = parseBalance(value);
  return parsed !== null && parsed <= 0.000001;
};

export function getBridgeErrorPresentation(
  error: string | null | undefined,
  context: BridgeErrorContext = {},
): BridgeErrorPresentation | null {
  const rawError = normalizeBridgeError(error);

  if (!rawError) {
    return null;
  }

  const normalized = rawError.toLowerCase();
  const sourceChain = context.fromChainName ?? "the source chain";
  const destinationChain = context.toChainName ?? "the destination chain";
  const sourceGasToken = getNativeTokenLabel(
    sourceChain,
    context.fromGasTokenSymbol,
  );
  const destinationGasToken = getNativeTokenLabel(
    destinationChain,
    context.toGasTokenSymbol,
  );
  const sourceGasInsufficient = hasInsufficientGasBalance(context.fromGasBalance);
  const destinationGasInsufficient = hasInsufficientGasBalance(
    context.toGasBalance,
  );

  if (isDestinationGasError(normalized)) {
    return {
      category: "Destination gas required",
      title: `Add gas on ${destinationChain}`,
      summary: `The bridge could not complete because the receiving wallet does not have enough native gas on ${destinationChain} to finish or use the bridged funds.`,
      guidance: [
        `Fund the receiving wallet with ${destinationGasToken} on ${destinationChain} before retrying.`,
        "Keep a small buffer for claiming, wallet interactions, and follow-up transfers.",
        "Retry the bridge after the gas top-up is confirmed on-chain.",
      ],
      tone: "critical",
      icon: Fuel,
      rawError,
    };
  }

  if (
    includesAny(normalized, [
      "insufficient gas",
      "out of gas",
      "native token",
      "intrinsic gas too low",
      "gas required",
      "gas fee",
    ])
  ) {
    const destinationLikely =
      isDestinationGasError(normalized) ||
      (!isSourceGasError(normalized) &&
        destinationGasInsufficient &&
        !sourceGasInsufficient);
    const sourceLikely =
      isSourceGasError(normalized) ||
      (!isDestinationGasError(normalized) &&
        sourceGasInsufficient &&
        !destinationGasInsufficient);
    const bothSidesLow = sourceGasInsufficient && destinationGasInsufficient;

    return {
      category: bothSidesLow
        ? "Gas required on both chains"
        : destinationLikely
        ? "Destination gas required"
        : sourceLikely
          ? "Source chain gas required"
          : "Gas required for bridge",
      title: bothSidesLow
        ? `Add gas on ${sourceChain} and ${destinationChain}`
        : destinationLikely
        ? `Add gas on ${destinationChain}`
        : sourceLikely
          ? `Add gas on ${sourceChain}`
          : "Bridge could not confirm which chain lacks gas",
      summary: bothSidesLow
        ? `Both the source wallet on ${sourceChain} and the receiving wallet on ${destinationChain} appear to be short on gas for this bridge flow.`
        : destinationLikely
        ? `The receiving wallet needs native gas on ${destinationChain} to complete or use the bridged funds.`
        : sourceLikely
          ? `The source wallet does not have enough native gas on ${sourceChain} to approve or submit this bridge transaction.`
          : "The bridge failed because one side of the route does not have enough gas, but the error details did not clearly identify whether it is the source or destination chain.",
      guidance: [
        bothSidesLow
          ? `Fund the source wallet with ${sourceGasToken} on ${sourceChain} and the receiving wallet with ${destinationGasToken} on ${destinationChain} before retrying.`
          : destinationLikely
          ? `Fund the receiving wallet with ${destinationGasToken} on ${destinationChain} before retrying.`
          : sourceLikely
            ? `Fund the source wallet with ${sourceGasToken} on ${sourceChain} before retrying.`
            : `Check gas balances on both ${sourceChain} (${sourceGasToken}) and ${destinationChain} (${destinationGasToken}) before retrying.`,
        "Keep a small extra buffer for approvals, confirmations, and follow-up wallet actions.",
        "Retry after the top-up is confirmed on-chain.",
      ],
      tone: "critical",
      icon: Fuel,
      rawError,
    };
  }

  if (
    includesAny(normalized, [
      "rpc",
      "fetch failed",
      "failed to fetch",
      "network connection error",
      "upstream",
      "503",
      "gateway timeout",
      "service unavailable",
      "timeout",
      "timed out",
      "execution exceeded",
      "connection",
    ])
  ) {
    return {
      category: "Network or RPC issue",
      title: "Bridge service is temporarily unreachable",
      summary: `We could not reliably reach the RPC or bridge infrastructure for ${sourceChain} or ${destinationChain}. The transaction may not have been submitted.`,
      guidance: [
        "Wait a moment and try again once the network stabilizes.",
        "Check whether your wallet still shows a pending transaction before retrying.",
        "If this keeps happening, switch RPC/provider or try again from a more stable connection.",
      ],
      tone: "critical",
      icon: Network,
      rawError,
    };
  }

  if (
    includesAny(normalized, [
      "user rejected",
      "rejected",
      "denied",
      "cancelled",
      "canceled",
    ])
  ) {
    return {
      category: "Wallet action cancelled",
      title: "Bridge approval was not completed",
      summary:
        "The wallet confirmation was closed or rejected before the bridge transaction could be approved.",
      guidance: [
        "Open your wallet and approve the next request when you are ready.",
        "Check that the selected chain, amount, and receiving address are correct before retrying.",
      ],
      tone: "warning",
      icon: Wallet,
      rawError,
    };
  }

  if (
    includesAny(normalized, [
      "insufficient funds",
      "insufficient balance",
      "exceeds balance",
      "not enough balance",
    ])
  ) {
    return {
      category: "Insufficient funds",
      title: "Wallet balance is too low",
      summary: `The source wallet does not have enough funds on ${sourceChain} to cover the bridge amount or the gas needed to submit it.`,
      guidance: [
        "Reduce the bridge amount or fund the wallet with more USDC and native gas.",
        `Make sure the wallet has enough ${sourceChain} gas for approval and bridge submission.`,
      ],
      tone: "warning",
      icon: Wallet,
      rawError,
    };
  }

  if (
    includesAny(normalized, [
      "approval",
      "allowance",
      "permit",
      "erc20",
    ])
  ) {
    return {
      category: "Token approval issue",
      title: "Token approval did not complete",
      summary:
        "The token approval step failed, so the bridge could not access the funds needed for this transfer.",
      guidance: [
        "Check your wallet for a rejected or stuck approval transaction.",
        "Confirm the connected wallet holds the token on the selected source chain.",
        "Retry the bridge once the approval state is clear.",
      ],
      tone: "warning",
      icon: KeyRound,
      rawError,
    };
  }

  if (
    includesAny(normalized, [
      "invalid address",
      "destination address",
      "address format",
    ])
  ) {
    return {
      category: "Invalid destination",
      title: "Receiving address needs attention",
      summary: `The destination wallet address does not match the address format expected for ${destinationChain}.`,
      guidance: [
        `Double-check the destination address for ${destinationChain}.`,
        "If you pasted the address, make sure there are no missing or extra characters.",
      ],
      tone: "warning",
      icon: ShieldAlert,
      rawError,
    };
  }

  if (
    includesAny(normalized, [
      "not supported",
      "unsupported",
      "invalid chain",
      "switch to",
      "source chain",
    ])
  ) {
    return {
      category: "Route or network mismatch",
      title: "Bridge route needs a supported network",
      summary:
        "The selected bridge route or active wallet network does not match a supported bridge configuration.",
      guidance: [
        `Confirm the wallet is connected to ${sourceChain}.`,
        "Choose a supported source and destination chain pair, then retry.",
      ],
      tone: "warning",
      icon: ShieldAlert,
      rawError,
    };
  }

  if (
    includesAny(normalized, [
      "pending",
      "settling",
      "still processing",
      "attestation",
      "mint",
      "burn transaction succeeded",
    ])
  ) {
    return {
      category: "Bridge still in progress",
      title: "Bridge is taking longer than usual",
      summary:
        "The bridge may already be moving through on-chain settlement. This often happens while burn, attestation, or mint steps are still completing.",
      guidance: [
        "Check your wallet and explorer before retrying to avoid duplicate attempts.",
        "Give the bridge a few minutes to finish if a transaction hash already exists.",
      ],
      tone: "warning",
      icon: Clock3,
      rawError,
    };
  }

  return {
    category: "Bridge error",
    title: "Bridge could not be completed",
    summary:
      "Something interrupted the bridge flow before it could finish. The details below should help identify the exact issue.",
    guidance: [
      "Review the technical details below and confirm your wallet state before retrying.",
      "If the wallet shows a pending transaction, let it settle first.",
      "Try again after checking network status, balances, and the destination address.",
    ],
    tone: "critical",
    icon: AlertTriangle,
    rawError,
  };
}
