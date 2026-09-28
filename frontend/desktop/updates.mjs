/** A failed launch check never makes a locally installed game unplayable. */
export async function checkLaunchUpdate({
  updater, ask, beforeInstall, report = console.warn, timeoutMs = 8_000,
}) {
  updater.autoDownload = false
  updater.autoInstallOnAppQuit = false
  updater.allowDowngrade = false
  updater.allowPrerelease = false
  // A late response after timeout may emit an error. It cannot show a dialog.
  if (updater.listenerCount('error') === 0) {
    updater.on('error', (error) => report(`Desktop update unavailable: ${error.message}`))
  }
  let timer
  try {
    const result = await Promise.race([
      updater.checkForUpdates(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Update check timed out; offline play is available.')), timeoutMs)
      }),
    ]).finally(() => clearTimeout(timer))
    if (!result?.isUpdateAvailable) return
    const choice = await ask({
      type: 'info',
      title: 'Solomon Darker update',
      message: `Version ${result.updateInfo.version} is available.`,
      detail: 'Download the update now, or play the installed version. Your local saves are kept.',
      buttons: ['Download update', 'Play current version'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    })
    if (choice.response !== 0) return
    await updater.downloadUpdate()
    const install = await ask({
      type: 'info',
      title: 'Solomon Darker update ready',
      message: 'Restart and install the downloaded update?',
      detail: 'Restarting closes the game and disconnects friends you host. Later does not install at exit.',
      buttons: ['Restart and install', 'Later'],
      defaultId: 1,
      cancelId: 1,
      noLink: true,
    })
    if (install.response === 0) {
      await beforeInstall()
      updater.quitAndInstall(false, true)
    }
  } catch (error) {
    report(`Desktop update unavailable: ${error.message}`)
  }
}
