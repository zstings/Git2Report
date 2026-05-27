import { ref, computed } from 'vue';
import { storage } from 'vokex.app';
import type { GitProject } from '@/projects';

const STORAGE_KEY = 'git2report_projects';

export function useProjects() {
  const loading = ref(false);
  const projects = ref<GitProject[]>([]);
  const searchQuery = ref('');

  const filteredProjects = computed(() => {
    let result = projects.value;
    if (searchQuery.value.trim()) {
      const query = searchQuery.value.toLowerCase().trim();
      result = result.filter(project => {
        const projectName = project.localPath.split(/[\\/]/).pop()?.toLowerCase() || '';
        const path = project.localPath.toLowerCase();
        const remote = project.remoteUrl.toLowerCase();
        return projectName.includes(query) || path.includes(query) || remote.includes(query);
      });
    }
    return result;
  });

  const activeProjects = computed(() => {
    return filteredProjects.value.filter(p => !p.isIgnored);
  });

  async function loadProjects() {
    loading.value = true;
    try {
      const savedProjects = await storage.getItem(STORAGE_KEY);
      if (savedProjects && Array.isArray(savedProjects)) {
        projects.value = savedProjects;
      }
    } catch (error) {
      console.error('加载项目失败:', error);
    } finally {
      loading.value = false;
    }
  }

  async function saveProjects() {
    try {
      await storage.setItem(STORAGE_KEY, projects.value);
    } catch (error) {
      console.error('保存项目列表失败:', error);
    }
  }

  async function toggleProjectIgnore(projectPath: string) {
    const project = projects.value.find(p => p.localPath === projectPath);
    if (project) {
      project.isIgnored = !project.isIgnored;
      await saveProjects();
    }
  }

  async function setProjectDisplayName(projectPath: string, displayName: string) {
    const project = projects.value.find(p => p.localPath === projectPath);
    if (project) {
      project.displayName = displayName.trim() || undefined;
      await saveProjects();
    }
  }

  function getProjectDisplayName(project: GitProject): string {
    if (project.displayName) {
      return project.displayName;
    }
    return project.localPath.split(/[\\/]/).pop() || '未知项目';
  }

  function setSearchQuery(query: string) {
    searchQuery.value = query;
  }

  return {
    loading,
    projects,
    filteredProjects,
    activeProjects,
    searchQuery,
    loadProjects,
    saveProjects,
    toggleProjectIgnore,
    setProjectDisplayName,
    getProjectDisplayName,
    setSearchQuery,
  };
}
