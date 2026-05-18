import { ref, computed } from 'vue';
import { AIService } from '../services/aiService';
import type { GitCommitLog, ArchiveSummary } from '../services/aiService';

export function useReport() {
  const aiService = AIService.getInstance();

  const loading = ref(false);
  const aiLoading = ref(false);
  const savingLoading = ref(false);

  const selectedDate = ref(formatDate(new Date()));
  const selectedReportType = ref<'daily' | 'weekly' | 'monthly'>('daily');

  const gitLogs = ref<GitCommitLog[]>([]);
  const ignoredProjectPaths = ref<Set<string>>(new Set());
  const userNotes = ref('');
  const generatedReport = ref('');
  const dailyArchive = ref<Record<string, string>>({});

  const filteredGitLogs = computed(() => {
    return gitLogs.value.filter(log => !ignoredProjectPaths.value.has(log.projectPath));
  });

  const gitLogsText = computed(() => {
    return filteredGitLogs.value
      .map(log => {
        return `项目：${log.projectName}
时间：${log.date}
内容：${log.content}
diff_start
${log.diff}
diff_end`;
      })
      .join('\n------------------------\n');
  });

  function formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function getCycleDateRange(type: 'week' | 'month', baseDate: string): [string, string][] {
    const base = new Date(baseDate);
    const year = base.getFullYear();
    const month = base.getMonth();
    const date = base.getDate();

    const dates: [string, string][] = [];

    if (type === 'week') {
      const dayOfWeek = base.getDay();
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monday = new Date(year, month, date - diffToMonday);

      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        dates.push([formatDate(d), formatDate(d)]);
      }
    } else if (type === 'month') {
      const lastDay = new Date(year, month + 1, 0).getDate();
      for (let i = 1; i <= lastDay; i++) {
        const d = new Date(year, month, i);
        dates.push([formatDate(d), formatDate(d)]);
      }
    }

    return dates;
  }

  function setIgnoredProjects(paths: string[]) {
    ignoredProjectPaths.value = new Set(paths);
  }

  async function loadGitLogs(reportPath: string, date: string) {
    loading.value = true;
    try {
      gitLogs.value = await aiService.readGitCommitLogs(reportPath, date);
    } catch (error) {
      console.error('加载 Git 日志失败:', error);
      gitLogs.value = [];
    } finally {
      loading.value = false;
    }
  }

  async function loadDailyArchive(reportPath: string) {
    try {
      dailyArchive.value = await aiService.loadDailyArchive(reportPath);
    } catch (error) {
      console.error('加载日报存档失败:', error);
      dailyArchive.value = {};
    }
  }

  async function generateDailyReport(onChunk?: (chunk: string) => void) {
    if (!gitLogsText.value && !userNotes.value.trim()) {
      return '暂无内容可生成报告';
    }

    aiLoading.value = true;
    try {
      if (onChunk) {
        generatedReport.value = '';
      }
      const report = await aiService.generateDailyReport(gitLogsText.value, userNotes.value, chunk => {
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
    } finally {
      aiLoading.value = false;
    }
  }

  async function generateCycleReport(reportPath: string, type: 'week' | 'month', onChunk?: (chunk: string) => void) {
    const dates = getCycleDateRange(type, selectedDate.value);
    const summaries: ArchiveSummary[] = [];

    for (const [date] of dates) {
      if (dailyArchive.value[date]) {
        summaries.push({
          date,
          content: dailyArchive.value[date],
        });
      }
    }

    if (summaries.length === 0) {
      generatedReport.value = '该时间段暂无存档日报';
      return generatedReport.value;
    }

    aiLoading.value = true;
    try {
      if (onChunk) {
        generatedReport.value = '';
      }
      const report = await aiService.generateCycleReport(summaries, type, chunk => {
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
    } finally {
      aiLoading.value = false;
    }
  }

  async function saveDailyReport(reportPath: string) {
    if (!generatedReport.value.trim()) {
      return;
    }

    savingLoading.value = true;
    try {
      await aiService.saveSummaryToLocal(reportPath, selectedDate.value, generatedReport.value);
      await loadDailyArchive(reportPath);
    } finally {
      savingLoading.value = false;
    }
  }

  function hasArchivedReport(date: string): boolean {
    return !!dailyArchive.value[date];
  }

  function loadArchivedReport(date: string): string {
    return dailyArchive.value[date] || '';
  }

  function setDate(date: string) {
    selectedDate.value = date;
    generatedReport.value = '';
  }

  function setReportType(type: 'daily' | 'weekly' | 'monthly') {
    selectedReportType.value = type;
    generatedReport.value = '';
  }

  function setUserNotes(notes: string) {
    userNotes.value = notes;
  }

  function setGeneratedReport(report: string) {
    generatedReport.value = report;
  }

  return {
    loading,
    aiLoading,
    savingLoading,
    selectedDate,
    selectedReportType,
    gitLogs,
    filteredGitLogs,
    userNotes,
    generatedReport,
    dailyArchive,
    gitLogsText,
    loadGitLogs,
    loadDailyArchive,
    generateDailyReport,
    generateCycleReport,
    saveDailyReport,
    hasArchivedReport,
    loadArchivedReport,
    setDate,
    setReportType,
    setUserNotes,
    setGeneratedReport,
    setIgnoredProjects,
    formatDate,
  };
}
