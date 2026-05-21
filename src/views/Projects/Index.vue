<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { loadProjects, saveProjects, projects, type GitProject } from '../../projects';
import AddProjectModal from './components/AddProjectModal.vue';
import ScanProjectsModal from './components/ScanProjectsModal.vue';

const loading = ref(false);
const searchQuery = ref('');
const showEditModal = ref(false);
const showAddModal = ref(false);
const showScanModal = ref(false);
const editingProject = ref<GitProject | null>(null);
const editNameInput = ref('');

/**
 * 过滤项目列表（根据搜索关键词）
 */
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

/**
 * 获取项目显示名称（优先使用自定义名称，否则使用路径最后一段）
 * @param project 项目对象
 * @returns 显示名称
 */
function getProjectDisplayName(project: GitProject): string {
  if (project.displayName) {
    return project.displayName;
  }
  return project.localPath.split(/[\\/]/).pop() || '未知项目';
}

/**
 * 初始化加载项目列表
 */
async function loadProjectsInit() {
  loading.value = true;
  loadProjects(() => {
    loading.value = false;
  });
}

/**
 * 切换项目忽略状态
 * @param projectPath 项目路径
 */
async function toggleProjectIgnore(projectPath: string) {
  const project = projects.value.find(p => p.localPath === projectPath);
  if (project) {
    project.isIgnored = !project.isIgnored;
    await saveProjects();
  }
}

/**
 * 打开编辑名称模态框
 * @param project 待编辑的项目
 */
function openEditModal(project: GitProject) {
  editingProject.value = project;
  editNameInput.value = project.displayName || '';
  showEditModal.value = true;
}

/**
 * 保存自定义名称
 */
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

/**
 * 关闭编辑模态框
 */
function closeEditModal() {
  showEditModal.value = false;
  editingProject.value = null;
  editNameInput.value = '';
}

/**
 * 更新项目列表（由子组件调用）
 * @param newProjects 新的项目列表
 */
async function updateProjects(newProjects: GitProject[]) {
  projects.value = newProjects;
  await saveProjects();
}

onMounted(async () => {
  await loadProjectsInit();
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
          </div>
          <div class="project-path singe-line" :title="project.localPath">{{ project.localPath }}</div>
          <div v-if="project.remoteUrl !== 'none'" class="project-remote singe-line" :title="project.remoteUrl">{{ project.remoteUrl }}</div>
          <div v-if="project.gitUsername" class="project-git-username">用户名: {{ project.gitUsername }}</div>
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

    <div v-if="showEditModal" class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h3>修改项目名称</h3>
          <button class="close-btn" @click="closeEditModal">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>自定义名称</label>
            <input v-model="editNameInput" type="text" placeholder="输入自定义名称" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" @click="closeEditModal">取消</button>
          <button class="btn-save" @click="saveDisplayName">保存</button>
        </div>
      </div>
    </div>

    <AddProjectModal :projects="projects" :visible="showAddModal" @update:visible="showAddModal = $event" @update:projects="updateProjects" />

    <ScanProjectsModal :projects="projects" :visible="showScanModal" @update:visible="showScanModal = $event" @update:projects="updateProjects" />
  </div>
</template>

<style scoped>
.page {
  padding: 24px;
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
}

.header-buttons {
  display: flex;
  gap: 8px;
}

.btn-scan,
.btn-add {
  padding: 8px 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--bg-panel);
  color: var(--text-regular);
  font-size: 13px;
  cursor: pointer;
}

.search-section {
  margin-bottom: 20px;
}

.search-input-group {
  position: relative;
  display: flex;
  align-items: center;
  max-width: 600px;
}

.search-icon {
  position: absolute;
  left: 14px;
  font-size: 15px;
  opacity: 0.6;
}

.search-input {
  flex: 1;
  padding: 10px 40px 10px 40px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 14px;
  background: var(--bg-panel);
  color: var(--text-regular);
  transition: all 0.15s;
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
  transition: all 0.15s;
}

.btn-clear:hover {
  background: var(--bg-sidebar);
  color: var(--text-primary);
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
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 600;
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

.project-path {
  font-size: 12px;
  color: var(--text-muted);
  font-family: monospace;
}

.project-remote {
  font-size: 11px;
  color: var(--color-primary);
  font-family: monospace;
}

.project-git-username {
  font-size: 11px;
  color: var(--text-muted);
  font-family: monospace;
  margin-top: 2px;
}

.project-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-left: auto;
}

.btn-edit,
.btn-ignore {
  padding: 5px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--bg-panel);
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.btn-edit:hover,
.btn-ignore:hover {
  background: var(--bg-sidebar);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
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

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: var(--text-muted);
  cursor: pointer;
}

.modal-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 16px;
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
  box-sizing: border-box;
  background: var(--bg-main);
  color: var(--text-regular);
}

.form-group textarea {
  min-height: 80px;
  resize: vertical;
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
  cursor: pointer;
}

.btn-save {
  padding: 8px 16px;
  border: none;
  border-radius: var(--radius-md);
  background: var(--text-primary);
  color: var(--bg-panel);
  cursor: pointer;
}

.btn-select-dir {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--bg-panel);
  cursor: pointer;
  margin-top: 8px;
}

.alert {
  padding: 12px;
  border-radius: var(--radius-md);
  font-size: 13px;
}

.alert-info {
  background: rgba(59, 130, 246, 0.1);
  color: var(--color-primary);
  border: 1px solid rgba(59, 130, 246, 0.2);
}
</style>
