/// <reference types="jest" />

import { SwapMathUtils, TokenUtils, EncodingUtils } from '../utils/helpers';
import { RouteOptimizer } from '../services/RouteOptimizer';
import { DexDiscoveryService } from '../services/DexDiscoveryService';
import { TransactionBuilder } from '../services/TransactionBuilder';
import { ethers } from 'ethers';

describe('SwapMathUtils', () => {
  describe('calculateMinimumOutputAmount', () => {
    it('should calculate minimum output with slippage', () => {
      const expectedAmount = ethers.utils.parseEther('100').toString();
      const slippageBps = 50; // 0.5%

      const result = SwapMathUtils.calculateMinimumOutputAmount(expectedAmount, slippageBps);
      const resultNum = parseFloat(ethers.utils.formatEther(result));
      const expectedNum = 100 * 0.995; // 100 - 0.5%

      expect(Math.abs(resultNum - expectedNum)).toBeLessThan(0.01);
    });

    it('should handle zero slippage', () => {
      const expectedAmount = ethers.utils.parseEther('100').toString();
      const result = SwapMathUtils.calculateMinimumOutputAmount(expectedAmount, 0);

      expect(result).toBe(expectedAmount);
    });

    it('should reject excessive slippage', () => {
      const expectedAmount = ethers.utils.parseEther('100').toString();

      expect(() => {
        SwapMathUtils.calculateMinimumOutputAmount(expectedAmount, 10001);
      }).toThrow();
    });
  });

  describe('calculateAmountOut', () => {
    it('should calculate output amount correctly', () => {
      const amountIn = ethers.utils.parseEther('1').toString();
      const reserveIn = ethers.utils.parseEther('1000').toString();
      const reserveOut = ethers.utils.parseEther('1000').toString();

      const result = SwapMathUtils.calculateAmountOut(amountIn, reserveIn, reserveOut, 25);
      const resultNum = parseFloat(ethers.utils.formatEther(result));

      // Uniswap formula: (1 * 9975/10000) * 1000 / (1000 + 1 * 9975/10000)
      // = 0.9975 * 1000 / 1000.9975 ≈ 0.9965
      expect(resultNum).toBeGreaterThan(0.99);
      expect(resultNum).toBeLessThan(1);
    });

    it('should handle empty reserves', () => {
      const amountIn = ethers.utils.parseEther('1').toString();
      const reserveIn = '0';
      const reserveOut = ethers.utils.parseEther('1000').toString();

      expect(() => {
        SwapMathUtils.calculateAmountOut(amountIn, reserveIn, reserveOut);
      }).toThrow();
    });
  });

  describe('calculateFee', () => {
    it('should calculate fee correctly', () => {
      const amount = ethers.utils.parseEther('1000').toString();
      const feeBps = 25; // 0.25%

      const fee = SwapMathUtils.calculateFee(amount, feeBps);
      const feeNum = parseFloat(ethers.utils.formatEther(fee));

      expect(Math.abs(feeNum - 2.5)).toBeLessThan(0.01); // 0.25% of 1000
    });

    it('should reject excessive fees', () => {
      const amount = ethers.utils.parseEther('1000').toString();

      expect(() => {
        SwapMathUtils.calculateFee(amount, 50); // > 30 bps
      }).toThrow();
    });
  });
});

describe('TokenUtils', () => {
  describe('toWei and fromWei', () => {
    it('should convert between units correctly', () => {
      const amount = '100.5';
      const decimals = 18;

      const wei = TokenUtils.toWei(amount, decimals);
      const back = TokenUtils.fromWei(wei, decimals);

      expect(back).toBe(amount);
    });

    it('should handle different decimal places', () => {
      const amount = '50';
      const decimals = 6; // USDC

      const wei = TokenUtils.toWei(amount, decimals);
      expect(wei).toBe('50000000'); // 50 * 10^6
    });
  });

  describe('calculateMinimumAmount', () => {
    it('should maintain consistency with SwapMathUtils', () => {
      const expectedAmount = ethers.utils.parseEther('100').toString();
      const slippageBps = 50;

      const result = SwapMathUtils.calculateMinimumOutputAmount(expectedAmount, slippageBps);
      const resultNum = parseFloat(ethers.utils.formatEther(result));

      expect(resultNum).toBeCloseTo(99.5, 2);
    });
  });
});

describe('EncodingUtils', () => {
  describe('encodeApprove', () => {
    it('should encode approve call correctly', () => {
      const spender = '0x1111111111111111111111111111111111111111';
      const amount = ethers.constants.MaxUint256.toString();

      const encoded = EncodingUtils.encodeApprove(spender, amount);

      expect(encoded).toMatch(/^0x095ea7b3/); // Function selector for approve
      expect(encoded.length).toBeGreaterThan(10);
    });
  });

  describe('encodeTowerRouterSwap', () => {
    it('should encode swap call correctly', () => {
      const amountIn = ethers.utils.parseEther('1').toString();
      const minAmountOut = ethers.utils.parseEther('0.99').toString();
      const path = [
        '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
      ];
      const to = '0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC';
      const deadline = Math.floor(Date.now() / 1000) + 30 * 60;
      const router = '0xDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD';
      const referrer = '0xEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE';

      const encoded = EncodingUtils.encodeTowerRouterSwap(
        amountIn,
        minAmountOut,
        path,
        to,
        deadline,
        router,
        referrer
      );

      expect(encoded).toMatch(/^0x[0-9a-f]+$/i);
      expect(encoded.length).toBeGreaterThan(100);
    });
  });
});

describe('Integration Tests', () => {
  let provider: ethers.providers.Provider;
  let dexService: DexDiscoveryService;

  beforeAll(() => {
    // Use a mock provider for testing
    provider = ethers.providers.getDefaultProvider('homestead');
    
    // Initialize DexDiscoveryService with mock provider and config
    const arcConfig = {
      chainId: 5042002,
      rpcUrl: 'https://rpc.testnet.arc.network',
      wethAddress: '0x0000000000000000000000000000000000000000',
      towerRouterAddress: '0x1111111111111111111111111111111111111111',
      feeControllerAddress: '0x2222222222222222222222222222222222222222',
      explorerUrl: 'https://testnet.arcscan.app',
      blockTime: 2000,
    };
    dexService = new DexDiscoveryService(provider, arcConfig);
  });

  describe('RouteOptimizer', () => {
    it('should initialize with config', () => {
      const config = {
        maxHops: 5,
        maxSplits: 3,
        minLiquidity: ethers.utils.parseEther('1').toString(),
        slippagePercentage: 50,
        gasPriceMultiplier: 1.2,
        timeLimit: 30000,
      };

      expect(() => {
        new RouteOptimizer(dexService, config);
      }).not.toThrow();
    });
  });

  describe('TransactionBuilder', () => {
    it('should validate transaction correctly', () => {
      const config = {
        chainId: 5042002,
        rpcUrl: 'https://rpc.testnet.arc.network',
        wethAddress: '0x0000000000000000000000000000000000000000',
        towerRouterAddress: '0x1111111111111111111111111111111111111111',
        feeControllerAddress: '0x2222222222222222222222222222222222222222',
        explorerUrl: 'https://testnet.arcscan.app',
        blockTime: 2000,
      };

      const txBuilder = new TransactionBuilder(config, provider);

      const validTx = {
        to: '0x1111111111111111111111111111111111111111',
        data: '0x1234567890',
        value: '0',
        from: '0x3333333333333333333333333333333333333333',
        gasLimit: '500000',
        chainId: 5042002,
      };

      const validation = txBuilder.validateTransaction(validTx);
      expect(validation.valid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });

    it('should reject invalid transactions', () => {
      const config = {
        chainId: 5042002,
        rpcUrl: 'https://rpc.testnet.arc.network',
        wethAddress: '0x0000000000000000000000000000000000000000',
        towerRouterAddress: '0x1111111111111111111111111111111111111111',
        feeControllerAddress: '0x2222222222222222222222222222222222222222',
        explorerUrl: 'https://testnet.arcscan.app',
        blockTime: 2000,
      };

      const txBuilder = new TransactionBuilder(config, provider);

      const invalidTx = {
        to: 'invalid-address',
        data: '0x1234567890',
        value: '0',
        from: '0x3333333333333333333333333333333333333333',
        gasLimit: '500000',
        chainId: 5042002,
      };

      const validation = txBuilder.validateTransaction(invalidTx);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });
});
