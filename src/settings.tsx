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
        <main className="settings-page">
            <section className="settings-card animate-fade-in-up">
                <header className="settings-card__header">
                    <span className="settings-card__icon-wrap">
                        <FontAwesomeIcon
                            icon={faPalette}
                            className="icon icon--sm icon--inverse"
                        />
                    </span>
                    <div>
                        <h1 className="settings-card__title">
                            Preferences
                        </h1>
                        <p className="settings-card__subtitle">
                            Customize how marks are created and grouped.
                        </p>
                    </div>
                </header>

                <div className="settings-section settings-section--spaced">
                    <p className="settings-section__eyebrow">
                        Theme Mode
                    </p>
                    <ThemeToggle value={themePreference} onChange={onThemeChange} />
                    <p className="settings-section__help settings-section__help--spaced">
                        System follows your browser appearance preferences.
                    </p>
                </div>

                <div className="settings-section">
                    <p className="settings-section__eyebrow">
                        New Mark Placement
                    </p>
                    <div className="segmented-control">
                        <button
                            onClick={() => {
                                onMarkInsertPositionChange('top')
                            }}
                            className={`segmented-control__button${
                                markInsertPosition === 'top'
                                    ? ' segmented-control__button--active'
                                    : ''
                            }`}
                        >
                            Top
                        </button>
                        <button
                            onClick={() => {
                                onMarkInsertPositionChange('bottom')
                            }}
                            className={`segmented-control__button${
                                markInsertPosition === 'bottom'
                                    ? ' segmented-control__button--active'
                                    : ''
                            }`}
                        >
                            Bottom
                        </button>
                    </div>
                    <p className="settings-section__help settings-section__help--spaced">
                        Choose whether new marks are added first or last in the list.
                    </p>
                </div>

                <div className="settings-section">
                    <p className="settings-section__eyebrow">
                        URL Matching
                    </p>
                    <p className="settings-section__help">
                        Query parameters are the <span className="settings-section__inline-code">?key=value</span> parts at the end of a URL. When you enable this setting, pages with different query parameters (e.g. <span className="settings-section__inline-code">?page=1</span> vs <span className="settings-section__inline-code">?page=2</span>) are treated as separate pages, each with their own marks. Only enable this if the content of your pages changes based on query parameters.
                    </p>
                    <label className="settings-checkbox">
                        <input
                            type="checkbox"
                            checked={queryIdentitySettings.globalMode === 'include'}
                            onChange={(e) => {
                                onGlobalQueryIdentityModeChange(
                                    e.target.checked ? 'include' : 'ignore'
                                )
                            }}
                            className="checkbox"
                        />
                        Include query parameters by default
                    </label>
                    <p className="settings-section__help settings-section__help--tight">
                        Add site-specific rules only when a site should behave differently.
                    </p>

                    <div className="settings-subsection">
                        <p className="settings-section__eyebrow">
                            Site-Specific Rules
                        </p>
                        <p className="settings-section__help">
                            Example: set <span className="settings-section__inline-code">news.ycombinator.com</span> to use query parameters even if your default ignores them.
                        </p>

                        <div className="settings-rule-builder">
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
                                className="settings-input settings-input--fill"
                            />
                            <select
                                value={newHostnameMode}
                                onChange={(e) => {
                                    setNewHostnameMode(e.target.value as QueryIdentityMode)
                                }}
                                className="settings-select"
                            >
                                <option value="include">Use query</option>
                                <option value="ignore">Ignore query</option>
                            </select>
                            <button
                                onClick={onAddHostnameOverride}
                                className="button button--primary settings-add-button"
                            >
                                Add
                            </button>
                        </div>

                        {hostnameError && (
                            <p className="settings-error">
                                {hostnameError}
                            </p>
                        )}

                        {hostnameEntries.length === 0 ? (
                            <p className="settings-empty-state">
                                No site-specific rules yet.
                            </p>
                        ) : (
                            <div className="settings-rule-list">
                                {hostnameEntries.map(([hostname, mode]) => (
                                    <div
                                        key={hostname}
                                        className="settings-rule-item"
                                    >
                                        <span className="settings-rule-item__hostname">
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
                                            className="settings-rule-item__select"
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
                                            className="icon-button settings-rule-item__remove"
                                        >
                                            <FontAwesomeIcon icon={faTrashCan} className="icon icon--xs" />
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
