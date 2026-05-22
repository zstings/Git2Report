<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import DatePicker from '@/components/DatePicker.vue';
import { useProjects } from '@/composables/useProjects';
import type { GitCommitLog } from '@/services/aiService';
import { formatDate } from '@/utils';

const { loadProjects, activeProjects } = useProjects();

const loading = ref(false);

const selectedDate = defineModel<string>('selectedDate', { default: '' });

const gitLogs = defineModel<GitCommitLog[]>('modelValue', { default: () => [] });
const userNotes = ref('');

async function fetchGitLogsFromProjects(project: any[], targetDate: string): Promise<GitCommitLog[]> {
  const { shell } = await import('vokex.app');

  // 手动实现异步池，限制【项目级别】的并发
  async function asyncPool(limit: number, array: any[], iteratorFn: (item: any) => Promise<any>) {
    const ret = []; // 存储所有任务的 Promise
    const executing: any[] = []; // 存储当前正在执行的任务

    for (const item of array) {
      // 调用 iteratorFn，并确保它完成后从 executing 队列中移除自己
      const p = Promise.resolve().then(() => iteratorFn(item));
      ret.push(p);

      if (limit <= array.length) {
        const e: any = p.finally(() => {
          const index = executing.indexOf(e);
          if (index > -1) executing.splice(index, 1);
        });
        executing.push(e);

        // 如果当前执行中的任务数达到了限制，就等待其中最快的一个完成
        if (executing.length >= limit) {
          await Promise.race(executing);
        }
      }
    }
    return Promise.all(ret);
  }

  const fetchProjectLogs = async (item: any): Promise<GitCommitLog[]> => {
    const normalizedPath = item.localPath.replace(/\\/g, '/');
    const projectName = normalizedPath.split('/').pop() || '未知项目';
    const currentUserName = item.gitUsername;
    if (!currentUserName) return [];

    // 获取日志元数据（不带 -p，保证响应极快且体积小）
    const gitLogArgs = [
      '-C',
      normalizedPath,
      'log',
      '--all',
      '--no-merges',
      '--reverse',
      `--author=${currentUserName}`,
      `--since=${targetDate} 00:00:00`,
      `--until=${targetDate} 23:59:59`,
      '--pretty=format:%H|||%ai|||%s|||%b[COMMIT_SEP]',
    ];

    const gitLogResult = await shell.exec('git', gitLogArgs);
    if (!gitLogResult.success || !gitLogResult.stdout) return [];

    const commits = gitLogResult.stdout.split('[COMMIT_SEP]').filter(c => c.trim());
    const logs: GitCommitLog[] = [];

    for (const commit of commits) {
      const parts: any[] = commit.split('|||');
      if (parts.length < 3) continue;

      const hash = parts[0].trim();
      const date = parts[1].trim();
      const subject = parts[2].trim();
      const body = parts[3]?.trim() || '';

      const bodyClean = body
        .replace(/Signed-off-by:.*/g, '')
        .replace(/[\n\r]+/g, ' ')
        .trim();
      const content = bodyClean ? `${subject}(${bodyClean})` : subject;

      let diff = '[已忽略]';
      // 只有短提交才触发额外的 shell 调用
      if (content.length < 15) {
        // 这里不需要再加并发控制，因为外部项目已经是并发的了
        const diffResult = await shell.exec('git', ['-C', normalizedPath, 'show', '--no-color', '--pretty=', '--patch-with-stat', hash]);
        if (diffResult.success) diff = diffResult.stdout.trim();
      }

      logs.push({
        displayName: item.displayName,
        projectPath: normalizedPath,
        projectName,
        hash,
        date,
        content,
        diff,
      });
    }
    return logs;
  };

  // 这里的并发数很关键：
  // 30 个项目，并发设为 5-6。
  // 即使这 5 个项目同时在跑 git show，总进程数也在可控范围内。
  const allLogsArrays = await asyncPool(6, project, fetchProjectLogs);

  const allLogs = allLogsArrays.flat();
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
  selectedDate.value = formatDate(current);
}

async function handleLoadGitLogs() {
  loading.value = true;
  try {
    await loadProjects();
    await loadGitLogs(activeProjects.value, selectedDate.value);
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
  flex: 1;
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
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
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
</style>
