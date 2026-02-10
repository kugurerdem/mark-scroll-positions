import {createRoot} from 'react-dom/client'
import {useCallback, useEffect, useState} from 'react'
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome'
import {faPalette} from '@fortawesome/free-solid-svg-icons'

import {
    getThemePreference,
    initializeTheme,
    setThemePreference as setStoredThemePreference,
    subscribeThemePreference,
} from './theme'
import {ThemeToggle} from './theme-toggle'

import type {ThemePreference} from './theme'

const main = async () => {
    await initializeTheme()

    createRoot(document.getElementById('app')!).render(<App />)
}

const App = () => {
    const [themePreference, setThemePreference] =
        useState<ThemePreference>('system')

    useEffect(() => {
        let isMounted = true

        void getThemePreference().then((preference) => {
            if (!isMounted) return
            setThemePreference(preference)
        })

        const unsubscribe = subscribeThemePreference((preference) => {
            if (!isMounted) return
            setThemePreference(preference)
        })

        return () => {
            isMounted = false
            unsubscribe()
        }
    }, [])

    const onThemeChange = useCallback((preference: ThemePreference) => {
        setThemePreference(preference)
        void setStoredThemePreference(preference)
    }, [])

    return (
        <main className="min-h-screen bg-cream-200 px-6 py-10">
            <section className="max-w-xl mx-auto rounded-2xl border border-cream-300 bg-cream-50 p-6 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.12)] animate-fade-in-up">
                <header className="flex items-center gap-3">
                    <span className="inline-flex w-10 h-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 shadow-sm shadow-accent-500/20">
                        <FontAwesomeIcon
                            icon={faPalette}
                            className="w-4 h-4 text-white pointer-events-none"
                        />
                    </span>
                    <div>
                        <h1 className="font-display text-2xl font-semibold text-ink-900 tracking-tight leading-tight">
                            Appearance
                        </h1>
                        <p className="text-ink-400 text-sm mt-0.5">
                            Choose how the popup and pages should look.
                        </p>
                    </div>
                </header>

                <div className="mt-5 rounded-xl border border-cream-300 bg-cream-100 p-4">
                    <p className="text-[11px] uppercase tracking-wider font-medium text-ink-400 mb-2">
                        Theme Mode
                    </p>
                    <ThemeToggle value={themePreference} onChange={onThemeChange} />
                    <p className="mt-3 text-xs text-ink-400 leading-relaxed">
                        System follows your browser appearance preferences.
                    </p>
                </div>
            </section>
        </main>
    )
}

main()
