import { ref, readonly } from 'vue';
import type { Component } from 'vue';
import Message from '../components/Message.vue';

interface MessageItem {
  id: number;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration: number;
}

const messages = ref<MessageItem[]>([]);
let messageId = 0;

function showMessage(type: 'success' | 'error' | 'warning' | 'info', message: string, duration: number = 3000) {
  const id = ++messageId;
  messages.value.push({ id, type, message, duration });
  return id;
}

function closeMessage(id: number) {
  const index = messages.value.findIndex(m => m.id === id);
  if (index !== -1) {
    messages.value.splice(index, 1);
  }
}

function success(message: string, duration?: number) {
  return showMessage('success', message, duration);
}

function error(message: string, duration?: number) {
  return showMessage('error', message, duration);
}

function warning(message: string, duration?: number) {
  return showMessage('warning', message, duration);
}

function info(message: string, duration?: number) {
  return showMessage('info', message, duration);
}

export function useMessage() {
  return {
    messages: readonly(messages),
    success,
    error,
    warning,
    info,
    close: closeMessage,
  };
}

export function getMessageContainer() {
  return {
    messages,
    closeMessage,
    MessageComponent: Message as Component,
  };
}
