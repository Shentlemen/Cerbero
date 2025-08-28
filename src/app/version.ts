export const APP_VERSION = {
  version: '0.9.0-beta',
  buildNumber: '2025.08.691',
  releaseDate: '2025-08-27',
  codename: 'Cerbero Beta',
  company: 'Cerbero Development Team',
  copyright: '© 2024 Cerbero'
};

export const getVersionInfo = () => {
  return {
    fullVersion: `${APP_VERSION.version} (${APP_VERSION.buildNumber})`,
    displayVersion: `v${APP_VERSION.version}`,
    buildInfo: `Build ${APP_VERSION.buildNumber}`,
    releaseInfo: `Released ${APP_VERSION.releaseDate}`,
    ...APP_VERSION
  };
}; 