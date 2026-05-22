import { http, safeStorage, fs, path } from 'vokex.app';
import { todaySystemPrompt } from '../utils';

/**
 * AI 配置接口
 */
export interface AIConfig {
  /** API 密钥 */
  apiKey: string;
  /** API 基础地址 */
  baseUrl: string;
  /** 模型名称 */
  model: string;
  /** 个人偏好设置 */
  systemPreference: string;
}

/**
 * AI 配置档案接口
 */
export interface AIProfile {
  /** 档案 ID */
  id: string;
  /** 档案名称 */
  name: string;
  /** AI 配置 */
  config: AIConfig;
  /** 是否为当前活跃档案 */
  isActive: boolean;
}

/**
 * 日报存档接口
 */
export interface DailyArchive {
  /** 日期到内容的映射 */
  [date: string]: string;
}

/**
 * Git 提交日志接口
 */
export interface GitCommitLog {
  /** 项目显示名称 */
  displayName: string;
  /** 项目本地路径 */
  projectPath: string;
  /** 项目显示名称 */
  projectName: string;
  /** 提交哈希 */
  hash: string;
  /** 提交日期 */
  date: string;
  /** 提交内容 */
  content: string;
  /** 提交差异 */
  diff: string;
}

/**
 * 旧版配置接口（用于配置迁移）
 */
interface LegacyConfig {
  /** API 密钥 */
  apiKey: string;
  /** API 基础地址 */
  baseUrl: string;
  /** 模型名称 */
  model: string;
  /** 个人偏好设置 */
  systemPreference: string;
}

/**
 * AI 服务类
 * 提供 AI 配置管理和日报生成功能
 * 采用单例模式，确保全局唯一实例
 */
export class AIService {
  private static instance: AIService;
  private profiles: AIProfile[] = [];
  private activeProfileId: string | null = null;

  /**
   * 获取单例实例
   * @returns AIService 实例
   */
  static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  /**
   * 获取当前活跃的配置档案
   * @returns 活跃档案或 null
   */
  getActiveProfile(): AIProfile | null {
    return this.profiles.find(p => p.id === this.activeProfileId) || null;
  }

  /**
   * 获取当前活跃的 AI 配置
   * @returns AI 配置或 null
   */
  getActiveConfig(): AIConfig | null {
    const profile = this.getActiveProfile();
    return profile?.config || null;
  }

  /**
   * 获取所有配置档案
   * @returns 档案列表副本
   */
  getAllProfiles(): AIProfile[] {
    return [...this.profiles];
  }

  /**
   * 迁移旧版配置到新版格式
   * 私有方法，仅在首次加载时调用
   */
  private async migrateLegacyConfig(): Promise<void> {
    try {
      const hasLegacy = await safeStorage.has('aiConfig');
      if (hasLegacy) {
        const legacyConfig = (await safeStorage.getItem('aiConfig')) as LegacyConfig | null;
        if (legacyConfig && legacyConfig.apiKey) {
          const hasNewFormat = await safeStorage.has('aiProfiles');
          if (!hasNewFormat) {
            const defaultProfile: AIProfile = {
              id: this.generateId(),
              name: '默认配置',
              config: {
                apiKey: legacyConfig.apiKey || '',
                baseUrl: legacyConfig.baseUrl || 'https://api.openai.com/v1',
                model: legacyConfig.model || 'gpt-3.5-turbo',
                systemPreference: legacyConfig.systemPreference || '',
              },
              isActive: true,
            };
            await this.saveProfiles([defaultProfile]);
            await safeStorage.removeItem('aiConfig');
          }
        }
      }
    } catch (error) {
      console.error('迁移旧配置失败:', error);
    }
  }

  /**
   * 从本地存储加载配置档案
   * @returns 配置档案列表
   */
  async loadProfiles(): Promise<AIProfile[]> {
    try {
      const hasProfiles = await safeStorage.has('aiProfiles');
      if (hasProfiles) {
        const savedProfiles = (await safeStorage.getItem('aiProfiles')) as AIProfile[];
        if (savedProfiles && Array.isArray(savedProfiles)) {
          this.profiles = savedProfiles;
          const activeProfile = this.profiles.find(p => p.isActive);
          this.activeProfileId = activeProfile?.id ?? (this.profiles.length > 0 ? (this.profiles[0]?.id ?? null) : null);
          return this.profiles;
        }
      }

      await this.migrateLegacyConfig();
      const migratedProfiles = (await safeStorage.getItem('aiProfiles')) as AIProfile[];
      if (migratedProfiles && Array.isArray(migratedProfiles)) {
        this.profiles = migratedProfiles;
        this.activeProfileId = this.profiles.length > 0 ? (this.profiles[0]?.id ?? null) : null;
        return this.profiles;
      }

      return [];
    } catch (error) {
      console.error('加载 AI 配置失败:', error);
      return [];
    }
  }

  async saveProfiles(profiles: AIProfile[]): Promise<void> {
    this.profiles = profiles;
    await safeStorage.setItem('aiProfiles', profiles);
  }

  /**
   * 添加新的配置档案
   * @param profile - 要添加的档案
   */
  async addProfile(profile: AIProfile): Promise<void> {
    this.profiles.push(profile);
    await this.saveProfiles(this.profiles);
  }

  async updateProfile(profileId: string, updates: Partial<AIProfile>): Promise<void> {
    const index = this.profiles.findIndex(p => p.id === profileId);
    if (index !== -1) {
      const existingProfile = this.profiles[index];
      this.profiles[index] = {
        ...existingProfile,
        ...updates,
        id: existingProfile?.id ?? '',
      } as AIProfile;
      await this.saveProfiles(this.profiles);
    }
  }

  async deleteProfile(profileId: string): Promise<void> {
    this.profiles = this.profiles.filter(p => p.id !== profileId);
    if (this.activeProfileId === profileId) {
      this.activeProfileId = this.profiles.length > 0 ? (this.profiles[0]?.id ?? null) : null;
      if (this.activeProfileId) {
        this.profiles = this.profiles.map(p => ({
          ...p,
          isActive: p.id === this.activeProfileId,
        }));
      }
    }
    await this.saveProfiles(this.profiles);
  }

  async setActiveProfile(profileId: string): Promise<void> {
    this.profiles = this.profiles.map(p => ({
      ...p,
      isActive: p.id === profileId,
    }));
    this.activeProfileId = profileId;
    await this.saveProfiles(this.profiles);
  }

  generateId(): string {
    return `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 生成日报
   * @param gitLogs - Git 提交日志
   * @param userNotes - 用户补充内容
   * @param onChunk - 流式回调函数
   * @returns 生成的日报内容
   */
  async generateDailyReport(gitLogs: string, userNotes: string, onChunk?: (chunk: string) => void): Promise<string> {
    const config = this.getActiveConfig();
    if (!config) {
      throw new Error('请先配置 AI 服务');
    }

    const systemPrompt = todaySystemPrompt(config);

    const userPrompt = `Git 提交日志：\n${gitLogs}\n\n用户补充工作内容：\n${userNotes || '无'}`;
    console.log(userPrompt, 'userPrompt');
    alert(userPrompt);

    try {
      const response = await http.fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        body: {
          model: config.model,
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
          Authorization: `Bearer ${config.apiKey}`,
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

  /**
   * 解析 SSE 流式响应
   * @param response - HTTP 响应对象
   * @param onChunk - 片段回调函数
   * @returns 完整文本内容
   */
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
            } catch {
              console.warn('解析 SSE 数据失败');
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

        let fileContent = '';

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
