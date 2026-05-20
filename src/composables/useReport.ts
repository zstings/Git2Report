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
  const projectDisplayNames = ref<Map<string, string>>(new Map());
  const userNotes = ref('');
  const generatedReport = ref('');
  const thinkingContent = ref('');
  const dailyArchive = ref<Record<string, string>>({});

  const filteredGitLogs = computed(() => {
    return gitLogs.value
      .filter(log => !ignoredProjectPaths.value.has(log.projectPath))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  });

  const gitLogsText = computed(() => {
    return filteredGitLogs.value
      .map(log => {
        const displayName = projectDisplayNames.value.get(log.projectPath) || log.projectName;
        return `项目：${displayName}
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

  function setProjectDisplayNames(names: Map<string, string>) {
    projectDisplayNames.value = names;
  }

  /**
   * 从项目列表实时抓取 Git 提交记录
   * 
   * @param projectPaths - 项目路径列表
   * @param targetDate - 目标日期（格式：YYYY-MM-DD）
   * @returns GitCommitLog[] 格式的日志数组
   * 
   * 功能说明：
   * 1. 直接从 Git 仓库抓取，不读写文件
   * 2. 使用 Promise.all 并行从所有项目抓取
   * 3. 跳过合并提交（--no-merges）
   * 4. 抓取所有分支（--all）
   * 5. 时间范围精确到秒
   */
  async function fetchGitLogsFromProjects(projectPaths: string[], targetDate: string): Promise<import('../services/aiService').GitCommitLog[]> {
    const { shell, path: pathUtil } = await import('vokex.app');

    // 定义单个项目抓取函数
    const fetchProjectLogs = async (projectPath: string): Promise<import('../services/aiService').GitCommitLog[]> => {
      const normalizedPath = projectPath.replace(/\\/g, '/');
      const logs: import('../services/aiService').GitCommitLog[] = [];

      // 从 Git 仓库抓取日志
      const gitLogResult = await shell.exec('git', [
        '-C', normalizedPath,
        'log',
        '--all',
        '--no-merges',
        '--reverse',
        `--since="${targetDate} 00:00:00"`,
        `--until="${targetDate} 23:59:59"`,
        '--pretty=format:%H|||%ai|||%s|||%b[COMMIT_SEP]',
      ]);

      if (!gitLogResult.success || !gitLogResult.stdout) {
        return logs;
      }

      // 分割提交记录
      const commits = gitLogResult.stdout.split('[COMMIT_SEP]').filter(c => c.trim());

      for (const commit of commits) {
        const parts = commit.split('|||');
        if (parts.length < 3) continue;

        const hash = parts[0].trim();
        const date = parts[1].trim();
        const subject = parts[2].trim();
        const body = parts.length > 3 ? parts[3].trim() : '';

        // 清理 body 内容
        let bodyClean = body.replace(/Signed-off-by:.*/g, '').trim();
        bodyClean = bodyClean.replace(/[\n\r]+/g, ' ').trim();

        // 拼接内容
        let content = subject;
        if (bodyClean) {
          content = `${subject}(${bodyClean})`;
        }

        // 如果内容长度小于 15，获取 diff 信息
        let diff = '[已忽略]';
        if (content.length < 15) {
          const diffResult = await shell.exec('git', [
            '-C', normalizedPath,
            'show',
            '--no-color',
            '--pretty=',
            '--patch-with-stat',
            hash,
          ]);
          if (diffResult.success) {
            diff = diffResult.stdout;
          }
        }

        // 获取项目名称
        const projectName = normalizedPath.split('/').pop() || normalizedPath.split('\\').pop() || '未知项目';

        logs.push({
          projectPath: normalizedPath,
          projectName,
          hash,
          date,
          content,
          diff: diff.trim(),
        });
      }

      return logs;
    };

    // 并行抓取所有项目
    const allLogsArrays = await Promise.all(
      projectPaths.map(projectPath => fetchProjectLogs(projectPath))
    );

    // 合并并排序
    const allLogs = allLogsArrays.flat();
    return allLogs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  async function loadGitLogs(projectPaths: string[], date: string) {
    loading.value = true;
    try {
      gitLogs.value = await fetchGitLogsFromProjects(projectPaths, date);
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
    thinkingContent,
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
    setProjectDisplayNames,
    formatDate,
    fetchGitLogsFromProjects,
  };
}
