import { ref } from 'vue';
import { storage } from 'vokex.app';

export interface AppConfig {
  reportPath: string;
  mirrorUrl: string;
}

const defaultConfig: AppConfig = {
  reportPath: '',
  mirrorUrl: 'https://gh-proxy.com/',
};

const STORAGE_KEY = 'git2report_config';

export function useConfig() {
  const config = ref<AppConfig>({ ...defaultConfig });
  const loading = ref(false);

  async function loadConfig() {
    loading.value = true;
    try {
      const savedData = await storage.getItem(STORAGE_KEY);
      if (savedData) {
        config.value = { ...defaultConfig, ...savedData };
      }
    } catch (error) {
      console.error('加载配置失败:', error);
      config.value = { ...defaultConfig };
    } finally {
      loading.value = false;
    }
  }

  async function saveConfig() {
    loading.value = true;
    try {
      await storage.setItem(STORAGE_KEY, config.value);
    } catch (error) {
      console.error('保存配置失败:', error);
      throw error;
    } finally {
      loading.value = false;
    }
  }

  return {
    config,
    loading,
    loadConfig,
    saveConfig,
  };
}
