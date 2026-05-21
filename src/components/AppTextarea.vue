<script setup lang="ts">
import { computed } from 'vue';

/**
 * 全局多行文本输入组件
 * 提供统一的多行文本输入样式，支持自定义行数和 resize 属性
 */

interface Props {
  /** 输入值（双向绑定） */
  modelValue: string;
  /** 占位提示文本 */
  placeholder?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 显示行数 */
  rows?: number;
  /** 调整大小方式 */
  resize?: 'none' | 'both' | 'horizontal' | 'vertical';
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '',
  disabled: false,
  rows: 6,
  resize: 'vertical',
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'input', value: string): void;
  (e: 'focus', e: FocusEvent): void;
  (e: 'blur', e: FocusEvent): void;
}>();

function handleInput(e: Event) {
  const target = e.target as HTMLTextAreaElement;
  emit('update:modelValue', target.value);
  emit('input', target.value);
}

function handleFocus(e: FocusEvent) {
  emit('focus', e);
}

function handleBlur(e: FocusEvent) {
  emit('blur', e);
}
</script>

<template>
  <textarea
    class="app-textarea"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :rows="rows"
    :style="{ resize }"
    @input="handleInput"
    @focus="handleFocus"
    @blur="handleBlur"
  />
</template>

<style scoped>
.app-textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 14px;
  font-family: inherit;
  color: var(--text-regular);
  background: var(--bg-main);
  box-sizing: border-box;
  transition: border-color 0.15s;
  min-height: 80px;
}

.app-textarea:focus {
  outline: none;
  border-color: var(--color-primary);
}

.app-textarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
