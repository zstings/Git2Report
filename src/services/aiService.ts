import { http, storage, fs, path } from "vokex.app";

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
      const savedConfig = await storage.getData("aiConfig");
      if (savedConfig) {
        this.config = savedConfig as AIConfig;
        return this.config;
      }
      return null;
    } catch (error) {
      console.error("加载 AI 配置失败:", error);
      return null;
    }
  }

  async saveConfig(config: AIConfig): Promise<void> {
    this.config = config;
    await storage.setData("aiConfig", config);
  }

  async generateDailyReport(
    gitLogs: string,
    userNotes: string,
  ): Promise<string> {
    if (!this.config) {
      throw new Error("请先配置 AI 服务");
    }

    const systemPrompt = `你是一位开发主管。严格基于数据总结，严禁捏造。对包含多任务的提交信息进行原子性拆分，对同模块的多次提交进行逻辑合并。如果提交信息极短（如 "1"），必须深度分析 diff_start ... diff_end 块的代码行变动以推断开发者真实意图并补偿专业文字。

格式要求：输出标准的 Markdown。包含 ## 今日工作总结（按项目/模块分类）和 ## 明日计划（智能推导）。

${this.config.systemPreference ? `用户偏好：${this.config.systemPreference}` : ""}`;

    const userPrompt = `Git 提交日志：
${gitLogs}

用户补充工作内容：
${userNotes || "无"}`;

    try {
      const response = await http.post(
        `${this.config.baseUrl}/chat/completions`,
        {
          model: this.config.model,
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: userPrompt,
            },
          ],
          temperature: 0.7,
        },
        {
          headers: {
            "Authorization": `Bearer ${this.config.apiKey}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error(`API 请求失败: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error("生成日报失败:", error);
      throw new Error(`生成日报失败: ${error}`);
    }
  }

  async generateCycleReport(
    archiveSummaries: ArchiveSummary[],
    type: "week" | "month",
  ): Promise<string> {
    if (!this.config) {
      throw new Error("请先配置 AI 服务");
    }

    if (archiveSummaries.length === 0) {
      return "该时间段暂无存档日报";
    }

    const typeLabel = type === "week" ? "周报" : "月报";

    const systemPrompt = `你是一位技术总监。输入的是已过滤代码细节的精简日报，无需再分析 diff。严禁把多天日报机械拼接做流水账。必须站在功能迭代和架构演进高度纵向合并，按【核心业务研发】、【系统架构重构】等大类成果导向输出，面向高层汇报。

${this.config.systemPreference ? `用户偏好：${this.config.systemPreference}` : ""}`;

    const userPrompt = `请根据以下存档的日报内容，生成一份${typeLabel}：

${archiveSummaries
  .map((summary) => `---\n日期：${summary.date}\n${summary.content}`)
  .join("\n")}`;

    try {
      const response = await http.post(
        `${this.config.baseUrl}/chat/completions`,
        {
          model: this.config.model,
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: userPrompt,
            },
          ],
          temperature: 0.7,
        },
        {
          headers: {
            "Authorization": `Bearer ${this.config.apiKey}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error(`API 请求失败: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error("生成周期报告失败:", error);
      throw new Error(`生成周期报告失败: ${error}`);
    }
  }

  async saveSummaryToLocal(
    reportPath: string,
    date: string,
    content: string,
  ): Promise<void> {
    try {
      const summaryDir = await path.join(reportPath, "summary");
      await fs.mkdir(summaryDir, { recursive: true });

      const archivePath = await path.join(summaryDir, "daily_archive.json");
      let archive: DailyArchive = {};

      const exists = await fs.exists(archivePath);
      if (exists) {
        const rawContent = await fs.readFile(archivePath, { encoding: "utf-8" });
        let content: string;
        
        if (typeof rawContent === 'string') {
          content = rawContent;
        } else if (rawContent instanceof Uint8Array) {
          content = new TextDecoder().decode(rawContent);
        } else {
          console.warn('读取存档文件返回了不支持的类型');
          archive = {};
        }
        
        if (content) {
          archive = JSON.parse(content);
        }
      }

      archive[date] = content;
      await fs.writeFile(archivePath, JSON.stringify(archive, null, 2));
    } catch (error) {
      console.error("保存日报存档失败:", error);
      throw new Error(`保存日报存档失败: ${error}`);
    }
  }

  async loadDailyArchive(reportPath: string): Promise<DailyArchive> {
    try {
      const archivePath = await path.join(
        reportPath,
        "summary",
        "daily_archive.json",
      );
      const exists = await fs.exists(archivePath);
      if (!exists) {
        return {};
      }

      const rawContent = await fs.readFile(archivePath, { encoding: "utf-8" });
      let content: string;
      
      if (typeof rawContent === 'string') {
        content = rawContent;
      } else if (rawContent instanceof Uint8Array) {
        content = new TextDecoder().decode(rawContent);
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
      console.error("加载日报存档失败:", error);
      return {};
    }
  }

  async readGitCommitLogs(
    reportPath: string,
    date: string,
  ): Promise<GitCommitLog[]> {
    try {
      const originalDir = await path.join(reportPath, "original");
      const logPath = await path.join(
        originalDir,
        `${date}-git_commit_history.txt`,
      );

      console.log(`[DEBUG] 尝试读取 Git 日志文件:`);
      console.log(`[DEBUG]   reportPath: ${reportPath}`);
      console.log(`[DEBUG]   date: ${date}`);
      console.log(`[DEBUG]   originalDir: ${originalDir}`);
      console.log(`[DEBUG]   logPath: ${logPath}`);

      const exists = await fs.exists(logPath);
      console.log(`[DEBUG]   文件是否存在: ${exists}`);
      
      if (!exists) {
        console.log(`[DEBUG]   文件不存在，返回空数组`);
        return [];
      }

      const rawContent = await fs.readFile(logPath, { encoding: "utf-8" });
      let content: string;
      
      if (typeof rawContent === 'string') {
        content = rawContent;
      } else if (rawContent instanceof Uint8Array) {
        content = new TextDecoder().decode(rawContent);
      } else {
        console.warn('读取日志文件返回了不支持的类型');
        return [];
      }
      
      if (!content || typeof content !== 'string') {
        console.warn('读取日志文件内容为空或无效');
        return [];
      }
      
      const logs: GitCommitLog[] = [];

      const entries = content.split("------------------------").filter((e) =>
        e.trim()
      );

      for (const entry of entries) {
        const lines = entry.trim().split("\n").filter((l) => l.trim());
        if (lines.length === 0) continue;

        let projectPath = "";
        let hash = "";
        let dateStr = "";
        let contentStr = "";
        let diff = "";
        let inDiff = false;

        for (const line of lines) {
          if (line.startsWith("项目：")) {
            projectPath = line.substring("项目：".length).trim();
          } else if (line.startsWith("hash：")) {
            hash = line.substring("hash：".length).trim();
          } else if (line.startsWith("时间：")) {
            dateStr = line.substring("时间：".length).trim();
          } else if (line.startsWith("内容：")) {
            contentStr = line.substring("内容：".length).trim();
          } else if (line === "diff_start") {
            inDiff = true;
          } else if (line === "diff_end") {
            inDiff = false;
          } else if (inDiff) {
            diff += line + "\n";
          }
        }

        if (projectPath) {
          const projectName = await path.basename(projectPath);
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
      console.error("读取 Git 提交日志失败:", error);
      return [];
    }
  }
}
