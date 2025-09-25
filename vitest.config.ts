import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Run tests in the main thread to avoid multiple VM contexts which
    // can cause constructor identity and global object mismatch issues
    // (e.g. react-dom instanceof checks failing). Disabling threads
    // makes the test environment more deterministic.
     isolate: false,
     // Reduce test isolation so tests run in a shared environment where
     // globals like window/navigator remain identical. This helps avoid
     // constructor identity mismatches with react-dom's instanceof checks.
  },
  resolve: {
    alias: {
      '@': './src',
      '@types': './src/types',
    },
  },
});