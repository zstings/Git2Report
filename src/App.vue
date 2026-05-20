<script setup lang="ts">
import { ref, onMounted } from 'vue';
import ProjectsPage from './components/ProjectsPage.vue';
import InitHooksPage from './components/InitHooksPage.vue';
import AppUpdate from './components/AppUpdate.vue';
import GenerateReportPage from './components/GenerateReportPage.vue';
import { useDarkMode } from './composables/useDarkMode';
import { version } from '../package.json';

type Page = 'init' | 'projects' | 'report';

const currentPage = ref<Page>('init');
const projectsPageKey = ref(0);
const { isDark, initTheme, toggleDark } = useDarkMode();

function navigateTo(page: Page) {
  currentPage.value = page;
  if (page === 'projects') {
    projectsPageKey.value += 1;
  }
}

onMounted(() => {
  initTheme();
});
</script>

<template>
  <div class="app">
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="header-top">
          <div>
            <h1 class="app-title">Git2Report</h1>
            <p class="app-subtitle">工作报告生成</p>
            <p class="app-version">v{{ version }}</p>
          </div>
          <button class="theme-toggle" @click="toggleDark" :title="isDark ? '切换到浅色模式' : '切换到暗黑模式'">
            {{ isDark ? '☀️' : '🌙' }}
          </button>
        </div>
      </div>
      <nav class="nav">
        <button class="nav-item" :class="{ active: currentPage === 'init' }" @click="navigateTo('init')">
          <span class="nav-icon">⚙️</span>
          <span class="nav-text">系统设置</span>
        </button>
        <button class="nav-item" :class="{ active: currentPage === 'projects' }" @click="navigateTo('projects')">
          <span class="nav-icon">📂</span>
          <span class="nav-text">项目列表</span>
        </button>
        <button class="nav-item" :class="{ active: currentPage === 'report' }" @click="navigateTo('report')">
          <span class="nav-icon">📝</span>
          <span class="nav-text">生成报告</span>
        </button>
      </nav>
      <div class="sidebar-footer">
        <AppUpdate />
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

html.dark {
  --bg-main: #0b0f19;
  --bg-panel: #131a26;
  --bg-sidebar: #0f1420;
  --text-primary: #f8fafc;
  --text-regular: #cbd5e1;
  --text-muted: #64748b;
  --color-primary: #3b82f6;
  --color-border: #1e293b;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background: var(--bg-main);
  height: 100%;
  overflow: hidden;
  transition: background-color 0.2s ease;
}

*::-webkit-scrollbar {
  width: 6px;
}

*::-webkit-scrollbar-track {
  background: transparent;
}

*::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}

*::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

html.dark *::-webkit-scrollbar-thumb {
  background: #334155;
}

html.dark *::-webkit-scrollbar-thumb:hover {
  background: #475569;
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

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.theme-toggle {
  width: 32px;
  height: 32px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: transparent;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  flex-shrink: 0;
}

.theme-toggle:hover {
  background: var(--bg-main);
  border-color: var(--color-primary);
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

.app-version {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 4px;
  opacity: 0.7;
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
