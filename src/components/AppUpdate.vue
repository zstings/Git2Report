<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { version } from '../../package.json';
import { http, shell, fs, path, app } from 'vokex.app';
import { useMessage } from '@/composables/useMessage';
const { info, error, success } = useMessage();

interface Release {
  tag_name: string;
  name: string;
  releaseNotes: string;
}

const CONFIG = {
  githubRawUrl: 'https://raw.githubusercontent.com/zstings/Git2Report/refs/heads/main/package.json',
  releaseDownloadUrl: 'https://github.com/zstings/Git2Report/releases/download',
};

const showUpdateModal = ref(false);
const isChecking = ref(false);
const hasUpdate = ref(false);
const isDownloading = ref(false);
const isUpdateReady = ref(false);
const latestVersion = ref('');
const releaseNotes = ref('');

function parseVersion(v: string): number {
  const parts = v
    .replace(/^v/, '')
    .split('.')
    .map(n => n.padEnd(3, '0'));
  return Number(parts.join(''));
}

async function checkFromGitHubRaw(isAuto: boolean): Promise<Release | null> {
  try {
    const response = await http.fetch(CONFIG.githubRawUrl, {
      method: 'GET',
      timeout: isAuto ? 5 : 20,
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

async function checkForUpdates(isAuto: boolean): Promise<boolean> {
  if (latestVersion.value) return false;
  isChecking.value = true;
  try {
    const release = await checkFromGitHubRaw(isAuto);
    if (!release) {
      throw new Error('检查更新失败');
    }
    releaseNotes.value = release.releaseNotes;
    latestVersion.value = release.tag_name;

    const current = parseVersion(version);
    const latest = parseVersion(release.tag_name);

    hasUpdate.value = latest > current;

    // 检查是否已下载过
    if (hasUpdate.value) {
      const tempDir = await app.getPath('temp');
      const downloadedPath = await path.join(tempDir, `git2report_v${release.tag_name}.exe`);
      const exists = await fs.exists(downloadedPath);
      if (exists) {
        isUpdateReady.value = true;
      }
    }

    return hasUpdate.value;
  } catch (err) {
    console.log('检查更新出错:', err);
    return false;
  } finally {
    isChecking.value = false;
  }
}

async function downloadUpdate(): Promise<boolean> {
  isDownloading.value = true;
  try {
    const tempDir = await app.getPath('temp');
    const downloadUrl = `${CONFIG.releaseDownloadUrl}/${latestVersion.value}/Git2Report.exe`;
    const savePath = await path.join(tempDir, `git2report_v${latestVersion.value}.exe`);

    // 用 PowerShell 下载，自动处理 GitHub 302 重定向
    const psCmd = `Invoke-WebRequest -Uri "${downloadUrl}" -OutFile "${savePath}" -UseBasicParsing`;
    const result = await shell.exec('powershell', ['-NoProfile', '-Command', psCmd]);

    if (!result.success) {
      throw new Error(`下载失败: ${result.stderr || '未知错误'}`);
    }

    // 校验文件大小
    const stat = await fs.stat(savePath);
    if (!stat.isFile || stat.size === 0) {
      await fs.rm(savePath, { force: true });
      throw new Error('下载文件无效（0字节）');
    }

    isUpdateReady.value = true;
    success('更新已下载完成，点击"重启更新"完成安装');
    return true;
  } catch (err) {
    error(`下载更新失败: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  } finally {
    isDownloading.value = false;
  }
}

async function applyUpdate(): Promise<void> {
  try {
    const tempDir = await app.getPath('temp');
    const newExePath = await path.join(tempDir, `git2report_v${latestVersion.value}.exe`);

    // 检查下载的文件是否存在
    const exists = await fs.exists(newExePath);
    if (!exists) {
      error('更新文件不存在，请重新下载');
      return;
    }

    // 获取当前 exe 路径
    const appPath = await app.getAppPath();
    const appName = await app.getName();
    const currentExePath = await path.join(appPath, appName + '.exe');

    // 用 spawn 启动 PowerShell 后台进程，不 await 等待完成
    // 等旧进程退出 → 复制覆盖 → 启动新版本
    const psCmd = `Start-Sleep -Seconds 2; Copy-Item -Path '${newExePath}' -Destination '${currentExePath}' -Force; Start-Process '${currentExePath}'`;
    await shell.spawn('powershell', ['-WindowStyle', 'Hidden', '-Command', psCmd]);

    // 立即退出当前应用，释放文件锁，PowerShell 会等 2 秒后复制覆盖
    await app.quit();
  } catch (err) {
    error(`更新失败: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function handleManualCheck(isAuto: boolean = false) {
  const found = await checkForUpdates(isAuto);
  if (found) {
    if (!isAuto) showUpdateModal.value = true;
  } else {
    if (isAuto) return;
    info('当前已是最新版本 v' + version);
  }
}

async function handleUpdate() {
  if (isUpdateReady.value) {
    await applyUpdate();
  } else {
    await downloadUpdate();
  }
}

onMounted(async () => {
  handleManualCheck(true);
});
</script>

<template>
  <button v-if="isUpdateReady" class="update-check-btn update-ready" @click="applyUpdate">
    <span>重启更新</span>
  </button>
  <button v-else-if="hasUpdate" class="update-check-btn" @click="() => (showUpdateModal = true)" :disabled="isChecking">
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
          <button class="btn-update" @click="handleUpdate" :disabled="isDownloading">
            <span v-if="isDownloading">下载中...</span>
            <span v-else-if="isUpdateReady">重启更新</span>
            <span v-else>立即更新</span>
          </button>
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

.update-check-btn.update-ready {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
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
