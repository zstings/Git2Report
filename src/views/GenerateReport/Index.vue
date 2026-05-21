 <script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useAI } from '@/composables/useAI';
import { useConfig } from '@/composables/useConfig';
import { useReport } from '@/composables/useReport';
import { useProjects } from '@/composables/useProjects';
import { useMessage } from '@/composables/useMessage';
import DatePicker from '@/components/DatePicker.vue';
import AIConfigModal from '@/views/GenerateReport/components/AIConfigModal.vue';
import { storage } from 'vokex.app';

const { success, error, warning, info } = useMessage();

const { activeConfig, loadProfiles } = useAI();
const { config: appConfig, loadConfig: loadAppConfig } = useConfig();
const { loadProjects } = useProjects();
const report = useReport();

const showAIConfig = ref(false);
const isGenerating = ref(false);
const isSaving = ref(false);
const viewMode = ref<'preview' | 'edit'>('preview');

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
    const STORAGE_KEY = 'git2report_projects';
    const savedProjects = await storage.getData(STORAGE_KEY);
    if (!savedProjects || !Array.isArray(savedProjects)) {
      warning('请先在系统设置页面配置项目');
      return;
    };
    const activeProject = savedProjects.filter(p => !p.isIgnored);
    await report.loadGitLogs(activeProject, report.selectedDate.value);
    if (report.hasArchivedReport(report.selectedDate.value)) {
      report.generatedReport.value = report.loadArchivedReport(report.selectedDate.value);
    }
  } finally {
    report.loading.value = false;
  }
}

async function handleGenerateReport() {
  if (!activeConfig.value?.apiKey) {
    warning('请先配置 AI 服务');
    showAIConfig.value = true;
    return;
  }

  if (report.filteredGitLogs.value.length === 0 && !report.userNotes.value.trim()) {
    info('当日没有 Git 提交记录');
    return;
  }

  isGenerating.value = true;
  report.generatedReport.value = '';
  try {
    await report.generateDailyReport(chunk => {
      report.generatedReport.value += chunk;
    });
  } catch (err) {
    error(`生成失败: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    isGenerating.value = false;
    if (report.generatedReport.value.trim() && appConfig.value.reportPath) {
      try {
        await report.saveDailyReport(appConfig.value.reportPath);
      } catch {
        // 自动存档失败时不阻塞，用户仍可手动存档
      }
    }
  }
}

function selectElementText(element: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(element);
  const selection = window.getSelection()!;
  selection.removeAllRanges(); // 清除已有选中
  selection.addRange(range);
}

async function handleCopyReport() {
  if (!report.generatedReport.value) return;
  const dom = document.querySelector('.report-preview') as HTMLElement;
  if (!dom) return;
  const docx = dom.cloneNode(true) as HTMLElement;
  docx.style.backgroundColor = 'white';
  dom.appendChild(docx);
  selectElementText(docx);
  document.execCommand('copy');
  dom.removeChild(docx);
  docx.remove();
  success('报告已复制到剪贴板');
}

async function handleSaveReport() {
  if (!appConfig.value.reportPath) {
    warning('请先在系统设置页面设置报告存放目录');
    return;
  }

  isSaving.value = true;
  try {
    await report.saveDailyReport(appConfig.value.reportPath);
    success('报告已存档');
  } catch (err) {
    error(`保存失败: ${err}`);
  } finally {
    isSaving.value = false;
  }
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function changeDate(days: number) {
  const current = new Date(report.selectedDate.value);
  current.setDate(current.getDate() + days);
  report.setDate(formatDate(current));
}

function renderMarkdown(text: string | undefined): string {
   if (!text || typeof text !== 'string') return '';

  try {
    const lines = text.split('\n');
    let html = '';
    const listStack: number[] = []; // 记录当前缩进层级

    const closeLists = (toLevel: number) => {
      while (listStack.length > toLevel) {
        html += '</ul>';
        listStack.pop();
      }
    };

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) {
        closeLists(0);
        continue;
      }

      // 1. 处理标题 (##### [项目A])
      if (/^#{1,6}\s/.test(trimmedLine)) {
        closeLists(0);
        const level = trimmedLine.match(/^#+/)?.[0].length || 1;
        const content = trimmedLine.replace(/^#+\s+/, '');
        // 转换内部的加粗等格式
        const formattedContent = formatInline(content);
        html += `<h${level}>${formattedContent}</h${level}>`;
        continue;
      }

      // 2. 处理分割线 (---)
      if (/^[-*_]{3,}$/.test(trimmedLine)) {
        closeLists(0);
        html += '<hr style="border:none;border-top:1px solid #e6e5e6;margin:10px 0;" />';
        continue;
      }

      // 3. 处理列表 (支持多级缩进)
      const listMatch = line.match(/^(\s*)([-*])\s+(.*)$/);
      if (listMatch) {
        const indent = listMatch[1]?.length || 0;
        const content = formatInline(listMatch[3] || '');

        // 简单的层级判定：根据空格长度划分（0-1格为L1，2格以上为L2）
        const currentLevel = indent === 0 ? 1 : 2;

        if (currentLevel > listStack.length) {
          html += '<ul style="list-style-type: disc; padding-left: 20px;">';
          listStack.push(currentLevel);
        } else if (currentLevel < listStack.length) {
          closeLists(currentLevel);
        }

        html += `<li>${content}</li>`;
      } else {
        // 普通文本行
        closeLists(0);
        html += `<p>${formatInline(line)}</p>`;
      }
    }

    closeLists(0);
    return html;
  } catch (error) {
    console.error('渲染失败:', error);
    return '';
  }
}

// 专门处理行内格式，避免全局正则的陷阱
function formatInline(text: string): string {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // 加粗
    .replace(/\*(.*?)\*/g, '<em>$1</em>')             // 斜体
    .replace(/`(.*?)`/g, '<code>$1</code>')           // 代码
    .replace(/【(.*?)】/g, '<span style="color:#1890ff;font-weight:bold;">【$1】</span>'); // 针对中文括号美化
}

watch(report.selectedDate, async () => {
  await handleLoadGitLogs();
});

onMounted(async () => {
  await Promise.all([loadProfiles(), loadAppConfig()]);
  await loadProjects();
  await report.loadDailyArchive(appConfig.value.reportPath);
  await handleLoadGitLogs();
});
</script>

<template>
  <div class="page report-page">
    <div class="workflow-container">
      <div class="git-panel">
        <div class="panel-header">
          <div class="date-navigator">
            <button class="btn-icon" @click="changeDate(-1)" title="前一天">‹</button>
            <DatePicker v-model="report.selectedDate.value" />
            <button class="btn-icon" @click="changeDate(1)" title="后一天">›</button>
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
          <textarea v-model="report.userNotes.value" class="notes-textarea" placeholder="记录非代码工作..." />
        </div>

        <div v-if="report.hasArchivedReport(report.selectedDate.value)" class="archive-badge">
          <span class="archive-icon">✓</span>
          <span class="archive-text">该日期已有存档报告</span>
        </div>
      </div>

      <div class="report-panel">
        <div class="panel-header">
          <div class="report-type-tabs">
            <button class="tab-btn" @click="report.setReportType('daily')" :class="{ active: report.selectedReportType.value === 'daily' }">日报</button>
            <button class="tab-btn" @click="report.setReportType('weekly')" :class="{ active: report.selectedReportType.value === 'weekly' }">周报</button>
            <button class="tab-btn" @click="report.setReportType('monthly')" :class="{ active: report.selectedReportType.value === 'monthly' }">月报</button>
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
          <button class="btn-primary" @click="handleSaveReport" :disabled="isSaving">
            {{ isSaving ? '保存中...' : '确认存档' }}
          </button>
        </div>
      </div>
    </div>

    <AIConfigModal v-model:visible="showAIConfig" />
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
  min-width: 300px;
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
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  font-size: 18px;
  cursor: pointer;
  color: var(--text-muted);
  transition: all 0.15s;
}

.btn-icon:hover {
  background: var(--bg-sidebar);
  color: var(--text-primary);
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
  padding: 16px 20px;
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
}

.log-time-marker .time {
  font-size: 11px;
  color: var(--text-muted);
}

.log-time-marker .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-primary);
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
}

.project-badge {
  padding: 2px 6px;
  background: var(--bg-sidebar);
  color: var(--text-regular);
  border-radius: 3px;
  font-size: 11px;
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
  padding: 16px 20px;
  border-top: 1px solid var(--color-border);
}

.notes-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 8px;
}

.notes-textarea {
  width: 100%;
  min-height: 80px;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 14px;
  box-sizing: border-box;
  resize: vertical;
  background: var(--bg-main);
}

.archive-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 12px;
  background: rgba(37, 99, 235, 0.04);
  border-radius: 20px;
  margin: 0 auto 12px;
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
  transition: all 0.15s;
}

.tab-btn:hover {
  color: var(--text-primary);
}

.tab-btn {
  padding: 6px 16px;
  border: none;
  background: transparent;
  border-radius: calc(var(--radius-md) - 2px);
  font-size: 13px;
  color: var(--text-muted);
  cursor: pointer;
}

.tab-btn.active {
  background: var(--bg-panel);
  color: var(--color-primary);
  transition: all 0.2s;
  flex-shrink: 0;
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
  margin: 0 20px 12px;
  border-bottom: 1px solid var(--color-border);
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
  min-height: 0;
  margin-bottom: 16px;
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
  resize: none;
  box-sizing: border-box;
  background: var(--bg-main);
  font-family: inherit;
  color: var(--text-regular);
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
  cursor: pointer;
  font-weight: 500;
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
  cursor: pointer;
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

:deep(.markdown-body) code {
  background: var(--bg-sidebar);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: monospace;
  font-size: 13px;
  color: var(--text-regular);
}
</style>
