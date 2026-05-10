import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
var contractsEntry = fileURLToPath(new URL("./shared/contracts/src/index.ts", import.meta.url));
var contractsSchemasEntry = fileURLToPath(new URL("./shared/contracts/src/schemas/index.ts", import.meta.url));
/** 로컬 전용 포트 — Vite 기본(5173)·일반 API(4000)와 섞이지 않도록 고정 */
var TGX_WEB_PORT = 5720;
var TGX_PREVIEW_PORT = 5721;
var TGX_API_ORIGIN = "http://localhost:4720";
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: [
            { find: "@tetherget/contracts/schemas", replacement: contractsSchemasEntry },
            { find: "@tetherget/contracts", replacement: contractsEntry }
        ]
    },
    server: {
        port: TGX_WEB_PORT,
        open: true,
        host: true,
        proxy: {
            "/api": {
                target: TGX_API_ORIGIN,
                changeOrigin: true
            }
        }
    },
    preview: {
        port: TGX_PREVIEW_PORT,
        open: true,
        host: true,
        proxy: {
            "/api": {
                target: TGX_API_ORIGIN,
                changeOrigin: true
            }
        }
    },
    test: {
        environment: "node",
        include: ["src/**/*.test.ts"]
    }
});
