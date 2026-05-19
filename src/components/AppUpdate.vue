<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { version } from '../../package.json';
import { dialog, http, shell } from 'vokex.app';

interface Release {
  tag_name: string;
  name: string;
  releaseNotes: string;
}

const CONFIG = {
  githubRawUrl: 'https://raw.githubusercontent.com/zstings/Git2Report/refs/heads/main/package.json'
};

const showUpdateModal = ref(false);
const isChecking = ref(false);
const hasUpdate = ref(false);
const latestVersion = ref('');
const releaseNotes = ref('');

function parseVersion(v: string): number {
  const parts = v
    .replace(/^v/, '')
    .split('.')
    .map(n => n.padEnd(3, '0'));
  return Number(parts.join(''));
}

async function checkFromGitHubRaw(): Promise<Release | null> {
  try {
    const response = await http.fetch(CONFIG.githubRawUrl, {
      method: 'GET',
      timeout: 20,
    });
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    const data = await response.json();
    return {
      tag_name: data.version,
      name: `v${data.version}`,
      releaseNotes: data.releaseNotes,
    };
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : error}`);
  }
}

async function checkForUpdates(): Promise<boolean> {
  if(latestVersion.value) return false;
  isChecking.value = true;
  try {
    const release = await checkFromGitHubRaw();
    if (!release) {
      throw new Error('检查更新失败');
    }
    releaseNotes.value = release.releaseNotes;
    latestVersion.value = release.tag_name;

    const current = parseVersion(version);
    const latest = parseVersion(release.tag_name);

    hasUpdate.value = latest > current;

    return hasUpdate.value;
  } catch (error) {
    console.log('检查更新出错:', error);
    return false;
  } finally {
    isChecking.value = false;
  }
}

async function openDownloadPage() {
  await shell.openExternal('https://github.com/zstings/Git2Report/releases/tag/v' + latestVersion.value);
}

async function handleManualCheck(isAuto: boolean = false) {
  const hasUpdate = await checkForUpdates();
  if (hasUpdate) {
    showUpdateModal.value = true;
  } else {
    if(isAuto) return;
    await dialog.info({
      title: '检查更新',
      message: '当前已是最新版本 v' + version,
    });
  }
}

async function handleUpdate() {
  await openDownloadPage();
  showUpdateModal.value = false;
}

onMounted(async () => {
  handleManualCheck(true);
});
</script>

<template>
  <button v-if="hasUpdate" class="update-check-btn" @click="() => showUpdateModal = true" :disabled="isChecking">
    <span>✨ 发现新版本</span>
  </button>
  <button v-else class="update-check-btn" @click="handleManualCheck()" :disabled="isChecking">
    <span v-if="isChecking">检查中...</span>
    <span v-else>检查更新</span>
  </button>
  <Teleport to="body">
    <div v-if="showUpdateModal" class="modal-overlay" @click.self="showUpdateModal = false">
      <div class="update-modal">
        <div class="modal-header">
          <h3>🎉 发现新版本</h3>
          <button class="close-btn" @click="showUpdateModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="version-info">
            <p class="current-version">当前版本: v{{ version }}</p>
            <p class="latest-version">最新版本: v{{ latestVersion }}</p>
          </div>
          <div v-if="releaseNotes" class="release-notes">
            <h4>更新内容:</h4>
            <pre>{{ releaseNotes }}</pre>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" @click="showUpdateModal = false">稍后</button>
          <button class="btn-update" @click="handleUpdate">前往下载</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style>
.update-check-btn {
  width: 100%;
  padding: 10px 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--bg-main);
  color: var(--text-regular);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.update-check-btn:hover:not(:disabled) {
  background: rgba(37, 99, 235, 0.08);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.update-check-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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

.update-modal {
  background: var(--bg-panel);
  border-radius: calc(var(--radius-md) + 4px);
  width: 90%;
  max-width: 480px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid var(--color-border);
}

.modal-header h3 {
  font-size: 18px;
  color: var(--text-primary);
  margin: 0;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: var(--text-muted);
  cursor: pointer;
  line-height: 1;
  padding: 0;
  transition: color 0.15s;
}

.close-btn:hover {
  color: var(--text-primary);
}

.modal-body {
  padding: 24px;
}

.version-info {
  margin-bottom: 20px;
}

.current-version,
.latest-version {
  font-size: 14px;
  margin: 6px 0;
}

.current-version {
  color: var(--text-muted);
}

.latest-version {
  color: var(--color-primary);
  font-weight: 600;
}

.release-notes h4 {
  font-size: 14px;
  color: var(--text-primary);
  margin-bottom: 10px;
  font-weight: 600;
}

.release-notes pre {
  background: var(--bg-main);
  padding: 12px;
  border-radius: var(--radius-md);
  font-size: 13px;
  color: var(--text-regular);
  line-height: 1.6;
  white-space: pre-wrap;
  word-wrap: break-word;
  max-height: 200px;
  overflow-y: auto;
  margin: 0;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 24px;
  border-top: 1px solid var(--color-border);
}

.btn-cancel,
.btn-update {
  padding: 10px 20px;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-cancel {
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--text-regular);
}

.btn-cancel:hover {
  background: var(--bg-sidebar);
}

.btn-update {
  border: none;
  background: var(--color-primary);
  color: white;
}

.btn-update:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}
</style>
