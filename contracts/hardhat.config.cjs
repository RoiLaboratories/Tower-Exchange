require("@nomicfoundation/hardhat-toolbox");
require("dotenv/config");

const config = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    "arc-testnet": {
      url: process.env.ARC_TESTNET_RPC_URL || 'https://rpc.testnet.arc.network',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 5042002,
      timeout: 60000,
    },
    hardhat: {
      forking: {
        enabled: process.env.FORKING === "true",
        url: process.env.ARC_TESTNET_RPC_URL || "https://rpc.testnet.arc.network",
      },
    },
  },
  etherscan: {
    apiKey: {
      "arc-testnet": "empty"
    },
    customChains: [
      {
        network: "arc-testnet",
        chainId: 5042002,
        urls: {
          apiURL: "https://testnet.arcscan.app/api",
          browserURL: "https://testnet.arcscan.app"
        }
      }
    ]
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

module.exports = config;
