"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { ExternalLink } from "lucide-react";

const faucetCards = [
  {
    title: "USDC/EURC",
    description: "Get testnet USDC and EURC tokens",
    icon: (
      <div className="flex items-center justify-center w-12 h-12">
        <Image
          src="/assets/USDC_EURC logo.svg"
          alt="USDC EURC"
          width={48}
          height={48}
          className="object-contain"
        />
      </div>
    ),
    panel: {
      title: "Circle Faucet",
      description:
        "Official Circle faucet for USDC and EURC testnet tokens",
      href: "https://faucet.circle.com/",
    },
  },
  {
    title: "Sepolia ETH",
    description: "Get Sepolia testnet ETH",
    icon: (
      <div className="flex items-center justify-center w-12 h-12">
        <Image
          src="/assets/Sepolia ETH logo Alchemy.svg"
          alt="Sepolia ETH Alchemy"
          width={48}
          height={48}
          className="object-contain"
        />
      </div>
    ),
    panel: {
      title: "Alchemy Faucet",
      description: "Alchemy Sepolia ETH faucet",
      href: "https://www.alchemy.com/faucets/ethereum-sepolia",
    },
  },
  {
    title: "Sepolia ETH",
    description: "Get Sepolia testnet ETH",
    icon: (
      <div className="flex items-center justify-center w-12 h-12">
        <Image
          src="/assets/SepoliaETH logo Relay.svg"
          alt="Sepolia ETH Relay"
          width={48}
          height={48}
          className="object-contain"
        />
      </div>
    ),
    panel: {
      title: "Relay Faucet",
      description: "Relay Sepolia ETH faucet",
      href: "https://testnets.relay.link/",
    },
  },
  {
    title: "Sepolia ETH",
    description: "Get Sepolia testnet ETH",
    icon: (
      <div className="flex items-center justify-center w-12 h-12">
        <Image
          src="/assets/SepoliaETH logo Quick Node.svg"
          alt="Sepolia ETH QuickNode"
          width={48}
          height={48}
          className="object-contain"
        />
      </div>
    ),
    panel: {
      title: "QuickNode Faucet",
      description: "QuickNode Sepolia ETH faucet",
      href: "https://faucet.quicknode.com/ethereum/sepolia",
    },
  },
];

const steps = [
  "Click on any faucet link above to open it in a new tab",
  "Connect your wallet or paste your wallet address",
  "Request tokens and wait for the transaction to complete",
  "Use the tokens to test Tower Exchange features",
];

export default function FaucetPage() {
  return (
    <div className="text-foreground min-h-screen flex-1">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-12"
        >
          <h1
            className="text-3xl sm:text-4xl font-bold text-foreground mb-2"
            style={{ fontFamily: "var(--font-sora)" }}
          >
            Testnet Faucets
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg">
            Get free testnet tokens to interact with Tower Exchange
          </p>
        </motion.div>

        {/* Faucet Cards Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-16"
        >
          {faucetCards.map((card, index) => (
            <motion.article
              key={`${card.title}-${card.panel.title}-${index}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 + index * 0.05 }}
              className="rounded-xl bg-card border border-border p-5 sm:p-6 flex flex-col"
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-lg font-bold text-foreground">
                    {card.title}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {card.description}
                  </p>
                </div>
                {card.icon}
              </div>
              <div className="rounded-lg bg-secondary/80 border border-border p-4 flex-1 flex flex-col">
                <h3 className="text-base font-light text-foreground mb-1">
                  {card.panel.title}
                </h3>
                <p className="text-sm text-muted-foreground mb-4 flex-1">
                  {card.panel.description}
                </p>
                <a
                  href={card.panel.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                >
                  {card.panel.href}
                  <ExternalLink className="w-4 h-4 shrink-0" />
                </a>
              </div>
            </motion.article>
          ))}
        </motion.div>

        {/* How to use faucets */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <h2
            className="text-xl sm:text-2xl font-bold text-foreground mb-6"
            style={{ fontFamily: "var(--font-sora)" }}
          >
            How to use faucets
          </h2>
          <ol className="list-decimal list-inside space-y-3 text-foreground">
            {steps.map((step, index) => (
              <motion.li
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.35 + index * 0.05 }}
                className="text-base"
              >
                {step}
              </motion.li>
            ))}
          </ol>
        </motion.section>
      </main>
    </div>
  );
}
