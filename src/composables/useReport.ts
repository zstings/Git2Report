import { ref, computed } from 'vue';
import { AIService } from '../services/aiService';
import type { GitCommitLog } from '../services/aiService';

export function useReport() {
  const aiService = AIService.getInstance();

  const loading = ref(false);

  const selectedDate = ref(formatDate(new Date()));

  const gitLogs = ref<GitCommitLog[]>([]);
  const ignoredProjectPaths = ref<Set<string>>(new Set());
  const projectDisplayNames = ref<Map<string, string>>(new Map());
  const userNotes = ref('');
  const generatedReport = ref('');
  const dailyArchive = ref<Record<string, string>>({});
  const selectedReportType = ref<'daily' | 'weekly' | 'monthly'>('daily');

  const filteredGitLogs = computed(() => {
    return gitLogs.value.filter(log => !ignoredProjectPaths.value.has(log.projectPath)).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
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

    const allLogsArrays = await Promise.all(project.map(n => fetchProjectLogs(n)));

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

  async function loadDailyArchive(reportPath: string) {
    try {
      dailyArchive.value = await aiService.loadDailyArchive(reportPath);
    } catch (error) {
      console.error('加载日报存档失败:', error);
      dailyArchive.value = {};
    }
    // dailyArchive.value = {};
  }

  async function generateDailyReport(onChunk?: (chunk: string) => void) {
    if (!gitLogsText.value && !userNotes.value.trim()) {
      return '暂无内容可生成报告';
    }

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
    } catch (error) {
      console.error('生成日报失败:', error);
      throw error;
    }
  }

  async function saveDailyReport(reportPath: string) {
    if (!generatedReport.value.trim()) {
      return;
    }

    try {
      await aiService.saveSummaryToLocal(reportPath, selectedDate.value, generatedReport.value);
      await loadDailyArchive(reportPath);
    } catch (error) {
      console.error('保存日报失败:', error);
      throw error;
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

  return {
    loading,
    selectedDate,
    gitLogs,
    filteredGitLogs,
    userNotes,
    generatedReport,
    dailyArchive,
    gitLogsText,
    selectedReportType,
    loadGitLogs,
    loadDailyArchive,
    generateDailyReport,
    saveDailyReport,
    hasArchivedReport,
    loadArchivedReport,
    setDate,
    setReportType,
  };
}
