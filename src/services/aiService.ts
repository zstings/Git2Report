import { http, safeStorage, fs, path, shell } from 'vokex.app';
import { todaySystemPrompt } from '../utils';

export interface AIConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  systemPreference: string;
}

export interface DailyArchive {
  [date: string]: string;
}

export interface ArchiveSummary {
  date: string;
  content: string;
}

export interface GitCommitLog {
  projectPath: string;
  projectName: string;
  hash: string;
  date: string;
  content: string;
  diff: string;
}

export class AIService {
  private static instance: AIService;
  private config: AIConfig | null = null;

  static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  async loadConfig(): Promise<AIConfig | null> {
    try {
      const hasConfig = await safeStorage.has('aiConfig');
      if (hasConfig) {
        const savedConfig = await safeStorage.getItem('aiConfig');
        if (savedConfig) {
          this.config = savedConfig as AIConfig;
          return this.config;
        }
      }
      return null;
    } catch (error) {
      console.error('加载 AI 配置失败:', error);
      return null;
    }
  }

  async saveConfig(config: AIConfig): Promise<void> {
    this.config = config;
    await safeStorage.setItem('aiConfig', config);
  }

  async generateDailyReport(gitLogs: string, userNotes: string, onChunk?: (chunk: string) => void): Promise<string> {
    if (!this.config) {
      throw new Error('请先配置 AI 服务');
    }

    const systemPrompt = todaySystemPrompt(this.config);

    const userPrompt = `Git 提交日志：\n${gitLogs}\n\n用户补充工作内容：\n${userNotes || '无'}`;

    try {
      const response = await http.fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        body: {
          model: this.config.model,
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: userPrompt,
            },
          ],
          temperature: 0.7,
          stream: !!onChunk,
        },
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        stream: !!onChunk,
        timeout: 120,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API 请求失败: ${response.status} - ${errorText}`);
      }

      if (onChunk) {
        return this.parseSSEStream(response, onChunk);
      } else {
        const data = await response.json();
        return data.choices[0].message.content;
      }
    } catch (error) {
      console.error('生成日报失败:', error);
      throw error;
    }
  }

  private async parseSSEStream(response: Response, onChunk: (chunk: string) => void): Promise<string> {
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    if (!reader) {
      throw new Error('无法获取响应流');
    }

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const rawChunk = decoder.decode(value, { stream: true });
        const lines = rawChunk.split('\n');

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;

          if (trimmed.startsWith('data: ')) {
            try {
              const jsonStr = trimmed.slice(6);
              const data = JSON.parse(jsonStr);
              const content = data.choices?.[0]?.delta?.content || '';
              if (content) {
                fullText += content;
                onChunk(content);
              }
            } catch (e) {
              console.warn('解析 SSE 数据失败:', e);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return fullText;
  }

  async generateCycleReport(archiveSummaries: ArchiveSummary[], type: 'week' | 'month', onChunk?: (chunk: string) => void): Promise<string> {
    if (!this.config) {
      throw new Error('请先配置 AI 服务');
    }

    if (archiveSummaries.length === 0) {
      return '该时间段暂无存档日报';
    }

    const typeLabel = type === 'week' ? '周报' : '月报';

    const systemPrompt = `你是一位技术总监。输入的是已过滤代码细节的精简日报，无需再分析 diff。严禁把多天日报机械拼接做流水账。必须站在功能迭代和架构演进高度纵向合并，按【核心业务研发】、【系统架构重构】等大类成果导向输出，面向高层汇报。

${this.config.systemPreference ? `用户偏好：${this.config.systemPreference}` : ''}`;

    const userPrompt = `请根据以下存档的日报内容，生成一份${typeLabel}：

${archiveSummaries.map(summary => `---\n日期：${summary.date}\n${summary.content}`).join('\n')}`;

    try {
      const response = await http.fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        body: {
          model: this.config.model,
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: userPrompt,
            },
          ],
          temperature: 0.7,
          stream: !!onChunk,
        },
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        stream: !!onChunk,
        timeout: 120,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API 请求失败: ${response.status} - ${errorText}`);
      }

      if (onChunk) {
        return this.parseSSEStream(response, onChunk);
      } else {
        const data = await response.json();
        return data.choices[0].message.content;
      }
    } catch (error) {
      console.error('生成周期报告失败:', error);
      throw error;
    }
  }

  async saveSummaryToLocal(reportPath: string, date: string, content: string): Promise<void> {
    try {
      const summaryDir = await path.join(reportPath, 'summary');
      await fs.mkdir(summaryDir, { recursive: true });

      const archivePath = await path.join(summaryDir, 'daily_archive.json');
      let archive: DailyArchive = {};

      const exists = await fs.exists(archivePath);
      if (exists) {
        const rawContent = await fs.readFile(archivePath, { encoding: 'utf8' });

        let fileContent: string;

        if (typeof rawContent === 'string') {
          fileContent = rawContent;
        } else {
          console.warn('读取存档文件返回了不支持的类型');
          archive = {};
        }

        if (fileContent) {
          archive = JSON.parse(fileContent);
        }
      }

      archive[date] = content;
      await fs.writeFile(archivePath, JSON.stringify(archive, null, 2));
    } catch (error) {
      console.error('保存日报存档失败:', error);
      throw new Error(`保存日报存档失败: ${error}`);
    }
  }

  async loadDailyArchive(reportPath: string): Promise<DailyArchive> {
    try {
      const archivePath = await path.join(reportPath, 'summary', 'daily_archive.json');
      const exists = await fs.exists(archivePath);
      if (!exists) {
        return {};
      }

      const rawContent = await fs.readFile(archivePath, { encoding: 'utf8' });
      let content: string;

      if (typeof rawContent === 'string') {
        content = rawContent;
      } else {
        console.warn('读取存档文件返回了不支持的类型');
        return {};
      }

      if (!content || typeof content !== 'string') {
        console.warn('读取存档文件内容为空或无效');
        return {};
      }

      return JSON.parse(content);
    } catch (error) {
      console.error('加载日报存档失败:', error);
      return {};
    }
  }

  async readGitCommitLogs(reportPath: string, date: string): Promise<GitCommitLog[]> {
    try {
      const originalDir = await path.join(reportPath, 'original');
      const logPath = await path.join(originalDir, `${date}-git_commit_history.txt`);

      const exists = await fs.exists(logPath);

      if (!exists) {
        return [];
      }

      const rawContent = await fs.readFile(logPath, { encoding: 'utf8' });
      let content: string;

      if (typeof rawContent === 'string') {
        content = rawContent;
      } else {
        console.warn('读取日志文件返回了不支持的类型');
        return [];
      }

      if (!content || typeof content !== 'string') {
        console.warn('读取日志文件内容为空或无效');
        return [];
      }

      const logs: GitCommitLog[] = [];
      
      // 匹配格式：----------{HASH}-o---------- 开头，----------{HASH}-e---------- 结尾
      const startMarkerRegex = /----------([0-9a-f]+)-o----------/g;
      let match;
      const entries: string[] = [];
      const contentLines = content.split('\n');
      let currentEntry: string[] = [];
      let inEntry = false;

      for (const line of contentLines) {
        if (line.match(/----------([0-9a-f]+)-o----------/)) {
          if (inEntry && currentEntry.length > 0) {
            entries.push(currentEntry.join('\n'));
          }
          inEntry = true;
          currentEntry = [];
        } else if (line.match(/----------([0-9a-f]+)-e----------/)) {
          if (inEntry && currentEntry.length > 0) {
            entries.push(currentEntry.join('\n'));
          }
          inEntry = false;
          currentEntry = [];
        } else if (inEntry) {
          currentEntry.push(line);
        }
      }

      for (const entry of entries) {
        const lines = entry
          .trim()
          .split('\n')
          .filter(l => l.trim());
        if (lines.length === 0) continue;

        let projectPath = '';
        let hash = '';
        let dateStr = '';
        let contentStr = '';
        let diff = '';
        let inDiff = false;

        for (const line of lines) {
          if (line.startsWith('项目：')) {
            projectPath = line.substring('项目：'.length).trim();
          } else if (line.startsWith('hash：')) {
            hash = line.substring('hash：'.length).trim();
          } else if (line.startsWith('时间：')) {
            dateStr = line.substring('时间：'.length).trim();
          } else if (line.startsWith('内容：')) {
            contentStr = line.substring('内容：'.length).trim();
          } else if (line === 'diff_start') {
            inDiff = true;
          } else if (line === 'diff_end') {
            inDiff = false;
          } else if (inDiff) {
            diff += line + '\n';
          }
        }

        if (projectPath) {
          const projectName = path.basename(projectPath);
          logs.push({
            projectPath,
            projectName,
            hash,
            date: dateStr,
            content: contentStr,
            diff: diff.trim(),
          });
        }
      }

      return logs;
    } catch (error) {
      console.error('读取 Git 提交日志失败:', error);
      return [];
    }
  }

  async verifyAndCleanCommitLogs(reportPath: string, date: string): Promise<number> {
    try {
      const originalDir = await path.join(reportPath, 'original');
      const logPath = await path.join(originalDir, `${date}-git_commit_history.txt`);

      console.log(`[清理] 检查文件: ${logPath}`);

      const exists = await fs.exists(logPath);
      if (!exists) {
        console.log(`[清理] 文件不存在`);
        return 0;
      }

      const rawContent = await fs.readFile(logPath, { encoding: 'utf8' });
      let content: string;

      if (typeof rawContent === 'string') {
        content = rawContent;
      } else {
        console.warn('读取日志文件返回了不支持的类型');
        return 0;
      }

      if (!content || typeof content !== 'string') {
        console.log(`[清理] 文件内容为空`);
        return 0;
      }

      console.log(`[清理] 文件原始内容长度: ${content.length}`);

      // 解析条目，保留完整标记
      const contentLines = content.split('\n');
      interface FullEntry {
        startMarker: string;
        contentLines: string[];
        endMarker: string;
        hash: string;
        projectPath: string;
      }
      const fullEntries: FullEntry[] = [];
      let currentEntry: Partial<FullEntry> | null = null;

      for (const line of contentLines) {
        const startMatch = line.match(/----------([0-9a-f]+)-o----------/);
        const endMatch = line.match(/----------([0-9a-f]+)-e----------/);

        if (startMatch) {
          if (currentEntry) {
            console.warn(`[清理] 发现未闭合的条目`);
          }
          currentEntry = {
            startMarker: line,
            contentLines: [],
            hash: startMatch[1],
            projectPath: '',
          };
        } else if (endMatch && currentEntry) {
          currentEntry.endMarker = line;
          fullEntries.push(currentEntry as FullEntry);
          currentEntry = null;
        } else if (currentEntry) {
          currentEntry.contentLines!.push(line);
          if (line.startsWith('项目：')) {
            currentEntry.projectPath = line.substring('项目：'.length).trim();
          }
        }
      }

      console.log(`[清理] 找到 ${fullEntries.length} 条记录`);

      const validFullEntries: FullEntry[] = [];
      let removedCount = 0;

      for (const entry of fullEntries) {
        if (!entry.projectPath || !entry.hash) {
          console.log(`[清理] 跳过无效条目: 缺少项目路径或hash`);
          validFullEntries.push(entry);
          continue;
        }

        const validHash = await this.verifyHashExists(entry.projectPath, entry.hash);

        if (validHash) {
          validFullEntries.push(entry);
        } else {
          removedCount++;
          console.log(`[清理] 移除无效提交: ${entry.hash} (项目: ${entry.projectPath})`);
        }
      }

      if (removedCount > 0) {
        const newContentLines: string[] = [];
        for (const entry of validFullEntries) {
          newContentLines.push(entry.startMarker);
          newContentLines.push(...entry.contentLines);
          newContentLines.push(entry.endMarker);
        }
        let newContent = newContentLines.join('\n');
        // 确保文件末尾有换行符，这样新记录追加时格式正确
        if (newContent.length > 0 && !newContent.endsWith('\n')) {
          newContent += '\n';
        }
        console.log(`[清理] 写入新内容，有效记录: ${validFullEntries.length} 条`);
        await fs.writeFile(logPath, newContent);
        console.log(`[清理] 清理完成，移除了 ${removedCount} 条无效记录`);
      } else {
        console.log(`[清理] 没有需要移除的记录`);
      }

      return removedCount;
    } catch (error) {
      console.error('清理无效提交日志失败:', error);
      return 0;
    }
  }

  private async verifyHashExists(projectPath: string, hash: string): Promise<boolean> {
    try {
      console.log(`[检查] 项目路径: ${projectPath}`);
      
      // 先检查项目路径是否存在
      const pathExists = await fs.exists(projectPath);
      if (!pathExists) {
        console.log(`[验证失败] 项目路径不存在: ${projectPath}`);
        return false;
      }

      // 检查 hash 是否在任何分支的历史记录中（更严格的检查）
      const command = `git -C "${projectPath}" branch --contains ${hash}`;
      console.log(`[检查命令] 完整命令: ${command}`);
      const result = await shell.exec('git', ['-C', projectPath, 'branch', '--contains', hash]);
      console.log(`[检查结果] Hash: ${hash}, Success: ${result.success}, Code: ${result.code}, Stdout: "${result.stdout.trim()}", Stderr: "${result.stderr}"`);
      
      const isValid = result.success && result.code === 0 && result.stdout && result.stdout.trim().length > 0;
      if (!isValid) {
        console.log(`[验证失败] 项目: ${projectPath}, Hash: ${hash} - 提交不在任何分支中`);
      }
      return isValid;
    } catch (error) {
      console.log(`[验证异常] 项目: ${projectPath}, Hash: ${hash}, 错误: ${error}`);
      return false;
    }
  }
}
