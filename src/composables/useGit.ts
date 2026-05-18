import { ref } from "vue";
import { GitService } from "../services/gitService";

export function useGit() {
  const gitService = GitService.getInstance();
  const loading = ref(false);

  async function initGitHooks(reportPath?: string) {
    loading.value = true;
    try {
      const result = await gitService.initGitHooks(reportPath);
      return result;
    } finally {
      loading.value = false;
    }
  }

  return {
    loading,
    initGitHooks,
  };
}
