// ==============================================================================
// Appointly Server — PII-Safe Application Logger
// ==============================================================================
// Reference: System-Level SDS Section 7.2 (NFR-006)
// Strictly redacts passwords, tokens, secrets, and credentials from all logs.
// ==============================================================================

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'password_hash',
  'newpassword',
  'oldpassword',
  'currentpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'access_token',
  'refresh_token',
  'refreshtokenhash',
  'refresh_token_hash',
  'jwtaccesssecret',
  'jwtrefreshsecret',
  'authorization',
  'cookie',
  'cookies',
  'set-cookie',
  'secret',
  'apikey',
  'api_key',
]);

const BEARER_TOKEN_REGEX = /Bearer\s+[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/gi;

/**
 * Deeply redacts sensitive keys and values from arbitrary log payloads.
 */
export function sanitizeLogData(data: unknown, visited = new WeakSet()): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    return data.replace(BEARER_TOKEN_REGEX, 'Bearer [REDACTED]');
  }

  if (typeof data !== 'object') {
    return data;
  }

  if (data instanceof Error) {
    return {
      name: data.name,
      message: data.message.replace(BEARER_TOKEN_REGEX, 'Bearer [REDACTED]'),
      stack: data.stack?.replace(BEARER_TOKEN_REGEX, 'Bearer [REDACTED]'),
    };
  }

  if (data instanceof Date) {
    return data.toISOString();
  }

  if (visited.has(data)) {
    return '[Circular]';
  }
  visited.add(data);

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeLogData(item, visited));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    const normalizedKey = key.toLowerCase().replace(/[-_]/g, '');
    if (SENSITIVE_KEYS.has(normalizedKey)) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = sanitizeLogData(value, visited);
    }
  }

  return sanitized;
}

export const logger = {
  info: (message: string, ...args: unknown[]) => {
    if (process.env.NODE_ENV !== 'test') {
      const sanitized = args.map((arg) => sanitizeLogData(arg));
      console.log(`[INFO] ${new Date().toISOString()} - ${message}`, ...sanitized);
    }
  },

  warn: (message: string, ...args: unknown[]) => {
    if (process.env.NODE_ENV !== 'test') {
      const sanitized = args.map((arg) => sanitizeLogData(arg));
      console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, ...sanitized);
    }
  },

  error: (message: string, ...args: unknown[]) => {
    // Error logs are printed even in test when unexpected
    const sanitized = args.map((arg) => sanitizeLogData(arg));
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, ...sanitized);
  },

  debug: (message: string, ...args: unknown[]) => {
    if (process.env.NODE_ENV === 'development') {
      const sanitized = args.map((arg) => sanitizeLogData(arg));
      console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`, ...sanitized);
    }
  },
};

export default logger;

