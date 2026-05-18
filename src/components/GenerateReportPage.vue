<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useAI } from '../composables/useAI';
import { useConfig } from '../composables/useConfig';
import { useReport } from '../composables/useReport';
import { useProjects } from '../composables/useProjects';
import { clipboard, dialog } from 'vokex.app';

const { config: aiConfig, loadConfig: loadAIConfig, saveConfig: saveAIConfig } = useAI();
const { config: appConfig, loadConfig: loadAppConfig } = useConfig();
const { projects, loadProjects } = useProjects();
const report = useReport();

const showAIConfig = ref(false);
const showFillModal = ref(false);
const isGenerating = ref(false);
const isSaving = ref(false);
const viewMode = ref<'preview' | 'edit'>('preview');
const projectPathsInput = ref('');

function formatTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return dateStr;
  }
}

function truncate(str: string, maxLength: number = 50): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + '...';
}

async function handleLoadGitLogs() {
  report.loading.value = true;
  try {
    if (!appConfig.value.reportPath) {
      return;
    }

    await report.loadGitLogs(appConfig.value.reportPath, report.selectedDate.value);

    if (report.hasArchivedReport(report.selectedDate.value)) {
      report.generatedReport.value = report.loadArchivedReport(report.selectedDate.value);
    }

    // 只在今天才清理无效提交记录
    const today = report.formatDate(new Date());
    if (report.selectedDate.value === today) {
      const removedCount = await report.cleanInvalidCommits(appConfig.value.reportPath, report.selectedDate.value);
      if (removedCount > 0) {
        console.log(`清理了 ${removedCount} 条无效记录，重新加载...`);
        await report.loadGitLogs(appConfig.value.reportPath, report.selectedDate.value);
      }
    } else {
      console.log(`[跳过清理] 非今天日期: ${report.selectedDate.value}`);
    }
  } catch (error) {
    console.error('加载 Git 日志失败:', error);
  } finally {
    report.loading.value = false;
  }
}

async function handleSelectDirectories() {
  const result = await dialog.showOpenDialog({
    title: '选择 Git 项目目录',
    multiple: true,
    directory: true,
    defaultPath: '',
  });

  console.log('[选择目录] 返回结果:', result, '类型:', Array.isArray(result));
  
  if (result && result.length > 0) {
    const existingPaths = projectPathsInput.value.trim().split('\n').filter(p => p.trim());
    const newPaths = [...new Set([...existingPaths, ...result])];
    projectPathsInput.value = newPaths.join('\n');
    console.log('[选择目录] 已选择:', newPaths);
  }
}

async function handleFillCommits() {
  if (!appConfig.value.reportPath) {
    await dialog.info({
      title: '提示',
      message: '请先在初始化页面设置报告存放目录',
    });
    return;
  }

  const paths = projectPathsInput.value.trim().split('\n').filter(p => p.trim());
  if (paths.length === 0) {
    await dialog.info({
      title: '提示',
      message: '请输入或选择项目路径',
    });
    return;
  }

  showFillModal.value = false;
  report.loading.value = true;

  try {
    const addedCount = await report.fillCommitsFromProjects(appConfig.value.reportPath, paths, report.selectedDate.value);
    
    if (addedCount > 0) {
      await dialog.info({
        title: '完成',
        message: `补全完成，共添加 ${addedCount} 条提交记录`,
      });
    } else {
      await dialog.info({
        title: '完成',
        message: '未发现新的提交记录',
      });
    }

    await handleLoadGitLogs();
  } catch (error) {
    await dialog.error({
      title: '补全失败',
      message: String(error),
    });
  } finally {
    report.loading.value = false;
  }
}

async function handleGenerateReport() {
  if (!aiConfig.value.apiKey) {
    await dialog.info({
      title: '提示',
      message: '请先配置 AI 服务',
    });
    showAIConfig.value = true;
    return;
  }

  // 检查是否有 Git 记录
  if (report.selectedReportType.value === 'daily' && report.filteredGitLogs.value.length === 0 && !report.userNotes.value.trim()) {
    await dialog.info({
      title: '提示',
      message: '当日没有 Git 提交记录',
    });
    return;
  }

  isGenerating.value = true;
  report.generatedReport.value = '';
  try {
    if (report.selectedReportType.value === 'daily') {
      await report.generateDailyReport(chunk => {
        report.generatedReport.value += chunk;
      });
    } else {
      const type = report.selectedReportType.value === 'weekly' ? 'week' : 'month';
      await report.generateCycleReport(appConfig.value.reportPath, type, chunk => {
        report.generatedReport.value += chunk;
      });
    }
  } catch (error) {
    await dialog.error({
      title: '生成失败',
      message: `请求失败：${error instanceof Error ? error.message : String(error)}\n\n请检查：\n1. 网络连接是否正常\n2. API Key 是否有效\n3. API 服务是否可用`,
    });
  } finally {
    isGenerating.value = false;
    if (report.generatedReport.value.trim() && report.selectedReportType.value === 'daily' && appConfig.value.reportPath) {
      try {
        await report.saveDailyReport(appConfig.value.reportPath);
      } catch {
        // 自动存档失败时不阻塞，用户仍可手动存档
      }
    }
  }
}

async function handleCopyReport() {
  if (!report.generatedReport.value) return;
  await clipboard.writeText(report.generatedReport.value);
  await dialog.info({
    title: '成功',
    message: '报告已复制到剪贴板',
  });
}

async function handleSaveReport() {
  if (!appConfig.value.reportPath) {
    await dialog.info({
      title: '提示',
      message: '请先在初始化页面设置报告存放目录',
    });
    return;
  }

  if (report.selectedReportType.value !== 'daily') {
    await dialog.info({
      title: '提示',
      message: '仅日报可以存档',
    });
    return;
  }

  isSaving.value = true;
  try {
    await report.saveDailyReport(appConfig.value.reportPath);
    await dialog.info({
      title: '成功',
      message: '报告已存档',
    });
  } catch (error) {
    await dialog.error({
      title: '保存失败',
      message: String(error),
    });
  } finally {
    isSaving.value = false;
  }
}

async function handleSaveAIConfig() {
  await saveAIConfig();
  showAIConfig.value = false;
  await dialog.info({
    title: '成功',
    message: '配置已保存',
  });
}

function changeDate(days: number) {
  const current = new Date(report.selectedDate.value);
  current.setDate(current.getDate() + days);
  report.setDate(report.formatDate(current));
}

function renderMarkdown(text: string | undefined): string {
  if (!text || typeof text !== 'string') return '';
  try {
    let result = text
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*)\*/gim, '<em>$1</em>')
      .replace(/`(.*?)`/gim, '<code>$1</code>');
    const lines = result.split('\n');
    let inList = false;
    result = '';
    for (const line of lines) {
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        if (!inList) {
          result += '<ul>';
          inList = true;
        }
        result += `<li>${line.trim().substring(2)}</li>`;
      } else {
        if (inList) {
          result += '</ul>';
          inList = false;
        }
        if (line.trim()) {
          result += `<p>${line}</p>`;
        }
      }
    }
    if (inList) result += '</ul>';
    return result;
  } catch (error) {
    console.error('渲染 Markdown 失败:', error);
    return '';
  }
}

watch(report.selectedDate, async () => {
  await handleLoadGitLogs();
});

onMounted(async () => {
  await Promise.all([loadAIConfig(), loadAppConfig()]);

  if (appConfig.value.reportPath) {
    await loadProjects(appConfig.value.reportPath);
    const ignoredPaths = projects.value.filter(p => p.isIgnored).map(p => p.localPath);
    report.setIgnoredProjects(ignoredPaths);
    await report.loadDailyArchive(appConfig.value.reportPath);
    await handleLoadGitLogs();
  }
});

watch(
  () => projects.value,
  () => {
    const ignoredPaths = projects.value.filter(p => p.isIgnored).map(p => p.localPath);
    report.setIgnoredProjects(ignoredPaths);
  },
  { deep: true },
);
</script>

<template>
  <div class="page report-page">
    <div class="workflow-container">
      <div class="git-panel">
        <div class="panel-header">
          <div class="date-navigator">
            <button class="btn-icon" @click="changeDate(-1)" title="前一天">‹</button>
            <input type="date" class="date-input" v-model="report.selectedDate.value" />
            <button class="btn-icon" @click="changeDate(1)" title="后一天">›</button>
            <button class="btn-fill" @click="showFillModal = true" title="手动补全提交记录">手动补全提交记录</button>
          </div>
        </div>

        <div v-if="report.loading.value" class="loading-container">
          <div class="spinner"></div>
          <span>加载中...</span>
        </div>

        <div v-else-if="report.filteredGitLogs.value.length === 0" class="empty-state">
          <p>暂无 Git 提交记录</p>
        </div>

        <div v-else class="git-logs-list">
          <div v-for="(log, index) in report.filteredGitLogs.value" :key="index" class="log-item">
            <div class="log-time-marker">
              <span class="time">{{ formatTime(log.date) }}</span>
              <span class="dot"></span>
            </div>
            <div class="log-content-wrapper">
              <div class="log-header">
                <span class="project-badge">{{ log.projectName }}</span>
              </div>
              <div class="log-message">{{ truncate(log.content) }}</div>
              <div v-if="log.diff" class="log-diff">包含代码变更</div>
            </div>
          </div>
        </div>

        <div class="notes-section">
          <label class="notes-label">今日工作补充</label>
          <textarea v-model="report.userNotes.value" class="notes-textarea" placeholder="记录非代码工作，如：开会、写文档、线上排查等..." />
        </div>

        <div v-if="report.selectedReportType.value === 'daily' && report.hasArchivedReport(report.selectedDate.value)" class="archive-badge">
          <span class="archive-icon">✓</span>
          <span class="archive-text">该日期已有存档报告</span>
        </div>
      </div>

      <div class="report-panel">
        <div class="panel-header">
          <div class="report-type-tabs">
            <button class="tab-btn" :class="{ active: report.selectedReportType.value === 'daily' }" @click="report.setReportType('daily')">日报</button>
            <button class="tab-btn" :class="{ active: report.selectedReportType.value === 'weekly' }" @click="report.setReportType('weekly')">周报</button>
            <button class="tab-btn" :class="{ active: report.selectedReportType.value === 'monthly' }" @click="report.setReportType('monthly')">月报</button>
          </div>
          <button class="btn-icon" @click="showAIConfig = true" title="AI 配置">⚙️</button>
        </div>

        <button class="generate-btn" @click="handleGenerateReport" :disabled="isGenerating">
          <span v-if="isGenerating" class="spinner small"></span>
          {{ isGenerating ? '生成中...' : '智能 AI 一键生成' }}
        </button>

        <div class="view-tabs">
          <button class="view-tab" :class="{ active: viewMode === 'preview' }" @click="viewMode = 'preview'">预览</button>
          <button class="view-tab" :class="{ active: viewMode === 'edit' }" @click="viewMode = 'edit'">编辑</button>
        </div>

        <div class="report-content">
          <textarea v-if="viewMode === 'edit'" v-model="report.generatedReport.value" class="report-editor" placeholder="点击上方按钮生成报告..." />
          <div v-else class="report-preview markdown-body">
            <div v-if="report.generatedReport.value" v-html="renderMarkdown(report.generatedReport.value)"></div>
            <div v-else class="placeholder-text">点击上方按钮生成报告...</div>
          </div>
        </div>

        <div v-if="report.generatedReport.value" class="actions-bar">
          <button class="btn-secondary" @click="handleCopyReport">一键复制</button>
          <button v-if="report.selectedReportType.value === 'daily'" class="btn-primary" @click="handleSaveReport" :disabled="isSaving">
            {{ isSaving ? '保存中...' : '确认存档' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="showAIConfig" class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h3>AI 配置</h3>
          <button class="close-btn" @click="showAIConfig = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>API Key</label>
            <input v-model="aiConfig.apiKey" type="password" placeholder="请输入 API Key" />
          </div>
          <div class="form-group">
            <label>Base URL</label>
            <input v-model="aiConfig.baseUrl" type="text" placeholder="https://api.openai.com/v1" />
          </div>
          <div class="form-group">
            <label>Model</label>
            <input v-model="aiConfig.model" type="text" placeholder="gpt-3.5-turbo" />
          </div>
          <div class="form-group">
            <label>个人偏好（选填）</label>
            <textarea v-model="aiConfig.systemPreference" placeholder="例如：字数要求精炼，按格式：进展/问题/规划输出..." />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" @click="showAIConfig = false">取消</button>
          <button class="btn-save" @click="handleSaveAIConfig">保存</button>
        </div>
      </div>
    </div>

    <div v-if="showFillModal" class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h3>补全提交记录</h3>
          <button class="close-btn" @click="showFillModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>项目路径</label>
            <div class="path-input-container">
              <textarea 
                v-model="projectPathsInput" 
                class="path-textarea" 
                placeholder="请输入项目路径，每行一个&#10;例如：&#10;E:/projects/my-project&#10;D:/workspace/another-project"
              />
            </div>
            <button class="btn-select-dir" @click="handleSelectDirectories">选择目录</button>
          </div>
          <div class="form-group">
            <label>目标日期</label>
            <input type="date" v-model="report.selectedDate.value" class="date-input" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" @click="showFillModal = false">取消</button>
          <button class="btn-save" @click="handleFillCommits">确定</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  padding: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.workflow-container {
  display: flex;
  height: 100vh;
  gap: 0;
}

.git-panel {
  width: 50%;
  min-width: 320px;
  background: var(--bg-panel);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.report-panel {
  flex: 1;
  background: var(--bg-panel);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.date-navigator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-icon {
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-muted);
  transition: all 0.15s;
}

.btn-icon:hover {
  background: var(--bg-sidebar);
  color: var(--text-primary);
}

.btn-fill {
  padding: 6px 12px;
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-fill:hover:not(:disabled) {
  background: rgba(37, 99, 235, 0.08);
}

.btn-fill:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.date-input {
  padding: 6px 10px;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  font-size: 13px;
  color: var(--text-regular);
  background: transparent;
}

.date-input:focus {
  outline: none;
  border-color: var(--color-primary);
  background: var(--bg-main);
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  gap: 12px;
  color: var(--text-muted);
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.spinner.small {
  width: 14px;
  height: 14px;
  border-width: 2px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-muted);
}

.git-logs-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px 16px 20px;
}

.log-item {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  position: relative;
}

.log-time-marker {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.log-time-marker .time {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 500;
}

.log-time-marker .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-primary);
  margin-top: 2px;
}

.log-item:not(:last-child)::after {
  content: '';
  position: absolute;
  left: 21px;
  top: 28px;
  width: 1px;
  height: calc(100% - 8px);
  background: var(--color-border);
}

.log-content-wrapper {
  flex: 1;
  min-width: 0;
}

.log-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.project-badge {
  padding: 2px 6px;
  background: var(--bg-sidebar);
  color: var(--text-regular);
  border-radius: 3px;
  font-size: 11px;
  font-weight: 500;
}

.log-message {
  font-size: 14px;
  color: var(--text-regular);
  line-height: 1.5;
}

.log-diff {
  margin-top: 6px;
  font-size: 11px;
  color: var(--text-muted);
}

.notes-section {
  padding: 16px 20px 12px;
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;
}

.notes-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-regular);
  margin-bottom: 8px;
}

.notes-textarea {
  width: 100%;
  min-height: 80px;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
  box-sizing: border-box;
  color: var(--text-regular);
  background: var(--bg-main);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.notes-textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.08);
}

.archive-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: rgba(37, 99, 235, 0.06);
  border-radius: 20px;
  margin: 0 auto 12px;
  flex-shrink: 0;
  width: fit-content;
  margin-left: auto;
  margin-right: auto;
  margin-top: 4px;
}

.archive-icon {
  font-size: 14px;
  color: var(--color-primary);
}

.archive-text {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 500;
}

.report-type-tabs {
  display: flex;
  gap: 2px;
  background: var(--bg-main);
  padding: 3px;
  border-radius: var(--radius-md);
}

.tab-btn {
  padding: 6px 16px;
  border: none;
  background: transparent;
  border-radius: calc(var(--radius-md) - 2px);
  font-size: 13px;
  font-weight: 500;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.tab-btn:hover {
  color: var(--text-primary);
}

.tab-btn.active {
  background: var(--bg-panel);
  color: var(--color-primary);
}

.generate-btn {
  width: calc(100% - 40px);
  margin: 20px;
  padding: 12px 24px;
  border: none;
  border-radius: var(--radius-md);
  background: var(--text-primary);
  color: var(--bg-panel);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s;
  flex-shrink: 0;
}

.generate-btn:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
}

.generate-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.view-tabs {
  display: flex;
  gap: 0;
  margin: 0 20px 12px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.view-tab {
  padding: 10px 0;
  border: none;
  background: transparent;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-muted);
  cursor: pointer;
  margin-right: 20px;
  transition: all 0.15s;
  position: relative;
}

.view-tab:hover {
  color: var(--text-primary);
}

.view-tab.active {
  color: var(--color-primary);
}

.view-tab.active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--color-primary);
}

.report-content {
  flex: 1;
  padding: 0 20px;
  margin-bottom: 16px;
  min-height: 0;
  height: 100%;
}

.report-editor {
  width: 100%;
  height: 100%;
  min-height: 300px;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 14px;
  font-family: inherit;
  resize: none;
  box-sizing: border-box;
  color: var(--text-regular);
  background: var(--bg-main);
  line-height: 1.6;
}

.report-editor:focus {
  outline: none;
  border-color: var(--color-primary);
}

.report-preview {
  padding: 12px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-regular);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--bg-main);
  height: 100%;
  overflow: auto;
}

.placeholder-text {
  color: var(--text-muted);
}

.actions-bar {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding: 16px 20px;
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;
}

.btn-secondary {
  padding: 10px 20px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--bg-panel);
  color: var(--text-regular);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-secondary:hover {
  background: var(--bg-sidebar);
}

.btn-primary {
  padding: 10px 20px;
  border: none;
  border-radius: var(--radius-md);
  background: var(--text-primary);
  color: var(--bg-panel);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: var(--bg-panel);
  border-radius: calc(var(--radius-md) + 4px);
  width: 90%;
  max-width: 460px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
}

.modal-header h3 {
  font-size: 15px;
  color: var(--text-primary);
  margin: 0;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: var(--text-muted);
  cursor: pointer;
  line-height: 1;
  padding: 0;
  transition: color 0.15s;
}

.close-btn:hover {
  color: var(--text-primary);
}

.modal-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: var(--text-regular);
  font-size: 13px;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 14px;
  transition: border-color 0.15s;
  box-sizing: border-box;
  font-family: inherit;
  color: var(--text-regular);
  background: var(--bg-main);
}

.form-group textarea {
  min-height: 80px;
  resize: vertical;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--color-primary);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid var(--color-border);
}

.btn-cancel {
  padding: 8px 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-regular);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-cancel:hover {
  background: var(--bg-sidebar);
}

.btn-save {
  padding: 8px 16px;
  border: none;
  border-radius: var(--radius-md);
  background: var(--text-primary);
  color: var(--bg-panel);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-save:hover {
  opacity: 0.9;
}

:deep(.markdown-body) h1,
:deep(.markdown-body) h2,
:deep(.markdown-body) h3 {
  margin-top: 16px;
  margin-bottom: 8px;
  color: var(--text-primary);
  font-weight: 600;
}

:deep(.markdown-body) h1 {
  font-size: 18px;
}
:deep(.markdown-body) h2 {
  font-size: 16px;
}
:deep(.markdown-body) h3 {
  font-size: 15px;
}

:deep(.markdown-body) p {
  margin: 8px 0;
}

:deep(.markdown-body) ul {
  padding-left: 20px;
  margin: 8px 0;
}

:deep(.markdown-body) li {
  margin: 4px 0;
}

:deep(.markdown-body) code {
  background: var(--bg-sidebar);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: monospace;
  font-size: 13px;
  color: var(--text-regular);
}

.path-input-container {
  margin-bottom: 8px;
}

.path-textarea {
  width: 100%;
  height: 120px;
  padding: 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 13px;
  font-family: monospace;
  color: var(--text-regular);
  background: var(--bg-main);
  resize: vertical;
  box-sizing: border-box;
}

.path-textarea:focus {
  outline: none;
  border-color: var(--color-primary);
}

.btn-select-dir {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--bg-panel);
  color: var(--text-regular);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-select-dir:hover {
  background: var(--bg-sidebar);
  border-color: var(--text-muted);
}
</style>
