<script setup lang="ts">
import { ref } from "vue";
import InitHooksPage from "./components/InitHooksPage.vue";
import ProjectsPage from "./components/ProjectsPage.vue";
import GenerateReportPage from "./components/GenerateReportPage.vue";

type Page = "init" | "projects" | "report";

const currentPage = ref<Page>("init");
const projectsPageKey = ref(0);

function navigateTo(page: Page) {
  currentPage.value = page;
  if (page === "projects") {
    projectsPageKey.value += 1;
  }
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
      <div class="sidebar-footer" v-if="false">
        <p class="footer-text">基于 Vue 3 + Vite</p>
      </div>
    </aside>

    <main class="main">
      <InitHooksPage v-if="currentPage === 'init'" />
      <ProjectsPage v-else-if="currentPage === 'projects'" :key="projectsPageKey" />
      <GenerateReportPage v-else-if="currentPage === 'report'" />
    </main>
  </div>
</template>

<style>
:root {
  --bg-main: #f8fafc;
  --bg-panel: #ffffff;
  --bg-sidebar: #f1f5f9;
  --text-primary: #0f172a;
  --text-regular: #334155;
  --text-muted: #64748b;
  --color-primary: #2563eb;
  --color-border: #e2e8f0;
  --radius-md: 6px;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body {
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  background: var(--bg-main);
  height: 100%;
  overflow: hidden;
}

.app {
  height: 100vh;
  display: flex;
  overflow: hidden;
}

.sidebar {
  width: 220px;
  background: var(--bg-sidebar);
  color: var(--text-regular);
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--color-border);
  flex-shrink: 0;
  position: sticky;
  top: 0;
  height: 100vh;
}

.sidebar-header {
  padding: 24px 20px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.app-title {
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 4px;
  color: var(--text-primary);
}

.app-subtitle {
  font-size: 12px;
  color: var(--text-muted);
}

.nav {
  flex: 1;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
  min-height: 0;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.15s;
  flex-shrink: 0;
}

.nav-item:hover {
  background: rgba(37, 99, 235, 0.08);
  color: var(--text-primary);
}

.nav-item.active {
  background: rgba(37, 99, 235, 0.1);
  color: var(--color-primary);
}

.nav-icon {
  font-size: 16px;
}

.nav-text {
  font-size: 14px;
}

.sidebar-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;
}

.footer-text {
  font-size: 11px;
  color: var(--text-muted);
  text-align: center;
}

.main {
  flex: 1;
  overflow-y: auto;
  background: var(--bg-main);
  height: 100vh;
  overflow-x: hidden;
}
</style>
