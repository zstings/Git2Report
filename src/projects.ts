import { storage } from 'vokex.app';
import { ref } from 'vue';
import { normalizePath } from './utils';

export interface GitProject {
  localPath: string;
  remoteUrl: string;
  gitUsername?: string;
  isIgnored?: boolean;
  displayName?: string;
}

export const projects = ref<GitProject[]>([]);

export const STORAGE_KEY = 'git2report_projects';

export async function loadProjects(cb: () => void) {
  try {
    const savedProjects = await storage.getData(STORAGE_KEY);
    if (savedProjects && Array.isArray(savedProjects)) {
      savedProjects.forEach(project => {
        project.localPath = normalizePath(project.localPath);
      });
      projects.value = savedProjects;
      saveProjects();
    }
  } finally {
    if (cb) cb();
  }
}

export async function saveProjects() {
  await storage.setData(STORAGE_KEY, projects.value);
}
