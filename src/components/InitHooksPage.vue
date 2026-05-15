<script setup lang="ts">
import { onMounted } from 'vue'
import { useConfig } from '../composables/useConfig'
import { useGit } from '../composables/useGit'
import { dialog, shell } from 'vokex.app'

const { config, loading: configLoading, loadConfig, saveConfig } = useConfig()
const { loading: gitLoading, initGitHooks } = useGit()

const isLoading = () => configLoading.value || gitLoading.value

async function handleSelectPath() {
  const result = await dialog.selectDirectory()
  if (result && result.length > 0) {
    config.value.reportPath = result[0]
    await saveConfig()
  }
}

async function handleInit() {
  if (!config.value.reportPath) {
    await dialog.info({
      title: '提示',
      message: '请先设置报告存放目录路径'
    })
    return
  }

  const result = await initGitHooks()
  await dialog.info({
    title: result.success ? '成功' : '失败',
    message: result.message
  })
}

onMounted(() => {
  loadConfig()
})
</script>

<template>
  <div class="page init-page">
    <div class="page-header">
      <h1>🔧 初始化 Git 钩子</h1>
      <p class="subtitle">配置 Git 全局钩子以自动记录提交的项目</p>
    </div>

    <div class="card">
      <h2>📁 报告存放目录</h2>
      <div class="form-group">
        <label>选择目录</label>
        <div class="path-input-group">
          <input
            type="text"
            :value="config.reportPath"
            readonly
            placeholder="点击右侧按钮选择报告存放目录"
          />
          <button class="btn btn-secondary" @click="handleSelectPath" :disabled="isLoading()">
            选择目录
          </button>
        </div>
        <p class="hint">报告生成后将保存在此目录中</p>
      </div>
    </div>

    <div class="card">
      <h2>⚙️ 初始化钩子</h2>
      <p class="desc">
        点击下方按钮将配置 Git 全局钩子，使所有 Git 项目的提交都会被自动记录。
      </p>
      <button class="btn btn-primary btn-large" @click="handleInit" :disabled="isLoading()">
        {{ isLoading() ? '初始化中...' : '初始化 Git 钩子' }}
      </button>
    </div>

    <div class="card info-card">
      <h2>📖 说明</h2>
      <ul class="info-list">
        <li>首次使用必须初始化 Git 钩子</li>
        <li>初始化后，所有 Git 项目的提交都会被自动记录</li>
        <li>报告存放目录可以随时修改</li>
        <li>已存在的钩子文件不会被覆盖，我们会添加标记来管理</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.page {
  padding: 24px;
  max-width: 800px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 32px;
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

.card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.card h2 {
  font-size: 18px;
  color: #1a1a2e;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.form-group {
  margin-bottom: 8px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #333;
}

.path-input-group {
  display: flex;
  gap: 12px;
}

.path-input-group input {
  flex: 1;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  background: #f8f9fa;
}

.hint {
  font-size: 12px;
  color: #999;
  margin-top: 8px;
}

.desc {
  color: #666;
  margin-bottom: 20px;
  line-height: 1.6;
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

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-secondary {
  background: #f0f0f0;
  color: #333;
}

.btn-secondary:hover:not(:disabled) {
  background: #e0e0e0;
}

.btn-large {
  width: 100%;
  padding: 16px;
  font-size: 16px;
}

.info-card {
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
}

.info-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.info-list li {
  padding: 8px 0;
  padding-left: 24px;
  position: relative;
  color: #0c4a6e;
}

.info-list li::before {
  content: '✓';
  position: absolute;
  left: 0;
  color: #059669;
  font-weight: bold;
}
</style>
