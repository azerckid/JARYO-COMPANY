'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { SEMUAGENT_THEME_STORAGE_KEY } from '@/lib/theme/init-script'
import { parseThemeMode, type ThemeMode } from '@/lib/theme/mode'

type ResolvedTheme = 'light' | 'dark'

type ThemeContextValue = {
  readonly theme: ThemeMode
  readonly setTheme: (theme: string) => void
  readonly resolvedTheme: ResolvedTheme
  readonly themes: readonly string[]
  readonly systemTheme: ResolvedTheme
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyDocumentTheme(mode: ThemeMode): ResolvedTheme {
  const resolved = mode === 'system' ? readSystemTheme() : mode
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  root.classList.add(resolved)
  root.style.colorScheme = resolved
  return resolved
}

export function AppThemeProvider({ children }: { readonly children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('system')
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light')
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>('light')

  useEffect(() => {
    const stored = parseThemeMode(window.localStorage.getItem(SEMUAGENT_THEME_STORAGE_KEY))
    setThemeState(stored)
    setSystemTheme(readSystemTheme())
    setResolvedTheme(applyDocumentTheme(stored))

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onSystemChange = () => {
      const nextSystem = readSystemTheme()
      setSystemTheme(nextSystem)
      const current = parseThemeMode(window.localStorage.getItem(SEMUAGENT_THEME_STORAGE_KEY))
      if (current === 'system') {
        setResolvedTheme(applyDocumentTheme('system'))
      }
    }
    media.addEventListener('change', onSystemChange)
    return () => media.removeEventListener('change', onSystemChange)
  }, [])

  const setTheme = useCallback((value: string) => {
    const mode = parseThemeMode(value)
    window.localStorage.setItem(SEMUAGENT_THEME_STORAGE_KEY, mode)
    setThemeState(mode)
    setResolvedTheme(applyDocumentTheme(mode))
  }, [])

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    setTheme,
    resolvedTheme,
    themes: ['light', 'dark', 'system'],
    systemTheme,
  }), [theme, setTheme, resolvedTheme, systemTheme])

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

/** Drop-in for next-themes `useTheme` used by shell chrome only. */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) {
    return {
      theme: 'system',
      setTheme: () => {},
      resolvedTheme: 'light',
      themes: ['light', 'dark', 'system'],
      systemTheme: 'light',
    }
  }
  return context
}
