<script setup lang="ts">
import { ref } from 'vue';
import { dialog, fs } from 'vokex.app';
import { mergeAddProjects } from '@/projects';
import { useMessage } from '@/composables/useMessage';
import AppDialog from '@/components/AppDialog.vue';
import AppTextarea from '@/components/AppTextarea.vue';
import AppButton from '@/components/AppButton.vue';

/**
 * 全量扫描弹窗组件
 * 用于递归扫描指定目录下所有 Git 项目
 */

/** 是否显示弹窗（使用 defineModel 宏实现双向绑定） */
const visible = defineModel<boolean>('visible', { default: false });

const { warning, info } = useMessage();
/** 扫描起始目录输入内容 */
const scanPathsInput = ref('');
/** 是否正在扫描 */
const loading = ref(false);

/**
 * 选择扫描起始目录
 */
async function handleSelectDirectories() {
  const result = await dialog.showOpenDialog({
    title: '选择扫描起始目录',
    multiple: true,
    directory: true,
  });
  if (Array.isArray(result) && result.length > 0) {
    const existingPaths = scanPathsInput.value
      .split('\n')
      .map(p => p.trim())
      .filter(p => p.length > 0);
    const newPaths = result.filter(p => !existingPaths.includes(p));
    scanPathsInput.value = [...existingPaths, ...newPaths].join('\n');
  }
}

/**
 * 执行全量扫描，查找 Git 项目
 * @param scanPaths - 需要扫描的目录列表
 * @returns 找到的 Git 项目路径数组
 */
async function performScan(scanPaths: string[]): Promise<string[]> {
  const foundProjects: string[] = [];
  const scanPromises = scanPaths.map(async scanPath => {
    try {
      const gitDirs = await fs.glob({ pattern: '**/.git', cwd: scanPath, absolute: true });
      for (const gitDir of gitDirs) {
        const projectPath = gitDir.replace(/[\\/].git$/, '');
        if (projectPath && !foundProjects.includes(projectPath)) {
          foundProjects.push(projectPath);
        }
      }
    } catch {}
  });
  await Promise.all(scanPromises);
  return foundProjects;
}

/**
 * 处理开始扫描
 */
async function handleStartScan() {
  const paths = scanPathsInput.value.trim().split('\n');
  const validPaths = paths.filter(p => p.trim());
  if (validPaths.length === 0) {
    warning('请输入或选择至少一个扫描起始目录');
    return;
  }
  loading.value = true;
  try {
    const foundProjects = await performScan(validPaths);
    if (foundProjects.length === 0) {
      info('未发现任何 Git 项目');
      return;
    }
    await mergeAddProjects(foundProjects, {
      success: () => {
        visible.value = false;
        scanPathsInput.value = '';
      },
      finally: () => {
        loading.value = false;
      },
    });
  } finally {
    loading.value = false;
  }
}

/**
 * 关闭弹窗
 */
function closeModal() {
  visible.value = false;
  scanPathsInput.value = '';
}
</script>

<template>
  <AppDialog v-model:visible="visible" title="全量扫描" width="500px" @close="closeModal">
    <div class="form-group">
      <label>扫描起始目录（每行一个）</label>
      <AppTextarea v-model="scanPathsInput" placeholder="输入扫描起始目录，每行一个" :rows="6" />
      <AppButton type="secondary" @click="handleSelectDirectories" class="mt-2">选择目录</AppButton>
    </div>
    <div class="alert alert-info">
      <strong>提示：</strong>扫描会递归查找所有包含 .git 的目录，请谨慎选择扫描范围。
    </div>
    <template #footer>
      <AppButton type="secondary" @click="closeModal">取消</AppButton>
      <AppButton type="primary" :loading="loading" @click="handleStartScan">
        {{ loading ? '扫描中...' : '开始扫描' }}
      </AppButton>
    </template>
  </AppDialog>
</template>

<style scoped>
.form-group {
  margin-bottom: 12px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-regular);
}

.mt-2 {
  margin-top: 8px;
}

.alert {
  padding: 12px;
  border-radius: var(--radius-md);
  font-size: 13px;
}

.alert-info {
  background: rgba(59, 130, 246, 0.1);
  color: var(--color-primary);
  border: 1px solid rgba(59, 130, 246, 0.2);
}
</style>
