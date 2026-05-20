export interface GitProject {
  localPath: string;
  remoteUrl: string;
  gitUsername?: string;
  isIgnored?: boolean;
  displayName?: string;
}
