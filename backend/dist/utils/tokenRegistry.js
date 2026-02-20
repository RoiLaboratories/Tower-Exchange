"use strict";
/**
 * Token Registry for Arc Testnet
 * Maps token addresses to symbols and metadata
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.arcTestnetTokens = void 0;
exports.getTokenByAddress = getTokenByAddress;
exports.getTokenSymbol = getTokenSymbol;
exports.isTokenSupported = isTokenSupported;
exports.getSupportedTokenAddresses = getSupportedTokenAddresses;
exports.getSupportedTokenSymbols = getSupportedTokenSymbols;
// Token address to symbol mapping for Arc Testnet
exports.arcTestnetTokens = {
    // Normalize addresses to lowercase for consistent lookups
    '0x3600000000000000000000000000000000000000': {
        symbol: 'USDC',
        address: '0x3600000000000000000000000000000000000000',
        decimals: 6,
        name: 'USD Coin (Native)',
    },
    '0xd40fcaa5d2ce963c5dabc2bf59e268489ad7bce4': {
        symbol: 'WUSDC',
        address: '0xD40fCAa5d2cE963c5dABC2bf59E268489ad7BcE4',
        decimals: 6,
        name: 'Wrapped USD Coin (QuantumExchange)',
    },
    '0x911b4000d3422f482f4062a913885f7b035382df': {
        symbol: 'WUSDC',
        address: '0x911b4000D3422F482F4062a913885f7b035382Df',
        decimals: 18,
        name: 'Wrapped USD Coin (Synthra)',
    },
    '0xcd304d2a421bfed31d45f0054af8e8a6a4cf3eae': {
        symbol: 'QTM',
        address: '0xCD304d2A421BFEd31d45f0054AF8E8a6a4cF3EaE',
        decimals: 18,
        name: 'Quantum',
    },
    '0x89b50855aa3be2f677cd6303cec089b5f319d72a': {
        symbol: 'EURC',
        address: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a',
        decimals: 6,
        name: 'Euro Coin',
    },
    '0x175cdb1d338945f0d851a741ccf787d343e57952': {
        symbol: 'USDT',
        address: '0x175CdB1D338945f0D851A741ccF787D343E57952',
        decimals: 18,
        name: 'Tether USD',
    },
    '0xc5124c846c6e6307986988dfb7e743327aa05f19': {
        symbol: 'SYN',
        address: '0xC5124C846c6e6307986988dFb7e743327aA05F19',
        decimals: 18,
        name: 'Synthra',
    },
    '0xbe7477bf91526fc9988c8f33e91b6db687119d45': {
        symbol: 'SWPRC',
        address: '0xBE7477BF91526FC9988C8f33e91B6db687119D45',
        decimals: 6,
        name: 'Swaparc Token',
    },
};
/**
 * Get token info by address
 */
function getTokenByAddress(address) {
    const normalized = address.toLowerCase();
    return exports.arcTestnetTokens[normalized];
}
/**
 * Get token symbol by address
 */
function getTokenSymbol(address) {
    return getTokenByAddress(address)?.symbol;
}
/**
 * Check if token is supported
 */
function isTokenSupported(address) {
    return getTokenByAddress(address) !== undefined;
}
/**
 * Get all supported token addresses
 */
function getSupportedTokenAddresses() {
    return Object.keys(exports.arcTestnetTokens);
}
/**
 * Get all supported token symbols
 */
function getSupportedTokenSymbols() {
    return Object.values(exports.arcTestnetTokens).map((token) => token.symbol);
}
//# sourceMappingURL=tokenRegistry.js.map