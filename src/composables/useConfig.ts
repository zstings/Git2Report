import { ref, watch } from 'vue'
import { fs, app, path } from 'vokex.app'

export interface AppConfig {
  reportPath: string
}

const defaultConfig: AppConfig = {
  reportPath: ''
}

const CONFIG_FILENAME = '.git2report_config.json'

export function useConfig() {
  const config = ref<AppConfig>({ ...defaultConfig })
  const loading = ref(false)

  async function getConfigPath() {
    const homeDir = await app.getPath('home')
    return await path.join(homeDir, CONFIG_FILENAME)
  }

  async function loadConfig() {
    loading.value = true
    try {
      const configPath = await getConfigPath()
      const exists = await fs.exists(configPath)
      if (exists) {
        const content = await fs.readFile(configPath, { encoding: 'utf8' })
        const loadedConfig = JSON.parse(content)
        config.value = { ...defaultConfig, ...loadedConfig }
      }
    } catch (error) {
      console.error('加载配置失败:', error)
      config.value = { ...defaultConfig }
    } finally {
      loading.value = false
    }
  }

  async function saveConfig() {
    loading.value = true
    try {
      const configPath = await getConfigPath()
      await fs.writeFile(configPath, JSON.stringify(config.value, null, 2))
    } catch (error) {
      console.error('保存配置失败:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  return {
    config,
    loading,
    loadConfig,
    saveConfig
  }
}
