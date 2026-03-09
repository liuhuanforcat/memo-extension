import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    permissions: ['activeTab', 'tabs'],
    host_permissions: [
      '*://www.v2ny.de/*',
      '*://v2ny.de/*',
      '*://*.v2ny.de/*',
      '*://naiun.adfgawidhioawjd.site/*',
    ],
  },
});
