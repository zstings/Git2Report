import { fs, shell, app, path } from "vokex.app";

export interface GitProject {
  localPath: string;
  remoteUrl: string;
}

export interface GitCommit {
  hash: string;
  date: string;
  author: string;
  message: string;
  projectPath: string;
  projectName: string;
}

export class GitService {
  private static instance: GitService;

  static getInstance(): GitService {
    if (!GitService.instance) {
      GitService.instance = new GitService();
    }
    return GitService.instance;
  }

  private async getHomeDir(): Promise<string> {
    return await app.getPath("home");
  }

  private async getProjectsListPath(): Promise<string> {
    const homeDir = await this.getHomeDir();
    return await path.join(homeDir, ".git_projects_list.txt");
  }

  async initGitHooks(): Promise<{ success: boolean; message: string }> {
    try {
      const homeDir = await this.getHomeDir();
      const configDir = await path.join(homeDir, ".config", "git", "hooks");

      await fs.mkdir(configDir, { recursive: true });

      await shell.exec("git", ["config", "--global", "core.hooksPath", configDir]);

      const postCommitPath = await path.join(configDir, "post-commit");

      const hookContent = `#!/bin/bash
RECORD_FILE="$HOME/.git_projects_list.txt"

PROJECT_PATH=$(git rev-parse --show-toplevel 2>/dev/null)

if [ -n "$PROJECT_PATH" ]; then
    touch "$RECORD_FILE"

    REMOTE_URL=$(git config --get remote.origin.url 2>/dev/null)
    if [ -z "$REMOTE_URL" ]; then
        REMOTE_URL="none"
    fi

    NEW_ENTRY="$PROJECT_PATH | $REMOTE_URL"

    if ! grep -Fq "$PROJECT_PATH |" "$RECORD_FILE" 2>/dev/null; then
        echo "$NEW_ENTRY" >> "$RECORD_FILE"
    else
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|^$PROJECT_PATH |.*|$NEW_ENTRY|" "$RECORD_FILE"
        else
            sed -i "s|^$PROJECT_PATH |.*|$NEW_ENTRY|" "$RECORD_FILE"
        fi
    fi
fi
`;

      const exists = await fs.exists(postCommitPath);
      const shouldWrite = true;

      if (exists) {
        const existingContent = await fs.readFile(postCommitPath, {
          encoding: "utf8",
        });
        if (existingContent === hookContent) {
          return {
            success: true,
            message: "Git 钩子已正确配置，无需更新",
          };
        }
      }

      await fs.writeFile(postCommitPath, hookContent);

      try {
        await shell.exec("chmod", ["+x", postCommitPath]);
      } catch {
        console.log("Windows 系统不需要 chmod");
      }

      return {
        success: true,
        message: "Git 全局钩子初始化成功！",
      };
    } catch (error) {
      console.error("初始化 Git 钩子失败:", error);
      return {
        success: false,
        message: `初始化失败: ${error}`,
      };
    }
  }

  async getProjects(): Promise<GitProject[]> {
    try {
      const projectsListPath = await this.getProjectsListPath();
      const exists = await fs.exists(projectsListPath);

      if (!exists) {
        return [];
      }

      const content = await fs.readFile(projectsListPath, { encoding: "utf8" });
      const lines = content.split("\n").filter((line) => line.trim());

      const projects: GitProject[] = [];
      for (const line of lines) {
        const parts: any = line.split(" | ");
        if (parts.length >= 2) {
          projects.push({
            localPath: parts[0].trim(),
            remoteUrl: parts[1].trim(),
          });
        }
      }

      return projects;
    } catch (error) {
      console.error("读取项目列表失败:", error);
      return [];
    }
  }

  async getCommits(projectPath: string, since: string, until: string): Promise<GitCommit[]> {
    try {
      const projectName = await path.basename(projectPath);

      const format = "###提交：%H%n###作者：%an%n###日期：%ad%n###标题：%s%n###描述：%b%n";
      // alert(
      //   JSON.stringify([
      //     "log",
      //     `--since=${since}`,
      //     `--until=${until}`,
      //     `--format=${format}`,
      //     "--date=iso",
      //   ]),
      // );
      const result = await shell.exec(
        "git",
        ["log", `--since=${since}`, `--until=${until}`, `--format=${format}`, "--date=iso"],
        { cwd: projectPath },
      );

      if (!result.success || !result.stdout) {
        return [];
      }

      const lines = result.stdout
        .split("\n\n")
        .filter((line) => line.trim())
        .map((line) =>
          line
            .replace("\n", "")
            .split("###")
            .filter((line) => line.trim()),
        );
      const commits: GitCommit[] = [];
      for (const line of lines) {
        if (line.length >= 4) {
          commits.push({
            hash: line[0],
            date: line[2],
            author: line[1],
            message: line[3] + `(${line[4]})`,
            projectPath,
            projectName,
          });
        }
      }

      return commits;
    } catch (error) {
      console.error(`获取项目 ${projectPath} 的提交记录失败:`, error);
      return [];
    }
  }

  async getAllCommits(since: string, until: string): Promise<GitCommit[]> {
    const projects = await this.getProjects();
    let allCommits: GitCommit[] = [];

    for (const project of projects) {
      const commits = await this.getCommits(project.localPath, since, until);
      allCommits = allCommits.concat(commits);
    }

    allCommits.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return allCommits;
  }

  getDateRange(type: "daily" | "weekly" | "monthly"): [string, string] {
    // 辅助：格式化 YYYY-MM-DD
    const format = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    };

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const date = now.getDate();

    let since = null;
    let until = null;

    if (type === "daily") {
      const today = new Date(year, month, date);
      since = format(today);
      until = format(today);
    } else if (type === "weekly") {
      const dayOfWeek = now.getDay(); // 0 周日 ~ 6 周六
      // 计算本周一（周一为 1，周日为 0，若周日则周一为今天-6）
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monday = new Date(year, month, date - diffToMonday);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      since = format(monday);
      until = format(sunday);
    } else if (type === "monthly") {
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      since = format(firstDay);
      until = format(lastDay);
    } else {
      throw new Error('Invalid type. Use "daily", "weekly", or "monthly".');
    }

    return [since + " 00:00:00", until + " 23:59:59"];
  }
}
