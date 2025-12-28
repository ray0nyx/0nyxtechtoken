import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// Plugin to handle CCXT Node.js dependencies
const ccxtPlugin = () => ({
  name: 'ccxt-node-deps',
  resolveId(id: string) {
    // Handle Node.js built-in modules (node: prefix)
    if (id.startsWith('node:')) {
      return { id: `virtual:${id}`, external: true };
    }
    
    // Stub out Node.js dependencies that CCXT tries to import
    const nodeDeps = [
      'http-proxy-agent',
      'https-proxy-agent',
      'socks-proxy-agent',
      'ws',
      'node-fetch',
      'form-data',
      'protobufjs/minimal.js',
      'protobufjs/minimal',
      'protobufjs',
      'starknet/utils/shortString.js',
      'starknet/utils/shortString',
      'ethers/coders/number.js',
      'ethers/coders/number',
      'stream',
      'util',
      'buffer',
      'crypto',
      'events',
      'url',
      'http',
      'https',
      'net',
      'tls',
      'zlib'
    ];
    if (nodeDeps.includes(id) || 
        id.includes('protobufjs') || 
        id.includes('starknet') || 
        id.includes('ethers/coders') ||
        id.includes('ccxt/js/src/static_dependencies')) {
      return { id: `virtual:${id}`, external: true };
    }
    return null;
  },
  load(id: string) {
    // Return empty module for stubbed dependencies
    if (id.startsWith('virtual:')) {
      return 'export default {};';
    }
    return null;
  }
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      '/api/functions/v1': {
        target: 'https://wagyu.supabase.co',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  },
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
    nodePolyfills({
      // Enable polyfills for Node.js built-ins
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      // Polyfill specific modules
      protocolImports: true,
    }),
    ccxtPlugin(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Use polyfills for Node.js built-ins instead of stubs
      'buffer': 'buffer',
      'process': 'process',
      // Stub out Node.js dependencies that CCXT tries to import (these don't have good polyfills)
      'http-proxy-agent': path.resolve(__dirname, './src/lib/stubs/empty-module.js'),
      'https-proxy-agent': path.resolve(__dirname, './src/lib/stubs/empty-module.js'),
      'socks-proxy-agent': path.resolve(__dirname, './src/lib/stubs/empty-module.js'),
      'ws': path.resolve(__dirname, './src/lib/stubs/empty-module.js'),
      'node-fetch': path.resolve(__dirname, './src/lib/stubs/empty-module.js'),
      'form-data': path.resolve(__dirname, './src/lib/stubs/empty-module.js'),
      'protobufjs/minimal.js': path.resolve(__dirname, './src/lib/stubs/empty-module.js'),
      'protobufjs/minimal': path.resolve(__dirname, './src/lib/stubs/empty-module.js'),
      'protobufjs': path.resolve(__dirname, './src/lib/stubs/empty-module.js')
    },
    dedupe: ['ccxt'],
    // Ignore Node.js built-ins and CCXT dependencies that don't work in browser
    conditions: ['import', 'module', 'browser', 'default']
  },
  optimizeDeps: {
    include: ['framer-motion', 'react-router-dom', 'lucide-react'],
    exclude: ['ccxt', 'http-proxy-agent', 'https-proxy-agent', 'socks-proxy-agent', 'ws', 'protobufjs', 'starknet', 'ethers']
  },
  envPrefix: "VITE_",
  define: {
    'process.env': {},
    'process.env.VITE_SUPABASE_URL': JSON.stringify(process.env.VITE_SUPABASE_URL || ''),
    'process.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY || ''),
    global: 'globalThis'
  },
  build: {
    rollupOptions: {
      output: {
        globals: {}
      },
      // Externalize CCXT and its Node.js dependencies - use function to check
      external: (id) => {
        // Externalize all node: prefixed imports
        if (id.startsWith('node:')) {
          return true;
        }
        // Externalize Node.js built-ins that don't have good polyfills
        if (['http-proxy-agent', 'https-proxy-agent', 'socks-proxy-agent', 'ws', 'node-fetch', 'form-data'].includes(id)) {
          return true;
        }
        // Externalize protobufjs and related modules
        if (id.includes('protobufjs') || id.includes('starknet') || id.includes('ethers/coders')) {
          return true;
        }
        // Externalize Node.js built-in modules that don't work in browser (but NOT buffer/process - those use polyfills)
        if (['crypto', 'stream', 'url', 'util', 'events', 'http', 'https', 'net', 'tls', 'zlib', 'fs', 'path', 'os'].includes(id)) {
          return true;
        }
        // Externalize CCXT static dependencies
        if (id.includes('ccxt/js/src/static_dependencies')) {
          return true;
        }
        // Don't externalize buffer/process - they use polyfills
        // Don't externalize anything else
        return false;
      },
      // Suppress warnings for problematic CCXT dependencies
      onwarn(warning, warn) {
        // Suppress warnings for CCXT internal dependencies
        if (
          warning.code === 'UNRESOLVED_IMPORT' ||
          warning.code === 'MISSING_EXPORT' ||
          warning.code === 'THIS_IS_UNDEFINED'
        ) {
          // Suppress all CCXT-related import errors
          if (
            warning.id?.includes('protobufjs') ||
            warning.id?.includes('starknet') ||
            warning.id?.includes('ethers') ||
            warning.id?.includes('shortString') ||
            warning.id?.includes('http-proxy-agent') ||
            warning.id?.includes('https-proxy-agent') ||
            warning.id?.includes('socks-proxy-agent') ||
            warning.id?.includes('ws') ||
            warning.id?.includes('node-fetch') ||
            warning.id?.includes('form-data') ||
            warning.id?.includes('dydx-v4-client') ||
            warning.id?.startsWith('node:') ||
            warning.id?.includes('ccxt/js/src/static_dependencies') ||
            warning.importer?.includes('ccxt')
          ) {
            return;
          }
        }
        warn(warning);
      }
    },
    commonjsOptions: {
      transformMixedEsModules: true,
      include: [/node_modules/],
      exclude: ['ccxt']
    }
  }
}));
