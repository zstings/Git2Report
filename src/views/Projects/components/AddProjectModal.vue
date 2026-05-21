<script setup lang="ts">
import { ref } from 'vue';
import { dialog } from 'vokex.app';
import { mergeAddProjects } from '@/projects';
import { useMessage } from '@/composables/useMessage';
import AppDialog from '@/components/AppDialog.vue';
import AppTextarea from '@/components/AppTextarea.vue';
import AppButton from '@/components/AppButton.vue';

/**
 * 添加项目弹窗组件
 * 用于批量添加 Git 项目，支持手动输入路径或选择目录
 */

/** 是否显示弹窗（使用 defineModel 宏实现双向绑定） */
const visible = defineModel<boolean>('visible', { default: false });

const { success, warning } = useMessage();
/** 项目路径输入内容（多行文本，每行一个路径） */
const addProjectPathsInput = ref('');
/** 是否正在加载 */
const loading = ref(false);

/**
 * 选择目录按钮点击处理
 * 通过系统对话框选择一个或多个目录
 */
async function handleSelectDirectories() {
  const result = await dialog.showOpenDialog({
    title: '选择 Git 项目目录',
    multiple: true,
    directory: true,
  });

  let selectedPaths: string[] = [];
  if (Array.isArray(result) && result.length > 0) {
    selectedPaths = result;
  } else if (typeof result === 'string' && result) {
    selectedPaths = [result];
  }

  if (selectedPaths.length > 0) {
    const existingPaths = addProjectPathsInput.value
      .trim()
      .split('\n')
      .filter(p => p.trim());
    const newPaths = [...new Set([...existingPaths, ...selectedPaths])];
    addProjectPathsInput.value = newPaths.join('\n');
  }
}

/**
 * 添加项目按钮点击处理
 * 验证输入路径并调用 mergeAddProjects 批量添加项目
 */
async function handleAddProjects() {
  const paths = addProjectPathsInput.value.trim().split('\n');
  const validPaths = paths.filter(p => p.trim());
  if (validPaths.length === 0) {
    warning('请输入或选择项目路径');
    return;
  }
  loading.value = true;
  await mergeAddProjects(validPaths, {
    success: () => {
      success('项目添加成功');
      visible.value = false;
      addProjectPathsInput.value = '';
    },
    finally: () => {
      loading.value = false;
    },
  });
}

/**
 * 关闭弹窗处理
 * 重置输入内容并触发关闭事件
 */
function closeModal() {
  visible.value = false;
  addProjectPathsInput.value = '';
}
</script>

<template>
  <AppDialog v-model:visible="visible" title="添加项目" width="460px" @close="closeModal">
    <div class="form-group">
      <label>项目路径（每行一个）</label>
      <AppTextarea v-model="addProjectPathsInput" placeholder="输入项目路径，每行一个" :rows="6" />
      <AppButton type="secondary" @click="handleSelectDirectories" class="mt-2">选择目录</AppButton>
    </div>
    <template #footer>
      <AppButton type="secondary" @click="closeModal">取消</AppButton>
      <AppButton type="primary" :loading="loading" @click="handleAddProjects">
        {{ loading ? '添加中...' : '确定' }}
      </AppButton>
    </template>
  </AppDialog>
</template>

<style scoped>
.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: var(--text-regular);
  font-size: 13px;
}

.mt-2 {
  margin-top: 8px;
}
</style>
