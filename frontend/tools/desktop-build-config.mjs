import { join, resolve } from 'node:path'

export function desktopBuildConfig({ stage, electronVersion, platform, release = false }) {
  if (release && platform !== 'linux' && !process.env.CSC_LINK) {
    throw new Error('Public Windows/macOS releases require CSC_LINK signing credentials')
  }
  if (release && platform === 'darwin'
    && !(process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD && process.env.APPLE_TEAM_ID)) {
    throw new Error('Public macOS releases require Apple notarization credentials')
  }
  return {
    appId: 'com.solomondarker.desktop',
    productName: 'Solomon Darker',
    electronVersion,
    directories: { app: resolve('desktop'), output: resolve('dist-desktop') },
    asar: true,
    npmRebuild: false,
    forceCodeSigning: release && platform !== 'linux',
    files: ['main.mjs', 'preload.cjs', 'static-client-server.mjs', 'updates.mjs', 'package.json'],
    extraResources: [
      { from: join(stage, 'client'), to: 'client' },
      { from: join(stage, 'game-host'), to: 'game-host' },
      { from: join(stage, 'runtime'), to: 'runtime' },
      { from: join(stage, 'desktop-package-manifest.json'), to: 'desktop-package-manifest.json' },
    ],
    publish: { provider: 'github', owner: 'JarrettOneSource', repo: 'solomon-dark-website', releaseType: 'draft' },
    win: { target: ['nsis'], artifactName: 'Solomon-Darker-Setup-${arch}.${ext}' },
    nsis: { oneClick: false, perMachine: false, allowToChangeInstallationDirectory: true, deleteAppDataOnUninstall: false },
    mac: {
      target: ['dmg', 'zip'],
      category: 'public.app-category.role-playing-games',
      artifactName: 'Solomon-Darker-${arch}.${ext}',
      identity: process.env.CSC_LINK ? undefined : null,
      hardenedRuntime: true,
      notarize: release,
      binaries: ['Contents/Resources/runtime/node'],
    },
    linux: {
      executableName: 'solomon-darker',
      target: ['AppImage'],
      category: 'Game',
      artifactName: 'Solomon-Darker-${arch}.${ext}',
    },
  }
}
