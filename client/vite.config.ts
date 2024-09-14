import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 5173;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:" + PORT,
      },
    },
  },
});
