<script setup lang="ts">
import { computed } from 'vue';

/**
 * 全局输入框组件
 * 提供统一的文本输入样式，支持 text 和 password 两种类型
 */

interface Props {
  /** 输入值（双向绑定） */
  modelValue: string;
  /** 输入类型：text 或 password */
  type?: 'text' | 'password';
  /** 占位提示文本 */
  placeholder?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 尺寸：small / default / large */
  size?: 'default' | 'small' | 'large';
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  placeholder: '',
  disabled: false,
  size: 'default',
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'input', value: string): void;
  (e: 'focus', e: FocusEvent): void;
  (e: 'blur', e: FocusEvent): void;
}>();

function handleInput(e: Event) {
  const target = e.target as HTMLInputElement;
  emit('update:modelValue', target.value);
  emit('input', target.value);
}

function handleFocus(e: FocusEvent) {
  emit('focus', e);
}

function handleBlur(e: FocusEvent) {
  emit('blur', e);
}

const inputClass = computed(() => {
  return [
    'app-input',
    `app-input--${props.size}`,
  ];
});
</script>

<template>
  <input
    :class="inputClass"
    :type="type"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    @input="handleInput"
    @focus="handleFocus"
    @blur="handleBlur"
  />
</template>

<style scoped>
.app-input {
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
}

.app-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.app-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.app-input--small {
  padding: 6px 10px;
  font-size: 13px;
}

.app-input--large {
  padding: 12px 14px;
  font-size: 15px;
}
</style>
