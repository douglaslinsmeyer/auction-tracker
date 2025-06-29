const winston = require('winston');
const path = require('path');

// Patterns to redact sensitive information
const REDACTION_PATTERNS = [
  // Authentication tokens
  { pattern: /(auth[_-]?token|token|jwt|bearer)[\s:=]*([\w-]+)/gi, replacement: '$1=[REDACTED]' },
  // Cookies
  { pattern: /(cookie|session[_-]?id)[\s:=]*([^;\s]+)/gi, replacement: '$1=[REDACTED]' },
  // Passwords
  { pattern: /(password|passwd|pwd)[\s:=]*([^\s]+)/gi, replacement: '$1=[REDACTED]' },
  // API keys
  { pattern: /(api[_-]?key|apikey)[\s:=]*([\w-]+)/gi, replacement: '$1=[REDACTED]' },
  // Credit card numbers
  { pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, replacement: '[CARD_REDACTED]' },
  // Email addresses (partial redaction)
  { pattern: /\b([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g, 
    replacement: (match, local, domain) => `${local.substring(0, 2)}***@${domain}` },
  // Dollar amounts in logs (for bid privacy)
  { pattern: /\$\d+(\.\d{2})?/g, replacement: '$[AMOUNT]' },
  // Encryption keys
  { pattern: /(encryption[_-]?key|secret[_-]?key)[\s:=]*([\w-]+)/gi, replacement: '$1=[REDACTED]' },
  // URLs with potential auth info
  { pattern: /(https?:\/\/)([^:]+):([^@]+)@/g, replacement: '$1[REDACTED]:[REDACTED]@' }
];

// Custom format that redacts sensitive info
const redactFormat = winston.format.printf(({ level, message, timestamp, ...meta }) => {
  // Redact message
  let safeMessage = message;
  if (typeof safeMessage === 'string') {
    REDACTION_PATTERNS.forEach(({ pattern, replacement }) => {
      safeMessage = safeMessage.replace(pattern, replacement);
    });
  }
  
  // Redact metadata
  let safeMeta = {};
  if (Object.keys(meta).length > 0) {
    safeMeta = JSON.parse(JSON.stringify(meta)); // Deep clone
    redactObject(safeMeta);
  }
  
  const metaStr = Object.keys(safeMeta).length > 0 ? ` ${JSON.stringify(safeMeta)}` : '';
  return `${timestamp} [${level.toUpperCase()}]: ${safeMessage}${metaStr}`;
});

// Recursively redact sensitive data in objects
function redactObject(obj) {
  const sensitiveKeys = [
    'password', 'passwd', 'pwd', 'token', 'auth', 'cookie', 'session',
    'secret', 'key', 'apikey', 'api_key', 'authorization', 'credit_card',
    'card_number', 'cvv', 'ssn', 'amount', 'bid', 'maxBid', 'cookies'
  ];
  
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    
    // Check if key contains sensitive words
    if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
      obj[key] = '[REDACTED]';
      continue;
    }
    
    // Recursively check nested objects
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      redactObject(value);
    } else if (Array.isArray(value)) {
      value.forEach(item => {
        if (item && typeof item === 'object') {
          redactObject(item);
        }
      });
    } else if (typeof value === 'string') {
      // Apply redaction patterns to string values
      let safeValue = value;
      REDACTION_PATTERNS.forEach(({ pattern, replacement }) => {
        safeValue = safeValue.replace(pattern, replacement);
      });
      obj[key] = safeValue;
    }
  }
}

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors ? winston.format.errors({ stack: true }) : winston.format.printf(info => info.message),
    redactFormat
  ),
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize ? winston.format.colorize() : winston.format.printf(info => info.message),
        redactFormat
      )
    }),
    // File transport for errors
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ],
  // Don't exit on handled exceptions
  exitOnError: false
});

// Create log directory if it doesn't exist
const fs = require('fs');
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Helper methods for structured logging
logger.logBidActivity = (action, auctionId, amount, metadata = {}) => {
  logger.info('Bid activity', {
    action,
    auctionId,
    amount: '[REDACTED]', // Always redact bid amounts
    ...metadata
  });
};

logger.logAuthActivity = (action, success, metadata = {}) => {
  logger.info('Authentication activity', {
    action,
    success,
    timestamp: new Date().toISOString(),
    ...metadata
  });
};

logger.logSecurityEvent = (event, severity, metadata = {}) => {
  const logMethod = severity === 'high' ? 'error' : severity === 'medium' ? 'warn' : 'info';
  logger[logMethod]('Security event', {
    event,
    severity,
    timestamp: new Date().toISOString(),
    ...metadata
  });
};

// Override console methods in production
if (process.env.NODE_ENV === 'production') {
  console.log = (...args) => logger.info(args.join(' '));
  console.error = (...args) => logger.error(args.join(' '));
  console.warn = (...args) => logger.warn(args.join(' '));
  console.info = (...args) => logger.info(args.join(' '));
}

module.exports = logger;