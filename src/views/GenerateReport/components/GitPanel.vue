<script setup lang="ts">
import { onMounted, watch } from 'vue';
import DatePicker from '@/components/DatePicker.vue';
import { useReport } from '@/composables/useReport';
import { storage } from 'vokex.app';

const report = useReport();

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

function changeDate(days: number) {
  const current = new Date(report.selectedDate.value);
  current.setDate(current.getDate() + days);
  report.setDate(formatDate(current));
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function handleLoadGitLogs() {
  report.loading.value = true;
  try {
    const STORAGE_KEY = 'git2report_projects';
    const savedProjects = await storage.getData(STORAGE_KEY);
    if (!savedProjects || !Array.isArray(savedProjects)) {
      return;
    };
    const activeProject = savedProjects.filter((p: { isIgnored: boolean }) => !p.isIgnored);
    await report.loadGitLogs(activeProject, report.selectedDate.value);
    if (report.hasArchivedReport(report.selectedDate.value)) {
      report.generatedReport.value = report.loadArchivedReport(report.selectedDate.value);
    }
  } finally {
    report.loading.value = false;
  }
}

watch(report.selectedDate, async () => {
  await handleLoadGitLogs();
});

onMounted(async () => {
  await handleLoadGitLogs();
});
</script>

<template>
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
</template>

<style scoped>
.git-panel {
  width: 50%;
  min-width: 300px;
  background: var(--bg-panel);
  border-right: 1px solid var(--color-border);
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
</style>
