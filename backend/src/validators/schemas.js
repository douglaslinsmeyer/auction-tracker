const Joi = require('joi');

// Common patterns
const auctionIdPattern = /^[a-zA-Z0-9_-]+$/;
const strategyTypes = ['auto', 'sniping'];

// Auction configuration schema
const auctionConfigSchema = Joi.object({
  maxBid: Joi.number()
    .positive()
    .max(999999)
    .required()
    .messages({
      'number.base': 'Max bid must be a number',
      'number.positive': 'Max bid must be positive',
      'number.max': 'Max bid cannot exceed $999,999',
      'any.required': 'Max bid is required'
    }),
  strategy: Joi.string()
    .valid(...strategyTypes)
    .required()
    .messages({
      'any.only': `Strategy must be one of: ${strategyTypes.join(', ')}`,
      'any.required': 'Strategy is required'
    }),
  autoBid: Joi.boolean()
    .default(false)
    .messages({
      'boolean.base': 'Auto bid must be true or false'
    }),
  incrementAmount: Joi.number()
    .positive()
    .max(1000)
    .optional()
    .messages({
      'number.positive': 'Increment amount must be positive',
      'number.max': 'Increment amount cannot exceed $1,000'
    }),
  minBidAmount: Joi.number()
    .positive()
    .optional()
    .messages({
      'number.positive': 'Minimum bid amount must be positive'
    }),
  snipeSeconds: Joi.number()
    .integer()
    .min(1)
    .max(60)
    .optional()
    .messages({
      'number.integer': 'Snipe seconds must be a whole number',
      'number.min': 'Snipe seconds must be at least 1',
      'number.max': 'Snipe seconds cannot exceed 60'
    })
});

// Partial config update schema (all fields optional)
const auctionConfigUpdateSchema = auctionConfigSchema.fork(
  ['maxBid', 'strategy'],
  (schema) => schema.optional()
);

// Bid schema
const bidSchema = Joi.object({
  amount: Joi.number()
    .positive()
    .max(999999)
    .required()
    .messages({
      'number.base': 'Bid amount must be a number',
      'number.positive': 'Bid amount must be positive',
      'number.max': 'Bid amount cannot exceed $999,999',
      'any.required': 'Bid amount is required'
    })
});

// Authentication schema
const authSchema = Joi.object({
  cookies: Joi.string()
    .min(10)
    .max(10000)
    .required()
    .messages({
      'string.base': 'Cookies must be a string',
      'string.min': 'Invalid cookies format',
      'string.max': 'Cookies string too long',
      'any.required': 'Cookies are required'
    })
});

// Settings schema
const settingsSchema = Joi.object({
  enableNotifications: Joi.boolean().optional(),
  defaultStrategy: Joi.string().valid(...strategyTypes).optional(),
  defaultMaxBid: Joi.number().positive().max(999999).optional(),
  defaultAutoBid: Joi.boolean().optional(),
  pollingInterval: Joi.number().integer().min(1000).max(60000).optional(),
  rapidPollingInterval: Joi.number().integer().min(500).max(10000).optional(),
  rapidPollingThreshold: Joi.number().integer().min(10).max(300).optional()
}).min(1).messages({
  'object.min': 'At least one setting must be provided'
});

// Auction ID validation
const auctionIdSchema = Joi.string()
  .pattern(auctionIdPattern)
  .min(1)
  .max(100)
  .required()
  .messages({
    'string.pattern.base': 'Invalid auction ID format',
    'string.min': 'Auction ID cannot be empty',
    'string.max': 'Auction ID too long',
    'any.required': 'Auction ID is required'
  });

// Metadata schema for auction monitoring
const metadataSchema = Joi.object({
  source: Joi.string().valid('api', 'extension', 'web').optional(),
  userAgent: Joi.string().max(500).optional(),
  timestamp: Joi.number().integer().optional(),
  title: Joi.string().max(200).optional(),
  url: Joi.string().uri().max(1000).optional(),
  imageUrl: Joi.string().uri().max(1000).allow(null).optional()
}).optional();

// Combined schema for starting monitoring
const startMonitoringSchema = Joi.object({
  config: auctionConfigSchema.required(),
  metadata: metadataSchema
});

module.exports = {
  auctionConfigSchema,
  auctionConfigUpdateSchema,
  bidSchema,
  authSchema,
  settingsSchema,
  auctionIdSchema,
  metadataSchema,
  startMonitoringSchema,
  // Export individual validators
  validateAuctionId: (id) => auctionIdSchema.validate(id),
  validateAuctionConfig: (config) => auctionConfigSchema.validate(config),
  validateAuctionConfigUpdate: (config) => auctionConfigUpdateSchema.validate(config),
  validateBid: (bid) => bidSchema.validate(bid),
  validateAuth: (auth) => authSchema.validate(auth),
  validateSettings: (settings) => settingsSchema.validate(settings),
  validateStartMonitoring: (data) => startMonitoringSchema.validate(data)
};