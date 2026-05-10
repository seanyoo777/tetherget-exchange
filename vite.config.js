import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
var contractsEntry = fileURLToPath(new URL("./shared/contracts/src/index.ts", import.meta.url));
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            "@tetherget/contracts": contractsEntry
        }
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
    }
});
