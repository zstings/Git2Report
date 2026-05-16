<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useAI } from '../composables/useAI'
import { useConfig } from '../composables/useConfig'
import { useReport } from '../composables/useReport'
import { clipboard, dialog } from 'vokex.app'

const { config: aiConfig, loadConfig: loadAIConfig, saveConfig: saveAIConfig } = useAI()
const { config: appConfig, loadConfig: loadAppConfig } = useConfig()
const report = useReport()

const showAIConfig = ref(false)
const isGenerating = ref(false)
const isSaving = ref(false)

function formatTime(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return dateStr
  }
}

function truncate(str: string, maxLength: number = 50): string {
  if (str.length <= maxLength) return str
  return str.substring(0, maxLength) + '...'
}

async function handleLoadGitLogs() {
  report.loading.value = true
  try {
    if (!appConfig.value.reportPath) {
      return
    }
    
    await report.loadGitLogs(appConfig.value.reportPath, report.selectedDate.value)

    if (report.hasArchivedReport(report.selectedDate.value)) {
      report.generatedReport.value = report.loadArchivedReport(report.selectedDate.value)
    }
  } catch (error) {
    console.error('加载 Git 日志失败:', error)
  } finally {
    report.loading.value = false
  }
}

async function handleGenerateReport() {
  if (!aiConfig.value.apiKey) {
    await dialog.info({
      title: '提示',
      body: '请先配置 AI 服务'
    })
    showAIConfig.value = true
    return
  }

  isGenerating.value = true
  try {
    if (report.selectedReportType.value === 'daily') {
      await report.generateDailyReport()
    } else {
      const type = report.selectedReportType.value === 'weekly' ? 'week' : 'month'
      await report.generateCycleReport(appConfig.value.reportPath, type)
    }
  } catch (error) {
    await dialog.error({
      title: '生成失败',
      body: String(error)
    })
  } finally {
    isGenerating.value = false
  }
}

async function handleCopyReport() {
  if (!report.generatedReport.value) return
  await clipboard.writeText(report.generatedReport.value)
  await dialog.info({
    title: '成功',
    body: '报告已复制到剪贴板'
  })
}

async function handleSaveReport() {
  if (!appConfig.value.reportPath) {
    await dialog.info({
      title: '提示',
      body: '请先在初始化页面设置报告存放目录'
    })
    return
  }

  if (report.selectedReportType.value !== 'daily') {
    await dialog.info({
      title: '提示',
      body: '仅日报可以存档'
    })
    return
  }

  isSaving.value = true
  try {
    await report.saveDailyReport(appConfig.value.reportPath)
    await dialog.info({
      title: '成功',
      body: '报告已存档'
    })
  } catch (error) {
    await dialog.error({
      title: '保存失败',
      body: String(error)
    })
  } finally {
    isSaving.value = false
  }
}

async function handleSaveAIConfig() {
  await saveAIConfig()
  showAIConfig.value = false
  await dialog.info({
    title: '成功',
    body: '配置已保存'
  })
}

function changeDate(days: number) {
  const current = new Date(report.selectedDate.value)
  current.setDate(current.getDate() + days)
  report.setDate(report.formatDate(current))
}

function renderMarkdown(text: string | undefined): string {
  if (!text || typeof text !== 'string') return ''
  try {
    let result = text
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*)\*/gim, '<em>$1</em>')
      .replace(/`(.*?)`/gim, '<code>$1</code>')
    const lines = result.split('\n')
    let inList = false
    result = ''
    for (const line of lines) {
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        if (!inList) {
          result += '<ul>'
          inList = true
        }
        result += `<li>${line.trim().substring(2)}</li>`
      } else {
        if (inList) {
          result += '</ul>'
          inList = false
        }
        if (line.trim()) {
          result += `<p>${line}</p>`
        }
      }
    }
    if (inList) result += '</ul>'
    return result
  } catch (error) {
    console.error('渲染 Markdown 失败:', error)
    return ''
  }
}

watch(report.selectedDate, async () => {
  await handleLoadGitLogs()
})

onMounted(async () => {
  await Promise.all([
    loadAIConfig(),
    loadAppConfig()
  ])

  if (appConfig.value.reportPath) {
    await report.loadDailyArchive(appConfig.value.reportPath)
    await handleLoadGitLogs()
  }
})
</script>

<template>
  <div class="page report-page">
    <div class="page-header">
      <h1>📝 智能工作报告</h1>
      <p class="subtitle">基于 Git 提交历史自动生成专业工作报告</p>
    </div>

    <div class="workflow-container">
      <div class="left-panel">
        <div class="card">
          <div class="card-header">
            <h2>📅 今日 Git 足迹</h2>
            <div class="date-navigator">
              <button class="btn btn-icon" @click="changeDate(-1)" title="前一天">‹</button>
              <input
                type="date"
                class="date-input"
                v-model="report.selectedDate.value"
              />
              <button class="btn btn-icon" @click="changeDate(1)" title="后一天">›</button>
            </div>
          </div>

          <div v-if="report.loading.value" class="loading-container">
            <div class="spinner"></div>
            <span>加载中...</span>
          </div>

          <div v-else-if="report.gitLogs.value.length === 0" class="empty-state">
            <p>暂无 Git 提交记录</p>
          </div>

          <div v-else class="git-logs-list">
            <div
              v-for="(log, index) in report.gitLogs.value"
              :key="index"
              class="log-item"
            >
              <div class="log-header">
                <span class="project-badge">{{ log.projectName }}</span>
                <span class="log-time">{{ formatTime(log.date) }}</span>
              </div>
              <div class="log-content">{{ truncate(log.content) }}</div>
              <div v-if="log.diff" class="log-diff-badge">包含代码变更</div>
            </div>
          </div>

          <div class="notes-section">
            <label class="notes-label">📝 今日工作补充</label>
            <textarea
              v-model="report.userNotes.value"
              class="notes-textarea"
              placeholder="在此记录非代码工作，如：开会、写文档、线上排查等..."
            />
          </div>
        </div>

        <div v-if="report.selectedReportType.value === 'daily' && report.hasArchivedReport(report.selectedDate.value)" class="card archive-badge">
          <span class="archive-icon">✅</span>
          <span class="archive-text">该日期已有存档报告</span>
        </div>
      </div>

      <div class="right-panel">
        <div class="card">
          <div class="card-header">
            <div class="report-type-tabs">
              <button
                class="tab-btn"
                :class="{ active: report.selectedReportType.value === 'daily' }"
                @click="report.setReportType('daily')"
              >
                日报
              </button>
              <button
                class="tab-btn"
                :class="{ active: report.selectedReportType.value === 'weekly' }"
                @click="report.setReportType('weekly')"
              >
                周报
              </button>
              <button
                class="tab-btn"
                :class="{ active: report.selectedReportType.value === 'monthly' }"
                @click="report.setReportType('monthly')"
              >
                月报
              </button>
            </div>

            <button
              class="btn btn-secondary btn-small"
              @click="showAIConfig = true"
              title="AI 配置"
            >
              ⚙️
            </button>
          </div>

          <div class="generate-section">
            <button
              class="btn btn-primary generate-btn"
              @click="handleGenerateReport"
              :disabled="isGenerating"
            >
              <span v-if="isGenerating" class="spinner small"></span>
              {{ isGenerating ? '生成中...' : '🪄 智能 AI 一键生成' }}
            </button>
          </div>

          <div class="report-editor-section">
            <label class="editor-label">AI 报告预览（可编辑）</label>
            <textarea
              v-model="report.generatedReport.value"
              class="report-editor"
              placeholder="点击上方按钮生成报告..."
            />

            <div v-if="report.generatedReport.value" class="report-preview markdown-body" v-html="renderMarkdown(report.generatedReport.value)"></div>
          </div>

          <div v-if="report.generatedReport.value" class="actions-bar">
            <button
              class="btn btn-secondary"
              @click="handleCopyReport"
            >
              📋 一键复制
            </button>

            <button
              v-if="report.selectedReportType.value === 'daily'"
              class="btn btn-success"
              @click="handleSaveReport"
              :disabled="isSaving"
            >
              {{ isSaving ? '保存中...' : '💾 确认存档' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showAIConfig" class="modal-overlay" @click.self="showAIConfig = false">
      <div class="modal">
        <div class="modal-header">
          <h3>⚙️ AI 配置</h3>
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
          <div class="form-group">
            <label>个人偏好（选填）</label>
            <textarea
              v-model="aiConfig.systemPreference"
              placeholder="例如：字数要求精炼，按格式：进展/问题/规划输出..."
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
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 24px;
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

.workflow-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

.left-panel,
.right-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.card-header h2 {
  font-size: 18px;
  color: #1a1a2e;
  margin: 0;
}

.date-navigator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.btn:hover:not(:disabled) {
  transform: translateY(-1px);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-success {
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
  color: white;
}

.btn-secondary {
  background: #f0f0f0;
  color: #333;
}

.btn-icon {
  width: 32px;
  height: 32px;
  padding: 0;
  border-radius: 6px;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-small {
  padding: 6px 12px;
  font-size: 13px;
}

.date-input {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  gap: 12px;
  color: #666;
}

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid #f0f0f0;
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.spinner.small {
  width: 16px;
  height: 16px;
  border-width: 2px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #999;
}

.git-logs-list {
  max-height: 300px;
  overflow-y: auto;
  margin-bottom: 16px;
}

.log-item {
  padding: 12px;
  border-radius: 8px;
  background: #f8f9fa;
  margin-bottom: 8px;
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.project-badge {
  padding: 4px 10px;
  background: #667eea;
  color: white;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.log-time {
  font-size: 12px;
  color: #999;
}

.log-content {
  font-size: 14px;
  color: #333;
}

.log-diff-badge {
  margin-top: 6px;
  font-size: 11px;
  color: #11998e;
}

.notes-section {
  margin-top: 16px;
}

.notes-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #333;
  margin-bottom: 8px;
}

.notes-textarea {
  width: 100%;
  min-height: 100px;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
  box-sizing: border-box;
}

.notes-textarea:focus {
  outline: none;
  border-color: #667eea;
}

.archive-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
}

.archive-icon {
  font-size: 20px;
}

.archive-text {
  color: #2e7d32;
  font-size: 14px;
  font-weight: 500;
}

.report-type-tabs {
  display: flex;
  gap: 4px;
  background: #f0f0f0;
  padding: 4px;
  border-radius: 8px;
}

.tab-btn {
  padding: 8px 20px;
  border: none;
  background: transparent;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn:hover {
  color: #333;
}

.tab-btn.active {
  background: white;
  color: #667eea;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}

.generate-section {
  margin-bottom: 20px;
}

.generate-btn {
  width: 100%;
  justify-content: center;
  padding: 14px 24px;
  font-size: 16px;
}

.report-editor-section {
  margin-bottom: 16px;
}

.editor-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #333;
  margin-bottom: 8px;
}

.report-editor {
  width: 100%;
  min-height: 200px;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
  box-sizing: border-box;
}

.report-editor:focus {
  outline: none;
  border-color: #667eea;
}

.report-preview {
  margin-top: 16px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.8;
}

.actions-bar {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
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

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #333;
  font-size: 14px;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  transition: border-color 0.2s;
  box-sizing: border-box;
  font-family: inherit;
}

.form-group textarea {
  min-height: 80px;
  resize: vertical;
}

.form-group input:focus,
.form-group textarea:focus {
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

:deep(.markdown-body) h1,
:deep(.markdown-body) h2,
:deep(.markdown-body) h3 {
  margin-top: 16px;
  margin-bottom: 8px;
  color: #1a1a2e;
}

:deep(.markdown-body) h1 { font-size: 20px; }
:deep(.markdown-body) h2 { font-size: 18px; }
:deep(.markdown-body) h3 { font-size: 16px; }

:deep(.markdown-body) p {
  margin: 8px 0;
}

:deep(.markdown-body) ul {
  padding-left: 24px;
  margin: 8px 0;
}

:deep(.markdown-body) li {
  margin: 4px 0;
}

:deep(.markdown-body) code {
  background: #e9ecef;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 13px;
}

@media (max-width: 1024px) {
  .workflow-container {
    grid-template-columns: 1fr;
  }
}
</style>
