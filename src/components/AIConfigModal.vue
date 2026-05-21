<script setup lang="ts">
import { ref, watch } from 'vue';
import { useAI } from '../composables/useAI';
import { useMessage } from '../composables/useMessage';
import type { AIProfile } from '../services/aiService';

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
}>();

const { success, error, warning } = useMessage();
const {
  profiles,
  activeProfileId,
  loadProfiles,
  addProfile,
  updateProfile,
  deleteProfile,
  setActiveProfile,
} = useAI();

const showAddForm = ref(false);
const showEditForm = ref(false);
const editingProfile = ref<AIProfile | null>(null);

const newProfileName = ref('');
const newApiKey = ref('');
const newBaseUrl = ref('https://api.openai.com/v1');
const newModel = ref('gpt-3.5-turbo');
const newSystemPreference = ref('');

const editProfileName = ref('');
const editApiKey = ref('');
const editBaseUrl = ref('');
const editModel = ref('');
const editSystemPreference = ref('');

watch(() => props.visible, async (val) => {
  if (val) {
    await loadProfiles();
    showAddForm.value = false;
    showEditForm.value = false;
  }
});

function openAddForm() {
  showAddForm.value = true;
  showEditForm.value = false;
  newProfileName.value = '';
  newApiKey.value = '';
  newBaseUrl.value = 'https://api.openai.com/v1';
  newModel.value = 'gpt-3.5-turbo';
  newSystemPreference.value = '';
}

async function handleAddProfile() {
  if (!newProfileName.value.trim()) {
    warning('请输入配置名称');
    return;
  }

  if (!newApiKey.value.trim()) {
    warning('请输入 API Key');
    return;
  }

  try {
    await addProfile(newProfileName.value.trim(), {
      apiKey: newApiKey.value.trim(),
      baseUrl: newBaseUrl.value.trim(),
      model: newModel.value.trim(),
      systemPreference: newSystemPreference.value.trim(),
    });

    success('配置添加成功');
    showAddForm.value = false;
  } catch (err) {
    error(`添加失败: ${err}`);
  }
}

function openEditForm(profile: AIProfile) {
  editingProfile.value = profile;
  showEditForm.value = true;
  showAddForm.value = false;
  editProfileName.value = profile.name;
  editApiKey.value = profile.config.apiKey;
  editBaseUrl.value = profile.config.baseUrl;
  editModel.value = profile.config.model;
  editSystemPreference.value = profile.config.systemPreference;
}

async function handleUpdateProfile() {
  if (!editingProfile.value) return;

  if (!editProfileName.value.trim()) {
    warning('请输入配置名称');
    return;
  }

  if (!editApiKey.value.trim()) {
    warning('请输入 API Key');
    return;
  }

  try {
    await updateProfile(editingProfile.value.id, {
      name: editProfileName.value.trim(),
      config: {
        apiKey: editApiKey.value.trim(),
        baseUrl: editBaseUrl.value.trim(),
        model: editModel.value.trim(),
        systemPreference: editSystemPreference.value.trim(),
      },
    });

    success('配置已更新');
    showEditForm.value = false;
    editingProfile.value = null;
  } catch (err) {
    error(`更新失败: ${err}`);
  }
}

async function handleDeleteProfile(profile: AIProfile) {
  try {
    await deleteProfile(profile.id);
    success('配置已删除');
  } catch (err) {
    error(`删除失败: ${err}`);
  }
}

async function handleSetActive(profile: AIProfile) {
  try {
    await setActiveProfile(profile.id);
    success(`已切换到「${profile.name}」`);
  } catch (err) {
    error(`切换失败: ${err}`);
  }
}

function closeModal() {
  emit('update:visible', false);
}

function maskApiKey(key: string): string {
  if (!key) return '';
  if (key.length <= 8) return '****';
  return key.substring(0, 4) + '****' + key.substring(key.length - 4);
}
</script>

<template>
  <div v-if="visible" class="modal-overlay" @click.self="closeModal">
    <div class="modal config-modal">
      <div class="modal-header">
        <h3>AI 配置管理</h3>
        <button class="close-btn" @click="closeModal">×</button>
      </div>

      <div class="modal-body">
        <div v-if="!showAddForm && !showEditForm" class="profiles-section">
          <div class="section-header">
            <span class="section-title">已保存的配置</span>
            <button class="btn-add-profile" @click="openAddForm">+ 添加配置</button>
          </div>

          <div v-if="profiles.length === 0" class="empty-profiles">
            <p>暂无保存的配置</p>
            <button class="btn-link" @click="openAddForm">添加第一个配置</button>
          </div>

          <div v-else class="profiles-list">
            <div
              v-for="profile in profiles"
              :key="profile.id"
              class="profile-card"
              :class="{ active: profile.id === activeProfileId }"
            >
              <div class="profile-main" @click="handleSetActive(profile)">
                <div class="profile-header">
                  <span class="profile-name">{{ profile.name }}</span>
                  <span v-if="profile.id === activeProfileId" class="active-badge">使用中</span>
                </div>
                <div class="profile-info">
                  <span class="profile-model">{{ profile.config.model }}</span>
                  <span class="profile-key">{{ maskApiKey(profile.config.apiKey) }}</span>
                </div>
              </div>
              <div class="profile-actions">
                <button class="btn-icon-sm" @click.stop="openEditForm(profile)" title="编辑">✏️</button>
                <button class="btn-icon-sm" @click.stop="handleDeleteProfile(profile)" title="删除">🗑️</button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="showAddForm" class="form-section">
          <div class="form-header">
            <button class="btn-back" @click="showAddForm = false">← 返回</button>
            <span class="section-title">添加新配置</span>
          </div>

          <div class="form-group">
            <label>配置名称</label>
            <input v-model="newProfileName" type="text" placeholder="例如：我的 OpenAI" />
          </div>

          <div class="form-group">
            <label>API Key</label>
            <input v-model="newApiKey" type="password" placeholder="请输入 API Key" />
          </div>

          <div class="form-group">
            <label>Base URL</label>
            <input v-model="newBaseUrl" type="text" placeholder="API 地址，默认 OpenAI 官方" />
          </div>

          <div class="form-group">
            <label>Model</label>
            <input v-model="newModel" type="text" placeholder="模型名称" />
          </div>

          <div class="form-group">
            <label>个人偏好（选填）</label>
            <textarea v-model="newSystemPreference" placeholder="例如：输出简洁，按格式：进展/问题/规划" />
          </div>

          <button class="btn-primary-full" @click="handleAddProfile">保存配置</button>
        </div>

        <div v-if="showEditForm && editingProfile" class="form-section">
          <div class="form-header">
            <button class="btn-back" @click="showEditForm = false">← 返回</button>
            <span class="section-title">编辑配置</span>
          </div>

          <div class="form-group">
            <label>配置名称</label>
            <input v-model="editProfileName" type="text" />
          </div>

          <div class="form-group">
            <label>API Key</label>
            <input v-model="editApiKey" type="password" placeholder="请输入 API Key" />
          </div>

          <div class="form-group">
            <label>Base URL</label>
            <input v-model="editBaseUrl" type="text" />
          </div>

          <div class="form-group">
            <label>Model</label>
            <input v-model="editModel" type="text" />
          </div>

          <div class="form-group">
            <label>个人偏好（选填）</label>
            <textarea v-model="editSystemPreference" placeholder="例如：输出简洁，按格式：进展/问题/规划" />
          </div>

          <button class="btn-primary-full" @click="handleUpdateProfile">保存更改</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: var(--bg-panel);
  border-radius: calc(var(--radius-md) + 4px);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
}

.config-modal {
  width: 90%;
  max-width: 480px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.modal-header h3 {
  font-size: 16px;
  color: var(--text-primary);
  margin: 0;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: var(--text-muted);
  cursor: pointer;
  line-height: 1;
  padding: 0;
  transition: color 0.15s;
}

.close-btn:hover {
  color: var(--text-primary);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.btn-add-profile {
  padding: 6px 14px;
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-primary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-add-profile:hover {
  background: rgba(37, 99, 235, 0.08);
}

.empty-profiles {
  padding: 40px 20px;
  text-align: center;
}

.empty-profiles p {
  color: var(--text-muted);
  margin-bottom: 12px;
}

.btn-link {
  background: none;
  border: none;
  color: var(--color-primary);
  cursor: pointer;
  font-size: 14px;
}

.btn-link:hover {
  text-decoration: underline;
}

.profiles-list {
  padding: 12px;
}

.profile-card {
  display: flex;
  align-items: center;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  margin-bottom: 8px;
  transition: all 0.15s;
}

.profile-card:last-child {
  margin-bottom: 0;
}

.profile-card:hover {
  border-color: var(--color-primary);
  background: var(--bg-main);
}

.profile-card.active {
  border-color: var(--color-primary);
  background: rgba(37, 99, 235, 0.04);
}

.profile-main {
  flex: 1;
  cursor: pointer;
  min-width: 0;
}

.profile-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.profile-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.active-badge {
  font-size: 10px;
  padding: 2px 6px;
  background: var(--color-primary);
  color: white;
  border-radius: 4px;
}

.profile-info {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--text-muted);
}

.profile-model {
  font-family: monospace;
}

.profile-key {
  font-family: monospace;
  color: var(--color-primary);
}

.profile-actions {
  display: flex;
  gap: 4px;
  margin-left: 12px;
}

.btn-icon-sm {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  transition: background 0.15s;
}

.btn-icon-sm:hover {
  background: var(--bg-sidebar);
}

.form-section {
  padding: 16px 20px;
}

.form-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.btn-back {
  background: none;
  border: none;
  color: var(--color-primary);
  cursor: pointer;
  font-size: 14px;
  padding: 0;
}

.btn-back:hover {
  text-decoration: underline;
}

.form-group {
  margin-bottom: 14px;
}

.form-group:last-of-type {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-regular);
}

.form-group input,
.form-group textarea {
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

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--color-primary);
}

.form-group textarea {
  min-height: 80px;
  resize: vertical;
}

.btn-primary-full {
  width: 100%;
  padding: 10px;
  border: none;
  border-radius: var(--radius-md);
  background: var(--text-primary);
  color: var(--bg-panel);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s;
}

.btn-primary-full:hover {
  opacity: 0.9;
}
</style>
