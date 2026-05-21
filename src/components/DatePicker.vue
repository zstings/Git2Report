<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';

const props = defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const showPanel = ref(false);
const currentYear = ref(0);
const currentMonth = ref(0);
const containerRef = ref<HTMLElement | null>(null);

const selectedDate = computed(() => {
  if (!props.modelValue) return null;
  const parts = props.modelValue.split('-');
  if (parts.length !== 3) return null;
  return {
    year: parseInt(parts[0]),
    month: parseInt(parts[1]),
    day: parseInt(parts[2]),
  };
});

const displayText = computed(() => {
  if (!selectedDate.value) return '';
  const { year, month, day } = selectedDate.value;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
});

const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

const calendarDays = computed(() => {
  const year = currentYear.value;
  const month = currentMonth.value;
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const days: Array<{ day: number; isCurrentMonth: boolean; isToday: boolean; isSelected: boolean }> = [];

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  for (let i = 0; i < firstDay; i++) {
    days.push({ day: 0, isCurrentMonth: false, isToday: false, isSelected: false });
  }

  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    days.push({
      day: i,
      isCurrentMonth: true,
      isToday: dateStr === todayStr,
      isSelected: dateStr === props.modelValue,
    });
  }

  return days;
});

function initCurrentDate() {
  if (selectedDate.value) {
    currentYear.value = selectedDate.value.year;
    currentMonth.value = selectedDate.value.month;
  } else {
    const today = new Date();
    currentYear.value = today.getFullYear();
    currentMonth.value = today.getMonth() + 1;
  }
}

function togglePanel() {
  showPanel.value = !showPanel.value;
  if (showPanel.value) {
    initCurrentDate();
  }
}

function selectDay(day: number) {
  const dateStr = `${currentYear.value}-${String(currentMonth.value).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  emit('update:modelValue', dateStr);
  showPanel.value = false;
}

function prevMonth() {
  if (currentMonth.value === 1) {
    currentMonth.value = 12;
    currentYear.value--;
  } else {
    currentMonth.value--;
  }
}

function nextMonth() {
  if (currentMonth.value === 12) {
    currentMonth.value = 1;
    currentYear.value++;
  } else {
    currentMonth.value++;
  }
}

function goToToday() {
  const today = new Date();
  currentYear.value = today.getFullYear();
  currentMonth.value = today.getMonth() + 1;
  selectDay(today.getDate());
}

function handleClickOutside(event: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(event.target as Node)) {
    showPanel.value = false;
  }
}

onMounted(() => {
  initCurrentDate();
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});

watch(
  () => props.modelValue,
  () => {
    if (showPanel.value) {
      initCurrentDate();
    }
  }
);
</script>

<template>
  <div ref="containerRef" class="date-picker">
    <button class="date-trigger" @click="togglePanel" type="button">
      <span class="date-icon">📅</span>
      <span class="date-text">{{ displayText || '选择日期' }}</span>
    </button>

    <Transition name="panel-fade">
      <div v-if="showPanel" class="date-panel">
        <div class="panel-header">
          <button class="nav-btn" @click="prevMonth" type="button">‹</button>
          <span class="current-month">{{ currentYear }}年 {{ monthNames[currentMonth - 1] }}</span>
          <button class="nav-btn" @click="nextMonth" type="button">›</button>
        </div>

        <div class="week-header">
          <span v-for="day in weekDays" :key="day" class="week-day">{{ day }}</span>
        </div>

        <div class="days-grid">
          <span
            v-for="(item, index) in calendarDays"
            :key="index"
            class="day-cell"
            :class="{
              'empty': !item.isCurrentMonth,
              'today': item.isToday,
              'selected': item.isSelected,
            }"
            @click="item.isCurrentMonth && selectDay(item.day)"
          >
            {{ item.isCurrentMonth ? item.day : '' }}
          </span>
        </div>

        <div class="panel-footer">
          <button class="today-btn" @click="goToToday" type="button">今天</button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.date-picker {
  position: relative;
  display: inline-block;
}

.date-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--bg-panel);
  color: var(--text-regular);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.date-trigger:hover {
  border-color: var(--color-primary);
}

.date-icon {
  font-size: 14px;
}

.date-text {
  font-family: inherit;
}

.date-panel {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  min-width: 280px;
  background: var(--bg-panel);
  border: 1px solid var(--color-border);
  border-radius: calc(var(--radius-md) + 2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  z-index: 1000;
  padding: 12px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--color-border);
}

.nav-btn {
  width: 28px;
  height: 28px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-muted);
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.nav-btn:hover {
  background: var(--bg-sidebar);
  color: var(--text-primary);
  border-color: var(--text-muted);
}

.current-month {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.week-header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  margin-bottom: 4px;
}

.week-day {
  text-align: center;
  font-size: 12px;
  color: var(--text-muted);
  padding: 4px 0;
}

.days-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.day-cell {
  text-align: center;
  padding: 8px 0;
  font-size: 13px;
  color: var(--text-regular);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.15s;
}

.day-cell:hover:not(.empty) {
  background: var(--bg-sidebar);
}

.day-cell.empty {
  cursor: default;
}

.day-cell.today {
  color: var(--color-primary);
  font-weight: 600;
}

.day-cell.selected {
  background: var(--color-primary);
  color: white;
}

.day-cell.selected:hover {
  background: var(--color-primary);
}

.panel-footer {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--color-border);
  text-align: center;
}

.today-btn {
  padding: 6px 16px;
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-primary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.today-btn:hover {
  background: rgba(37, 99, 235, 0.08);
}

.panel-fade-enter-active,
.panel-fade-leave-active {
  transition: all 0.2s ease;
}

.panel-fade-enter-from,
.panel-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
