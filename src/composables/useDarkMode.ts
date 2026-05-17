import { ref, watch } from 'vue'

const STORAGE_KEY = 'git2report-theme'
const isDark = ref(false)

function initTheme() {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    isDark.value = stored === 'dark'
  } else {
    isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  applyTheme()
}

function applyTheme() {
  if (isDark.value) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

function toggleDark() {
  isDark.value = !isDark.value
  applyTheme()
  localStorage.setItem(STORAGE_KEY, isDark.value ? 'dark' : 'light')
}

if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      isDark.value = e.matches
      applyTheme()
    }
  })
}

export function useDarkMode() {
  return {
    isDark,
    initTheme,
    toggleDark
  }
}
