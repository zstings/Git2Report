<script setup lang="ts">
import { ref } from 'vue';
import { dialog, fs, path, shell } from 'vokex.app';
import { normalizePath } from '@/utils';
import type { GitProject } from '@/projects';
import { useMessage } from '@/composables/useMessage';

const props = defineProps<{
  projects: GitProject[];
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'update:projects', value: GitProject[]): void;
}>();

const { success, error, warning, info } = useMessage();
const scanPathsInput = ref('');
const loading = ref(false);

/**
 * 选择扫描起始目录
 */
async function handleSelectDirectories() {
  const result = await dialog.showOpenDialog({
    title: '选择扫描起始目录',
    multiple: true,
    directory: true,
  });
  if (Array.isArray(result) && result.length > 0) {
    const existingPaths = scanPathsInput.value
      .split('\n')
      .map(p => p.trim())
      .filter(p => p.length > 0);
    const newPaths = result.filter(p => !existingPaths.includes(p));
    scanPathsInput.value = [...existingPaths, ...newPaths].join('\n');
  }
}

/**
 * 验证并获取项目信息（检查是否为 Git 仓库，获取远程 URL 和用户名）
 * @param localPath 本地路径
 * @returns 项目信息或 null
 */
async function validateAndGetProject(localPath: string): Promise<GitProject | null> {
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
 * 执行全量扫描，查找 Git 项目
 * @param scanPaths 扫描路径列表
 */
async function performScan(scanPaths: string[]) {
  loading.value = true;
  try {
    const foundProjects: string[] = [];
    const scanPromises = scanPaths.map(async scanPath => {
      try {
        const gitDirs = await fs.glob({ pattern: '**/.git', cwd: scanPath, absolute: true });
        for (const gitDir of gitDirs) {
          const projectPath = gitDir.replace(/[\\/].git$/, '');
          if (projectPath && !foundProjects.includes(projectPath)) {
            foundProjects.push(projectPath);
          }
        }
      } catch {}
    });
    await Promise.all(scanPromises);

    if (foundProjects.length === 0) {
      info('未发现任何 Git 项目');
      return;
    }

    const newProjects = [...props.projects];
    for (const localPath of foundProjects) {
      const normalizedPath = normalizePath(localPath);
      const project = await validateAndGetProject(normalizedPath);
      if (project) {
        const existing = newProjects.find(p => p.localPath === normalizedPath);
        if (!existing) {
          newProjects.push(project);
        }
      }
    }

    emit('update:projects', newProjects);
    success(`扫描完成，发现 ${foundProjects.length} 个项目`);
  } catch (err) {
    error(`扫描失败: ${err}`);
  } finally {
    loading.value = false;
  }
}

/**
 * 处理开始扫描
 */
async function handleStartScan() {
  const scanPaths = scanPathsInput.value
    .trim()
    .split('\n')
    .filter(p => p.trim());
  if (scanPaths.length === 0) {
    warning('请输入或选择至少一个扫描起始目录');
    return;
  }
  emit('update:visible', false);
  await performScan(scanPaths);
}

/**
 * 关闭模态框
 */
function closeModal() {
  emit('update:visible', false);
  scanPathsInput.value = '';
}
</script>

<template>
  <div v-if="visible" class="modal-overlay" @click.self="closeModal">
    <div class="modal-content">
      <div class="modal-header">
        <h3>全盘扫描</h3>
        <button class="modal-close" @click="closeModal">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>扫描起始目录（每行一个）</label>
          <textarea v-model="scanPathsInput" placeholder="输入扫描起始目录，每行一个" rows="6" class="form-control"></textarea>
          <button @click="handleSelectDirectories" class="btn btn-secondary mt-2">选择目录</button>
        </div>
        <div class="alert alert-info"><strong>提示：</strong>扫描会递归查找所有包含 .git 的目录，请谨慎选择扫描范围。</div>
      </div>
      <div class="modal-footer">
        <button @click="closeModal" class="btn btn-secondary">取消</button>
        <button @click="handleStartScan" class="btn btn-primary" :disabled="loading">
          {{ loading ? '扫描中...' : '开始扫描' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--bg-panel);
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--text-muted);
}

.modal-body {
  padding: 16px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px;
  border-top: 1px solid var(--border-color);
}

.form-group {
  margin-bottom: 12px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
}

.form-control {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-input);
  color: var(--text-color);
  font-size: 14px;
  resize: vertical;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-secondary {
  background: var(--bg-button);
  color: var(--text-color);
}

.mt-2 {
  margin-top: 8px;
}

.alert {
  padding: 12px;
  border-radius: 4px;
  font-size: 13px;
}

.alert-info {
  background: rgba(59, 130, 246, 0.1);
  color: var(--color-primary);
  border: 1px solid rgba(59, 130, 246, 0.2);
}
</style>
