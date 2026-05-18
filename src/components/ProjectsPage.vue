<script setup lang="ts">
import { onMounted } from "vue";
import { useProjects } from "../composables/useProjects";
import { useConfig } from "../composables/useConfig";
import { dialog, fs } from "vokex.app";

const {
  loading,
  filteredProjects,
  searchQuery,
  loadProjects,
  scanProjectsFromLogs,
  setSearchQuery,
} = useProjects();
const { config, loadConfig } = useConfig();

async function handleScanLogs() {
  if (!config.value.reportPath) {
    await dialog.info({
      title: "提示",
      message: "请先在初始化页面设置报告存放目录",
    });
    return;
  }

  const exists = await fs.exists(config.value.reportPath);
  if (!exists) {
    await dialog.info({
      title: "提示",
      message: `报告目录不存在: ${config.value.reportPath}`,
    });
    return;
  }

  await loadProjects(config.value.reportPath);
  await dialog.info({
    title: "完成",
    message:
      filteredProjects.value.length > 0
        ? `扫描完成，发现 ${filteredProjects.value.length} 个项目`
        : "扫描完成，未发现项目",
  });
}

onMounted(async () => {
  await loadConfig();
  if (config.value.reportPath) {
    await loadProjects(config.value.reportPath);
  }
});
</script>

<template>
  <div class="page projects-page">
    <div class="page-header">
      <div class="header-left">
        <h1>已记录的项目</h1>
        <p class="subtitle">所有已被 Git 钩子记录的项目列表</p>
      </div>
      <button class="btn-scan" @click="handleScanLogs" :disabled="loading">扫描日志</button>
    </div>

    <div class="search-section">
      <div class="search-input-group">
        <span class="search-icon">🔍</span>
        <input
          type="text"
          v-model="searchQuery"
          @input="setSearchQuery(searchQuery)"
          placeholder="搜索项目名称或路径..."
          class="search-input"
        />
        <button v-if="searchQuery" class="btn-clear" @click="setSearchQuery('')">×</button>
      </div>
      <div v-if="searchQuery" class="search-hint">
        找到 {{ filteredProjects.length }} 个匹配项目
      </div>
    </div>

    <div v-if="loading && filteredProjects.length === 0" class="loading-state">
      <div class="spinner"></div>
      <p>加载中...</p>
    </div>

    <div v-else-if="filteredProjects.length > 0" class="projects-grid">
      <div v-for="(project, index) in filteredProjects" :key="index" class="project-card">
        <div class="project-initials">
          {{ project.localPath.split(/[\\/]/).pop()?.charAt(0).toUpperCase() || "?" }}
        </div>
        <div class="project-details">
          <div class="project-name">
            {{ project.localPath.split(/[\\/]/).pop() }}
          </div>
          <div class="project-path">{{ project.localPath }}</div>
          <div v-if="project.remoteUrl !== 'none'" class="project-remote">
            {{ project.remoteUrl }}
          </div>
        </div>
      </div>
    </div>

    <div v-else class="empty-state">
      <div class="empty-icon">📭</div>
      <h2>暂无项目</h2>
      <p>还没有记录任何项目，点击「扫描日志」从已有的日志文件中识别项目</p>
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

.subtitle {
  color: var(--text-muted);
  font-size: 13px;
}

.btn-scan {
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

.btn-scan:hover:not(:disabled) {
  background: var(--bg-sidebar);
  border-color: var(--text-muted);
}

.btn-scan:disabled {
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
}

.project-card:hover {
  border-color: var(--text-muted);
  background: var(--bg-main);
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

.empty-state {
  text-align: center;
  padding: 80px 20px;
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
</style>
