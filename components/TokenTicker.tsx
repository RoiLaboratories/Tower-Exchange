"use client";
import { motion } from "framer-motion";
import Image from "next/image";
import { useState } from "react";
import { tokens } from "@/mockData/token";

const TokenTicker = () => {
  const [isPaused, setIsPaused] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="relative overflow-hidden py-3 hover:cursor-pointer"
      style={{
        maskImage:
          "linear-gradient(to right, transparent, black 5%, black 95%, transparent)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent, black 5%, black 95%, transparent)",
      }}
    >
      <motion.div
        className="flex"
        animate={{ x: isPaused ? undefined : [0, -1000] }}
        transition={{
          x: {
            repeat: Infinity,
            repeatType: "loop",
            duration: 20,
            ease: "linear",
          },
        }}
      >
        {[...tokens, ...tokens, ...tokens].map((token, index) => (
          <motion.div
            key={index}
            className="flex items-center gap-3 px-6 py-2.5 mx-2 rounded-full bg-secondary/50 border border-border whitespace-nowrap"
            onHoverStart={() => setIsPaused(true)}
            onHoverEnd={() => setIsPaused(false)}
            whileHover={{
              scale: 1.05,
              backgroundColor: "rgba(59, 130, 246, 0.1)",
            }}
          >
            <div className="shrink-0 w-5 h-5">
              <Image
                src={token.icon}
                alt={`${token.symbol} logo`}
                width={20}
                height={20}
                className="object-contain w-full h-full"
              />
            </div>
            <span className="font-semibold text-foreground">
              ${token.symbol}
            </span>
            <span className="text-foreground font-medium">{token.price}</span>
            <span
              className={
                token.change.startsWith("+")
                  ? "text-success"
                  : "text-muted-foreground"
              }
            >
              {token.change}
            </span>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
};

export default TokenTicker;
