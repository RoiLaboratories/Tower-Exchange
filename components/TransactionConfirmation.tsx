"use client";

import { motion } from "framer-motion";
import { CheckCircle, Loader, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";

interface TransactionConfirmationProps {
  status: "idle" | "signing" | "broadcasting" | "confirming" | "confirmed" | "error";
  statusMessage?: string;
  transactionHash?: string;
  blockNumber?: number;
  error?: string | null;
  onClose?: () => void;
  title?: string;
  errorLayout?: "inline" | "stacked";
}

export const TransactionConfirmation: React.FC<TransactionConfirmationProps> = ({
  status,
  statusMessage,
  transactionHash,
  blockNumber,
  error,
  onClose,
  title,
  errorLayout = "inline",
}) => {
  const [copied, setCopied] = useState(false);
  const showInlineError =
    status === "error" && Boolean(error) && errorLayout === "inline";
  const showStackedError =
    status === "error" && Boolean(error) && errorLayout === "stacked";

  const handleCopyHash = () => {
    if (transactionHash) {
      navigator.clipboard.writeText(transactionHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case "signing":
      case "broadcasting":
      case "confirming":
        return (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Loader size={24} className="text-blue-500" />
          </motion.div>
        );
      case "confirmed":
        return <CheckCircle size={24} className="text-green-500" />;
      case "error":
        return null;
      default:
        return null;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case "signing":
      case "broadcasting":
      case "confirming":
        return "border-blue-500/50 bg-blue-500/5";
      case "confirmed":
        return "border-green-500/50 bg-green-500/5";
      case "error":
        return "border-red-500/50 bg-red-500/5";
      default:
        return "border-gray-500/50 bg-gray-500/5";
    }
  };

  const getStatusText = () => {
    switch (status) {
      case "signing":
        return "Signing Transaction";
      case "broadcasting":
        return "Broadcasting Transaction";
      case "confirming":
        return "Confirming on Blockchain";
      case "confirmed":
        return "Swap Confirmed";
      case "error":
        return "Transaction Failed";
      default:
        return "Processing";
    }
  };

  const statusTitle = title ?? getStatusText();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-lg border ${showInlineError ? "px-3 py-3 sm:p-4" : "p-4"} ${getStatusColor()}`}
    >
      <div className={showInlineError || showStackedError ? "block" : "flex items-start gap-3"}>
        {!showInlineError && (
          <div className="mt-1 shrink-0">{getStatusIcon()}</div>
        )}

        <div className="min-w-0 flex-1">
          {showInlineError ? (
            <p className="text-left text-sm leading-5 text-red-400">
              {error}
            </p>
          ) : (
            <>
              <h3 className="mb-1 font-semibold text-white">{statusTitle}</h3>
              {showStackedError ? (
                <p className="text-sm text-red-400">{error}</p>
              ) : statusMessage && (
                <p className="mb-3 text-sm text-gray-300">{statusMessage}</p>
              )}
            </>
          )}

          {transactionHash && (
            <div className="mb-3 p-2 rounded bg-black/30 font-mono text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-400">TX Hash:</span>
                <div className="flex items-center gap-2">
                  <span className="text-gray-300 truncate">
                    {transactionHash.slice(0, 10)}...
                    {transactionHash.slice(-10)}
                  </span>
                  <button
                    onClick={handleCopyHash}
                    className="p-1 hover:bg-white/10 rounded transition-colors"
                    title="Copy full hash"
                  >
                    <Copy size={14} />
                  </button>
                  <a
                    href={`https://testnet.arcscan.app/tx/${transactionHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 hover:bg-white/10 rounded transition-colors"
                    title="View on Arcscan Testnet"
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>
              </div>
              {copied && (
                <p className="text-xs text-green-400 mt-1">Copied to clipboard!</p>
              )}
            </div>
          )}

          {blockNumber && status === "confirmed" && (
            <p className="text-xs text-gray-400">Block: {blockNumber}</p>
          )}

          {error && !showInlineError && !showStackedError && (
            <p className="text-sm text-red-400 mt-2">{error}</p>
          )}

          {status === "confirmed" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-3 flex gap-2"
            >
              {onClose && (
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 rounded text-sm bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                >
                  Close
                </button>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
