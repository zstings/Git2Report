import { ref, computed } from 'vue';
import { AIService } from '../services/aiService';
import type { AIConfig, AIProfile } from '../services/aiService';

const aiService = AIService.getInstance();
const profiles = ref<AIProfile[]>([]);
const activeProfileId = ref<string | null>(null);

const activeProfile = computed(() => {
  return profiles.value.find(p => p.id === activeProfileId.value) || null;
});

const activeConfig = computed(() => {
  return activeProfile.value?.config || null;
});

async function loadProfiles() {
  const loadedProfiles = await aiService.loadProfiles();
  profiles.value = loadedProfiles;
  activeProfileId.value = aiService.getActiveProfile()?.id || null;
}

async function addProfile(name: string, config: Partial<AIConfig>) {
  const newProfile: AIProfile = {
    id: aiService.generateId(),
    name,
    isActive: profiles.value.length === 0,
    config: {
      apiKey: '',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-3.5-turbo',
      systemPreference: '',
      ...config,
    },
  };

  await aiService.addProfile(newProfile);
  profiles.value = aiService.getAllProfiles();

  if (newProfile.isActive) {
    activeProfileId.value = newProfile.id;
  }

  return newProfile;
}

async function updateProfile(profileId: string, updates: { name?: string; config?: Partial<AIConfig> }) {
  await aiService.updateProfile(profileId, {
    ...(updates.name && { name: updates.name }),
    ...(updates.config && {
      config: {
        ...profiles.value.find(p => p.id === profileId)!.config,
        ...updates.config,
      },
    }),
  });
  profiles.value = aiService.getAllProfiles();
}

async function deleteProfile(profileId: string) {
  await aiService.deleteProfile(profileId);
  profiles.value = aiService.getAllProfiles();
  activeProfileId.value = aiService.getActiveProfile()?.id || null;
}

async function setActiveProfile(profileId: string) {
  await aiService.setActiveProfile(profileId);
  profiles.value = aiService.getAllProfiles();
  activeProfileId.value = profileId;
}

export function useAI() {
  return {
    profiles,
    activeProfile,
    activeConfig,
    activeProfileId,
    loadProfiles,
    addProfile,
    updateProfile,
    deleteProfile,
    setActiveProfile,
  };
}
