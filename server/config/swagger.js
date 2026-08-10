/**
 * Swagger UI Setup and Configuration
 * 
 * This file configures Swagger UI for interactive API documentation.
 * It provides a user-friendly interface to explore and test the API.
 * 
 * Setup Instructions:
 * 
 * 1. Install dependencies:
 *    npm install swagger-ui-express js-yaml --save
 * 
 * 2. Add to your main server file (e.g., server.js or app.js):
 * 
 *    const setupSwagger = require('./config/swagger');
 *    setupSwagger(app);
 * 
 * 3. Access documentation at:
 *    http://localhost:5000/api-docs
 */

const swaggerUi = require('swagger-ui-express');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

/**
 * Setup Swagger UI middleware
 * @param {Express} app - Express application instance
 */
function setupSwagger(app) {
  try {
    // Load the Swagger YAML file
    const swaggerPath = path.join(__dirname, '..', 'swagger.yml');
    const swaggerDocument = yaml.load(fs.readFileSync(swaggerPath, 'utf8'));

    // Swagger UI options
    const options = {
      explorer: true,
      swaggerOptions: {
        persistAuthorization: true, // Keep authorization between page refreshes
        displayRequestDuration: true, // Show request duration
        filter: true, // Enable search/filter
        syntaxHighlight: {
          activate: true,
          theme: 'monokai'
        },
        tryItOutEnabled: true, // Enable "Try it out" by default
        requestSnippetsEnabled: true, // Show code snippets
        defaultModelsExpandDepth: 3, // Expand models by default
        defaultModelExpandDepth: 3,
        docExpansion: 'list', // 'list', 'full', or 'none'
        operationsSorter: 'alpha', // Sort operations alphabetically
        tagsSorter: 'alpha' // Sort tags alphabetically
      },
      customCss: `
        .swagger-ui .topbar { display: none }
        .swagger-ui .info { margin: 20px 0 }
        .swagger-ui .scheme-container { margin: 0; padding: 0; background: #fafafa }
      `,
      customSiteTitle: "E-Commerce API Documentation",
      customfavIcon: "/assets/favicon.ico"
    };

    // Serve Swagger UI
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, options));

    // Serve raw swagger.yml
    app.get('/swagger.yml', (req, res) => {
      res.sendFile(swaggerPath);
    });

    // Serve swagger as JSON
    app.get('/swagger.json', (req, res) => {
      res.json(swaggerDocument);
    });

    console.log('[OK] Swagger UI configured successfully');
    console.log('  → Documentation: http://localhost:5000/api-docs');
    console.log('  → Swagger YAML: http://localhost:5000/swagger.yml');
    console.log('  → Swagger JSON: http://localhost:5000/swagger.json');

  } catch (error) {
    console.error('[FAILED] Failed to setup Swagger UI:', error.message);
    console.log('  Note: Install required packages with:');
    console.log('  npm install swagger-ui-express js-yaml --save');
  }
}

/**
 * Alternative: Redoc Setup (Optional)
 * 
 * Redoc provides a modern, three-panel documentation interface.
 * 
 * Installation:
 *   npm install redoc-express --save
 * 
 * Usage:
 *   const setupRedoc = require('./config/swagger').setupRedoc;
 *   setupRedoc(app);
 * 
 * Access at: http://localhost:5000/docs
 */
function setupRedoc(app) {
  try {
    const redoc = require('redoc-express');
    const path = require('path');

    app.get('/docs', redoc({
      title: 'E-Commerce API Documentation',
      specUrl: '/swagger.yml',
      redocOptions: {
        theme: {
          colors: {
            primary: {
              main: '#3b82f6'
            }
          },
          typography: {
            fontSize: '15px',
            fontFamily: '"Inter", sans-serif',
            headings: {
              fontFamily: '"Inter", sans-serif'
            }
          }
        },
        hideDownloadButton: false,
        expandResponses: '200,201',
        requiredPropsFirst: true,
        sortPropsAlphabetically: true,
        noAutoAuth: false,
        pathInMiddlePanel: true,
        hideHostname: false,
        expandDefaultServerVariables: true,
        maxDisplayedEnumValues: 5
      }
    }));

    console.log('[OK] Redoc configured successfully');
    console.log('  → Documentation: http://localhost:5000/docs');

  } catch (error) {
    console.error('[FAILED] Failed to setup Redoc:', error.message);
    console.log('  Note: Install with: npm install redoc-express --save');
  }
}

/**
 * Setup multiple documentation viewers
 * @param {Express} app - Express application instance
 */
function setupAllDocs(app) {
  setupSwagger(app);
  setupRedoc(app);
}

module.exports = setupSwagger;
module.exports.setupRedoc = setupRedoc;
module.exports.setupAllDocs = setupAllDocs;
