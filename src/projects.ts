import { fs, path, shell, storage } from 'vokex.app';
import { ref } from 'vue';
import { normalizePath } from './utils';
import { useMessage } from '@/composables/useMessage';
const { success, error } = useMessage();

export interface GitProject {
  localPath: string;
  remoteUrl: string;
  gitUsername?: string;
  isIgnored?: boolean;
  displayName?: string;
}

export const projects = ref<GitProject[]>([]);

export const STORAGE_KEY = 'git2report_projects';

/**
 * 加载项目列表
 */
export async function loadProjects(cb: () => void) {
  try {
    const savedProjects = await storage.getData(STORAGE_KEY);
    if (savedProjects && Array.isArray(savedProjects)) {
      savedProjects.forEach(project => {
        project.localPath = normalizePath(project.localPath);
      });
      projects.value = savedProjects;
      saveProjects();
    }
  } finally {
    if (cb) cb();
  }
}

/**
 * 保存项目列表
 */
export async function saveProjects() {
  await storage.setData(STORAGE_KEY, projects.value);
}

/**
 * 验证并获取项目信息（检查是否为 Git 仓库，获取远程 URL 和用户名）
 * @param localPath 本地路径
 * @returns 项目信息或 null
 */
export async function validateAndGetProject(localPath: string): Promise<GitProject | null> {
  try {
    const gitDir = await path.join(localPath, '.git');
    const exists = await fs.exists(gitDir);
    if (!exists) return null;

    let remoteUrl = 'none';
    try {
      const result = await shell.exec('git', ['config', '--get', 'remote.origin.url'], { cwd: localPath });
      if (result.success && result.stdout) {
        remoteUrl = result.stdout.trim();
      }
    } catch {}

    let gitUsername = '';
    try {
      const localResult = await shell.exec('git', ['config', 'user.name'], { cwd: localPath });
      if (localResult.success && localResult.stdout) {
        gitUsername = localResult.stdout.trim();
      }
    } catch {}

    return { localPath, remoteUrl, gitUsername };
  } catch {
    return null;
  }
}

/**
 * 合并添加项目的路径
 */
export async function mergeAddProjects(paths: string[], cb?: { success?: () => void; error?: (msg: any) => void; finally?: () => void }) {
  let addedCount = 0; // 新增项目数量
  let updatedCount = 0; // 更新项目数量
  try {
    for (const localPath of paths) {
      const normalizedPath = normalizePath(localPath);
      const project = await validateAndGetProject(normalizedPath);
      if (project) {
        const item = projects.value.find(p => p.localPath === normalizedPath);
        if (item) {
          item.remoteUrl = project.remoteUrl;
          item.gitUsername = project.gitUsername;
          updatedCount++;
        } else {
          projects.value.push(project);
          addedCount++;
        }
      }
    }
    let message = '';
    if (addedCount > 0 && updatedCount > 0) {
      message = `成功添加 ${addedCount} 个项目，更新 ${updatedCount} 个项目`;
    } else if (addedCount > 0) {
      message = `成功添加 ${addedCount} 个项目`;
    } else if (updatedCount > 0) {
      message = `成功更新 ${updatedCount} 个项目`;
    } else {
      message = '未添加或更新任何项目';
    }
    success(message);
    await saveProjects();
    if (cb && cb.success) cb.success();
  } catch (err) {
    error(`添加失败: ${err}`);
    if (cb && cb.error) cb.error(err);
  } finally {
    if (cb && cb.finally) cb.finally();
  }
}
