import {createRoot} from 'react-dom/client'
import {useCallback, useEffect, useState} from 'react'
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome'
import {faPalette, faTrashCan} from '@fortawesome/free-solid-svg-icons'

import {
    getThemePreference,
    initializeTheme,
    setThemePreference as setStoredThemePreference,
    subscribeThemePreference,
} from './theme'
import {ThemeToggle} from './theme-toggle'
import {
    QUERY_IDENTITY_SETTINGS_KEY,
    getQueryIdentitySettings,
    normalizeQueryIdentitySettings,
    setQueryIdentitySettings as setStoredQueryIdentitySettings,
} from './url-identity'

import type {ThemePreference} from './theme'
import type {
    ScrollInsertPosition,
    QueryIdentityMode,
    QueryIdentitySettings,
} from './types'

const MARK_INSERT_POSITION_KEY = 'markInsertPosition'

const isScrollInsertPosition = (value: unknown): value is ScrollInsertPosition =>
    value === 'top' || value === 'bottom'

const getScrollInsertPosition = async (): Promise<ScrollInsertPosition> => {
    const result = await chrome.storage.local.get(MARK_INSERT_POSITION_KEY)
    const value = result[MARK_INSERT_POSITION_KEY]
    return isScrollInsertPosition(value) ? value : 'bottom'
}

const setScrollInsertPosition = async (position: ScrollInsertPosition): Promise<void> => {
    await chrome.storage.local.set({[MARK_INSERT_POSITION_KEY]: position})
}

const hasProtocol = (value: string): boolean =>
    /^[a-z][a-z0-9+.-]*:\/\//i.test(value)

const normalizeHostnameInput = (value: string): string | null => {
    const trimmed = value.trim().toLowerCase()
    if (!trimmed) return null

    const normalizedURL = hasProtocol(trimmed) ? trimmed : `https://${trimmed}`

    try {
        const parsedURL = new URL(normalizedURL)
        if (!parsedURL.hostname) return null
        return parsedURL.hostname
    } catch {
        return null
    }
}

const defaultQueryIdentitySettings: QueryIdentitySettings = {
    globalMode: 'ignore',
    perHostMode: {},
}

const main = async () => {
    await initializeTheme()

    createRoot(document.getElementById('app')!).render(<App />)
}

const App = () => {
    const [themePreference, setThemePreference] =
        useState<ThemePreference>('system')
    const [markInsertPosition, setMarkInsertPosition] =
        useState<ScrollInsertPosition>('bottom')
    const [queryIdentitySettings, setQueryIdentitySettings] =
        useState<QueryIdentitySettings>(defaultQueryIdentitySettings)
    const [newHostname, setNewHostname] = useState('')
    const [newHostnameMode, setNewHostnameMode] =
        useState<QueryIdentityMode>('include')
    const [hostnameError, setHostnameError] = useState<string | null>(null)

    useEffect(() => {
        let isMounted = true

        void getThemePreference().then((preference) => {
            if (!isMounted) return
            setThemePreference(preference)
        })

        void getScrollInsertPosition().then((position) => {
            if (!isMounted) return
            setMarkInsertPosition(position)
        })

        void getQueryIdentitySettings().then((settings) => {
            if (!isMounted) return
            setQueryIdentitySettings(settings)
        })

        const unsubscribe = subscribeThemePreference((preference) => {
            if (!isMounted) return
            setThemePreference(preference)
        })

        const onStorageChange: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (
            changes,
            areaName
        ) => {
            if (areaName !== 'local') return

            const positionChange = changes[MARK_INSERT_POSITION_KEY]

            if (positionChange) {
                const nextValue = positionChange.newValue
                if (isScrollInsertPosition(nextValue)) {
                    setMarkInsertPosition(nextValue)
                }
            }

            const queryIdentityChange = changes[QUERY_IDENTITY_SETTINGS_KEY]
            if (!queryIdentityChange) return

            setQueryIdentitySettings(
                normalizeQueryIdentitySettings(queryIdentityChange.newValue)
            )
        }

        chrome.storage.onChanged.addListener(onStorageChange)

        return () => {
            isMounted = false
            unsubscribe()
            chrome.storage.onChanged.removeListener(onStorageChange)
        }
    }, [])

    const onThemeChange = useCallback((preference: ThemePreference) => {
        setThemePreference(preference)
        void setStoredThemePreference(preference)
    }, [])

    const onMarkInsertPositionChange = useCallback((position: ScrollInsertPosition) => {
        setMarkInsertPosition(position)
        void setScrollInsertPosition(position)
    }, [])

    const updateQueryIdentitySettings = useCallback(
        (
            updater: (current: QueryIdentitySettings) => QueryIdentitySettings
        ) => {
            setQueryIdentitySettings((current) => {
                const next = updater(current)
                void setStoredQueryIdentitySettings(next)
                return next
            })
        },
        []
    )

    const onGlobalQueryIdentityModeChange = useCallback(
        (mode: QueryIdentityMode) => {
            updateQueryIdentitySettings((current) => ({
                globalMode: mode,
                perHostMode: Object.entries(current.perHostMode).reduce<Record<string, QueryIdentityMode>>((acc, [hostname, hostMode]) => {
                    if (hostMode === mode) return acc
                    acc[hostname] = hostMode
                    return acc
                }, {}),
            }))
        },
        [updateQueryIdentitySettings]
    )

    const onHostnameModeChange = useCallback(
        (hostname: string, mode: QueryIdentityMode) => {
            updateQueryIdentitySettings((current) => {
                const nextPerHostMode = {...current.perHostMode}

                if (mode === current.globalMode) {
                    delete nextPerHostMode[hostname]
                } else {
                    nextPerHostMode[hostname] = mode
                }

                return {
                    ...current,
                    perHostMode: nextPerHostMode,
                }
            })
        },
        [updateQueryIdentitySettings]
    )

    const onRemoveHostnameOverride = useCallback(
        (hostname: string) => {
            updateQueryIdentitySettings((current) => {
                const nextPerHostMode = {...current.perHostMode}
                delete nextPerHostMode[hostname]

                return {
                    ...current,
                    perHostMode: nextPerHostMode,
                }
            })
        },
        [updateQueryIdentitySettings]
    )

    const onAddHostnameOverride = useCallback(() => {
        const normalizedHostname = normalizeHostnameInput(newHostname)

        if (!normalizedHostname) {
            setHostnameError('Enter a valid hostname, such as news.ycombinator.com.')
            return
        }

        setHostnameError(null)

        updateQueryIdentitySettings((current) => {
            const nextPerHostMode = {...current.perHostMode}

            if (newHostnameMode === current.globalMode) {
                delete nextPerHostMode[normalizedHostname]
            } else {
                nextPerHostMode[normalizedHostname] = newHostnameMode
            }

            return {
                ...current,
                perHostMode: nextPerHostMode,
            }
        })

        setNewHostname('')
    }, [newHostname, newHostnameMode, updateQueryIdentitySettings])

    const hostnameEntries = Object.entries(queryIdentitySettings.perHostMode).sort(
        ([leftHostname], [rightHostname]) =>
            leftHostname.localeCompare(rightHostname)
    )

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
                            Preferences
                        </h1>
                        <p className="text-ink-400 text-sm mt-0.5">
                            Customize how marks are created and grouped.
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

                <div className="mt-4 rounded-xl border border-cream-300 bg-cream-100 p-4">
                    <p className="text-[11px] uppercase tracking-wider font-medium text-ink-400 mb-2">
                        New Mark Placement
                    </p>
                    <div className="inline-flex w-full rounded-lg border border-cream-300 bg-cream-50 p-1">
                        <button
                            onClick={() => {
                                onMarkInsertPositionChange('top')
                            }}
                            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                                markInsertPosition === 'top'
                                    ? 'bg-accent-500 text-white'
                                    : 'text-ink-600 hover:bg-cream-100'
                            }`}
                        >
                            Top
                        </button>
                        <button
                            onClick={() => {
                                onMarkInsertPositionChange('bottom')
                            }}
                            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                                markInsertPosition === 'bottom'
                                    ? 'bg-accent-500 text-white'
                                    : 'text-ink-600 hover:bg-cream-100'
                            }`}
                        >
                            Bottom
                        </button>
                    </div>
                    <p className="mt-3 text-xs text-ink-400 leading-relaxed">
                        Choose whether new marks are added first or last in the list.
                    </p>
                </div>

                <div className="mt-4 rounded-xl border border-cream-300 bg-cream-100 p-4">
                    <p className="text-[11px] uppercase tracking-wider font-medium text-ink-400 mb-2">
                        URL Matching
                    </p>
                    <p className="text-xs text-ink-400 leading-relaxed">
                        Query parameters are the <span className="text-ink-600">?key=value</span> parts at the end of a URL. When you enable this setting, pages with different query parameters (e.g. <span className="text-ink-600">?page=1</span> vs <span className="text-ink-600">?page=2</span>) are treated as separate pages, each with their own marks. Only enable this if the content of your pages changes based on query parameters.
                    </p>
                    <label className="mt-3 flex items-center gap-2 text-sm font-medium text-ink-600 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={queryIdentitySettings.globalMode === 'include'}
                            onChange={(e) => {
                                onGlobalQueryIdentityModeChange(
                                    e.target.checked ? 'include' : 'ignore'
                                )
                            }}
                            className="w-4 h-4 accent-accent-600 rounded border-cream-400"
                        />
                        Include query parameters by default
                    </label>
                    <p className="mt-1 text-xs text-ink-400 leading-relaxed">
                        Add site-specific rules only when a site should behave differently.
                    </p>

                    <div className="mt-4 border-t border-cream-300 pt-4">
                        <p className="text-[11px] uppercase tracking-wider font-medium text-ink-400 mb-2">
                            Site-Specific Rules
                        </p>
                        <p className="text-xs text-ink-400 leading-relaxed">
                            Example: set <span className="text-ink-600">news.ycombinator.com</span> to use query parameters even if your default ignores them.
                        </p>

                        <div className="mt-2 flex items-center gap-2">
                            <input
                                value={newHostname}
                                placeholder="example.com"
                                onChange={(e) => {
                                    setNewHostname(e.target.value)
                                    setHostnameError(null)
                                }}
                                onKeyDown={(e) => {
                                    if (e.key !== 'Enter') return
                                    e.preventDefault()
                                    onAddHostnameOverride()
                                }}
                                className="flex-1 h-9 px-3 border border-cream-300 rounded-lg bg-cream-50 font-body text-[13px] text-ink-700 outline-none transition-all focus:border-accent-400 focus:shadow-[0_0_0_3px_rgba(62,114,183,0.16)] placeholder:text-ink-300"
                            />
                            <select
                                value={newHostnameMode}
                                onChange={(e) => {
                                    setNewHostnameMode(e.target.value as QueryIdentityMode)
                                }}
                                className="h-9 px-3 border border-cream-300 rounded-lg bg-cream-50 text-[13px] font-medium text-ink-700 outline-none transition-all focus:border-accent-400"
                            >
                                <option value="include">Use query</option>
                                <option value="ignore">Ignore query</option>
                            </select>
                            <button
                                onClick={onAddHostnameOverride}
                                className="h-9 px-3 rounded-lg bg-accent-500 text-white text-[13px] font-medium transition-colors hover:bg-accent-600"
                            >
                                Add
                            </button>
                        </div>

                        {hostnameError && (
                            <p className="mt-2 text-xs text-red-600">
                                {hostnameError}
                            </p>
                        )}

                        {hostnameEntries.length === 0 ? (
                            <p className="mt-3 text-xs text-ink-400">
                                No site-specific rules yet.
                            </p>
                        ) : (
                            <div className="mt-3 flex flex-col gap-2">
                                {hostnameEntries.map(([hostname, mode]) => (
                                    <div
                                        key={hostname}
                                        className="flex items-center gap-2 rounded-lg border border-cream-300 bg-cream-50 p-2"
                                    >
                                        <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink-700">
                                            {hostname}
                                        </span>
                                        <select
                                            value={mode}
                                            onChange={(e) => {
                                                onHostnameModeChange(
                                                    hostname,
                                                    e.target.value as QueryIdentityMode
                                                )
                                            }}
                                            className="px-2 py-1.5 border border-cream-300 rounded-md bg-cream-100 text-[11px] font-medium text-ink-700 outline-none transition-all focus:border-accent-400"
                                        >
                                            <option value="include">Use query</option>
                                            <option value="ignore">Ignore query</option>
                                        </select>
                                        <button
                                            onClick={() => {
                                                onRemoveHostnameOverride(hostname)
                                            }}
                                            title="Remove site rule"
                                            aria-label={`Remove site rule for ${hostname}`}
                                            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-ink-400 cursor-pointer transition-colors hover:bg-accent-50 hover:text-accent-700"
                                        >
                                            <FontAwesomeIcon icon={faTrashCan} className="w-3 h-3 text-current pointer-events-none" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </section>
        </main>
    )
}

main()
