<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useAI } from '@/composables/useAI';
import { useConfig } from '@/composables/useConfig';
import { useMessage } from '@/composables/useMessage';
import { AIService } from '@/services/aiService';
import type { GitCommitLog } from '@/services/aiService';
import { formatDate } from '@/utils';

const { success, error, warning, info } = useMessage();
const { activeConfig, loadProfiles } = useAI();
const { config: appConfig, loadConfig: loadAppConfig } = useConfig();
const aiService = AIService.getInstance();

const gitLogs = defineModel<GitCommitLog[]>('modelValue', { default: () => [] });
const selectedDate = defineModel<string>('selectedDate', { default: '' });
const dailyArchive = defineModel<Record<string, string>>('dailyArchive', { default: () => ({}) });

const isGenerating = ref(false);
const isSaving = ref(false);
const viewMode = ref<'preview' | 'edit'>('preview');
const generatedReport = ref('');
const userNotes = ref('');
const selectedReportType = ref<'daily' | 'weekly' | 'monthly'>('daily');
const enableDetailPoints = ref(localStorage.getItem('enableDetailPoints') === 'true');
watch(enableDetailPoints, v => localStorage.setItem('enableDetailPoints', String(v)));

const gitLogsText = computed(() => {
  return gitLogs.value
    .map(log => {
      return `项目：${log.displayName || log.projectName}\n时间：${log.date}\n内容：${log.content}\ndiff_start\n${log.diff}\ndiff_end`;
    })
    .join('\n------------------------\n');
});

function setReportType(type: 'daily' | 'weekly' | 'monthly') {
  selectedReportType.value = type;
  if (type === 'daily') {
    loadArchivedReport();
  } else {
    generatedReport.value = '';
  }
}

// 获取日期范围内的所有日期（含起止）
function getDateRange(startDate: Date, endDate: Date): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    dates.push(formatDate(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

// 根据 selectedDate 和报告类型计算日期范围
function getReportDateRange(): string[] {
  const current = new Date(selectedDate.value);
  if (selectedReportType.value === 'weekly') {
    // 周一~周日
    const day = current.getDay();
    const monday = new Date(current);
    monday.setDate(current.getDate() - (day === 0 ? 6 : day - 1));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return getDateRange(monday, sunday);
  } else if (selectedReportType.value === 'monthly') {
    // 月初~月末
    const firstDay = new Date(current.getFullYear(), current.getMonth(), 1);
    const lastDay = new Date(current.getFullYear(), current.getMonth() + 1, 0);
    return getDateRange(firstDay, lastDay);
  }
  return [selectedDate.value];
}

// 从 dailyArchive 中按日期范围拼接日报内容
function collectDailyContent(dates: string[]): string {
  const parts: string[] = [];
  for (const date of dates) {
    const content = dailyArchive.value[date];
    if (content) {
      parts.push(`【${date}】\n${content}`);
    }
  }
  return parts.join('\n\n------------------------------------------\n\n');
}

async function generateDailyReport(onChunk?: (chunk: string) => void) {
  if (!gitLogsText.value && !userNotes.value.trim()) {
    return '暂无内容可生成报告';
  }

  try {
    if (onChunk) {
      generatedReport.value = '';
    }
    const report = await aiService.generateDailyReport(gitLogsText.value, userNotes.value, enableDetailPoints.value, chunk => {
      if (onChunk) {
        onChunk(chunk);
      } else {
        generatedReport.value += chunk;
      }
    });
    if (!onChunk) {
      generatedReport.value = report;
    }
    return report;
  } catch (err) {
    console.error('生成日报失败:', err);
    throw err;
  }
}

async function loadDailyArchive(reportPath: string) {
  try {
    dailyArchive.value = await aiService.loadDailyArchive(reportPath);
  } catch (err) {
    console.error('加载日报存档失败:', err);
    dailyArchive.value = {};
  }
}

async function saveDailyReport(reportPath: string) {
  if (!generatedReport.value.trim()) {
    return;
  }

  try {
    await aiService.saveSummaryToLocal(reportPath, selectedDate.value, generatedReport.value);
    await loadDailyArchive(reportPath);
  } catch (err) {
    console.error('保存日报失败:', err);
    throw err;
  }
}

async function handleGenerateReport() {
  if (!activeConfig.value?.apiKey) {
    warning('请先配置 AI 服务');
    emit('showAIConfig');
    return;
  }

  // 周报/月报：基于已有日报汇总
  if (selectedReportType.value === 'weekly' || selectedReportType.value === 'monthly') {
    const dates = getReportDateRange();
    const dailyContent = collectDailyContent(dates);
    if (!dailyContent) {
      const typeLabel = selectedReportType.value === 'weekly' ? '周' : '月';
      warning(`所选${typeLabel}期内没有日报存档，请先逐日生成并保存日报`);
      return;
    }

    isGenerating.value = true;
    generatedReport.value = '';
    try {
      await aiService.generateSummaryReport(selectedReportType.value, dailyContent, chunk => {
        generatedReport.value += chunk;
      });
    } catch (err) {
      error(`生成失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      isGenerating.value = false;
    }
    return;
  }

  // 日报：基于 git 提交记录生成
  if (gitLogs.value.length === 0 && !userNotes.value.trim()) {
    info('当日没有 Git 提交记录');
    return;
  }

  isGenerating.value = true;
  generatedReport.value = '';
  try {
    await generateDailyReport(chunk => {
      generatedReport.value += chunk;
    });
  } catch (err) {
    error(`生成失败: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    isGenerating.value = false;
    if (generatedReport.value.trim() && appConfig.value.reportPath) {
      try {
        await saveDailyReport(appConfig.value.reportPath);
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
  if (!generatedReport.value) return;
  const dom = document.querySelector('.report-preview') as HTMLElement;
  if (!dom) return;
  const docx = dom.cloneNode(true) as HTMLElement;
  docx.style.backgroundColor = 'white';
  // 复制时将 CSS class 转为内联样式，确保粘贴到 Word 等外部应用时样式保留
  docx.querySelectorAll('.md-hr').forEach(el => {
    (el as HTMLElement).style.cssText = 'border:none;border-top:1px solid #e6e5e6;margin:10px 0;';
  });
  docx.querySelectorAll('.md-list').forEach(el => {
    (el as HTMLElement).style.cssText = 'list-style-type:disc;padding-left:20px;';
  });
  docx.querySelectorAll('.md-bracket').forEach(el => {
    (el as HTMLElement).style.cssText = 'color:#1890ff;font-weight:bold;';
  });
  dom.appendChild(docx);
  selectElementText(docx);
  document.execCommand('copy');
  dom.removeChild(docx);
  docx.remove();
  success('报告已复制到剪贴板');
}

async function handleSaveReport() {
  if (selectedReportType.value !== 'daily') {
    info('周报/月报无需存档，可随时从日报重新生成');
    return;
  }

  if (!appConfig.value.reportPath) {
    warning('请先在系统设置页面设置报告存放目录');
    return;
  }

  isSaving.value = true;
  try {
    await saveDailyReport(appConfig.value.reportPath);
    success('报告已存档');
  } catch (err) {
    error(`保存失败: ${err}`);
  } finally {
    isSaving.value = false;
  }
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
        html += '<hr class="md-hr" />';
        continue;
      }

      // 3. 处理列表 (支持多级缩进)
      const listMatch = line.match(/^(\s*)([-*])\s+(.*)$/);
      const orderedMatch = !listMatch ? line.match(/^(\s*)(\d+)\.\s+(.*)$/) : null;
      const match = listMatch || orderedMatch;
      if (match) {
        const indent = match[1]?.length || 0;
        const content = formatInline(match[3] || '');

        const currentLevel = indent < 2 ? 1 : indent < 4 ? 2 : 3;
        const isOrdered = !!orderedMatch;
        const tag = isOrdered ? 'ol' : 'ul';
        const listClass = isOrdered ? 'md-olist' : 'md-list';

        if (currentLevel > listStack.length) {
          html += `<${tag} class="${listClass}">`;
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
  } catch (err) {
    console.error('渲染失败:', err);
    return '';
  }
}

// 专门处理行内格式，避免全局正则的陷阱
function formatInline(text: string): string {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // 加粗
    .replace(/\*(.*?)\*/g, '<em>$1</em>') // 斜体
    .replace(/`(.*?)`/g, '<code>$1</code>') // 代码
    .replace(/【(.*?)】/g, '<span class="md-bracket">【$1】</span>'); // 针对中文括号美化
}

function loadArchivedReport() {
  if (dailyArchive.value[selectedDate.value]) {
    generatedReport.value = dailyArchive.value[selectedDate.value] ?? '';
  } else {
    generatedReport.value = '';
  }
}

async function initDailyArchive() {
  loadProfiles();
  await loadAppConfig();
  const reportPath = appConfig.value.reportPath;
  console.log(reportPath);
  if (!reportPath) return;
  await loadDailyArchive(reportPath);
  loadArchivedReport();
}

initDailyArchive();

watch(
  () => appConfig.value.reportPath,
  newPath => {
    if (newPath) {
      loadDailyArchive(newPath).then(() => loadArchivedReport());
    }
  },
);

watch(selectedDate, () => {
  loadArchivedReport();
});

const emit = defineEmits<{
  (e: 'showAIConfig'): void;
}>();
</script>

<template>
  <div class="report-panel">
    <div class="panel-header">
      <div class="report-type-tabs">
        <button class="tab-btn" @click="setReportType('daily')" :class="{ active: selectedReportType === 'daily' }">日报</button>
        <button class="tab-btn" @click="setReportType('weekly')" :class="{ active: selectedReportType === 'weekly' }">周报</button>
        <button class="tab-btn" @click="setReportType('monthly')" :class="{ active: selectedReportType === 'monthly' }">月报</button>
      </div>
      <label v-if="selectedReportType === 'daily'" class="detail-toggle">
        <input type="checkbox" v-model="enableDetailPoints" />
        <span>详细要点</span>
      </label>
      <button class="btn-icon" @click="emit('showAIConfig')" title="AI 配置">⚙️</button>
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
      <textarea v-if="viewMode === 'edit'" v-model="generatedReport" class="report-editor" placeholder="点击上方按钮生成报告..." />
      <div v-else class="report-preview markdown-body">
        <div v-if="generatedReport" v-html="renderMarkdown(generatedReport)"></div>
        <div v-else class="placeholder-text">点击上方按钮生成报告...</div>
      </div>
    </div>

    <div v-if="generatedReport" class="actions-bar">
      <span v-if="selectedReportType === 'daily' && dailyArchive[selectedDate]" class="archive-hint">✓ 已存档</span>
      <button class="btn-secondary" @click="handleCopyReport">一键复制</button>
      <button v-if="selectedReportType === 'daily'" class="btn-primary" @click="handleSaveReport" :disabled="isSaving">
        {{ isSaving ? '保存中...' : '确认存档' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.report-panel {
  flex: 1;
  background: var(--bg-panel);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
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
  margin-left: auto;
}

.btn-icon:hover {
  background: var(--bg-sidebar);
  color: var(--text-primary);
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

.detail-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-muted);
  cursor: pointer;
  margin-left: 8px;
  user-select: none;
}

.detail-toggle input {
  margin: 0;
  cursor: pointer;
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
  align-items: center;
  justify-content: flex-end;
  padding: 16px 20px;
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;
}

.archive-hint {
  font-size: 12px;
  color: var(--color-primary);
  margin-right: auto;
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

:deep(.markdown-body) .md-hr {
  border: none;
  border-top: 1px solid #e6e5e6;
  margin: 10px 0;
}

:deep(.markdown-body) .md-list {
  list-style-type: disc;
  padding-left: 20px;
}

:deep(.markdown-body) .md-olist {
  list-style-type: decimal;
  padding-left: 20px;
}

:deep(.markdown-body) .md-bracket {
  color: #1890ff;
  font-weight: bold;
  margin-bottom: 3px;
  display: block;
}
</style>
