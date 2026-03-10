import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    permissions: ['activeTab', 'tabs', 'storage', 'scripting'],
    host_permissions: ['https://www.zhipin.com/*'],
  },
});
