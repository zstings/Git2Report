<script setup lang="ts">
import { ref, watch } from 'vue';
import { useAI } from '@/composables/useAI';
import { useMessage } from '@/composables/useMessage';
import type { AIProfile } from '@/services/aiService';
import AppDialog from '@/components/AppDialog.vue';
import AppInput from '@/components/AppInput.vue';
import AppTextarea from '@/components/AppTextarea.vue';
import AppButton from '@/components/AppButton.vue';

/**
 * AI 配置管理弹窗组件
 * 支持添加、编辑、删除、切换 AI 配置文件
 */

/** 是否显示弹窗（使用 defineModel 宏实现双向绑定） */
const visible = defineModel<boolean>('visible', { default: false });

const { success, error, warning } = useMessage();
const { profiles, activeProfileId, loadProfiles, addProfile, updateProfile, deleteProfile, setActiveProfile } = useAI();

/** 是否显示添加表单 */
const showAddForm = ref(false);
/** 是否显示编辑表单 */
const showEditForm = ref(false);
/** 当前编辑的配置项 */
const editingProfile = ref<AIProfile | null>(null);

/** 新建配置 - 配置名称 */
const newProfileName = ref('');
/** 新建配置 - API Key */
const newApiKey = ref('');
/** 新建配置 - Base URL */
const newBaseUrl = ref('https://api.openai.com/v1');
/** 新建配置 - 模型 */
const newModel = ref('gpt-3.5-turbo');
/** 新建配置 - 个人偏好 */
const newSystemPreference = ref('');
/** 新建配置 - API 类型 */
const newWireApi = ref<'chat' | 'responses'>('chat');

/** 编辑配置 - 配置名称 */
const editProfileName = ref('');
/** 编辑配置 - API Key */
const editApiKey = ref('');
/** 编辑配置 - Base URL */
const editBaseUrl = ref('');
/** 编辑配置 - 模型 */
const editModel = ref('');
/** 编辑配置 - 个人偏好 */
const editSystemPreference = ref('');
/** 编辑配置 - API 类型 */
const editWireApi = ref<'chat' | 'responses'>('chat');

watch(visible, async val => {
  if (val) {
    await loadProfiles();
    showAddForm.value = false;
    showEditForm.value = false;
  }
});

/**
 * 打开添加表单
 */
function openAddForm() {
  showAddForm.value = true;
  showEditForm.value = false;
  newProfileName.value = '';
  newApiKey.value = '';
  newBaseUrl.value = 'https://api.openai.com/v1';
  newModel.value = 'gpt-3.5-turbo';
  newSystemPreference.value = '';
  newWireApi.value = 'chat';
}

/**
 * 提交添加配置
 */
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
      wireApi: newWireApi.value,
    });

    success('配置添加成功');
    showAddForm.value = false;
  } catch (err) {
    error(`添加失败: ${err}`);
  }
}

/**
 * 打开编辑表单
 * @param profile - 需要编辑的配置项
 */
function openEditForm(profile: AIProfile) {
  editingProfile.value = profile;
  showEditForm.value = true;
  showAddForm.value = false;
  editProfileName.value = profile.name;
  editApiKey.value = profile.config.apiKey;
  editBaseUrl.value = profile.config.baseUrl;
  editModel.value = profile.config.model;
  editSystemPreference.value = profile.config.systemPreference;
  editWireApi.value = profile.config.wireApi || 'chat';
}

/**
 * 提交编辑配置
 */
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
        wireApi: editWireApi.value,
      },
    });

    success('配置已更新');
    showEditForm.value = false;
    editingProfile.value = null;
  } catch (err) {
    error(`更新失败: ${err}`);
  }
}

/**
 * 删除配置
 * @param profile - 需要删除的配置项
 */
async function handleDeleteProfile(profile: AIProfile) {
  try {
    await deleteProfile(profile.id);
    success('配置已删除');
  } catch (err) {
    error(`删除失败: ${err}`);
  }
}

/**
 * 设置活跃配置
 * @param profile - 需要设为活跃的配置项
 */
async function handleSetActive(profile: AIProfile) {
  try {
    await setActiveProfile(profile.id);
    success(`已切换到「${profile.name}」`);
  } catch (err) {
    error(`切换失败: ${err}`);
  }
}

/**
 * 关闭弹窗
 */
function closeModal() {
  visible.value = false;
}

/**
 * 隐藏 API Key
 * @param key - 原始 API Key
 * @returns 隐藏后的 Key
 */
function maskApiKey(key: string): string {
  if (!key) return '';
  if (key.length <= 8) return '****';
  return key.substring(0, 4) + '****' + key.substring(key.length - 4);
}
</script>

<template>
  <AppDialog v-model:visible="visible" title="AI 配置管理" width="480px" :close-on-overlay="false" @close="closeModal">
    <!-- 配置列表视图 -->
    <div v-if="!showAddForm && !showEditForm" class="profiles-section">
      <div class="section-header">
        <span class="section-title">已保存的配置</span>
        <AppButton type="secondary" size="small" @click="openAddForm">+ 添加配置</AppButton>
      </div>

      <div v-if="profiles.length === 0" class="empty-profiles">
        <p>暂无保存的配置</p>
        <button class="btn-link" @click="openAddForm">添加第一个配置</button>
      </div>

      <div v-else class="profiles-list">
        <div v-for="profile in profiles" :key="profile.id" class="profile-card" :class="{ active: profile.id === activeProfileId }">
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

    <!-- 添加表单视图 -->
    <div v-if="showAddForm" class="form-section">
      <div class="form-header">
        <button class="btn-back" @click="showAddForm = false">← 返回</button>
        <span class="section-title">添加新配置</span>
      </div>

      <div class="form-group">
        <label>配置名称</label>
        <AppInput v-model="newProfileName" placeholder="例如：我的 OpenAI" />
      </div>

      <div class="form-group">
        <label>API Key</label>
        <AppInput v-model="newApiKey" type="password" placeholder="请输入 API Key" />
      </div>

      <div class="form-group">
        <label>Base URL</label>
        <AppInput v-model="newBaseUrl" placeholder="API 地址，默认 OpenAI 官方" />
      </div>

      <div class="form-group">
        <label>Model</label>
        <AppInput v-model="newModel" placeholder="模型名称" />
      </div>

      <div class="form-group">
        <label>API 类型</label>
        <select v-model="newWireApi" class="form-select">
          <option value="chat">Chat Completions</option>
          <option value="responses">Responses</option>
        </select>
        <p class="form-hint">如代理仅支持 Responses API，请选择 Responses</p>
      </div>

      <div class="form-group">
        <label>个人偏好（选填）</label>
        <AppTextarea v-model="newSystemPreference" placeholder="例如：输出简洁，按格式：进展/问题/规划" />
      </div>

      <AppButton type="primary" block @click="handleAddProfile">保存配置</AppButton>
    </div>

    <!-- 编辑表单视图 -->
    <div v-if="showEditForm && editingProfile" class="form-section">
      <div class="form-header">
        <button class="btn-back" @click="showEditForm = false">← 返回</button>
        <span class="section-title">编辑配置</span>
      </div>

      <div class="form-group">
        <label>配置名称</label>
        <AppInput v-model="editProfileName" />
      </div>

      <div class="form-group">
        <label>API Key</label>
        <AppInput v-model="editApiKey" type="password" placeholder="请输入 API Key" />
      </div>

      <div class="form-group">
        <label>Base URL</label>
        <AppInput v-model="editBaseUrl" />
      </div>

      <div class="form-group">
        <label>Model</label>
        <AppInput v-model="editModel" />
      </div>

      <div class="form-group">
        <label>API 类型</label>
        <select v-model="editWireApi" class="form-select">
          <option value="chat">Chat Completions</option>
          <option value="responses">Responses</option>
        </select>
        <p class="form-hint">如代理仅支持 Responses API，请选择 Responses</p>
      </div>

      <div class="form-group">
        <label>个人偏好（选填）</label>
        <AppTextarea v-model="editSystemPreference" placeholder="例如：输出简洁，按格式：进展/问题/规划" />
      </div>

      <AppButton type="primary" block @click="handleUpdateProfile">保存更改</AppButton>
    </div>
  </AppDialog>
</template>

<style scoped>
.profiles-section {
  max-height: 400px;
  overflow-y: auto;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px 20px;
  border-bottom: 1px solid var(--color-border);
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
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

.form-select {
  width: 100%;
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--bg-main);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  cursor: pointer;
}

.form-select:focus {
  border-color: var(--color-primary);
}

.form-hint {
  margin-top: 4px;
  font-size: 11px;
  color: var(--text-muted);
}
</style>
