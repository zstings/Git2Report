<script setup lang="ts">
import { computed } from 'vue';

/**
 * 全局按钮组件
 * 提供统一的按钮样式和交互行为
 */

interface Props {
  /** 按钮类型 */
  type?: 'primary' | 'secondary' | 'danger' | 'ghost';
  /** 按钮尺寸 */
  size?: 'small' | 'default' | 'large';
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否加载中 */
  loading?: boolean;
  /** 是否为块级元素 */
  block?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  type: 'primary',
  size: 'default',
  disabled: false,
  loading: false,
  block: false,
});

const buttonClass = computed(() => {
  return [
    'app-btn',
    `app-btn--${props.type}`,
    `app-btn--${props.size}`,
    {
      'app-btn--block': props.block,
      'app-btn--loading': props.loading,
    },
  ];
});
</script>

<template>
  <button
    :class="buttonClass"
    :disabled="disabled || loading"
    type="button"
  >
    <span v-if="loading" class="app-btn-spinner"></span>
    <slot />
  </button>
</template>

<style scoped>
.app-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  border: none;
  font-family: inherit;
}

.app-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.app-btn--primary {
  background: var(--color-primary);
  color: white;
}

.app-btn--primary:not(:disabled):hover {
  opacity: 0.9;
}

.app-btn--secondary {
  background: transparent;
  color: var(--text-regular);
  border: 1px solid var(--color-border);
}

.app-btn--secondary:not(:disabled):hover {
  background: var(--bg-sidebar);
}

.app-btn--danger {
  background: #ef4444;
  color: white;
}

.app-btn--danger:not(:disabled):hover {
  background: #dc2626;
}

.app-btn--ghost {
  background: transparent;
  color: var(--text-muted);
}

.app-btn--ghost:not(:disabled):hover {
  background: var(--bg-sidebar);
  color: var(--text-primary);
}

.app-btn--small {
  padding: 6px 12px;
  font-size: 13px;
}

.app-btn--large {
  padding: 12px 24px;
  font-size: 15px;
}

.app-btn--block {
  width: 100%;
}

.app-btn--loading {
  position: relative;
}

.app-btn-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
