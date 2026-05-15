<script setup lang="ts">
import { ref } from "vue";
import InitHooksPage from "./components/InitHooksPage.vue";
import ProjectsPage from "./components/ProjectsPage.vue";
import GenerateReportPage from "./components/GenerateReportPage.vue";

type Page = "init" | "projects" | "report";

const currentPage = ref<Page>("init");

function navigateTo(page: Page) {
  currentPage.value = page;
}
</script>

<template>
  <div class="app">
    <aside class="sidebar">
      <div class="sidebar-header">
        <h1 class="app-title">Git2Report</h1>
        <p class="app-subtitle">工作报告生成器</p>
      </div>
      <nav class="nav">
        <button
          class="nav-item"
          :class="{ active: currentPage === 'init' }"
          @click="navigateTo('init')"
        >
          <span class="nav-icon">🔧</span>
          <span class="nav-text">初始化钩子</span>
        </button>
        <button
          class="nav-item"
          :class="{ active: currentPage === 'projects' }"
          @click="navigateTo('projects')"
        >
          <span class="nav-icon">📂</span>
          <span class="nav-text">项目列表</span>
        </button>
        <button
          class="nav-item"
          :class="{ active: currentPage === 'report' }"
          @click="navigateTo('report')"
        >
          <span class="nav-icon">📝</span>
          <span class="nav-text">生成报告</span>
        </button>
      </nav>
      <div class="sidebar-footer">
        <p class="footer-text">基于 Vue 3 + Vite</p>
      </div>
    </aside>

    <main class="main">
      <InitHooksPage v-if="currentPage === 'init'" />
      <ProjectsPage v-else-if="currentPage === 'projects'" />
      <GenerateReportPage v-else-if="currentPage === 'report'" />
    </main>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  background: #f5f7fa;
  min-height: 100vh;
}

.app {
  min-height: 100vh;
  display: flex;
}

.sidebar {
  width: 260px;
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
  color: white;
  display: flex;
  flex-direction: column;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
}

.sidebar-header {
  padding: 32px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.app-title {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 4px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.app-subtitle {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
}

.nav {
  flex: 1;
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  border-radius: 10px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.nav-item.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.nav-icon {
  font-size: 18px;
}

.nav-text {
  font-size: 15px;
}

.sidebar-footer {
  padding: 20px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.footer-text {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  text-align: center;
}

.main {
  flex: 1;
  overflow-y: auto;
  background: #f5f7fa;
}
</style>
