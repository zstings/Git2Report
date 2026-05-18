import { fileURLToPath, URL } from 'node:url';

import vue from '@vitejs/plugin-vue';
import { vokexPlugin } from 'vokex.app/vite-plugin';
import { defineConfig, type UserConfig } from 'vite';
import { version } from './package.json';

export default defineConfig(({ mode }) => {
  return {
    plugins: [
      vue(),
      vokexPlugin({
        name: 'Git2Report',
        identifier: 'com.git2report.app',
        version: version,
        icon: ['icon.ico'],
        window: {
          title: `Git2Report - v${version}`,
          width: 1200,
          height: 700,
          center: true,
          resizable: true,
        },
        verbose: true,
        devtools: mode == 'development',
      }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  } as UserConfig;
});
