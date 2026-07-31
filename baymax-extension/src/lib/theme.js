import { useEffect, useState } from 'react'

// Persisted theme preference. The same key is read by the inline no-flash
// script in index.html / dashboard.html — keep them in sync.
export const THEME_KEY = 'baymax-theme'

function getTheme() {
  const stored = localStorage.getItem(THEME_KEY)
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
}

function applyTheme(theme) {
  const isDark = theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', isDark)
}

// Reflects the class the no-flash script already set, so the UI starts in the
// right state with no flicker.
export function useTheme() {
  const [theme, setThemeState] = useState(getTheme)

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const syncTheme = () => {
      const next = getTheme()
      setThemeState(next)
      applyTheme(next)
    }
    const syncSystem = () => {
      if (getTheme() === 'system') applyTheme('system')
    }

    window.addEventListener('storage', syncTheme)
    window.addEventListener('baymax-theme-change', syncTheme)
    media.addEventListener('change', syncSystem)
    return () => {
      window.removeEventListener('storage', syncTheme)
      window.removeEventListener('baymax-theme-change', syncTheme)
      media.removeEventListener('change', syncSystem)
    }
  }, [])

  function setTheme(next) {
    if (!['light', 'dark', 'system'].includes(next)) return
    localStorage.setItem(THEME_KEY, next)
    applyTheme(next)
    setThemeState(next)
    window.dispatchEvent(new Event('baymax-theme-change'))
  }

  return {
    theme,
    isDark: document.documentElement.classList.contains('dark'),
    setTheme,
    setDark: (on) => setTheme(on ? 'dark' : 'light'),
  }
}
