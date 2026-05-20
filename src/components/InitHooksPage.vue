<script setup lang="ts">
import { onMounted } from 'vue';
import { useConfig } from '../composables/useConfig';
import { dialog } from 'vokex.app';

const { config, loading: configLoading, loadConfig, saveConfig } = useConfig();

const isLoading = () => configLoading.value;

async function handleSelectPath() {
  const result = await dialog.showOpenDialog({
    directory: true,
    title: '选择报告存放目录',
  });

  if (result && typeof result === 'string' && result.length > 0) {
    config.value.reportPath = result;
    await saveConfig();
  }
}

onMounted(() => {
  loadConfig();
});
</script>

<template>
  <div class="page init-page">
    <div class="main-content">
      <div class="panel">
        <div class="panel-header">
          <h2>系统设置</h2>
        </div>

        <div class="form-section">
          <label class="form-label">报告存放目录</label>
          <div class="path-input-group">
            <input type="text" :value="config.reportPath" readonly placeholder="请选择报告存放目录" class="path-input" />
            <button class="btn-select" @click="handleSelectPath" :disabled="isLoading()">选择目录</button>
          </div>
          <p class="hint">报告生成后将保存在此目录中</p>
        </div>

        <div class="info-panel">
          <h3>说明</h3>
          <ul class="info-list">
            <li>首次使用必须设置报告存放目录</li>
            <li>报告目录可以随时修改</li>
            <li>日报会自动存档到该目录</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  padding: 24px;
  height: 100%;
  overflow-y: auto;
}

.main-content {
  margin: 0 auto;
}

.panel {
  background: var(--bg-panel);
  border-radius: calc(var(--radius-md) + 4px);
  border: 1px solid var(--color-border);
  padding: 24px;
}

.panel-header {
  margin-bottom: 24px;
}

.panel-header h2 {
  font-size: 18px;
  color: var(--text-primary);
  margin: 0;
  font-weight: 600;
}

.form-section {
  margin-bottom: 20px;
}

.form-label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: var(--text-regular);
  font-size: 14px;
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
