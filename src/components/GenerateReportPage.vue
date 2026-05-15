<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useGit } from '../composables/useGit'
import { useAI } from '../composables/useAI'
import { useConfig } from '../composables/useConfig'
import { clipboard, dialog, fs, path } from 'vokex.app'
import type { GitCommit } from '../services/gitService'

const { loading: gitLoading, loadCommits } = useGit()
const {
  loading: aiLoading,
  config: aiConfig,
  loadConfig: loadAIConfig,
  saveConfig: saveAIConfig,
  generateReport,
  generatePrompt
} = useAI()
const { config: appConfig, loadConfig: loadAppConfig } = useConfig()

const showResult = ref(false)
const showAIConfig = ref(false)
const currentPrompt = ref('')
const currentReport = ref('')
const currentDateLabel = ref('')
const currentCommits = ref<GitCommit[]>([])

const isLoading = () => gitLoading.value || aiLoading.value

async function handleGenerate(type: 'daily' | 'weekly' | 'monthly') {
  const result = await loadCommits(type)
  if (!result) return

  const { since, until, commits } = result
  currentDateLabel.value = `${since} 至 ${until}`
  currentCommits.value = commits

  if (commits.length === 0) {
    await dialog.info({
      title: '提示',
      message: '该时间段暂无提交记录'
    })
    return
  }

  currentPrompt.value = generatePrompt(commits, type, currentDateLabel.value)
  showResult.value = true
  currentReport.value = ''
}

async function handleCopyPrompt() {
  await clipboard.writeText(currentPrompt.value)
  await dialog.info({
    title: '成功',
    message: '提示词已复制到剪贴板'
  })
}

async function handleGenerateAI() {
  if (!aiConfig.value.apiKey) {
    await dialog.info({
      title: '提示',
      message: '请先配置 AI 服务'
    })
    showAIConfig.value = true
    return
  }

  const report = await generateReport(currentCommits.value, 'daily', currentDateLabel.value)
  currentReport.value = report
}

async function handleCopyReport() {
  await clipboard.writeText(currentReport.value)
  await dialog.info({
    title: '成功',
    message: '报告已复制到剪贴板'
  })
}

async function handleSaveReport() {
  if (!appConfig.value.reportPath) {
    await dialog.info({
      title: '提示',
      message: '请先在初始化页面设置报告存放目录'
    })
    return
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filename = `report-${timestamp}.md`
  const filepath = await path.join(appConfig.value.reportPath, filename)

  await fs.writeFile(filepath, currentReport.value)
  await dialog.info({
    title: '成功',
    message: `报告已保存到 ${filepath}`
  })
}

async function handleSaveAIConfig() {
  await saveAIConfig()
  showAIConfig.value = false
  await dialog.info({
    title: '成功',
    message: '配置已保存'
  })
}

onMounted(() => {
  loadAIConfig()
  loadAppConfig()
})
</script>

<template>
  <div class="page report-page">
    <div class="page-header">
      <h1>📝 生成报告</h1>
      <p class="subtitle">选择报告类型，自动生成 AI 提示词和报告</p>
    </div>

    <div class="card actions-card">
      <h2>选择报告类型</h2>
      <div class="action-buttons">
        <button class="btn btn-success" @click="handleGenerate('daily')" :disabled="isLoading()">
          📅 生成日报
        </button>
        <button class="btn btn-info" @click="handleGenerate('weekly')" :disabled="isLoading()">
          📆 生成周报
        </button>
        <button class="btn btn-warning" @click="handleGenerate('monthly')" :disabled="isLoading()">
          🗓️ 生成月报
        </button>
        <button class="btn btn-secondary" @click="showAIConfig = true">
          ⚙️ 配置 AI
        </button>
      </div>
    </div>

    <div v-if="showResult" class="card result-card">
      <div class="result-header">
        <h2>AI 提示词</h2>
        <span class="date-label">{{ currentDateLabel }}</span>
      </div>

      <div class="prompt-content">{{ currentPrompt }}</div>

      <div class="prompt-actions">
        <button class="btn btn-secondary" @click="handleCopyPrompt" :disabled="isLoading()">
          📋 复制提示词
        </button>
        <button class="btn btn-primary" @click="handleGenerateAI" :disabled="isLoading()">
          {{ aiLoading ? '生成中...' : '✨ 生成报告' }}
        </button>
      </div>

      <div v-if="currentReport" class="report-section">
        <div class="report-header">
          <h3>📄 生成的报告</h3>
          <div class="report-actions">
            <button class="btn btn-secondary btn-sm" @click="handleCopyReport">
              📋 复制
            </button>
            <button class="btn btn-success btn-sm" @click="handleSaveReport">
              💾 保存
            </button>
          </div>
        </div>
        <div class="report-content markdown-body">{{ currentReport }}</div>
      </div>
    </div>

    <div v-if="showAIConfig" class="modal-overlay" @click.self="showAIConfig = false">
      <div class="modal">
        <div class="modal-header">
          <h3>AI 配置</h3>
          <button class="close-btn" @click="showAIConfig = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>API Key</label>
            <input
              v-model="aiConfig.apiKey"
              type="password"
              placeholder="请输入 API Key"
            />
          </div>
          <div class="form-group">
            <label>Base URL</label>
            <input
              v-model="aiConfig.baseUrl"
              type="text"
              placeholder="https://api.openai.com/v1"
            />
          </div>
          <div class="form-group">
            <label>Model</label>
            <input
              v-model="aiConfig.model"
              type="text"
              placeholder="gpt-3.5-turbo"
            />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showAIConfig = false">取消</button>
          <button class="btn btn-primary" @click="handleSaveAIConfig">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  padding: 24px;
  max-width: 1000px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 32px;
}

.page-header h1 {
  font-size: 28px;
  color: #1a1a2e;
  margin-bottom: 8px;
}

.subtitle {
  color: #666;
  font-size: 14px;
}

.card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.card h2 {
  font-size: 18px;
  color: #1a1a2e;
  margin-bottom: 16px;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-sm {
  padding: 8px 16px;
  font-size: 13px;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-success {
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
  color: white;
}

.btn-success:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(17, 153, 142, 0.4);
}

.btn-info {
  background: linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%);
  color: white;
}

.btn-info:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(33, 147, 176, 0.4);
}

.btn-warning {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
}

.btn-warning:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(245, 87, 108, 0.4);
}

.btn-secondary {
  background: #f0f0f0;
  color: #333;
}

.btn-secondary:hover:not(:disabled) {
  background: #e0e0e0;
}

.action-buttons {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.date-label {
  font-size: 13px;
  color: #999;
}

.prompt-content {
  background: #f8f9fa;
  padding: 16px;
  border-radius: 8px;
  line-height: 1.6;
  white-space: pre-wrap;
  font-family: monospace;
  font-size: 13px;
  max-height: 400px;
  overflow-y: auto;
  margin-bottom: 16px;
}

.prompt-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.report-section {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid #f0f0f0;
}

.report-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.report-header h3 {
  font-size: 16px;
  color: #1a1a2e;
}

.report-actions {
  display: flex;
  gap: 8px;
}

.report-content {
  background: #f8f9fa;
  padding: 24px;
  border-radius: 8px;
  line-height: 1.8;
  white-space: pre-wrap;
  max-height: 500px;
  overflow-y: auto;
}

:deep(.markdown-body) h1,
:deep(.markdown-body) h2,
:deep(.markdown-body) h3 {
  margin-top: 16px;
  margin-bottom: 8px;
}

:deep(.markdown-body) ul,
:deep(.markdown-body) ol {
  padding-left: 24px;
  margin-bottom: 12px;
}

:deep(.markdown-body) code {
  background: #e9ecef;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #eee;
}

.modal-header h3 {
  font-size: 18px;
  color: #1a1a2e;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 28px;
  color: #999;
  cursor: pointer;
  line-height: 1;
  padding: 0;
}

.close-btn:hover {
  color: #333;
}

.modal-body {
  padding: 24px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #333;
}

.form-group input {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.form-group input:focus {
  outline: none;
  border-color: #667eea;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #eee;
}
</style>
