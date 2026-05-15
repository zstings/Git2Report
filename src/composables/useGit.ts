import { ref } from 'vue'
import { GitService } from '../services/gitService'
import type { GitProject, GitCommit } from '../services/gitService'

export function useGit() {
  const gitService = GitService.getInstance()
  const loading = ref(false)
  const projects = ref<GitProject[]>([])
  const commits = ref<GitCommit[]>([])

  async function initGitHooks(reportPath?: string) {
    loading.value = true
    try {
      const result = await gitService.initGitHooks(reportPath)
      return result
    } finally {
      loading.value = false
    }
  }

  async function loadProjects() {
    loading.value = true
    try {
      projects.value = await gitService.getProjects()
    } finally {
      loading.value = false
    }
  }

  async function loadCommits(type: 'daily' | 'weekly' | 'monthly') {
    loading.value = true
    try {
      const [since, until] = gitService.getDateRange(type)
      commits.value = await gitService.getAllCommits(since, until)
      return { since, until, commits: commits.value }
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    projects,
    commits,
    initGitHooks,
    loadProjects,
    loadCommits,
    getDateRange: gitService.getDateRange.bind(gitService)
  }
}
