const helmet = require('helmet');

function getDefaultAllowedOrigins() {
  const configuredOrigins = [
    process.env.API_URL,
    process.env.FRONTEND_URL,
    process.env.ADMIN_URL,
  ].filter(Boolean);

  if (configuredOrigins.length > 0) {
    return [...new Set(configuredOrigins)];
  }

  return ['http://localhost:5000', 'http://localhost:5173'];
}

function getSecurityMiddleware() {
  const isProduction = process.env.NODE_ENV === 'production';
  
  return [
    // Strict Transport Security - Force HTTPS in production
    helmet.hsts({
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    }),
    
    // Content Security Policy - Prevent XSS attacks
    helmet.contentSecurityPolicy({
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"], // Removed 'unsafe-inline'
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    }),
    
    // Prevent browsers from MIME-sniffing
    helmet.noSniff(),
    
    // Prevent clickjacking
    helmet.frameguard({ action: 'deny' }),
    
    // Remove X-Powered-By header
    helmet.hidePoweredBy(),
    
    // Prevent IE from executing downloads
    helmet.ieNoOpen(),
    
    // Prevent DNS prefetching
    helmet.dnsPrefetchControl({ allow: false }),
    
    // Referrer Policy
    helmet.referrerPolicy({ policy: 'strict-origin-when-cross-origin' }),
  ];
}


// CORS configuration with proper security
function getCorsOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);
      const allowedOrigins = process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',').map((value) => value.trim()).filter(Boolean)
        : getDefaultAllowedOrigins();
      if (allowedOrigins.includes(origin) || !isProduction) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Correlation-ID',
      'X-CSRF-Token',
      'X-Currency',
      'Accept-Language',
      'X-Guest-Token',
    ],
    exposedHeaders: ['X-Correlation-ID', 'X-Response-Time'],
    preflightContinue: false,
    maxAge: 86400,
  };
}


// Input sanitization configuration
const sanitizationRules = {
  maxStringLength: 10000,
  maxArrayLength: 1000,
  maxObjectDepth: 10,
};

module.exports = {
  getSecurityMiddleware,
  getCorsOptions,
  sanitizationRules,
};
