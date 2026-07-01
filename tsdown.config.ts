import { defineConfig } from "tsdown";

export default defineConfig({
  dts: {
    tsgo: true,
  },
  exports: true,
  entry: {
    index: "src/index.ts",
    parser: "src/parser/index.ts",
    viewer: "src/viewer/index.ts",
    vue: "src/vue/index.ts",
  },
});
