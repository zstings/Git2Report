import { http, storage } from "vokex.app";
import type { GitCommit } from "./gitService";

export interface AIConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
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

  async generateReport(
    commits: GitCommit[],
    reportType: "daily" | "weekly" | "monthly",
    dateLabel: string,
  ): Promise<string> {
    if (!this.config) {
      throw new Error("请先配置 AI 服务");
    }

    if (commits.length === 0) {
      return "暂无提交记录";
    }

    const commitsByProject: Record<string, GitCommit[]> = {};
    for (const commit of commits) {
      if (!commitsByProject[commit.projectName]) {
        commitsByProject[commit.projectName] = [];
      }
      commitsByProject[commit.projectName].push(commit);
    }

    let commitsText = "";
    for (const [projectName, projectCommits] of Object.entries(
      commitsByProject,
    )) {
      commitsText += `\n【${projectName}】\n`;
      for (const commit of projectCommits) {
        commitsText += `- ${commit.message} (${commit.author}, ${commit.date.split(" ")[0]})\n`;
      }
    }

    const typeLabels: Record<string, string> = {
      daily: "日报",
      weekly: "周报",
      monthly: "月报",
    };

    const prompt = `请根据以下 Git 提交记录，生成一份${typeLabels[reportType]}。

日期: ${dateLabel}

提交记录:
${commitsText}

要求:
1. 格式清晰，易于阅读
2. 按项目分组总结
3. 突出重要的工作内容
4. 语言简洁专业
5. 使用 Markdown 格式`;

    try {
      const response = await http.post(
        `${this.config.baseUrl}/chat/completions`,
        {
          model: this.config.model,
          messages: [
            {
              role: "system",
              content: "你是一个专业的工作报告生成助手，擅长根据 Git 提交记录生成清晰、专业的工作报告。",
            },
            {
              role: "user",
              content: prompt,
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
      console.error("生成报告失败:", error);
      throw new Error(`生成报告失败: ${error}`);
    }
  }
}
