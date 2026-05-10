import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const contractsEntry = fileURLToPath(new URL("./shared/contracts/src/index.ts", import.meta.url));
const contractsSchemasEntry = fileURLToPath(
  new URL("./shared/contracts/src/schemas/index.ts", import.meta.url)
);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: "@tetherget/contracts/schemas", replacement: contractsSchemasEntry },
      { find: "@tetherget/contracts", replacement: contractsEntry }
    ]
  },
  server: {
    port: 5173,
    open: true,
    host: true,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true
      }
    }
  },
  preview: {
    port: 4173,
    open: true,
    host: true,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true
      }
    }
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"]
  }
});
