import { defineConfig } from "vitest/config";
import path from "node:path";
import os from "node:os";

export default defineConfig({
  test: {
    env: { DATA_FILE: path.join(os.tmpdir(), "allowance-test-db.json") },
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});

