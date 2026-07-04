import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Dev-only: port of the standalone backend the /api proxy targets. The
  // backend runs on 5002 (see issa-beauty-backend/.env); override with PORT if needed.
  const PORT = env.PORT ? parseInt(env.PORT) : 5002;
  return {
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
  };
});
