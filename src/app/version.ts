export interface AppVersionData {
  version: string;
  buildNumber: string;
}

export interface VersionInfo extends AppVersionData {
  fullVersion: string;
  displayVersion: string;
  buildInfo: string;
  codename: string;
}

const DEFAULT_VERSION: AppVersionData = {
  version: '0.9.0',
  buildNumber: '1250'
};

const VERSION_METADATA = {
  codename: 'Cerbero'
};

export const buildVersionInfo = (data: AppVersionData): VersionInfo => ({
  ...data,
  codename: VERSION_METADATA.codename,
  fullVersion: `${data.version} (${data.buildNumber})`,
  displayVersion: `v${data.version}`,
  buildInfo: `Build ${data.buildNumber}`
});

export const getDefaultVersionInfo = (): VersionInfo => buildVersionInfo(DEFAULT_VERSION);