"use client";
import { FaXTwitter } from "react-icons/fa6";
import { FaTelegram, FaDiscord } from "react-icons/fa";
import { motion } from "framer-motion";

const Footer = () => {
  const socialLinks = [
    {
      icon: <FaXTwitter className="w-5 h-5" />,
      href: "https://x.com/",
    },
    {
      icon: <FaTelegram className="w-5 h-5" />,
      href: "https://web.telegram.org/",
    },
    {
      icon: <FaDiscord className="w-5 h-5" />,
      href: "https://discord.com/",
    },
  ];

  return (
    <motion.footer
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="flex items-center justify-between px-6 py-6 border-t border-border mt-auto bg-[#0C0C0D]"
    >
      <p className="text-sm text-muted-foreground">
        Tower Exchange • Copyright 2026
      </p>
      <div className="flex items-center gap-4">
        {socialLinks.map((link, index) => (
          <motion.a
            key={index}
            href={link.href}
            className="text-muted-foreground hover:text-foreground transition-colors"
            whileHover={{ scale: 1.2, y: -2 }}
            whileTap={{ scale: 0.9 }}
          >
            {link.icon}
          </motion.a>
        ))}
      </div>
    </motion.footer>
  );
};

export default Footer;
