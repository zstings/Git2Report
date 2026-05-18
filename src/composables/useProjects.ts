import { ref, computed } from 'vue'
import { GitService } from '../services/gitService'
import type { GitProject } from '../services/gitService'

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

  async function loadProjects(logDir?: string) {
    loading.value = true
    try {
      projects.value = []
      if (logDir) {
        const scannedProjects = await gitService.scanProjectsFromLogs(logDir)
        projects.value = scannedProjects
      }
    } catch (error) {
      console.error('加载项目失败:', error)
    } finally {
      loading.value = false
    }
  }

  async function scanProjectsFromLogs(logDir: string) {
    if (!logDir) return 0
    
    loading.value = true
    try {
      const scannedProjects = await gitService.scanProjectsFromLogs(logDir)
      const oldCount = projects.value.length
      projects.value = scannedProjects
      return projects.value.length - oldCount
    } finally {
      loading.value = false
    }
  }

  function setSearchQuery(query: string) {
    searchQuery.value = query
  }

  return {
    loading,
    projects,
    filteredProjects,
    searchQuery,
    loadProjects,
    scanProjectsFromLogs,
    setSearchQuery
  }
}
