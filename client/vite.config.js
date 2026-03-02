import path from 'path';
import process from 'node:process';
import { fileURLToPath } from 'url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import compression from 'vite-plugin-compression';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [
    react({
      // Automatic JSX runtime optimization
      jsxImportSource: 'react',
      babel: {
        plugins: [
          ['@babel/plugin-transform-runtime', { useESModules: true }],
        ],
      },
    }),
    // ✅ Gzip compression for production
    compression({
      filter: /\.(js|css|json|svg|wasm)$/i,
      disable: process.env.NODE_ENV === 'development',
      exclude: ['node_modules/**'],
    }),
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // ✅ Optimize module resolution
    extensions: ['.js', '.jsx', '.json', '.mjs'],
  },

  server: {
    port: 5173,
    // ✅ Preload modules for faster dev startup
    middlewareMode: false,
    // ✅ Enable HTTP/2
    middlewareMode: false,
    // ✅ Optimize for faster HMR
    hmr: {
      host: 'localhost',
      protocol: 'ws',
    },
    proxy: {
      "/api": {
        target: process.env.VITE_API_URL || "http://localhost:5000",
        changeOrigin: true,
        rewrite: (path) => path,
      },
    },
  },

  build: {
    // ✅ Optimize build output
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production',
        drop_debugger: true,
      },
      format: {
        comments: false, // Remove comments for smaller bundle
      },
    },
    
    // ✅ Source maps only in production for debugging
    sourcemap: process.env.NODE_ENV === 'production' ? 'hidden' : true,
    
    // ✅ Optimize chunk sizes
    rollupOptions: {
      output: {
        // ✅ Code splitting strategy for optimal bundle size
        manualChunks: (id) => {
          // Core React dependencies
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react-vendor';
          }
          
          // Redux state management
          if (id.includes('node_modules/@reduxjs') || id.includes('node_modules/react-redux')) {
            return 'redux-vendor';
          }

          // Router
          if (id.includes('node_modules/react-router')) {
            return 'router-vendor';
          }

          // UI utilities (Axios, date-fns, classnames)
          if (id.includes('node_modules/axios') || 
              id.includes('node_modules/date-fns') ||
              id.includes('node_modules/clsx')) {
            return 'utils-vendor';
          }

          // Feature code
          if (id.includes('src/features')) {
            return 'features';
          }

          // Shared component code
          if (id.includes('src/components')) {
            return 'components';
          }

          // Hooks
          if (id.includes('src/hooks')) {
            return 'hooks';
          }
        },

        // ✅ Hash filenames for better caching
        entryFileNames: 'js/[name].[hash].js',
        chunkFileNames: 'js/[name].[hash].chunk.js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/png|jpe?g|gif|svg|webp/.test(ext)) {
            return `images/[name].[hash][extname]`;
          } else if (/woff|woff2|eot|ttf|otf/.test(ext)) {
            return `fonts/[name].[hash][extname]`;
          } else if (ext === 'css') {
            return `css/[name].[hash][extname]`;
          }
          return `assets/[name].[hash][extname]`;
        },
      },
    },

    // ✅ Increase chunk size warning threshold
    chunkSizeWarningLimit: 600,

    // ✅ Optimize library output
    lib: undefined, // Not a library build
    
    // ✅ Report compressed size
    reportCompressedSize: true,

    // ✅ Target modern browsers for smaller output
    target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari13.1'],

    // ✅ Faster build with less overhead
    commonjsOptions: {
      include: /node_modules/,
      sourceMap: true,
    },
  },

  // ✅ Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@reduxjs/toolkit',
      'react-redux',
      'axios',
    ],
    exclude: [
      'node_modules/.vite',
    ],
  },

  // ✅ CSS processing
  css: {
    postcss: './postcss.config.js',
    modules: {
      localsConvention: 'camelCaseOnly',
    },
  },
});
