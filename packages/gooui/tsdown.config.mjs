import { defineConfig } from "tsdown";
import typegpu from "unplugin-typegpu/rolldown";

export default defineConfig({
  entry: "./src/index.ts",
  dts: true,
  platform: "neutral",
  plugins: [typegpu({})],
});
