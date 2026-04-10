// @ts-check

import {html, render, useCallback, useEffect, useState} from './ui.js'
import {getAppRoot} from './app-root.js'
import {
    getThemePreference,
    initializeTheme,
    setThemePreference as setStoredThemePreference,
    subscribeThemePreference,
} from './theme.js'
import {Icon} from './icons.js'
import {ThemeToggle} from './theme-toggle.js'
import {
    MARK_INSERT_POSITION_KEY,
    getScrollInsertPosition,
    isScrollInsertPosition,
    setScrollInsertPosition,
} from './preferences.js'
import {subscribeToStorageKey} from './storage.js'
import {
    QUERY_IDENTITY_SETTINGS_KEY,
    defaultQueryIdentitySettings,
    getQueryIdentitySettings,
    parseQueryIdentityMode,
    removeHostnameQueryIdentityMode,
    setGlobalQueryIdentityMode,
    setHostnameQueryIdentityMode,
    setQueryIdentitySettings as setStoredQueryIdentitySettings,
} from './url-identity.js'

/** @typedef {import('./theme.js').ThemePreference} ThemePreference */
/** @typedef {import('./url-identity.js').QueryIdentityMode} QueryIdentityMode */
/** @typedef {import('./url-identity.js').QueryIdentitySettings} QueryIdentitySettings */
/** @typedef {import('./preferences.js').ScrollInsertPosition} ScrollInsertPosition */

/** @param {string} value @returns {boolean} */
const hasProtocol = (value) => /^[a-z][a-z0-9+.-]*:\/\//i.test(value)

/** @param {string} value @returns {string | null} */
const normalizeHostnameInput = (value) => {
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

const main = async () => {
    await initializeTheme()
    render(html`<${App} />`, getAppRoot())
}

const App = () => {
    const [themePreference, setThemePreference] =
        useState(/** @type {ThemePreference} */ ('system'))
    const [markInsertPosition, setMarkInsertPosition] =
        useState(/** @type {ScrollInsertPosition} */ ('bottom'))
    const [queryIdentitySettings, setQueryIdentitySettings] =
        useState(defaultQueryIdentitySettings)
    const [newHostname, setNewHostname] = useState('')
    const [newHostnameMode, setNewHostnameMode] =
        useState(/** @type {QueryIdentityMode} */ ('include'))
    const [hostnameError, setHostnameError] = useState(/** @type {string | null} */ (null))

    useEffect(() => {
        let isMounted = true

        void Promise.all([
            getThemePreference(),
            getScrollInsertPosition(),
            getQueryIdentitySettings(),
        ]).then(([preference, position, settings]) => {
            if (!isMounted) return
            setThemePreference(preference)
            setMarkInsertPosition(position)
            setQueryIdentitySettings(settings)
        })

        const unsubscribe = subscribeThemePreference((preference) => {
            if (!isMounted) return
            setThemePreference(preference)
        })

        const unsubscribeMarkInsertPosition = subscribeToStorageKey(
            MARK_INSERT_POSITION_KEY,
            (positionChange) => {
                const nextValue = positionChange.newValue
                if (isScrollInsertPosition(nextValue)) {
                    setMarkInsertPosition(nextValue)
                }
            }
        )
        const unsubscribeQueryIdentitySettings = subscribeToStorageKey(
            QUERY_IDENTITY_SETTINGS_KEY,
            async () => {
                if (!isMounted) return
                setQueryIdentitySettings(await getQueryIdentitySettings())
            }
        )

        return () => {
            isMounted = false
            unsubscribe()
            unsubscribeMarkInsertPosition()
            unsubscribeQueryIdentitySettings()
        }
    }, [])

    const onThemeChange = useCallback(
        /** @param {ThemePreference} preference */
        (preference) => {
            setThemePreference(preference)
            void setStoredThemePreference(preference)
        },
        []
    )

    const onMarkInsertPositionChange = useCallback(
        /** @param {ScrollInsertPosition} position */
        (position) => {
            setMarkInsertPosition(position)
            void setScrollInsertPosition(position)
        },
        []
    )

    const updateQueryIdentitySettings = useCallback(
        /** @param {(current: QueryIdentitySettings) => QueryIdentitySettings} updater */
        (updater) => {
            /** @type {(current: QueryIdentitySettings) => QueryIdentitySettings} */
            const applyUpdate = (current) => {
                const next = updater(current)
                void setStoredQueryIdentitySettings(next)
                return next
            }

            setQueryIdentitySettings(applyUpdate)
        },
        []
    )

    const onGlobalQueryIdentityModeChange = useCallback(
        /** @param {QueryIdentityMode} mode */
        (mode) => {
            updateQueryIdentitySettings(
                /** @param {QueryIdentitySettings} current */
                (current) =>
                setGlobalQueryIdentityMode(current, mode)
            )
        },
        [updateQueryIdentitySettings]
    )

    const onHostnameModeChange = useCallback(
        /** @param {string} hostname @param {QueryIdentityMode} mode */
        (hostname, mode) => {
            updateQueryIdentitySettings(
                /** @param {QueryIdentitySettings} current */
                (current) =>
                setHostnameQueryIdentityMode(current, hostname, mode)
            )
        },
        [updateQueryIdentitySettings]
    )

    const onRemoveHostnameOverride = useCallback(
        /** @param {string} hostname */
        (hostname) => {
            updateQueryIdentitySettings(
                /** @param {QueryIdentitySettings} current */
                (current) =>
                removeHostnameQueryIdentityMode(current, hostname)
            )
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
        updateQueryIdentitySettings(
            /** @param {QueryIdentitySettings} current */
            (current) =>
                setHostnameQueryIdentityMode(current, normalizedHostname, newHostnameMode)
        )
        setNewHostname('')
    }, [newHostname, newHostnameMode, updateQueryIdentitySettings])

    const hostnameEntries = Object.entries(queryIdentitySettings.perHostMode).sort(
        ([leftHostname], [rightHostname]) =>
            leftHostname.localeCompare(rightHostname)
    )

    return html`
        <main class="settings-page">
            <section class="settings-card animate-fade-in-up">
                <header class="settings-card__header">
                    <span class="settings-card__icon-wrap">
                        <${Icon} icon="palette" className="icon icon--sm icon--inverse" />
                    </span>
                    <div>
                        <h1 class="settings-card__title">Preferences</h1>
                        <p class="settings-card__subtitle">
                            Customize how marks are created and grouped.
                        </p>
                    </div>
                </header>

                <div class="settings-section settings-section--spaced">
                    <p class="settings-section__eyebrow">Theme Mode</p>
                    <${ThemeToggle} value=${themePreference} onChange=${onThemeChange} />
                    <p class="settings-section__help settings-section__help--spaced">
                        System follows your browser appearance preferences.
                    </p>
                </div>

                <div class="settings-section">
                    <p class="settings-section__eyebrow">New Mark Placement</p>
                    <div class="segmented-control">
                        <button
                            type="button"
                            onClick=${() => onMarkInsertPositionChange('top')}
                            class=${`segmented-control__button${
                                markInsertPosition === 'top'
                                    ? ' segmented-control__button--active'
                                    : ''
                            }`}
                        >
                            Top
                        </button>
                        <button
                            type="button"
                            onClick=${() => onMarkInsertPositionChange('bottom')}
                            class=${`segmented-control__button${
                                markInsertPosition === 'bottom'
                                    ? ' segmented-control__button--active'
                                    : ''
                            }`}
                        >
                            Bottom
                        </button>
                    </div>
                    <p class="settings-section__help settings-section__help--spaced">
                        Choose whether new marks are added first or last in the list.
                    </p>
                </div>

                <div class="settings-section">
                    <p class="settings-section__eyebrow">URL Matching</p>
                    <p class="settings-section__help">
                        Query parameters are the
                        <span class="settings-section__inline-code">?key=value</span>
                        parts at the end of a URL. When you enable this setting, pages with different query
                        parameters (e.g.
                        <span class="settings-section__inline-code">?page=1</span>
                        vs
                        <span class="settings-section__inline-code">?page=2</span>)
                        are treated as separate pages, each with their own marks. Only enable this if the content
                        of your pages changes based on query parameters.
                    </p>
                    <label class="settings-checkbox">
                        <input
                            type="checkbox"
                            checked=${queryIdentitySettings.globalMode === 'include'}
                            onChange=${
                                /** @param {Event & {currentTarget: HTMLInputElement}} event */
                                (event) => {
                                    onGlobalQueryIdentityModeChange(
                                        event.currentTarget.checked ? 'include' : 'ignore'
                                    )
                                }
                            }
                            class="checkbox"
                        />
                        Include query parameters by default
                    </label>
                    <p class="settings-section__help settings-section__help--tight">
                        Add site-specific rules only when a site should behave differently.
                    </p>

                    <div class="settings-subsection">
                        <p class="settings-section__eyebrow">Site-Specific Rules</p>
                        <p class="settings-section__help">
                            Example: set
                            <span class="settings-section__inline-code">news.ycombinator.com</span>
                            to use query parameters even if your default ignores them.
                        </p>

                        <div class="settings-rule-builder">
                            <input
                                value=${newHostname}
                                placeholder="example.com"
                                onInput=${
                                    /** @param {InputEvent & {currentTarget: HTMLInputElement}} event */
                                    (event) => {
                                        setNewHostname(event.currentTarget.value)
                                        setHostnameError(null)
                                    }
                                }
                                onKeyDown=${
                                    /** @param {KeyboardEvent} event */
                                    (event) => {
                                        if (event.key !== 'Enter') return
                                        event.preventDefault()
                                        onAddHostnameOverride()
                                    }
                                }
                                class="settings-input settings-input--fill"
                            />
                            <select
                                value=${newHostnameMode}
                                onChange=${
                                    /** @param {Event & {currentTarget: HTMLSelectElement}} event */
                                    (event) => {
                                        const nextMode = parseQueryIdentityMode(event.currentTarget.value)
                                        if (nextMode) {
                                            setNewHostnameMode(nextMode)
                                        }
                                    }
                                }
                                class="settings-select"
                            >
                                <option value="include">Use query</option>
                                <option value="ignore">Ignore query</option>
                            </select>
                            <button
                                type="button"
                                onClick=${onAddHostnameOverride}
                                class="button button--primary settings-add-button"
                            >
                                Add
                            </button>
                        </div>

                        ${hostnameError
                            ? html`<p class="settings-error">${hostnameError}</p>`
                            : null}

                        ${hostnameEntries.length === 0
                            ? html`
                                <p class="settings-empty-state">No site-specific rules yet.</p>
                            `
                            : html`
                                <div class="settings-rule-list">
                                    ${hostnameEntries.map(([hostname, mode]) => html`
                                        <div key=${hostname} class="settings-rule-item">
                                            <span class="settings-rule-item__hostname">${hostname}</span>
                                            <select
                                                value=${mode}
                                                onChange=${
                                                    /** @param {Event & {currentTarget: HTMLSelectElement}} event */
                                                    (event) => {
                                                        const nextMode = parseQueryIdentityMode(
                                                            event.currentTarget.value
                                                        )
                                                        if (nextMode) {
                                                            onHostnameModeChange(hostname, nextMode)
                                                        }
                                                    }
                                                }
                                                class="settings-rule-item__select"
                                            >
                                                <option value="include">Use query</option>
                                                <option value="ignore">Ignore query</option>
                                            </select>
                                            <button
                                                type="button"
                                                onClick=${() => onRemoveHostnameOverride(hostname)}
                                                title="Remove site rule"
                                                aria-label=${`Remove site rule for ${hostname}`}
                                                class="icon-button settings-rule-item__remove"
                                            >
                                                <${Icon} icon="trashCan" className="icon icon--xs" />
                                            </button>
                                        </div>
                                    `)}
                                </div>
                            `}
                    </div>
                </div>
            </section>
        </main>
    `
}

void main()
