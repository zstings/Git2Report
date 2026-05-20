import { http, safeStorage, fs, path } from 'vokex.app';
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

  async saveSummaryToLocal(reportPath: string, date: string, content: string): Promise<void> {
    try {
      const summaryDir = await path.join(reportPath, 'summary');
      await fs.mkdir(summaryDir, { recursive: true });

      const archivePath = await path.join(summaryDir, 'daily_archive.json');
      let archive: DailyArchive = {};

      const exists = await fs.exists(archivePath);
      if (exists) {
        const rawContent = await fs.readFile(archivePath, { encoding: 'utf8' });

        let fileContent: string = '';

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
}
