 <script setup lang="ts">
import { ref } from 'vue';
import AIConfigModal from '@/views/GenerateReport/components/AIConfigModal.vue';
import GitPanel from '@/views/GenerateReport/components/GitPanel.vue';
import ReportPanel from '@/views/GenerateReport/components/ReportPanel.vue';
import type { GitCommitLog } from '@/services/aiService';
import { formatDate } from '@/utils';

const selectedDate = ref(formatDate(new Date()));
const gitLogs = ref<GitCommitLog[]>([]);
const dailyArchive = ref<Record<string, string>>({});

const showAIConfig = ref(false);
</script>

<template>
  <div class="page report-page">
    <div class="workflow-container">
      <GitPanel v-model="gitLogs" v-model:selectedDate="selectedDate" v-model:dailyArchive="dailyArchive" />

      <ReportPanel v-model="gitLogs" v-model:selectedDate="selectedDate" v-model:dailyArchive="dailyArchive" @showAIConfig="showAIConfig = true" />
    </div>

    <AIConfigModal v-model:visible="showAIConfig" />
  </div>
</template>

<style scoped>
.page {
  padding: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.workflow-container {
  display: flex;
  height: 100vh;
  gap: 0;
}
</style>
