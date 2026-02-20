/**
 * Platform Fee Configuration
 * Centralized configuration for platform fees applied to all swap types
 * Update these values to change fees globally across all services
 */

/**
 * Platform fee in basis points (bps)
 * 25 = 0.25%
 * 50 = 0.50%
 * 100 = 1.00%
 * etc.
 */
export const PLATFORM_FEE_BPS = parseInt(process.env.PLATFORM_FEE_BPS || '25', 10);

/**
 * Validate platform fee is within reasonable bounds (0.01% - 10%)
 */
export function validatePlatformFee(bps: number): boolean {
  return bps >= 1 && bps <= 10000; // 0.01% to 100%
}

/**
 * Get platform fee with validation
 */
export function getPlatformFeeBps(): number {
  const fee = PLATFORM_FEE_BPS;
  if (!validatePlatformFee(fee)) {
    console.error(
      `[PlatformFeeConfig] Invalid platform fee: ${fee} bps. Must be between 1-10000.`
    );
    throw new Error(`Invalid platform fee configuration: ${fee}`);
  }
  return fee;
}

/**
 * Get platform fee as a percentage
 * @returns Fee as decimal (e.g., 0.0025 for 0.25%)
 */
export function getPlatformFeeAsDecimal(): number {
  return getPlatformFeeBps() / 10000;
}

/**
 * Get platform fee as a percentage string
 * @returns Fee as string percentage (e.g., "0.25%" for 25 bps)
 */
export function getPlatformFeeAsPercentage(): string {
  const percentage = getPlatformFeeAsDecimal() * 100;
  return `${percentage.toFixed(4)}%`;
}

export const PlatformFeeConfig = {
  basisPoints: getPlatformFeeBps,
  asDecimal: getPlatformFeeAsDecimal,
  asPercentage: getPlatformFeeAsPercentage,
  validate: validatePlatformFee,
};
