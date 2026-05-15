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

      await shell.exec("git", [
        "config",
        "--global",
        "core.hooksPath",
        configDir,
      ]);

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
      let shouldWrite = true;

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
      } catch (e) {
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
        const parts = line.split(" | ");
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

  async getCommits(
    projectPath: string,
    since: string,
    until: string,
  ): Promise<GitCommit[]> {
    try {
      const projectName = await path.basename(projectPath);

      const format = "%H|%ad|%an|%s";
      const result = await shell.exec(
        "git",
        [
          "log",
          `--since=${since}`,
          `--until=${until}`,
          `--format=${format}`,
          "--date=iso",
        ],
        { cwd: projectPath },
      );

      if (!result.success || !result.stdout) {
        return [];
      }

      const lines = result.stdout.split("\n").filter((line) => line.trim());
      const commits: GitCommit[] = [];

      for (const line of lines) {
        const parts = line.split("|");
        if (parts.length >= 4) {
          commits.push({
            hash: parts[0],
            date: parts[1],
            author: parts[2],
            message: parts.slice(3).join("|"),
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
      const commits = await this.getCommits(
        project.localPath,
        since,
        until,
      );
      allCommits = allCommits.concat(commits);
    }

    allCommits.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    return allCommits;
  }

  getDateRange(type: "daily" | "weekly" | "monthly"): {
    since: string;
    until: string;
    label: string;
  } {
    const now = new Date();
    let since: Date;
    let label: string;

    if (type === "daily") {
      since = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      label = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    } else if (type === "weekly") {
      const dayOfWeek = now.getDay();
      const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      since = new Date(now.getFullYear(), now.getMonth(), diff);
      const end = new Date(since);
      end.setDate(end.getDate() + 6);
      label = `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, "0")}-${String(since.getDate()).padStart(2, "0")} 至 ${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
    } else {
      since = new Date(now.getFullYear(), now.getMonth(), 1);
      label = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    }

    return {
      since: since.toISOString().split("T")[0],
      until: now.toISOString().split("T")[0],
      label,
    };
  }
}
