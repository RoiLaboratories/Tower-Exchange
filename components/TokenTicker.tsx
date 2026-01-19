"use client";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useState } from "react";
import { tokens, Token } from "@/mockData/token";
import { ResponsiveContainer, Area, AreaChart } from "recharts";

interface TokenCardProps {
  token: Token;
  onMouseEnter: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave: () => void;
}

interface TokenOverlayProps {
  token: Token;
  position: { x: number; y: number };
}
const TokenCard = ({ token, onMouseEnter, onMouseLeave }: TokenCardProps) => {
  return (
    <motion.div
      className="flex items-center gap-2 px-3 py-1.5 mx-1.5 rounded-full bg-secondary/50 border border-border whitespace-nowrap text-sm"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      whileHover={{
        scale: 1.05,
        backgroundColor: "rgba(59, 130, 246, 0.1)",
      }}
    >
      <div className="shrink-0 w-4 h-4">
        <Image
          src={token.icon}
          alt={`${token.symbol} logo`}
          width={16}
          height={16}
          className="object-contain w-full h-full"
        />
      </div>
      <span className="font-semibold text-foreground">${token.symbol}</span>
      <span className="text-foreground font-medium">{token.price}</span>
      <span
        className={
          token.change.startsWith("+") ? "text-success" : "text-destructive"
        }
      >
        {token.change}
      </span>
    </motion.div>
  );
};

const TokenOverlay = ({ token, position }: TokenOverlayProps) => {
  const change24h = token.change24h || token.change;
  const isPositive = change24h.startsWith("+");

  const chartData =
    token.chartData?.map((value, index) => ({
      index,
      value,
    })) || [];

  const strokeColor = isPositive ? "rgb(34, 197, 94)" : "rgb(239, 68, 68)";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -10 }}
      transition={{ duration: 0.2 }}
      className="fixed z-50 pointer-events-none"
      style={{
        left: position.x,
        top: position.y,
        transform: "translateX(-50%)",
      }}
    >
      <div className="bg-background border border-border rounded-xl p-4 shadow-2xl backdrop-blur-sm w-56">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center border ${
              isPositive
                ? "bg-success/20 border-success/30"
                : "bg-destructive/20 border-destructive/30"
            }`}
          >
            <Image
              src={token.icon}
              alt={`${token.symbol} logo`}
              width={20}
              height={20}
              className="object-contain"
            />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">
              {token.symbol}
            </h3>
            <p
              className={`text-xs ${isPositive ? "text-success" : "text-destructive"}`}
            >
              {change24h} in 24h
            </p>
          </div>
        </div>

        {/* Chart with Recharts */}
        <div
          className={`mb-3 h-20 rounded-lg ${
            isPositive
              ? "bg-success/5 border border-success/10"
              : "bg-destructive/5 border border-destructive/10"
          }`}
        >
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
              >
                <defs>
                  <linearGradient
                    id={`gradient-${token.symbol}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor={strokeColor}
                      stopOpacity={0.4}
                    />
                    <stop
                      offset="100%"
                      stopColor={strokeColor}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={strokeColor}
                  strokeWidth={2}
                  fill={`url(#gradient-${token.symbol})`}
                  fillOpacity={1}
                  dot={false}
                  animationDuration={300}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
              No chart data available
            </div>
          )}
        </div>

        {/* Details */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground text-xs">Price:</span>
            <span className="text-foreground font-semibold text-sm">
              {token.price}
            </span>
          </div>
          {token.marketCap && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-xs">Market Cap:</span>
              <span className="text-foreground font-medium text-xs">
                {token.marketCap}
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const TokenTicker = () => {
  const [isPaused, setIsPaused] = useState(false);
  const [hoveredToken, setHoveredToken] = useState<Token | null>(null);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });

  const handleMouseEnter = (
    token: Token,
    event: React.MouseEvent<HTMLDivElement>,
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setHoverPosition({
      x: rect.left + rect.width / 2,
      y: rect.bottom + 10,
    });
    setHoveredToken(token);
    setIsPaused(true);
  };

  const handleMouseLeave = () => {
    setHoveredToken(null);
    setIsPaused(false);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="relative overflow-hidden py-2 hover:cursor-pointer"
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
            <TokenCard
              key={`${token.symbol}-${index}`}
              token={token}
              onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) =>
                handleMouseEnter(token, e)
              }
              onMouseLeave={handleMouseLeave}
            />
          ))}
        </motion.div>
      </motion.div>

      {/* Hover Overlay */}
      <AnimatePresence>
        {hoveredToken && (
          <TokenOverlay token={hoveredToken} position={hoverPosition} />
        )}
      </AnimatePresence>
    </>
  );
};

export default TokenTicker;
