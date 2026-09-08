import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const API_TARGET = process.env.API_PROXY_TARGET || "http://127.0.0.1:3000";

export default defineConfig(() => ({
  clearScreen: false,
  server: {
    host: "localhost",
    port: 8080,
    strictPort: true,
    watch: {
      ignored: ["**/public/uploads/**", "**/logs/**", "**/dist/**"],
    },
    proxy: {
      "/api": {
        target: API_TARGET,
        changeOrigin: true,
        timeout: 0,
        proxyTimeout: 0,
      },
    },
    fs: {
      strict: true,
      allow: [".", "./client", "./shared"],
      deny: [".env", ".env.*", "*.{crt,pem,key}", "**/.git/**", "server/**"],
    },
  },
  preview: {
    host: "localhost",
    port: 8080,
    strictPort: true,
  },
  build: {
    outDir: "dist/spa",
    sourcemap: false,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
}));
