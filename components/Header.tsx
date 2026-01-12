"use client";
import { Settings, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";

const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const navItems = [
    { name: "Trade", path: "/" },
    { name: "AI Agent", path: "/ai-agent" },
    { name: "Profile", path: "/profile" },
    {
      name: "Bell Points",
      path: "/bell-points",
      badge: "soon",
      disabled: true,
    },
  ];

  const handleNavigation = (path: string, disabled?: boolean) => {
    if (disabled) return;
    router.push(path);
    setMobileMenuOpen(false);
  };

  return (
    <>
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between px-4 sm:px-6 py-4 "
      >
        <div className="flex items-center gap-4 sm:gap-8">
          {/* Logo */}
          <motion.div
            className="flex items-center gap-2 cursor-pointer"
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.2 }}
            onClick={() => router.push("/")}
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
              <Image
                src="/assets/logo.png"
                alt="Tower logo"
                width={40}
                height={40}
                className="object-contain"
              />
            </div>
            <span className="text-lg sm:text-xl font-bold text-foreground">
              TOWER
            </span>
          </motion.div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item, index) => (
              <motion.button
                key={item.name}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: item.disabled ? 1 : 1.05 }}
                whileTap={{ scale: item.disabled ? 1 : 0.95 }}
                onClick={() => handleNavigation(item.path, item.disabled)}
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

          {/* User Button */}
          <motion.button
            className="hidden md:flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => router.push("/profile")}
          >
            <div className="w-5 h-5 rounded-full bg-primary/30 flex items-center justify-center">
              <span className="text-xs text-primary font-bold">
                <Image
                  src="/assets/arc_logo_1-removebg-preview.png"
                  alt="Arc"
                  width={40}
                  height={40}
                  className="object-contain"
                />
              </span>
            </div>
            <span className="text-sm font-medium text-white">Arc</span>
          </motion.button>

          {/* Connect Wallet Button */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="hidden sm:block"
          >
            <Button className="bg-primary hover:opacity-90 rounded-full px-4 sm:px-6 text-sm sm:text-base text-black">
              Connect Wallet
            </Button>
          </motion.div>

          {/* Mobile Connect Button */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="block sm:hidden"
          >
            <Button className="gradient-primary hover:opacity-90 rounded-full px-3 py-2 text-xs">
              Connect
            </Button>
          </motion.div>

          {/* Mobile Menu Button */}
          <motion.button
            className="lg:hidden p-2 rounded-lg hover:bg-secondary transition-colors"
            whileTap={{ scale: 0.9 }}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
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
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="lg:hidden border-b border-border bg-card overflow-hidden"
          >
            <nav className="flex flex-col p-4 gap-2">
              {navItems.map((item, index) => (
                <motion.button
                  key={item.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleNavigation(item.path, item.disabled)}
                  disabled={item.disabled}
                  className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    pathname === item.path
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  } ${item.disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <span className="flex items-center justify-between">
                    {item.name}
                    {item.badge && (
                      <span className="px-2 py-0.5 text-xs bg-muted rounded-full text-muted-foreground">
                        {item.badge}
                      </span>
                    )}
                  </span>
                </motion.button>
              ))}

              {/* Mobile-only items */}
              <div className="pt-2 mt-2 border-t border-border space-y-2">
                <button
                  onClick={() => router.push("/profile")}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors text-sm font-medium"
                >
                  <div className="w-5 h-5 rounded-full bg-primary/30 flex items-center justify-center">
                    <span className="text-xs text-primary font-bold">
                      <Image
                        src="/assets/arc_logo_1-removebg-preview.png"
                        alt="Arc"
                        width={40}
                        height={40}
                        className="object-contain"
                      />
                    </span>
                  </div>
                  <span className="text-white">Arc</span>
                </button>
                <button
                  onClick={() => setSettingsOpen(true)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-secondary transition-colors text-sm font-medium text-muted-foreground"
                >
                  <Settings className="w-5 h-5" />
                  <span>Settings</span>
                </button>
              </div>
            </nav>
          </motion.div>
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
