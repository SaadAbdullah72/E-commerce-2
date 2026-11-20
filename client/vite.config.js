import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Matches a file inside node_modules/<one of these packages>/ on any operating system.
const inPackages = (names) => {
  const pattern = new RegExp(`node_modules/(${names})/`);
  const backslash = String.fromCharCode(92);
  return (id) => pattern.test(id.replaceAll(backslash, '/'));
};

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    rolldownOptions: {
      output: {
        // Libraries that rarely change get their own files, so a shop update does not make
        // visitors download them again. (Total size is the same; caching is what improves.)
        codeSplitting: {
          groups: [
            { name: 'vendor-react', test: inPackages('react|react-dom|react-router|react-router-dom|scheduler'), priority: 30 },
            { name: 'vendor-supabase', test: inPackages('@supabase'), priority: 20 },
            { name: 'vendor-query', test: inPackages('@tanstack'), priority: 20 },
            { name: 'vendor-forms', test: inPackages('react-hook-form|@hookform|zod'), priority: 20 },
          ],
        },
      },
    },
  },
  test: {
    // The default pool fails to start on some Windows machines; vmForks runs the same tests.
    pool: 'vmForks',
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    restoreMocks: true,
    css: false,
  },
})
