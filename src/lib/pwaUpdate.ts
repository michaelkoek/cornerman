import { useRegisterSW } from 'virtual:pwa-register/react'

// Home-screen PWAs never reload on their own — no browser chrome refresh
// button, and iOS/Android "pull down" is just an elastic scroll effect, not
// a navigation. So a stale SW + cached shell can sit forever unless we poll
// for updates ourselves and reload as soon as a new one activates.
const CHECK_INTERVAL_MS = 60_000

export function usePwaAutoUpdate() {
  const { updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      const check = () => registration.update()
      window.setInterval(check, CHECK_INTERVAL_MS)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
    },
    onNeedRefresh() {
      // registerType: 'autoUpdate' already calls skipWaiting/clientsClaim —
      // reload just swaps the current tab onto the now-active new worker.
      updateServiceWorker(true)
    },
  })
}
