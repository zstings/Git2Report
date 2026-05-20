<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useConfig } from '../composables/useConfig';
import { dialog, fs, path, shell, storage } from 'vokex.app';

const STORAGE_KEY = 'git2report_projects';

interface GitProject {
  localPath: string;
  remoteUrl: string;
  gitUsername?: string;
  isIgnored?: boolean;
  displayName?: string;
}

const { loadConfig } = useConfig();
const loading = ref(false);
const projects = ref<GitProject[]>([]);
const searchQuery = ref('');
const showEditModal = ref(false);
const showAddModal = ref(false);
const showScanModal = ref(false);
const editingProject = ref<GitProject | null>(null);
const editNameInput = ref('');
const addProjectPathsInput = ref('');
const scanPathsInput = ref('');

const filteredProjects = computed(() => {
  let result = projects.value;
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase().trim();
    result = result.filter(project => {
      const projectName = project.localPath.split(/[\\/]/).pop()?.toLowerCase() || '';
      const path = project.localPath.toLowerCase();
      const remote = project.remoteUrl.toLowerCase();
      return projectName.includes(query) || path.includes(query) || remote.includes(query);
    });
  }
  return result;
});

function normalizePath(path: string) {
  return path.replace(/\\/g, '/')
}

function getProjectDisplayName(project: GitProject): string {
  if (project.displayName) {
    return project.displayName;
  }
  return project.localPath.split(/[\\/]/).pop() || '未知项目';
}

// 保存项目列表
async function saveProjects() {
  try {
    await storage.setData(STORAGE_KEY, projects.value);
  } catch (error) {
    console.error('保存项目列表失败:', error);
  }
}

// 加载项目列表
async function loadProjects() {
  loading.value = true;
  try {
    const savedProjects = await storage.getData(STORAGE_KEY);
    if (savedProjects && Array.isArray(savedProjects)) {
      // 标准化路径
      savedProjects.forEach(project => {
        project.localPath = normalizePath(project.localPath);
      });
      projects.value = savedProjects;
      saveProjects();
      console.log('加载项目列表:', projects.value);
    }
  } catch (error) {
    console.error('加载项目失败:', error);
  } finally {
    loading.value = false;
  }
}

async function toggleProjectIgnore(projectPath: string) {
  const project = projects.value.find(p => p.localPath === projectPath);
  if (project) {
    project.isIgnored = !project.isIgnored;
    await saveProjects();
  }
}

function openEditModal(project: GitProject) {
  editingProject.value = project;
  editNameInput.value = project.displayName || '';
  showEditModal.value = true;
}

async function saveDisplayName() {
  if (!editingProject.value) return;
  const project = projects.value.find(p => p.localPath === editingProject.value!.localPath);
  if (project) {
    project.displayName = editNameInput.value.trim() || undefined;
    await saveProjects();
  }
  showEditModal.value = false;
  editingProject.value = null;
  editNameInput.value = '';
}

function closeEditModal() {
  showEditModal.value = false;
  editingProject.value = null;
  editNameInput.value = '';
}

async function handleSelectDirectoriesForAdd() {
  const result = await dialog.showOpenDialog({
    title: '选择 Git 项目目录',
    multiple: true,
    directory: true,
    defaultPath: '',
  });

  console.log('[选择目录] 返回结果:', result, '类型:', typeof result, '是否数组:', Array.isArray(result));

  // 检查各种可能的返回格式
  let selectedPaths: string[] = [];
  if (Array.isArray(result) && result.length > 0) {
    selectedPaths = result;
  } else if (typeof result === 'string' && result) {
    selectedPaths = [result];
  }

  console.log('[选择目录] 解析到的路径:', selectedPaths);

  if (selectedPaths.length > 0) {
    const existingPaths = addProjectPathsInput.value.trim().split('\n').filter(p => p.trim());
    const newPaths = [...new Set([...existingPaths, ...selectedPaths])];
    addProjectPathsInput.value = newPaths.join('\n');
    console.log('[选择目录] 更新后的输入:', addProjectPathsInput.value);
  }
}

// 验证并获取项目信息: 检查项目目录是否存在，获取远程 URL 和本地 git 用户名
async function validateAndGetProject(localPath: string): Promise<GitProject | null> {
  try {
    const gitDir = await path.join(localPath, '.git');

    const exists = await fs.exists(gitDir);

    if (!exists) {
      return null;
    }

    let remoteUrl = 'none';
    try {
      const result = await shell.exec('git', ['config', '--get', 'remote.origin.url'], { cwd: localPath });

      if (result.success && result.stdout) {
        remoteUrl = result.stdout.trim();
      }
    } catch (e) {
      console.log('[验证项目] 获取远程 URL 失败:', e);
    }

    let gitUsername = '';
    // 先尝试本地配置
    try {
      const localResult = await shell.exec('git', ['config', 'user.name'], { cwd: localPath });

      if (localResult.success && localResult.stdout) {
        gitUsername = localResult.stdout.trim();
      }
    } catch (e) {
      console.log('[验证项目] 获取 git 用户名失败:', e);
    }

    return {
      localPath,
      remoteUrl,
      gitUsername,
    };
  } catch (e) {
    console.error('[验证项目] 异常:', e);
    return null;
  }
}

// 添加项目
async function handleAddProjects() {
  const paths = addProjectPathsInput.value.trim().split('\n').filter(p => p.trim());
  if (paths.length === 0) {
    await dialog.info({
      title: '提示',
      message: '请输入或选择项目路径',
    });
    return;
  }
  loading.value = true;
  let addedCount = 0; // 新增项目数量
  let updatedCount = 0; // 更新项目数量
  try {
    for (const localPath of paths) {
      const normalizedPath = normalizePath(localPath);
      const project = await validateAndGetProject(normalizedPath);
      if (project) {
        const item = projects.value.find(p => p.localPath === normalizedPath)!;
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

    console.log('[添加项目] 最终项目列表:', projects.value);

    if (addedCount > 0 || updatedCount > 0) {
      await saveProjects();
    }

    showAddModal.value = false;
    addProjectPathsInput.value = '';

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

    await dialog.info({
      title: '完成',
      message,
    });
  } catch (error) {
    console.error('[添加项目] 错误:', error);
    await dialog.error({
      title: '添加失败',
      message: String(error),
    });
  } finally {
    loading.value = false;
  }
}

// 关闭添加项目弹窗
function closeAddModal() {
  showAddModal.value = false;
  addProjectPathsInput.value = '';
}

// 关闭扫描弹窗
function closeScanModal() {
  showScanModal.value = false;
  scanPathsInput.value = '';
}

// 选择扫描起始目录
async function handleSelectDirectoriesForScan() {
  const result = await dialog.showOpenDialog({
    title: '选择扫描起始目录',
    multiple: true,
    directory: true,
  });
  if (result && result.length > 0) {
    const existingPaths = scanPathsInput.value
      .split('\n')
      .map(p => p.trim())
      .filter(p => p.length > 0);
    const newPaths = result.filter(p => !existingPaths.includes(p));
    scanPathsInput.value = [...existingPaths, ...newPaths].join('\n');
  }
}

// 开始扫描
async function handleStartScan() {
  const scanPaths = scanPathsInput.value.trim().split('\n').filter(p => p.trim());
  if (scanPaths.length === 0) {
    await dialog.info({
      title: '提示',
      message: '请输入或选择至少一个扫描起始目录',
    });
    return;
  }
  closeScanModal();
  await performScan(scanPaths);
}

// 扫描结束保存更新
async function performScan(scanPaths: string[]) {
  loading.value = true;
  let addedCount = 0;
  let updatedCount = 0;

  try {
    const foundProjects: string[] = [];

    const scanPromises = scanPaths.map(scanPath =>
      scanFromDirectory(scanPath, foundProjects)
    );
    await Promise.all(scanPromises);

    if (foundProjects.length === 0) {
      await dialog.info({
        title: '完成',
        message: '未发现任何 Git 项目',
      });
      return;
    }

    for (const localPath of foundProjects) {
      const normalizedPath = normalizePath(localPath);
      const project = await validateAndGetProject(normalizedPath);
      if (project) {
        const existing = projects.value.find(p => p.localPath === normalizedPath);
        if (existing) {
          existing.remoteUrl = project.remoteUrl;
          existing.gitUsername = project.gitUsername;
          updatedCount++;
        } else {
          projects.value.push(project);
          addedCount++;
        }
      }
    }

    if (addedCount > 0 || updatedCount > 0) {
      await saveProjects();
      console.log('[全量扫描] 保存成功');
    }

    let message = '';
    if (addedCount > 0 && updatedCount > 0) {
      message = `扫描完成，新增 ${addedCount} 个项目，更新 ${updatedCount} 个项目`;
    } else if (addedCount > 0) {
      message = `扫描完成，新增 ${addedCount} 个项目`;
    } else if (updatedCount > 0) {
      message = `扫描完成，更新 ${updatedCount} 个项目`;
    } else {
      message = '扫描完成，未发现新项目';
    }

    await dialog.info({
      title: '完成',
      message,
    });
  } catch (error) {
    console.error('[全量扫描] 扫描失败:', error);
    await dialog.error({
      title: '错误',
      message: `扫描失败: ${error}`,
    });
  } finally {
    loading.value = false;
  }
}

async function scanFromDirectory(startPath: string, foundProjects: string[]): Promise<void> {
  try {
    const gitDirs = await fs.glob({
      pattern: '**/.git',
      cwd: startPath,
      absolute: true,
      dot: true,
    });
    for (const gitDir of gitDirs) {
      const projectPath = gitDir.replace(/[\\/]?\.git$/, '');
      if (projectPath && !foundProjects.includes(projectPath)) {
        foundProjects.push(projectPath);
      }
    }
  } catch {
  }
}

onMounted(async () => {
  await loadConfig();
  await loadProjects();
});
</script>

<template>
  <div class="page projects-page">
    <div class="page-header">
      <div class="header-left">
        <h1>已记录的项目</h1>
        <p class="subtitle">管理 Git 项目列表</p>
      </div>
      <div class="header-buttons">
        <button class="btn-add" @click="showAddModal = true" :disabled="loading">添加项目</button>
        <button class="btn-scan" @click="showScanModal = true" :disabled="loading">全量扫描</button>
      </div>
    </div>

    <div class="search-section">
      <div class="search-input-group">
        <span class="search-icon">🔍</span>
        <input type="text" v-model="searchQuery" placeholder="搜索项目名称或路径..." class="search-input" />
        <button v-if="searchQuery" class="btn-clear" @click="searchQuery = ''">×</button>
      </div>
      <div v-if="searchQuery" class="search-hint">找到 {{ filteredProjects.length }} 个匹配项目</div>
    </div>

    <div v-if="loading && filteredProjects.length === 0" class="loading-state">
      <div class="spinner"></div>
      <p>加载中...</p>
    </div>

    <div v-else-if="filteredProjects.length > 0" class="projects-grid">
      <div v-for="(project, index) in filteredProjects" :key="index" class="project-card" :class="{ 'project-ignored': project.isIgnored }">
        <div class="project-initials">
          {{ getProjectDisplayName(project).charAt(0).toUpperCase() || '?' }}
        </div>
        <div class="project-details">
          <div class="project-name">
            {{ getProjectDisplayName(project) }}
            <span v-if="project.isIgnored" class="ignore-tag">已忽略</span>
            <span v-if="project.displayName" class="custom-name-tag">自定义</span>
          </div>
          <div class="project-path">{{ project.localPath }}</div>
          <div v-if="project.remoteUrl !== 'none'" class="project-remote">
            {{ project.remoteUrl }}
          </div>
          <div v-if="project.gitUsername" class="project-git-username">
            用户名: {{ project.gitUsername }}
          </div>
        </div>
        <div class="project-actions">
          <button class="btn-edit" @click="openEditModal(project)">修改名称</button>
          <button class="btn-ignore" @click="toggleProjectIgnore(project.localPath)">
            {{ project.isIgnored ? '取消忽略' : '忽略' }}
          </button>
        </div>
      </div>
    </div>

    <div v-else class="empty-state">
      <div class="empty-icon">📭</div>
      <h2>暂无项目</h2>
      <p>点击「添加项目」手动添加或点击「全量扫描」自动发现项目</p>
    </div>

    <!-- 编辑名称弹窗 -->
    <div v-if="showEditModal" class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h3>修改项目名称</h3>
          <button class="close-btn" @click="closeEditModal">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>当前名称</label>
            <input type="text" :value="editingProject ? getProjectDisplayName(editingProject) : ''" disabled class="disabled-input" />
          </div>
          <div class="form-group">
            <label>自定义名称</label>
            <input v-model="editNameInput" type="text" placeholder="输入自定义名称（留空则使用默认名称）" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" @click="closeEditModal">取消</button>
          <button class="btn-save" @click="saveDisplayName">保存</button>
        </div>
      </div>
    </div>

    <!-- 添加项目弹窗 -->
    <div v-if="showAddModal" class="modal-overlay">
      <div class="modal add-modal">
        <div class="modal-header">
          <h3>添加项目</h3>
          <button class="close-btn" @click="closeAddModal">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>项目路径</label>
            <div class="path-input-container">
              <textarea
                v-model="addProjectPathsInput"
                class="path-textarea"
                placeholder="请输入项目路径，每行一个&#10;例如：&#10;E:/projects/my-project&#10;D:/workspace/another-project"
              />
            </div>
            <button class="btn-select-dir" @click="handleSelectDirectoriesForAdd">选择目录</button>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" @click="closeAddModal">取消</button>
          <button class="btn-save" @click="handleAddProjects" :disabled="loading">
            {{ loading ? '添加中...' : '确定' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 扫描弹窗 -->
    <div v-if="showScanModal" class="modal-overlay">
      <div class="modal add-modal">
        <div class="modal-header">
          <h3>全量扫描</h3>
          <button class="close-btn" @click="closeScanModal">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>扫描起始目录</label>
            <div class="path-input-container">
              <textarea
                v-model="scanPathsInput"
                class="path-textarea"
                placeholder="请输入扫描起始目录，每行一个&#10;例如：&#10;C:\Users&#10;D:\Projects"
              />
            </div>
            <button class="btn-select-dir" @click="handleSelectDirectoriesForScan">选择目录</button>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" @click="closeScanModal">取消</button>
          <button class="btn-save" @click="handleStartScan" :disabled="loading">
            {{ loading ? '扫描中...' : '开始扫描' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  padding: 24px;
  margin: 0 auto;
  height: 100%;
  overflow-y: auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}

.header-left h1 {
  font-size: 20px;
  color: var(--text-primary);
  margin-bottom: 4px;
  font-weight: 600;
}

.header-buttons {
  display: flex;
  gap: 8px;
}

.subtitle {
  color: var(--text-muted);
  font-size: 13px;
}

.btn-scan,
.btn-add {
  padding: 8px 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--bg-panel);
  color: var(--text-regular);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.btn-scan:hover:not(:disabled),
.btn-add:hover:not(:disabled) {
  background: var(--bg-sidebar);
  border-color: var(--text-muted);
}

.btn-scan:disabled,
.btn-add:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.search-section {
  margin-bottom: 20px;
}

.search-input-group {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 14px;
  font-size: 15px;
  pointer-events: none;
  opacity: 0.6;
}

.search-input {
  flex: 1;
  padding: 10px 40px 10px 40px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 14px;
  transition: all 0.15s;
  background: var(--bg-panel);
  color: var(--text-regular);
}

.search-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.btn-clear {
  position: absolute;
  right: 10px;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  border-radius: 50%;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: all 0.15s;
}

.btn-clear:hover {
  background: var(--bg-sidebar);
  color: var(--text-primary);
}

.search-hint {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-muted);
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
}

.spinner {
  width: 28px;
  height: 28px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-state p {
  margin-top: 12px;
  color: var(--text-muted);
  font-size: 14px;
}

.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
}

.project-card {
  background: var(--bg-panel);
  border-radius: var(--radius-md);
  padding: 16px;
  display: flex;
  gap: 12px;
  align-items: flex-start;
  border: 1px solid var(--color-border);
  transition: all 0.15s;
  position: relative;
}

.project-card:hover {
  border-color: var(--text-muted);
  background: var(--bg-main);
}

.project-card.project-ignored {
  opacity: 0.5;
}

.project-initials {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  background: var(--bg-sidebar);
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 600;
  flex-shrink: 0;
}

.project-details {
  flex: 1;
  min-width: 0;
}

.project-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.ignore-tag {
  font-size: 10px;
  padding: 2px 6px;
  background: var(--text-muted);
  color: var(--bg-panel);
  border-radius: 4px;
}

.custom-name-tag {
  font-size: 10px;
  padding: 2px 6px;
  background: var(--color-primary);
  color: var(--bg-panel);
  border-radius: 4px;
  position: absolute;
  top: 0;
  right: 0;
  font-size: 0;
}

.project-path {
  font-size: 12px;
  color: var(--text-muted);
  font-family: monospace;
  margin-bottom: 2px;
  word-break: break-all;
  line-height: 1.4;
}

.project-remote {
  font-size: 11px;
  color: var(--color-primary);
  font-family: monospace;
  word-break: break-all;
  line-height: 1.4;
}

.project-git-username {
  font-size: 11px;
  color: var(--text-muted);
  font-family: monospace;
  line-height: 1.4;
  margin-top: 2px;
}

.project-actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.btn-edit {
  padding: 4px 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--bg-main);
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
  white-space: nowrap;
}

.btn-edit:hover {
  background: var(--bg-sidebar);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.btn-ignore {
  padding: 4px 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--bg-main);
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
  white-space: nowrap;
}

.btn-ignore:hover {
  background: var(--bg-sidebar);
  border-color: var(--text-muted);
  color: var(--text-regular);
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.6;
}

.empty-state h2 {
  font-size: 16px;
  color: var(--text-primary);
  margin-bottom: 8px;
  font-weight: 600;
}

.empty-state p {
  color: var(--text-muted);
  line-height: 1.5;
  font-size: 13px;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: var(--bg-panel);
  border-radius: calc(var(--radius-md) + 4px);
  width: 90%;
  max-width: 400px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
}

.modal.add-modal {
  max-width: 460px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
}

.modal-header h3 {
  font-size: 15px;
  color: var(--text-primary);
  margin: 0;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: var(--text-muted);
  cursor: pointer;
  line-height: 1;
  padding: 0;
  transition: color 0.15s;
}

.close-btn:hover {
  color: var(--text-primary);
}

.modal-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: var(--text-regular);
  font-size: 13px;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 14px;
  transition: border-color 0.15s;
  box-sizing: border-box;
  font-family: inherit;
  color: var(--text-regular);
  background: var(--bg-main);
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--color-primary);
}

.form-group input.disabled-input {
  background: var(--bg-sidebar);
  color: var(--text-muted);
  cursor: not-allowed;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid var(--color-border);
}

.btn-cancel {
  padding: 8px 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-regular);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-cancel:hover {
  background: var(--bg-sidebar);
}

.btn-save {
  padding: 8px 16px;
  border: none;
  border-radius: var(--radius-md);
  background: var(--text-primary);
  color: var(--bg-panel);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-save:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.path-input-container {
  margin-bottom: 8px;
}

.path-textarea {
  width: 100%;
  height: 120px;
  padding: 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 13px;
  font-family: monospace;
  color: var(--text-regular);
  background: var(--bg-main);
  resize: vertical;
  box-sizing: border-box;
}

.path-textarea:focus {
  outline: none;
  border-color: var(--color-primary);
}

.btn-select-dir {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--bg-panel);
  color: var(--text-regular);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-select-dir:hover {
  background: var(--bg-sidebar);
  border-color: var(--text-muted);
}
</style>
