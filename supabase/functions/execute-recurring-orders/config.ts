/**
 * Configuration for recurring orders execution
 * 
 * This file contains all configurable parameters for the Edge Function
 * that handles automatic recurring order execution.
 */

export const EXECUTION_CONFIG = {
  // Maximum number of orders to process in a single run
  // Increase for more throughput, decrease to reduce database load
  MAX_ORDERS_PER_RUN: 100,

  // Batch size for parallel execution (if implemented)
  // Set to 1 for sequential execution (safer)
  BATCH_SIZE: 1,

  // Timeout for individual order execution (in milliseconds)
  ORDER_EXECUTION_TIMEOUT: 30000, // 30 seconds

  // Timeout for API calls (in milliseconds)
  API_CALL_TIMEOUT: 10000, // 10 seconds

  // Maximum retry attempts for failed orders
  MAX_RETRIES: 3,

  // Retry delay in milliseconds
  RETRY_DELAY: 5000, // 5 seconds

  // Enable logging (set to false in production for performance)
  ENABLE_LOGGING: true,

  // Log level: 'debug', 'info', 'warn', 'error'
  LOG_LEVEL: 'info',
};

// Cron schedule patterns (if using pg_cron)
export const CRON_SCHEDULES = {
  // Every hour
  HOURLY: '0 * * * *',

  // Every 30 minutes
  HALF_HOURLY: '*/30 * * * *',

  // Every 15 minutes
  FREQUENT: '*/15 * * * *',

  // Every day at midnight UTC
  DAILY: '0 0 * * *',

  // Every 6 hours
  EVERY_6_HOURS: '0 */6 * * *',

  // Every Monday at midnight UTC
  WEEKLY: '0 0 * * 1',

  // First day of month at midnight UTC
  MONTHLY: '0 0 1 * *',
};

// Token configuration for decimals and routing
export const TOKEN_CONFIG = {
  DECIMALS: {
    USDC: 18,
    WUSDC: 6,
    QTM: 18,
    EURC: 6,
    SWPRC: 6,
    USDT: 6,
    UNI: 18,
    HYPE: 18,
    ETH: 18,
  },

  // Tokens supported by QuantumExchange
  SUPPORTED_TOKENS: [
    'USDC',
    'WUSDC',
    'QTM',
    'EURC',
    'SWPRC',
    'USDT',
    'UNI',
    'HYPE',
    'ETH',
  ],
};

// API Configuration
export const API_CONFIG = {
  // QuantumExchange API endpoint for swap quotes
  QUANTUM_EXCHANGE_API: 'https://www.quantumexchange.app/api/v1/quote',

  // Arc RPC endpoint
  ARC_RPC_URL: 'https://rpc.testnet.arc.network',

  // Retry policy for API calls
  RETRY_POLICY: {
    MAX_ATTEMPTS: 3,
    INITIAL_DELAY_MS: 1000,
    BACKOFF_MULTIPLIER: 2,
  },
};

// Database operations configuration
export const DATABASE_CONFIG = {
  // Query timeouts (in milliseconds)
  QUERY_TIMEOUT: 30000,

  // Connection pool size (if applicable)
  POOL_SIZE: 10,

  // Enable transaction for atomic operations
  USE_TRANSACTIONS: true,
};

// Error handling and alerts
export const ERROR_CONFIG = {
  // Send alerts for critical errors
  SEND_ALERTS: true,

  // Alert channel (e.g., Slack, email)
  ALERT_CHANNEL: 'logs', // Change to 'slack' or 'email' for actual alerts

  // Error types that should trigger alerts
  CRITICAL_ERRORS: [
    'NETWORK_ERROR',
    'RPC_ERROR',
    'AUTHENTICATION_ERROR',
    'DATABASE_ERROR',
  ],

  // Max consecutive failures before disabling order
  MAX_CONSECUTIVE_FAILURES: 5,
};

// Monitoring and metrics
export const MONITORING_CONFIG = {
  // Enable metrics collection
  ENABLE_METRICS: true,

  // Log execution summary
  ENABLE_SUMMARY: true,

  // Metrics to track
  TRACKED_METRICS: [
    'total_orders_processed',
    'successful_executions',
    'failed_executions',
    'total_execution_time',
    'average_execution_time',
    'total_volume_swapped',
  ],
};

export default {
  EXECUTION_CONFIG,
  CRON_SCHEDULES,
  TOKEN_CONFIG,
  API_CONFIG,
  DATABASE_CONFIG,
  ERROR_CONFIG,
  MONITORING_CONFIG,
};
