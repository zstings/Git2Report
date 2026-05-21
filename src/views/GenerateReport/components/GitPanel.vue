<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import DatePicker from '@/components/DatePicker.vue';
import { storage } from 'vokex.app';
import type { GitCommitLog } from '@/services/aiService';

const loading = ref(false);

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const selectedDate = ref(formatDate(new Date()));

const gitLogs = defineModel<GitCommitLog[]>('modelValue', { default: () => [] });
const userNotes = ref('');
const generatedReport = ref('');
const dailyArchive = ref<Record<string, string>>({});

function setDate(date: string) {
  selectedDate.value = date;
  generatedReport.value = '';
}

function hasArchivedReport(date: string): boolean {
  return !!dailyArchive.value[date];
}

function loadArchivedReport(date: string): string {
  return dailyArchive.value[date] || '';
}

async function fetchGitLogsFromProjects(project: any[], targetDate: string): Promise<GitCommitLog[]> {
  const { shell } = await import('vokex.app');

  const fetchProjectLogs = async (item: any): Promise<GitCommitLog[]> => {
    const normalizedPath = item.localPath.replace(/\\/g, '/');
    const projectName = normalizedPath.split('/').pop() || normalizedPath.split('\\').pop() || '未知项目';
    const logs: GitCommitLog[] = [];

    const currentUserName = item.gitUsername;

    if (!currentUserName) {
      console.log(`[获取提交] 无法获取当前项目的 Git 用户信息，跳过该项目`);
      return logs;
    }

    const gitLogArgs = [
      '-C',
      normalizedPath,
      'log',
      '--all',
      '--no-merges',
      '--reverse',
      `--since="${targetDate} 00:00:00"`,
      `--until="${targetDate} 23:59:59"`,
      '--pretty=format:%H|||%ai|||%an|||%ae|||%s|||%b[COMMIT_SEP]',
    ];

    if (currentUserName) {
      gitLogArgs.push(`--author=${currentUserName}`);
    }

    const gitLogResult = await shell.exec('git', gitLogArgs);

    if (!gitLogResult.success || !gitLogResult.stdout) {
      console.log(`[获取提交] 项目 ${projectName} 没有获取到提交记录`);
      return logs;
    }

    const commits = gitLogResult.stdout.split('[COMMIT_SEP]').filter(c => c.trim());

    for (const commit of commits) {
      const parts: any[] = commit.split('|||');
      if (parts.length < 5) continue;

      const hash = parts[0].trim();
      const date = parts[1].trim();
      const subject = parts[4].trim();
      const body = parts.length > 5 ? parts[5].trim() : '';

      let bodyClean = body.replace(/Signed-off-by:.*/g, '').trim();
      bodyClean = bodyClean.replace(/[\n\r]+/g, ' ').trim();

      let content = subject;
      if (bodyClean) {
        content = `${subject}(${bodyClean})`;
      }

      let diff = '[已忽略]';
      if (content.length < 15) {
        const diffResult = await shell.exec('git', ['-C', normalizedPath, 'show', '--no-color', '--pretty=', '--patch-with-stat', hash]);
        if (diffResult.success) {
          diff = diffResult.stdout;
        }
      }

      logs.push({
        projectPath: normalizedPath,
        projectName,
        hash,
        date,
        content,
        diff: diff.trim(),
      });
    }
    console.log(logs, 'logs');
    return logs;
  };

  const allLogsArrays = await Promise.all(project.filter(p => !p.isIgnored).map(n => fetchProjectLogs(n)));

  const allLogs = allLogsArrays.flat();
  console.log(`[获取提交] 总共获取到 ${allLogs.length} 条提交记录`);
  return allLogs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

async function loadGitLogs(project: any[], date: string) {
  loading.value = true;
  try {
    gitLogs.value = await fetchGitLogsFromProjects(project, date);
  } catch (error) {
    console.error('加载 Git 日志失败:', error);
    gitLogs.value = [];
  } finally {
    loading.value = false;
  }
}

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
  const current = new Date(selectedDate.value);
  current.setDate(current.getDate() + days);
  setDate(formatDate(current));
}

async function handleLoadGitLogs() {
  loading.value = true;
  try {
    const STORAGE_KEY = 'git2report_projects';
    const savedProjects = await storage.getData(STORAGE_KEY);
    if (!savedProjects || !Array.isArray(savedProjects)) {
      return;
    };
    const activeProject = savedProjects.filter((p: { isIgnored: boolean }) => !p.isIgnored);
    await loadGitLogs(activeProject, selectedDate.value);
    if (hasArchivedReport(selectedDate.value)) {
      generatedReport.value = loadArchivedReport(selectedDate.value);
    }
  } finally {
    loading.value = false;
  }
}

watch(selectedDate, async () => {
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
        <DatePicker v-model="selectedDate" />
        <button class="btn-icon" @click="changeDate(1)" title="后一天">›</button>
      </div>
    </div>

    <div v-if="loading" class="loading-container">
      <div class="spinner"></div>
      <span>加载中...</span>
    </div>

    <div v-else-if="gitLogs.length === 0" class="empty-state">
      <p>暂无 Git 提交记录</p>
    </div>

    <div v-else class="git-logs-list">
      <div v-for="(log, index) in gitLogs" :key="index" class="log-item">
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
      <textarea v-model="userNotes" class="notes-textarea" placeholder="记录非代码工作..." />
    </div>

    <div v-if="hasArchivedReport(selectedDate)" class="archive-badge">
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
