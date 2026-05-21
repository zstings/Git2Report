<script setup lang="ts">
import { ref } from 'vue';
import { dialog } from 'vokex.app';
import { type GitProject, mergeAddProjects } from '@/projects';
import { useMessage } from '@/composables/useMessage';

defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'update:projects', value: GitProject[]): void;
}>();

const { success, warning } = useMessage();
const addProjectPathsInput = ref('');
const loading = ref(false);

/**
 * 选择目录用于添加项目
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
 * 处理添加项目
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
      emit('update:visible', false);
      addProjectPathsInput.value = '';
    },
    finally: () => {
      loading.value = false;
    },
  });
}

/**
 * 关闭模态框
 */
function closeModal() {
  emit('update:visible', false);
  addProjectPathsInput.value = '';
}
</script>

<template>
  <div v-if="visible" class="modal-overlay" @click.self="closeModal">
    <div class="modal-content">
      <div class="modal-header">
        <h3>添加项目</h3>
        <button class="modal-close" @click="closeModal">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>项目路径（每行一个）</label>
          <textarea v-model="addProjectPathsInput" placeholder="输入项目路径，每行一个" rows="6" class="form-control"></textarea>
          <button @click="handleSelectDirectories" class="btn btn-secondary mt-2">选择目录</button>
        </div>
      </div>
      <div class="modal-footer">
        <button @click="closeModal" class="btn btn-secondary">取消</button>
        <button @click="handleAddProjects" class="btn btn-primary" :disabled="loading">
          {{ loading ? '添加中...' : '确定' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--bg-panel);
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--text-muted);
}

.modal-body {
  padding: 16px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px;
  border-top: 1px solid var(--border-color);
}

.form-group {
  margin-bottom: 12px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
}

.form-control {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-input);
  color: var(--text-color);
  font-size: 14px;
  resize: vertical;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-secondary {
  background: var(--bg-button);
  color: var(--text-color);
}

.mt-2 {
  margin-top: 8px;
}
</style>
