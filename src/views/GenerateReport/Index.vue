 <script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAI } from '@/composables/useAI';
import { useConfig } from '@/composables/useConfig';
import { useProjects } from '@/composables/useProjects';
import AIConfigModal from '@/views/GenerateReport/components/AIConfigModal.vue';
import GitPanel from '@/views/GenerateReport/components/GitPanel.vue';
import ReportPanel from '@/views/GenerateReport/components/ReportPanel.vue';

const { loadProfiles } = useAI();
const { loadConfig: loadAppConfig } = useConfig();
const { loadProjects } = useProjects();

const showAIConfig = ref(false);

onMounted(async () => {
  await Promise.all([loadProfiles(), loadAppConfig()]);
  await loadProjects();
});
</script>

<template>
  <div class="page report-page">
    <div class="workflow-container">
      <GitPanel />

      <ReportPanel @showAIConfig="showAIConfig = true" />
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
