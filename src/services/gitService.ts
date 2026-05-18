import { fs, shell, app, path } from "vokex.app";
import git_commit_history from "./git_commit_history.ts";

export interface GitProject {
  localPath: string;
  remoteUrl: string;
  isIgnored?: boolean;
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

  private readonly HOOK_START_MARKER = "# === GIT2REPORT HOOK START ===";
  private readonly HOOK_END_MARKER = "# === GIT2REPORT HOOK END ===";

  async initGitHooks(reportPath?: string): Promise<{ success: boolean; message: string }> {
    try {
      // 确保报告路径存在且创建 original 目录
      if (reportPath) {
        const originalDir = await path.join(reportPath, "original");
        await fs.mkdir(originalDir, { recursive: true });
      }

      const homeDir = await this.getHomeDir();
      const configDir = await path.join(homeDir, ".config", "git", "hooks");

      await fs.mkdir(configDir, { recursive: true });

      await shell.exec("git", ["config", "--global", "core.hooksPath", configDir]);

      const postCommitPath = await path.join(configDir, "post-commit");
      let hookContent = git_commit_history;
      if (reportPath) {
        const normalizedPath = reportPath.replace(/\\/g, "/");
        hookContent = hookContent.replace(/__REPORT_DIR__/g, normalizedPath);
      }
      const wrappedHookContent = `${this.HOOK_START_MARKER}\n${hookContent}\n${this.HOOK_END_MARKER}\n`;

      const exists = await fs.exists(postCommitPath);

      if (exists) {
        let existingContent = await fs.readFile(postCommitPath, {
          encoding: "utf8",
        });

        // 检查是否已经有我们的标记
        const hasStartMarker = existingContent.includes(this.HOOK_START_MARKER);
        const hasEndMarker = existingContent.includes(this.HOOK_END_MARKER);

        if (hasStartMarker && hasEndMarker) {
          // 替换标记之间的内容
          const startIndex = existingContent.indexOf(this.HOOK_START_MARKER);
          const endIndex =
            existingContent.indexOf(this.HOOK_END_MARKER) + this.HOOK_END_MARKER.length;
          existingContent =
            existingContent.substring(0, startIndex) +
            wrappedHookContent +
            existingContent.substring(endIndex);
        } else {
          // 追加到文件末尾
          existingContent = existingContent.trim() + "\n" + wrappedHookContent;
        }

        await fs.writeFile(postCommitPath, existingContent);
      } else {
        // 文件不存在，创建新文件
        await fs.writeFile(postCommitPath, wrappedHookContent);
      }

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

  async scanProjectsFromLogs(logDir: string, todayOnly: boolean = false): Promise<GitProject[]> {
    try {
      const originalDir = await path.join(logDir, "original");
      const exists = await fs.exists(originalDir);

      if (!exists) {
        return [];
      }

      let files = await fs.glob({
        pattern: "*.txt",
        cwd: originalDir,
        absolute: true,
      });

      if (todayOnly) {
        const today = new Date().toISOString().split("T")[0];
        files = files.filter((file) => file.includes(today!));
      }

      const projectMap = new Map<string, string>();

      for (const filePath of files) {
        try {
          const content = await fs.readFile(filePath, { encoding: "utf8" });
          const lines = content.split("\n");

          for (const line of lines) {
            if (line.startsWith("项目：")) {
              const projectPath = line.substring("项目：".length).trim();
              if (projectPath && !projectMap.has(projectPath)) {
                try {
                  const remoteResult = await shell.exec(
                    "git",
                    ["config", "--get", "remote.origin.url"],
                    { cwd: projectPath },
                  );
                  projectMap.set(
                    projectPath,
                    remoteResult.success && remoteResult.stdout
                      ? remoteResult.stdout.trim()
                      : "none",
                  );
                } catch {
                  projectMap.set(projectPath, "none");
                }
              }
            }
          }
        } catch (error) {
          console.error(`读取日志文件 ${filePath} 失败:`, error);
        }
      }

      const projects: GitProject[] = [];
      for (const [localPath, remoteUrl] of projectMap) {
        projects.push({ localPath, remoteUrl });
      }

      return projects;
    } catch (error) {
      console.error("扫描日志目录失败:", error);
      return [];
    }
  }
}
