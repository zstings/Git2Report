<script setup lang="ts">
import { onMounted } from 'vue'
import { useProjects } from '../composables/useProjects'
import { useConfig } from '../composables/useConfig'
import { dialog, fs } from 'vokex.app'

const { 
  loading, 
  filteredProjects, 
  searchQuery, 
  loadProjects, 
  scanProjectsFromLogs, 
  setSearchQuery
} = useProjects()
const { config, loadConfig } = useConfig()

async function handleScanLogs() {
  if (!config.value.reportPath) {
    await dialog.info({
      title: '提示',
      message: '请先在初始化页面设置报告存放目录'
    })
    return
  }
  
  const exists = await fs.exists(config.value.reportPath)
  if (!exists) {
    await dialog.info({
      title: '提示',
      message: `报告目录不存在: ${config.value.reportPath}`
    })
    return
  }
  
  const addedCount = await scanProjectsFromLogs(config.value.reportPath)
  await dialog.info({
    title: '完成',
    message: addedCount > 0 
      ? `扫描完成，发现 ${addedCount} 个新项目` 
      : '扫描完成，未发现新项目'
  })
}

onMounted(async () => {
  await loadConfig()
  await loadProjects()
  if (config.value.reportPath) {
    await scanProjectsFromLogs(config.value.reportPath)
  }
})
</script>

<template>
  <div class="page projects-page">
    <div class="page-header">
      <h1>📂 已记录的项目</h1>
      <p class="subtitle">所有已被 Git 钩子记录的项目列表</p>
      <div class="header-actions">
        <button class="btn btn-secondary" @click="handleScanLogs" :disabled="loading">
          🔍 扫描日志
        </button>
      </div>
    </div>

    <div class="search-section">
      <div class="search-input-group">
        <span class="search-icon">🔎</span>
        <input
          type="text"
          v-model="searchQuery"
          @input="setSearchQuery(searchQuery)"
          placeholder="搜索项目名称或路径..."
          class="search-input"
        />
        <button 
          v-if="searchQuery" 
          class="btn btn-clear" 
          @click="setSearchQuery('')"
        >
          ×
        </button>
      </div>
      <div v-if="searchQuery" class="search-hint">
        找到 {{ filteredProjects.length }} 个匹配项目
      </div>
    </div>

    <div v-if="loading && filteredProjects.length === 0" class="loading-state">
      <div class="spinner"></div>
      <p>加载中...</p>
    </div>

    <div v-else-if="filteredProjects.length > 0" class="projects-list">
      <div v-for="(project, index) in filteredProjects" :key="index" class="project-card">
        <div class="project-icon">
          {{ project.localPath.split(/[\\/]/).pop()?.charAt(0).toUpperCase() || '?' }}
        </div>
        <div class="project-info">
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
  max-width: 900px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;
}

.page-header h1 {
  font-size: 28px;
  color: #1a1a2e;
  margin-bottom: 8px;
}

.subtitle {
  color: #666;
  font-size: 14px;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.search-section {
  margin-bottom: 24px;
}

.search-input-group {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 16px;
  font-size: 16px;
  pointer-events: none;
}

.search-input {
  flex: 1;
  padding: 12px 48px 12px 44px;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  font-size: 14px;
  transition: all 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.btn-clear {
  position: absolute;
  right: 12px;
  width: 28px;
  height: 28px;
  border: none;
  background: #f0f0f0;
  border-radius: 50%;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  color: #666;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.btn-clear:hover {
  background: #e0e0e0;
  color: #333;
}

.search-hint {
  margin-top: 8px;
  font-size: 13px;
  color: #667eea;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: #f0f0f0;
  color: #333;
}

.btn-secondary:hover:not(:disabled) {
  background: #e0e0e0;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f0f0f0;
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-state p {
  margin-top: 16px;
  color: #666;
}

.projects-list {
  display: grid;
  gap: 16px;
}

.project-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  gap: 16px;
  align-items: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s;
}

.project-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
}

.project-icon {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: bold;
  flex-shrink: 0;
}

.project-info {
  flex: 1;
  min-width: 0;
}

.project-name {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a2e;
  margin-bottom: 4px;
}

.project-path {
  font-size: 13px;
  color: #666;
  font-family: monospace;
  margin-bottom: 4px;
  word-break: break-all;
}

.project-remote {
  font-size: 12px;
  color: #11998e;
  font-family: monospace;
  word-break: break-all;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 24px;
}

.empty-state h2 {
  font-size: 20px;
  color: #1a1a2e;
  margin-bottom: 12px;
}

.empty-state p {
  color: #666;
  line-height: 1.6;
  margin-bottom: 20px;
}
</style>
