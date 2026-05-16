import { ref } from 'vue'
import { AIService } from '../services/aiService'
import type { AIConfig } from '../services/aiService'

export function useAI() {
  const aiService = AIService.getInstance()
  const loading = ref(false)
  const config = ref<AIConfig>({
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-3.5-turbo',
    systemPreference: ''
  })

  async function loadConfig() {
    const savedConfig = await aiService.loadConfig()
    if (savedConfig) {
      config.value = savedConfig
    }
  }

  async function saveConfig() {
    await aiService.saveConfig(config.value)
  }

  return {
    loading,
    config,
    loadConfig,
    saveConfig
  }
}
