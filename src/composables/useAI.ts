import { ref } from 'vue'
import { AIService } from '../services/aiService'
import type { AIConfig, GitCommit } from '../services/aiService'

export function useAI() {
  const aiService = AIService.getInstance()
  const loading = ref(false)
  const config = ref<AIConfig>({
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-3.5-turbo'
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

  async function generateReport(
    commits: GitCommit[],
    type: 'daily' | 'weekly' | 'monthly',
    dateLabel: string
  ) {
    loading.value = true
    try {
      return await aiService.generateReport(commits, type, dateLabel)
    } finally {
      loading.value = false
    }
  }

  function generatePrompt(
    commits: GitCommit[],
    type: 'daily' | 'weekly' | 'monthly',
    dateLabel: string
  ): string {
    const commitsByProject: Record<string, GitCommit[]> = {}
    for (const commit of commits) {
      if (!commitsByProject[commit.projectName]) {
        commitsByProject[commit.projectName] = []
      }
      commitsByProject[commit.projectName].push(commit)
    }

    let commitsText = ''
    for (const [projectName, projectCommits] of Object.entries(commitsByProject)) {
      commitsText += `\n【${projectName}】\n`
      for (const commit of projectCommits) {
        commitsText += `- ${commit.message} (${commit.author}, ${commit.date.split(' ')[0]})\n`
      }
    }

    const typeLabels: Record<string, string> = {
      daily: '日报',
      weekly: '周报',
      monthly: '月报'
    }

    return `请根据以下 Git 提交记录，生成一份${typeLabels[type]}。

日期: ${dateLabel}

提交记录:
${commitsText}

要求:
1. 格式清晰，易于阅读
2. 按项目分组总结
3. 突出重要的工作内容
4. 语言简洁专业
5. 使用 Markdown 格式返回，记录md格式使用4个反引号包裹

示例：
✅[项目1]
- 提交
- 提交

✅[项目2]
- 提交
- 提交

示例中不要带作者和日期，只需要提交信息。
`
  }

  return {
    loading,
    config,
    loadConfig,
    saveConfig,
    generateReport,
    generatePrompt
  }
}
