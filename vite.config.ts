import { fileURLToPath, URL } from "node:url";

import vue from "@vitejs/plugin-vue";
import { vokexPlugin } from "vokex.app/vite-plugin";
import { defineConfig } from "vite";
import { version } from "./package.json";

export default defineConfig(({ mode }) => {
  return {
    plugins: [
      vue(),
      vokexPlugin({
        name: "Vokex Demo",
        identifier: "com.vokex.vokex",
        version: version,
        icon: ["icon/icon.ico", "icon/32x32.png"],
        window: {
          title: "Vokex App Demo",
          width: 1200,
          height: 800,
          center: true,
        },
        verbose: true,
        devtools: mode == "development",
        new_window: {
          value: 1,
        },
        security: {
          allowed_remote_apis: ["fs.readFile", "computer.*"],
          allow_remote_pages: true,
        },
      }),
    ],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
  };
});
