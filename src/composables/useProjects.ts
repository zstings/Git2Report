import { ref, computed } from "vue";
import { GitService } from "../services/gitService";
import { storage } from "vokex.app";
import type { GitProject } from "../services/gitService";

const STORAGE_KEY = "git2report_projects";

export function useProjects() {
  const gitService = GitService.getInstance();
  const loading = ref(false);
  const projects = ref<GitProject[]>([]);
  const searchQuery = ref("");

  const filteredProjects = computed(() => {
    let result = projects.value;
    if (searchQuery.value.trim()) {
      const query = searchQuery.value.toLowerCase().trim();
      result = result.filter((project) => {
        const projectName = project.localPath.split(/[\\/]/).pop()?.toLowerCase() || "";
        const path = project.localPath.toLowerCase();
        const remote = project.remoteUrl.toLowerCase();
        return projectName.includes(query) || path.includes(query) || remote.includes(query);
      });
    }
    return result;
  });

  const activeProjects = computed(() => {
    return filteredProjects.value.filter((p) => !p.isIgnored);
  });

  async function loadProjects(logDir?: string) {
    loading.value = true;
    try {
      const savedProjects = await storage.getData(STORAGE_KEY);
      if (savedProjects && Array.isArray(savedProjects)) {
        projects.value = savedProjects;
      }

      if (logDir) {
        const todayProjects = await gitService.scanProjectsFromLogs(logDir, true);
        const existingPaths = new Set(projects.value.map((p) => p.localPath));

        for (const project of todayProjects) {
          if (!existingPaths.has(project.localPath)) {
            projects.value.push(project);
          }
        }

        await saveProjects();
      }
    } catch (error) {
      console.error("加载项目失败:", error);
    } finally {
      loading.value = false;
    }
  }

  async function scanAllProjects(logDir: string) {
    if (!logDir) return 0;

    loading.value = true;
    try {
      const allProjects = await gitService.scanProjectsFromLogs(logDir, false);
      // 合并现有项目的忽略状态
      const existingMap = new Map(projects.value.map((p) => [p.localPath, p.isIgnored]));
      projects.value = allProjects.map((p) => ({
        ...p,
        isIgnored: existingMap.get(p.localPath),
      }));
      await saveProjects();
      return allProjects.length;
    } catch (error) {
      console.error("扫描所有项目失败:", error);
      return 0;
    } finally {
      loading.value = false;
    }
  }

  async function saveProjects() {
    try {
      await storage.setData(STORAGE_KEY, projects.value);
    } catch (error) {
      console.error("保存项目列表失败:", error);
    }
  }

  async function toggleProjectIgnore(projectPath: string) {
    const project = projects.value.find((p) => p.localPath === projectPath);
    if (project) {
      project.isIgnored = !project.isIgnored;
      await saveProjects();
    }
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
    scanAllProjects,
    toggleProjectIgnore,
    setSearchQuery,
  };
}
