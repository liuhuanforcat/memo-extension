import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    permissions: ['activeTab', 'tabs'],
    // 允许在所有站点上与标签页通信和注入脚本（自用工具场景）
    host_permissions: ['*://*/*'],
  },
});
