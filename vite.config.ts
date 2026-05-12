import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  base: mode === "github-pages" ? "/tcuny-wifi-tour/" : "/",
  plugins: [react()],
  test: {
    environment: "node",
  },
}));
