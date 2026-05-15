<script setup lang="ts">
import { ref, onMounted } from "vue";
import { GitService } from "./services/gitService";
import { AIService } from "./services/aiService";
import type { GitCommit } from "./services/gitService";
import type { AIConfig } from "./services/aiService";
import { clipboard, dialog } from "vokex.app";

const gitService = GitService.getInstance();
const aiService = AIService.getInstance();

const isInitialized = ref(false);
const loading = ref(false);
const projects = ref<{ localPath: string; remoteUrl: string }[]>([]);
const report = ref("");
const prompt = ref("");
const showConfig = ref(false);
const showResult = ref(false);
const currentDateLabel = ref("");

const aiConfig = ref<AIConfig>({
  apiKey: "",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-3.5-turbo",
});

async function init() {
  await loadConfig();
  await loadProjects();
}

async function loadConfig() {
  const savedConfig = await aiService.loadConfig();
  if (savedConfig) {
    aiConfig.value = savedConfig;
  }
}

async function saveConfig() {
  await aiService.saveConfig(aiConfig.value);
  showConfig.value = false;
  await dialog.info({ title: "提示", message: "配置已保存" });
}

async function initGitHooks() {
  loading.value = true;
  try {
    const result = await gitService.initGitHooks();
    await dialog.info({ title: result.success ? "成功" : "失败", message: result.message });
    if (result.success) {
      isInitialized.value = true;
    }
  } finally {
    loading.value = false;
  }
}

async function loadProjects() {
  projects.value = await gitService.getProjects();
}

function generatePrompt(commits: GitCommit[], type: "daily" | "weekly" | "monthly", dateLabel: string): string {
  const commitsByProject: Record<string, GitCommit[]> = {};
  for (const commit of commits) {
    if (!commitsByProject[commit.projectName]) {
      commitsByProject[commit.projectName] = [];
    }
    commitsByProject[commit.projectName].push(commit);
  }

  let commitsText = "";
  for (const [projectName, projectCommits] of Object.entries(commitsByProject)) {
    commitsText += `\n【${projectName}】\n`;
    for (const commit of projectCommits) {
      commitsText += `- ${commit.message} (${commit.author}, ${commit.date.split(" ")[0]})\n`;
    }
  }

  const typeLabels: Record<string, string> = {
    daily: "日报",
    weekly: "周报",
    monthly: "月报",
  };

  return `请根据以下 Git 提交记录，生成一份${typeLabels[type]}。

日期: ${dateLabel}

提交记录:
${commitsText}

要求:
1. 格式清晰，易于阅读
2. 按项目分组总结
3. 突出重要的工作内容
4. 语言简洁专业
5. 使用 Markdown 格式`;
}

async function generateReport(type: "daily" | "weekly" | "monthly") {
  loading.value = true;
  showResult.value = false;
  report.value = "";
  prompt.value = "";

  try {
    const { since, until, label } = gitService.getDateRange(type);
    currentDateLabel.value = label;
    
    const allCommits = await gitService.getAllCommits(since, until);

    if (allCommits.length === 0) {
      await dialog.info({ title: "提示", message: "该时间段暂无提交记录" });
      return;
    }

    prompt.value = generatePrompt(allCommits, type, label);
    showResult.value = true;
  } catch (error) {
    await dialog.error({ title: "错误", message: `${error}` });
  } finally {
    loading.value = false;
  }
}

async function generateAIReport() {
  if (!aiConfig.value.apiKey) {
    await dialog.info({ title: "提示", message: "请先配置 AI 服务" });
    showConfig.value = true;
    return;
  }

  loading.value = true;
  try {
    const { since, until, label } = gitService.getDateRange("daily");
    const allCommits = await gitService.getAllCommits(since, until);
    report.value = await aiService.generateReport(allCommits, "daily", currentDateLabel.value);
  } catch (error) {
    await dialog.error({ title: "错误", message: `${error}` });
  } finally {
    loading.value = false;
  }
}

async function copyPrompt() {
  await clipboard.writeText(prompt.value);
  await dialog.info({ title: "提示", message: "提示词已复制到剪贴板" });
}

async function copyReport() {
  await clipboard.writeText(report.value);
  await dialog.info({ title: "提示", message: "报告已复制到剪贴板" });
}

onMounted(() => {
  init();
});
</script>

<template>
  <div class="app">
    <main class="main">
      <div class="section init-section">
        <h2>初始化 Git 钩子</h2>
        <p class="desc">首次使用需要配置全局 Git 钩子，用于自动记录提交的项目</p>
        <button class="btn btn-primary" @click="initGitHooks" :disabled="loading">
          {{ loading ? "初始化中..." : "初始化 Git 钩子" }}
        </button>
      </div>

      <div class="section projects-section">
        <h2>已记录的项目 ({{ projects.length }})</h2>
        <div v-if="projects.length > 0" class="projects-list">
          <div v-for="(project, index) in projects" :key="index" class="project-item">
            <div class="project-name">{{ project.localPath.split("\\").pop()?.split("/").pop() }}</div>
            <div class="project-path">{{ project.localPath }}</div>
            <div v-if="project.remoteUrl !== 'none'" class="project-remote">{{ project.remoteUrl }}</div>
          </div>
        </div>
        <p v-else class="empty-text">暂无记录的项目，请先提交代码</p>
      </div>

      <div class="section actions-section">
        <h2>生成报告</h2>
        <div class="action-buttons">
          <button class="btn btn-success" @click="generateReport('daily')" :disabled="loading">
            📅 生成日报
          </button>
          <button class="btn btn-info" @click="generateReport('weekly')" :disabled="loading">
            📆 生成周报
          </button>
          <button class="btn btn-warning" @click="generateReport('monthly')" :disabled="loading">
            🗓️ 生成月报
          </button>
          <button class="btn btn-secondary" @click="showConfig = true">
            ⚙️ 配置 AI
          </button>
        </div>
      </div>

      <div v-if="showResult" class="section result-section">
        <div class="result-header">
          <h2>AI 提示词</h2>
        </div>
        
        <div class="prompt-content">{{ prompt }}</div>
        
        <div class="prompt-actions">
          <button class="btn btn-secondary" @click="copyPrompt">📋 复制提示词</button>
          <button class="btn btn-primary" @click="generateAIReport" :disabled="loading">
            {{ loading ? "生成中..." : "✨ 生成报告" }}
          </button>
        </div>

        <div v-if="report" class="report-section">
          <div class="report-header">
            <h3>📄 生成的报告</h3>
            <button class="btn btn-secondary btn-sm" @click="copyReport">📋 复制报告</button>
          </div>
          <div class="report-content markdown-body">{{ report }}</div>
        </div>
      </div>
    </main>

    <div v-if="showConfig" class="modal-overlay" @click.self="showConfig = false">
      <div class="modal">
        <div class="modal-header">
          <h3>AI 配置</h3>
          <button class="close-btn" @click="showConfig = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>API Key</label>
            <input v-model="aiConfig.apiKey" type="password" placeholder="请输入 API Key" />
          </div>
          <div class="form-group">
            <label>Base URL</label>
            <input v-model="aiConfig.baseUrl" type="text" placeholder="https://api.openai.com/v1" />
          </div>
          <div class="form-group">
            <label>Model</label>
            <input v-model="aiConfig.model" type="text" placeholder="gpt-3.5-turbo" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showConfig = false">取消</button>
          <button class="btn btn-primary" @click="saveConfig">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
}

.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.main {
  flex: 1;
  padding: 24px 32px;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.section {
  background: white;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.section h2 {
  font-size: 18px;
  color: #1a1a2e;
  margin-bottom: 16px;
}

.desc {
  color: #666;
  margin-bottom: 16px;
  font-size: 14px;
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

.btn-sm {
  padding: 8px 16px;
  font-size: 13px;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-success {
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
  color: white;
}

.btn-success:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(17, 153, 142, 0.4);
}

.btn-info {
  background: linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%);
  color: white;
}

.btn-info:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(33, 147, 176, 0.4);
}

.btn-warning {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
}

.btn-warning:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(245, 87, 108, 0.4);
}

.btn-secondary {
  background: #f0f0f0;
  color: #333;
}

.btn-secondary:hover:not(:disabled) {
  background: #e0e0e0;
}

.projects-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.project-item {
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid #667eea;
}

.project-name {
  font-weight: 600;
  color: #1a1a2e;
  margin-bottom: 4px;
}

.project-path {
  font-size: 12px;
  color: #666;
  font-family: monospace;
  margin-bottom: 4px;
}

.project-remote {
  font-size: 12px;
  color: #11998e;
  font-family: monospace;
}

.empty-text {
  color: #999;
  text-align: center;
  padding: 32px;
}

.action-buttons {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.result-header h2 {
  margin-bottom: 0;
}

.prompt-content {
  background: #f8f9fa;
  padding: 16px;
  border-radius: 8px;
  line-height: 1.6;
  white-space: pre-wrap;
  font-family: monospace;
  font-size: 13px;
  max-height: 400px;
  overflow-y: auto;
  margin-bottom: 16px;
}

.prompt-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.report-section {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid #f0f0f0;
}

.report-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.report-header h3 {
  font-size: 16px;
  color: #1a1a2e;
}

.report-content {
  background: #f8f9fa;
  padding: 24px;
  border-radius: 8px;
  line-height: 1.8;
  white-space: pre-wrap;
  max-height: 500px;
  overflow-y: auto;
}

.markdown-body h1,
.markdown-body h2,
.markdown-body h3 {
  margin-top: 16px;
  margin-bottom: 8px;
}

.markdown-body ul,
.markdown-body ol {
  padding-left: 24px;
  margin-bottom: 12px;
}

.markdown-body code {
  background: #e9ecef;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #eee;
}

.modal-header h3 {
  font-size: 18px;
  color: #1a1a2e;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: #999;
  cursor: pointer;
  line-height: 1;
}

.close-btn:hover {
  color: #333;
}

.modal-body {
  padding: 24px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #333;
}

.form-group input {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: #667eea;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #eee;
}
</style>
