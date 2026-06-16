"use client";
import { Settings, Menu, X, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { HeaderWalletAvatar } from "@/components/wallet/TowerWalletAvatar";

interface WalletConnectButtonProps {
  compact?: boolean;
}

const WalletConnectButton = ({
  compact = false,
}: WalletConnectButtonProps) => {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        mounted,
        openAccountModal,
        openChainModal,
        openConnectModal,
      }) => {
        if (!mounted) {
          return (
            <div
              aria-hidden="true"
              className={compact ? "h-10 w-12 opacity-0" : "h-10 w-44 opacity-0"}
            />
          );
        }

        if (!account || !chain) {
          return (
            <button
              type="button"
              onClick={openConnectModal}
              className={`inline-flex items-center justify-center rounded-full border border-primary bg-primary font-semibold text-background transition-all hover:opacity-90 ${
                compact
                  ? "px-3 py-2 text-xs"
                  : "px-4 py-2 text-sm shadow-[0_4px_12px_rgba(123,184,255,0.18)]"
              }`}
            >
              {compact ? "Connect" : "Connect Wallet"}
            </button>
          );
        }

        if (chain.unsupported) {
          return (
            <button
              type="button"
              onClick={openChainModal}
              className={`inline-flex items-center justify-center rounded-full border border-destructive/40 bg-destructive/10 font-semibold text-destructive transition-colors hover:bg-destructive/15 ${
                compact ? "px-3 py-2 text-xs" : "px-4 py-2 text-sm"
              }`}
            >
              Wrong network
            </button>
          );
        }

        if (compact) {
          return (
            <button
              type="button"
              onClick={openAccountModal}
              data-tower-wallet-button="true"
              className="group inline-flex items-center gap-2 rounded-full border border-primary/70 bg-primary px-2.5 py-2 text-background shadow-[0_8px_24px_rgba(123,184,255,0.22)] transition-opacity hover:opacity-90"
            >
              <HeaderWalletAvatar
                address={account.address}
                ensImage={account.ensAvatar}
              />
              <ChevronDown className="h-4 w-4 text-background/70 transition-colors group-hover:text-background" />
              <span className="sr-only">Open wallet menu</span>
            </button>
          );
        }

        return (
          <button
            type="button"
            onClick={openAccountModal}
            data-tower-wallet-button="true"
            className="group inline-flex items-center overflow-hidden rounded-full border border-primary/70 bg-primary text-background shadow-[0_12px_30px_rgba(123,184,255,0.24)] transition-opacity hover:opacity-90"
          >
            <span className="flex items-center gap-2 px-3 py-2 text-sm font-semibold">
              <HeaderWalletAvatar
                address={account.address}
                ensImage={account.ensAvatar}
              />
              <span className="text-background">{account.displayName}</span>
              <ChevronDown className="h-4 w-4 text-background/70 transition-colors group-hover:text-background" />
            </span>
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
};

const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileTradeDropdownOpen, setMobileTradeDropdownOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [arcDropdownOpen, setArcDropdownOpen] = useState(false);
  const [tradeDropdownOpen, setTradeDropdownOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const tradeOptions = [
    { name: "Swap", path: "/" },
    { name: "Bridge", path: "/bridge" },
  ];

  const navItems = [
    { name: "Trade", path: null, dropdown: true }, // Trade is now a dropdown
    { name: "Tower AI", path: "/ai-agent" },
    { name: "Profile", path: "/profile" },
    { name: "Recurring Orders", path: "/recurring-orders" },
    { name: "Faucet", path: "/faucet" },
    {
      name: "Bell Points",
      path: "/bell-point",
      badge: "soon",
      disabled: true,
    },
  ];

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;

    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [mobileMenuOpen]);

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
    setMobileTradeDropdownOpen(false);
    setTradeDropdownOpen(false);
  };

  const handleNavigation = (path: string, disabled?: boolean) => {
    if (disabled) return;
    router.push(path);
    closeMobileMenu();
  };

  return (
    <>
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-6 py-4 bg-background border-b border-border"
      >
        <div className="flex items-center gap-4 sm:gap-8">
          {/* Logo */}
          <motion.div
            className="flex items-center justify-center cursor-pointer mr-4 ml-8"
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.2 }}
            onClick={() => router.push("/")}
          >
            <div className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center">
              <Image
                src="/assets/towerlogo.svg"
                alt="Tower logo"
                width={256}
                height={256}
                className="object-contain scale-250"
              />
            </div>
          </motion.div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item, index) => (
              <div key={item.name}>
                {item.dropdown ? (
                  // Trade Dropdown
                  <div className="relative group">
                    <motion.button
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setTradeDropdownOpen(!tradeDropdownOpen)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-1 ${
                        tradeDropdownOpen || pathname === "/" || pathname === "/bridge"
                          ? "bg-primary/20 text-primary"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {item.name}
                      <ChevronDown
                        className={`w-4 h-4 transition-transform ${
                          tradeDropdownOpen ? "rotate-180" : ""
                        }`}
                      />
                    </motion.button>

                    {/* Trade Dropdown Menu */}
                    <AnimatePresence>
                      {tradeDropdownOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-30"
                            onClick={() => setTradeDropdownOpen(false)}
                          />
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            className="absolute left-0 mt-2 w-40 bg-card rounded-lg shadow-xl z-40 overflow-hidden border border-border"
                          >
                            <div className="p-2">
                              {tradeOptions.map((option) => (
                                <button
                                  key={option.name}
                                  className={`w-full text-left px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
                                    pathname === option.path
                                      ? "bg-primary/20 text-primary"
                                      : "text-foreground hover:bg-secondary"
                                  }`}
                                  onClick={() => {
                                    router.push(option.path);
                                    setTradeDropdownOpen(false);
                                  }}
                                >
                                  {option.name}
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  // Regular nav items
                  <motion.button
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ scale: item.disabled ? 1 : 1.05 }}
                    whileTap={{ scale: item.disabled ? 1 : 0.95 }}
                    onClick={() => handleNavigation(item.path as string, item.disabled)}
                    disabled={item.disabled}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      pathname === item.path
                        ? "bg-primary/20 text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    } ${
                      item.disabled
                        ? "opacity-50 cursor-not-allowed"
                        : "cursor-pointer"
                    }`}
                  >
                    {item.name}
                    {item.badge && (
                      <span className="ml-2 px-2 py-0.5 text-xs bg-muted rounded-full text-muted-foreground">
                        {item.badge}
                      </span>
                    )}
                  </motion.button>
                )}
              </div>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Settings Button */}
          <motion.button
            className="hidden sm:block p-2 rounded-lg hover:bg-secondary transition-colors"
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setSettingsOpen(true)}
          >
            <Settings className="w-5 h-5 text-muted-foreground" />
          </motion.button>

          {/* Arc Button - Mobile Only (no dropdown) */}
          <motion.button
            className="md:hidden flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="w-5 h-5 rounded-full bg-primary/30 flex items-center justify-center">
              <Image
                src="/assets/arclogo.svg"
                alt="Arc"
                width={40}
                height={40}
                className="object-contain"
              />
            </div>
            <span className="text-xs font-medium text-white">Arc</span>
          </motion.button>

          {/* Arc Dropdown Button - Desktop Only */}
          <div className="hidden md:block relative">
            <motion.button
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setArcDropdownOpen(!arcDropdownOpen)}
            >
              <div className="w-5 h-5 rounded-full bg-primary/30 flex items-center justify-center">
                <Image
                  src="/assets/arclogo.svg"
                  alt="Arc"
                  width={40}
                  height={40}
                  className="object-contain"
                />
              </div>
              <span className="text-sm font-medium text-white">Arc</span>
              <ChevronDown
                className={`w-4 h-4 text-muted-foreground transition-transform ${
                  arcDropdownOpen ? "rotate-180" : ""
                }`}
              />
            </motion.button>

            {/* Arc Dropdown Menu */}
            <AnimatePresence>
              {arcDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setArcDropdownOpen(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute right-0 mt-2 w-48 bg-card rounded-lg shadow-xl z-40 overflow-hidden border border-border"
                  >
                    <div className="p-2">
                      <button
                        className="w-full text-left px-4 py-2 rounded-lg hover:bg-secondary transition-colors text-sm font-medium text-foreground"
                        onClick={() => {
                          setArcDropdownOpen(false);
                        }}
                      >
                        Arc
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Connect Wallet Button - Desktop */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="hidden sm:block"
          >
            <WalletConnectButton />
          </motion.div>

          {/* Mobile Connect Button */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="block sm:hidden"
          >
            <WalletConnectButton compact />
          </motion.div>

          {/* Mobile Menu Button */}
          <motion.button
            className="lg:hidden p-2 rounded-lg hover:bg-secondary transition-colors"
            whileTap={{ scale: 0.9 }}
            onClick={() =>
              setMobileMenuOpen((open) => {
                const nextOpen = !open;

                if (!nextOpen) {
                  setMobileTradeDropdownOpen(false);
                }

                return nextOpen;
              })
            }
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? "Close mobile menu" : "Open mobile menu"}
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5 text-foreground" />
            ) : (
              <Menu className="w-5 h-5 text-foreground" />
            )}
          </motion.button>
        </div>
      </motion.header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[60] bg-black/50 lg:hidden"
              onClick={closeMobileMenu}
            />

            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-xs flex-col border-l border-border bg-card px-4 pb-6 pt-20 shadow-2xl lg:hidden"
            >
              <div className="mb-5 flex items-center justify-between">
                <span className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Menu
                </span>
                <button
                  type="button"
                  onClick={closeMobileMenu}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-foreground transition-colors hover:bg-secondary/80"
                  aria-label="Close mobile menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <nav className="flex flex-col gap-2">
                {navItems.map((item, index) => (
                  <div key={item.name}>
                    {item.dropdown ? (
                      <>
                        <motion.button
                          initial={{ opacity: 0, x: 24 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 24 }}
                          transition={{ delay: index * 0.04 }}
                          onClick={() =>
                            setMobileTradeDropdownOpen((open) => !open)
                          }
                          className={`w-full rounded-2xl px-4 py-3 text-left text-sm font-medium transition-colors ${
                            mobileTradeDropdownOpen ||
                            pathname === "/" ||
                            pathname === "/bridge"
                              ? "bg-primary/20 text-primary"
                              : "text-foreground hover:bg-secondary"
                          }`}
                        >
                          <span className="flex items-center justify-between gap-3">
                            <span>{item.name}</span>
                            <ChevronDown
                              className={`h-4 w-4 transition-transform ${
                                mobileTradeDropdownOpen ? "rotate-180" : ""
                              }`}
                            />
                          </span>
                        </motion.button>

                        <AnimatePresence initial={false}>
                          {mobileTradeDropdownOpen && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-2 flex flex-col gap-2 pl-3">
                                {tradeOptions.map((option, optionIndex) => (
                                  <motion.button
                                    key={option.name}
                                    initial={{ opacity: 0, x: 16 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 16 }}
                                    transition={{
                                      delay: optionIndex * 0.04,
                                    }}
                                    onClick={() => handleNavigation(option.path)}
                                    className={`w-full rounded-2xl px-4 py-3 text-left text-sm font-medium transition-colors ${
                                      pathname === option.path
                                        ? "bg-primary/20 text-primary"
                                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                                    }`}
                                  >
                                    {option.name}
                                  </motion.button>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </>
                    ) : (
                      <motion.button
                        initial={{ opacity: 0, x: 24 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 24 }}
                        transition={{ delay: index * 0.04 }}
                        onClick={() => handleNavigation(item.path as string, item.disabled)}
                        disabled={item.disabled}
                        className={`w-full rounded-2xl px-4 py-3 text-left text-sm font-medium transition-colors ${
                          pathname === item.path
                            ? "bg-primary/20 text-primary"
                            : "text-foreground hover:bg-secondary"
                        } ${item.disabled ? "cursor-not-allowed opacity-50" : ""}`}
                      >
                        <span className="flex items-center justify-between gap-3">
                          <span>{item.name}</span>
                          {item.badge && (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              {item.badge}
                            </span>
                          )}
                        </span>
                      </motion.button>
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => {
                    setSettingsOpen(true);
                    closeMobileMenu();
                  }}
                  className="mt-2 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  <Settings className="h-5 w-5 text-muted-foreground" />
                  <span>Settings</span>
                </button>
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {settingsOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSettingsOpen(false)}
              className="fixed inset-0 bg-black/50 z-40"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="fixed top-20 right-4 w-80 bg-card rounded-2xl shadow-xl z-50 overflow-hidden border border-border"
            >
              <div className="p-6">
                <h2 className="text-xl font-bold text-foreground mb-6">
                  Settings
                </h2>

                <div className="space-y-4">
                  {/* Theme Setting */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">
                      Theme
                    </span>
                    <span className="px-3 py-1 text-xs bg-muted rounded-full text-muted-foreground">
                      soon
                    </span>
                  </div>

                  {/* Preferred Explorer */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">
                      Preferred Explorer
                    </span>
                    <span className="text-sm text-muted-foreground">
                      Arcscan
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default Header;
