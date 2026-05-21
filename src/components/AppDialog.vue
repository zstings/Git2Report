<script setup lang="ts">
import { computed } from 'vue';

/**
 * 全局弹窗组件
 * 提供统一的弹窗样式和交互行为，支持自定义标题、宽度、关闭按钮等
 * 使用 Teleport 挂载到 body，避免 z-index 层级问题
 */

interface Props {
  /** 是否显示弹窗 */
  visible: boolean;
  /** 弹窗标题 */
  title?: string;
  /** 弹窗宽度，支持字符串或数字 */
  width?: string | number;
  /** 是否显示关闭按钮 */
  showClose?: boolean;
  /** 点击遮罩层是否关闭弹窗 */
  closeOnOverlay?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  width: '480px',
  showClose: true,
  closeOnOverlay: true,
});

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'close'): void;
}>();

const dialogWidth = computed(() => {
  if (typeof props.width === 'number') {
    return `${props.width}px`;
  }
  return props.width;
});

function close() {
  emit('update:visible', false);
  emit('close');
}

function handleOverlayClick() {
  if (props.closeOnOverlay) {
    close();
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog-fade">
      <div v-if="visible" class="app-dialog-overlay" @click.self="handleOverlayClick">
        <div class="app-dialog" :style="{ width: dialogWidth }">
          <div v-if="title || $slots.header" class="app-dialog-header">
            <slot name="header">
              <h3 class="app-dialog-title">{{ title }}</h3>
            </slot>
            <button v-if="showClose" class="app-dialog-close" @click="close">×</button>
          </div>
          <div class="app-dialog-body">
            <slot />
          </div>
          <div v-if="$slots.footer" class="app-dialog-footer">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.app-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.app-dialog {
  background: var(--bg-panel);
  border-radius: calc(var(--radius-md) + 4px);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  max-height: 90vh;
}

.app-dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.app-dialog-title {
  font-size: 16px;
  color: var(--text-primary);
  margin: 0;
  font-weight: 600;
}

.app-dialog-close {
  background: none;
  border: none;
  font-size: 24px;
  color: var(--text-muted);
  cursor: pointer;
  line-height: 1;
  padding: 0;
  transition: color 0.15s;
}

.app-dialog-close:hover {
  color: var(--text-primary);
}

.app-dialog-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.app-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;
}

.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: all 0.2s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
