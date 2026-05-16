import { ref, computed } from 'vue'
import { GitService } from '../services/gitService'
import { storage } from 'vokex.app'
import type { GitProject } from '../services/gitService'

const STORAGE_KEY = 'git2report_projects'

export function useProjects() {
  const gitService = GitService.getInstance()
  const loading = ref(false)
  const projects = ref<GitProject[]>([])
  const searchQuery = ref('')

  const filteredProjects = computed(() => {
    if (!searchQuery.value.trim()) {
      return projects.value
    }
    const query = searchQuery.value.toLowerCase().trim()
    return projects.value.filter(project => {
      const projectName = project.localPath.split(/[\\/]/).pop()?.toLowerCase() || ''
      const path = project.localPath.toLowerCase()
      const remote = project.remoteUrl.toLowerCase()
      return projectName.includes(query) || path.includes(query) || remote.includes(query)
    })
  })

  async function loadProjects() {
    loading.value = true
    try {
      const savedProjects = await storage.getData(STORAGE_KEY)
      if (savedProjects && Array.isArray(savedProjects)) {
        projects.value = savedProjects
      }
      if (projects.value.length === 0) {
        const freshProjects = await gitService.getProjects()
        if (freshProjects.length > 0) {
          projects.value = freshProjects
          await saveProjects()
        }
      }
    } catch (error) {
      console.error('加载项目失败:', error)
    } finally {
      loading.value = false
    }
  }

  async function saveProjects() {
    try {
      await storage.setData(STORAGE_KEY, projects.value)
    } catch (error) {
      console.error('保存项目列表失败:', error)
    }
  }

  async function scanProjectsFromLogs(logDir: string) {
    if (!logDir) return 0
    
    loading.value = true
    try {
      const scannedProjects = await gitService.scanProjectsFromLogs(logDir)
      const existingPaths = new Set(projects.value.map(p => p.localPath))
      let addedCount = 0
      for (const project of scannedProjects) {
        if (!existingPaths.has(project.localPath)) {
          projects.value.push(project)
          addedCount++
        }
      }
      
      if (addedCount > 0) {
        await saveProjects()
      }
      
      return addedCount
    } finally {
      loading.value = false
    }
  }

  function setSearchQuery(query: string) {
    searchQuery.value = query
  }

  async function addProject(project: GitProject) {
    const existingPaths = new Set(projects.value.map(p => p.localPath))
    if (!existingPaths.has(project.localPath)) {
      projects.value.push(project)
      await saveProjects()
    }
  }

  async function removeProject(projectPath: string) {
    projects.value = projects.value.filter(p => p.localPath !== projectPath)
    await saveProjects()
  }

  return {
    loading,
    projects,
    filteredProjects,
    searchQuery,
    loadProjects,
    scanProjectsFromLogs,
    setSearchQuery,
    addProject,
    removeProject,
    saveProjects
  }
}
