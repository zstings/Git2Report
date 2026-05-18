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
  const thinkingContent = ref('');
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

  async function cleanInvalidCommits(reportPath: string, date: string): Promise<number> {
    try {
      return await aiService.verifyAndCleanCommitLogs(reportPath, date);
    } catch (error) {
      console.error('清理无效提交失败:', error);
      return 0;
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

  async function fillCommitsFromProjects(reportPath: string, projectPaths: string[], targetDate: string): Promise<number> {
    const { fs, shell, path } = await import('vokex.app');
    
    const originalDir = await path.join(reportPath, 'original');
    await fs.mkdir(originalDir, { recursive: true });
    
    const logFilePath = await path.join(originalDir, `${targetDate}-git_commit_history.txt`);
    
    let existingContent = '';
    if (await fs.exists(logFilePath)) {
      existingContent = await fs.readFile(logFilePath, { encoding: 'utf8' });
    }

    const existingHashes = new Set<string>();
    const hashRegex = /----------([a-f0-9]{40})-o----------/g;
    let match;
    while ((match = hashRegex.exec(existingContent)) !== null) {
      existingHashes.add(match[1]);
    }

    let addedCount = 0;
    const newEntries: string[] = [];

    for (const projectPath of projectPaths) {
      const normalizedPath = projectPath.replace(/\\/g, '/');
      
      const result = await shell.exec('git', [
        '-C', normalizedPath,
        'log',
        '--all',
        '--no-merges',
        `--since="${targetDate} 00:00"`,
        `--until="${targetDate} 23:59"`,
        '--pretty=format:%H|||%ai|||%s|||%b[COMMIT_SEP]',
      ]);

      if (!result.success || !result.stdout) {
        continue;
      }

      const commits = result.stdout.split('[COMMIT_SEP]').filter(c => c.trim());
      
      for (const commit of commits) {
        const parts = commit.split('|||');
        if (parts.length < 3) continue;
        
        const hash = parts[0].trim();
        if (existingHashes.has(hash)) {
          continue;
        }
        
        const date = parts[1].trim();
        const subject = parts[2].trim();
        const body = parts.length > 3 ? parts[3].trim() : '';

        let bodyClean = body.replace(/Signed-off-by:.*/g, '').trim();
        bodyClean = bodyClean.replace(/[\n\r]+/g, ' ').trim();

        let content = subject;
        if (bodyClean) {
          content = `${subject}(${bodyClean})`;
        }

        let diffInfo = '[已忽略]';
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
            diffInfo = diffResult.stdout;
          }
        }

        existingHashes.add(hash);
        addedCount++;

        let entry = `----------${hash}-o----------\n`;
        entry += `项目：${normalizedPath}\n`;
        entry += `hash：${hash}\n`;
        entry += `时间：${date}\n`;
        entry += `内容：${content}\n`;
        entry += `diff_start\n`;
        entry += `${diffInfo}\n`;
        entry += `diff_end\n`;
        entry += `----------${hash}-e----------\n`;
        
        newEntries.push(entry);
      }
    }

    if (addedCount > 0) {
      if (existingContent && !existingContent.endsWith('\n')) {
        existingContent += '\n';
      }
      existingContent += newEntries.join('\n');
      await fs.writeFile(logFilePath, existingContent);
    }

    return addedCount;
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
    cleanInvalidCommits,
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
    fillCommitsFromProjects,
  };
}
