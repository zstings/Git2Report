<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

export interface MessageProps {
  id: number;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
  onClose: (id: number) => void;
}

const props = withDefaults(defineProps<MessageProps>(), {
  duration: 3000,
});

const visible = ref(false);
let timer: ReturnType<typeof setTimeout> | null = null;

function close() {
  visible.value = false;
  setTimeout(() => {
    props.onClose(props.id);
  }, 300);
}

onMounted(() => {
  visible.value = true;
  if (props.duration > 0) {
    timer = setTimeout(close, props.duration);
  }
});

onUnmounted(() => {
  if (timer) {
    clearTimeout(timer);
  }
});
</script>

<template>
  <Transition name="message-fade">
    <div v-if="visible" class="message" :class="`message-${type}`">
      <span class="message-icon">
        {{ type === 'success' ? '✓' : type === 'error' ? '✕' : type === 'warning' ? '!' : 'i' }}
      </span>
      <span class="message-text">{{ message }}</span>
    </div>
  </Transition>
</template>

<style scoped>
.message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: var(--radius-md);
  font-size: 14px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  pointer-events: auto;
  margin-bottom: 8px;
}

.message-icon {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
  flex-shrink: 0;
}

.message-text {
  line-height: 1.4;
}

.message-success {
  background: #f0fdf4;
  color: #166534;
  border: 1px solid #bbf7d0;
}

.message-success .message-icon {
  background: #22c55e;
  color: white;
}

.message-error {
  background: #fef2f2;
  color: #991b1b;
  border: 1px solid #fecaca;
}

.message-error .message-icon {
  background: #ef4444;
  color: white;
}

.message-warning {
  background: #fffbeb;
  color: #92400e;
  border: 1px solid #fde68a;
}

.message-warning .message-icon {
  background: #f59e0b;
  color: white;
}

.message-info {
  background: #eff6ff;
  color: #1e40af;
  border: 1px solid #bfdbfe;
}

.message-info .message-icon {
  background: #3b82f6;
  color: white;
}

.message-fade-enter-active,
.message-fade-leave-active {
  transition: all 0.3s ease;
}

.message-fade-enter-from,
.message-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

html.dark .message-success {
  background: #052e16;
  color: #86efac;
  border-color: #166534;
}

html.dark .message-error {
  background: #450a0a;
  color: #fca5a5;
  border-color: #991b1b;
}

html.dark .message-warning {
  background: #451a03;
  color: #fcd34d;
  border-color: #92400e;
}

html.dark .message-info {
  background: #1e3a5f;
  color: #93c5fd;
  border-color: #1e40af;
}
</style>
