<script setup lang="ts">
import { onMounted } from 'vue';
import { useConfig } from '../composables/useConfig';
import { useGit } from '../composables/useGit';
import { dialog } from 'vokex.app';

const { config, loading: configLoading, loadConfig, saveConfig } = useConfig();
const { loading: gitLoading, initGitHooks } = useGit();

const isLoading = () => configLoading.value || gitLoading.value;

async function handleSelectPath() {
  const result = await dialog.showOpenDialog({
    directory: true,
    title: '选择报告存放目录'
  });
  
  if (result && typeof result === 'string' && result.length > 0) {
    config.value.reportPath = result;
    await saveConfig();
  }
}

async function handleInit() {
  if (!config.value.reportPath) {
    await dialog.info({
      title: '提示',
      message: '请先设置报告存放目录'
    });
    return;
  }

  const result = await initGitHooks(config.value.reportPath);
  await dialog.info({
    title: result.success ? '成功' : '失败',
    message: result.message
  });
}

onMounted(() => {
  loadConfig();
});
</script>

<template>
  <div class="page init-page">
    <div class="main-content">
      <div class="left-section">
        <div class="page-header">
          <h1>初始化 Git 钩子</h1>
          <p class="subtitle">配置 Git 全局钩子以自动记录提交的项目</p>
        </div>

        <div class="steps-section">
          <div class="step-item">
            <div class="step-number">1</div>
            <div class="step-content">
              <h3>设置报告存放目录</h3>
              <p>选择一个目录用于存放生成的工作报告</p>
            </div>
          </div>

          <div class="step-item">
            <div class="step-number">2</div>
            <div class="step-content">
              <h3>初始化 Git 钩子</h3>
              <p>配置全局钩子以自动记录所有 Git 提交</p>
            </div>
          </div>
        </div>
      </div>

      <div class="right-section">
        <div class="panel">
          <div class="panel-header">
            <div class="status-indicator">
              <span class="status-dot"></span>
              <span class="status-text">{{ config.reportPath ? '已配置' : '待配置' }}</span>
            </div>
          </div>

          <div class="form-section">
            <h3>报告存放目录</h3>
            <div class="path-input-group">
              <input
                type="text"
                :value="config.reportPath"
                readonly
                placeholder="请选择报告存放目录"
                class="path-input"
              />
              <button class="btn-select" @click="handleSelectPath" :disabled="isLoading()">
                选择目录
              </button>
            </div>
            <p class="hint">报告生成后将保存在此目录中</p>
          </div>

          <div class="action-section">
            <button class="btn-init" @click="handleInit" :disabled="isLoading() || !config.reportPath">
              {{ isLoading() ? '初始化中...' : '初始化 Git 钩子' }}
            </button>
          </div>
        </div>

        <div class="info-panel">
          <h3>说明</h3>
          <ul class="info-list">
            <li>首次使用必须初始化 Git 钩子</li>
            <li>初始化后，所有 Git 项目的提交都会被自动记录</li>
            <li>报告存放目录可以随时修改</li>
            <li>已存在的钩子文件不会被覆盖，我们会添加标记来管理</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  padding: 0;
  height: 100%;
  overflow: hidden;
}

.main-content {
  display: flex;
  height: 100%;
  margin: 0 auto;
  padding: 24px;
  gap: 60px;
  flex-direction: row-reverse;
}

.left-section {
  flex: 1;
}

.page-header {
  margin-bottom: 40px;
}

.page-header h1 {
  font-size: 24px;
  color: var(--text-primary);
  margin-bottom: 8px;
  font-weight: 600;
}

.subtitle {
  color: var(--text-muted);
  font-size: 14px;
}

.steps-section {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.step-item {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.step-number {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--bg-sidebar);
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 600;
  flex-shrink: 0;
}

.step-content h3 {
  font-size: 15px;
  color: var(--text-primary);
  margin-bottom: 4px;
  font-weight: 600;
}

.step-content p {
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.5;
  margin: 0;
}

.right-section {
  width: 420px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel {
  background: var(--bg-panel);
  border-radius: calc(var(--radius-md) + 4px);
  border: 1px solid var(--color-border);
  padding: 20px;
}

.panel-header {
  margin-bottom: 20px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--color-primary);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.status-text {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-regular);
}

.form-section {
  margin-bottom: 20px;
}

.form-section h3 {
  font-size: 14px;
  color: var(--text-primary);
  margin-bottom: 12px;
  font-weight: 600;
}

.path-input-group {
  display: flex;
  gap: 10px;
}

.path-input {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 13px;
  background: var(--bg-main);
  color: var(--text-regular);
  font-family: monospace;
}

.btn-select {
  padding: 10px 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--bg-panel);
  color: var(--text-regular);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
}

.btn-select:hover:not(:disabled) {
  background: var(--bg-sidebar);
  border-color: var(--text-muted);
}

.btn-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.hint {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 8px;
}

.action-section {
  padding-top: 12px;
  border-top: 1px solid var(--color-border);
}

.btn-init {
  width: 100%;
  padding: 12px 24px;
  border: none;
  border-radius: var(--radius-md);
  background: var(--text-primary);
  color: white;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-init:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-init:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.info-panel {
  background: rgba(37, 99, 235, 0.04);
  border-radius: calc(var(--radius-md) + 4px);
  padding: 18px 20px;
  border: 1px solid rgba(37, 99, 235, 0.1);
}

.info-panel h3 {
  font-size: 14px;
  color: var(--text-primary);
  margin-bottom: 12px;
  font-weight: 600;
}

.info-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.info-list li {
  padding: 6px 0;
  padding-left: 20px;
  position: relative;
  color: var(--text-regular);
  font-size: 13px;
  line-height: 1.5;
}

.info-list li::before {
  content: '✓';
  position: absolute;
  left: 0;
  color: var(--color-primary);
  font-weight: 600;
  font-size: 12px;
}
</style>
