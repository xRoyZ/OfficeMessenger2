import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const devPort = Number(process.env.PORT) || 5173;

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: devPort,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
  },
});
