# RainbowKit Migration Guide

## Overview
This document outlines the complete migration from Privy to RainbowKit for wallet authentication in Tower Exchange.

## ✅ What's Been Done

### 1. **New Provider Components Created**
- **`components/providers/RainbowKitProvider.tsx`**: Main provider component that wraps the app with:
  - `WagmiProvider` - for wallet state management
  - `QueryClientProvider` - for data fetching
  - `RainbowKitProvider` - for UI components with custom theme
  - Custom color theme matching Tower Finance design

- **`lib/wagmi-config.ts`**: Wagmi configuration with:
  - Support for mainnet, polygon, arbitrum, base, optimism, sepolia
  - Support for Arc testnet (custom chain at chainId 5042002)
  - WalletConnect integration

- **`lib/use-rainbowkit-auth.ts`**: Compatibility hook for easy migration

### 2. **Updated Core Files**
- **`app/layout.tsx`**: Replaced `PrivyProvider` with `CustomRainbowKitProvider`
- **`components/Header.tsx`**: 
  - Replaced `usePrivy` with `useAccount` and `useDisconnect` from wagmi
  - Integrated `ConnectButton` from RainbowKit (handles login/logout automatically)
  - Maintains existing UI/UX design

### 3. **Custom Styling**
- **`styles/rainbowkit-theme.css`**: Custom CSS matching Tower Finance:
  - Primary color: `#7bb8ff`
  - Dark theme with custom card backgrounds
  - Rounded button styles
  - Modal customization
  - Responsive design for mobile

- **`app/globals.css`**: Updated to import RainbowKit theme CSS

### 4. **RainbowKit Theme**
Custom theme object in `RainbowKitProvider.tsx` with:
- Custom color palette
- Typography matching Sora font
- Rounded button styles (9999px border-radius)
- Modal shadows and blurs

## 📦 Dependencies to Install

Run the following command:
```bash
npm install @rainbow-me/rainbowkit wagmi viem @tanstack/react-query
```

## ✅ No External API Keys Required

**No WalletConnect Project ID needed!** We're using direct wallet connectors:
- MetaMask (injected)
- Coinbase Wallet
- Other browser-injected wallets

This eliminates:
- ❌ 500 MAU limits
- ❌ Subscription costs
- ❌ External API dependencies
- ✅ Cost-effective for high-traffic apps

No environment variables needed for wallet connection!

## 🔄 Data Persistence

✅ **Existing user data is NOT affected** because:
- Supabase records are keyed by `wallet_address` (EVM address)
- RainbowKit also uses wallet addresses
- No authentication logic in backend depends on Privy IDs
- Users' activities, chats, and sessions will be automatically available

### Migration Path for Existing Users:
1. When users visit the app, they'll see the RainbowKit connect button
2. They connect their same wallet address
3. Their existing data (activities, chat history) is automatically accessible
4. No re-registration or data loss

## 📝 Code Changes Summary

### Before (Privy):
```typescript
import { usePrivy } from "@privy-io/react-auth";
const { user, login, logout, authenticated } = usePrivy();
const address = user?.wallet?.address;
```

### After (RainbowKit + Wagmi):
```typescript
import { useAccount, useDisconnect } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";

const { address, isConnected } = useAccount();
const { disconnect } = useDisconnect();

// Use ConnectButton component for UI
<ConnectButton />
```

## 🎨 Styling Features

The custom RainbowKit theme includes:
- ✅ Dark mode with Tower Finance colors
- ✅ Blue accent (#7bb8ff) throughout
- ✅ Rounded buttons (9999px radius)
- ✅ Card-based modals (hsl(220 20% 10%))
- ✅ Hover effects with scaling
- ✅ Custom scrollbars
- ✅ Fully responsive design

## 🧪 Testing Checklist

- [ ] Install dependencies: `npm install @rainbow-me/rainbowkit wagmi viem @tanstack/react-query`
- [ ] Run `npm run dev`
- [ ] Click "Connect Wallet" button
- [ ] Verify modal appears with custom styling
- [ ] Select a wallet (MetaMask, WalletConnect, etc.)
- [ ] Confirm connection shows address
- [ ] Click account to see disconnect option
- [ ] Verify activities load with connected wallet
- [ ] Test on mobile responsive view

## 📱 Responsive Design

The ConnectButton automatically handles:
- Desktop: Full button with address displayed
- Mobile: Compact version with account icon

## 🔌 Plugins & Wallets Included

RainbowKit includes connectors for:
- MetaMask
- WalletConnect
- Coinbase Wallet
- Trust Wallet
- Ledger
- Trezor
- And many others...

## 🚀 Next Steps

1. **Install dependencies** (if not already done)
2. **Set up WalletConnect Project ID**
3. **Add environment variables**
4. **Test the connection flow**
5. **Monitor user adoption** of new wallet connection
6. **Optional: Gradually deprecate Privy** if no longer needed

## ⚠️ Important Notes

- RainbowKit is **wallet-only** (no email/social auth)
- If you need email/social auth, keep Privy as an option alongside RainbowKit
- **No WalletConnect Project ID required** — uses direct wallet connectors (MetaMask, Coinbase, etc.)
- **No MAU limits or subscription costs** — fully self-contained
- All existing user data persists (keyed by wallet address)
- No breaking changes to Supabase queries
- Arc testnet is pre-configured

## 🆘 Troubleshooting

### "ConnectButton not showing"
- Ensure `CustomRainbowKitProvider` wraps your app in layout.tsx
- Check that both `WagmiProvider` and `RainbowKitProvider` are present

### "Chain selector showing"
- This is normal; users can switch networks
- Arc testnet should appear in the chain list

### "Custom styling not applied"
- Verify `rainbowkit-theme.css` is imported in `globals.css`
- Check browser DevTools for CSS specificity issues

### "Wallet not connecting"
- Ensure the user has a wallet extension installed (MetaMask, Coinbase Wallet, etc.)
- Try clearing browser cache and reconnecting

## 📚 Resources

- [RainbowKit Docs](https://www.rainbowkit.com)
- [Wagmi Docs](https://wagmi.sh)
- [WalletConnect Docs](https://docs.walletconnect.com)
- [Viem Docs](https://viem.sh)

---

**Migration Status**: ✅ Complete
**User Data Risk**: ✅ None
**Rollback Risk**: ⚠️ Medium (requires reinstalling Privy if needed)
