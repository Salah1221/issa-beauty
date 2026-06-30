import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["server/**/*.test.js"],
    // mongodb-memory-server downloads a binary on first run; give it room.
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});
