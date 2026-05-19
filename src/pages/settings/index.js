// @ts-check

import {html, render, useCallback, useEffect, useState} from '../../shared/lib/ui.js'
import {getAppRoot} from '../../shared/lib/app-root.js'
import {
    getThemePreference,
    initializeTheme,
    setThemePreference as setStoredThemePreference,
    subscribeThemePreference,
} from '../../shared/lib/theme.js'
import {Icon} from '../../shared/components/icons.js'
import {ThemeToggle} from '../../shared/components/theme-toggle.js'
import {
    MARK_INSERT_POSITION_KEY,
    SCROLL_STRATEGY_SETTINGS_KEY,
    defaultScrollStrategySettings,
    getScrollInsertPosition,
    getScrollStrategySettings,
    isScrollInsertPosition,
    normalizeURLPattern,
    parseScrollStrategy,
    removeURLPatternScrollStrategy,
    setGlobalScrollStrategy,
    setURLPatternScrollStrategy,
    setScrollInsertPosition,
    setScrollStrategySettings as setStoredScrollStrategySettings,
} from '../../shared/lib/preferences.js'
import {subscribeToStorageKey} from '../../shared/lib/storage.js'
import {
    QUERY_IDENTITY_SETTINGS_KEY,
    defaultQueryIdentitySettings,
    getQueryIdentitySettings,
    parseQueryIdentityMode,
    removeHostnameQueryIdentityMode,
    setGlobalQueryIdentityMode,
    setHostnameQueryIdentityMode,
    setQueryIdentitySettings as setStoredQueryIdentitySettings,
} from '../../shared/lib/url-identity.js'

/** @typedef {import('../../shared/lib/theme.js').ThemePreference} ThemePreference */
/** @typedef {import('../../shared/lib/url-identity.js').QueryIdentityMode} QueryIdentityMode */
/** @typedef {import('../../shared/lib/url-identity.js').QueryIdentitySettings} QueryIdentitySettings */
/** @typedef {import('../../shared/lib/preferences.js').ScrollInsertPosition} ScrollInsertPosition */
/** @typedef {import('../../shared/lib/preferences.js').ScrollStrategy} ScrollStrategy */
/** @typedef {import('../../shared/lib/preferences.js').ScrollStrategySettings} ScrollStrategySettings */

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
    const [scrollStrategySettings, setScrollStrategySettings] =
        useState(defaultScrollStrategySettings)
    const [newHostname, setNewHostname] = useState('')
    const [newHostnameMode, setNewHostnameMode] =
        useState(/** @type {QueryIdentityMode} */ ('include'))
    const [hostnameError, setHostnameError] = useState(/** @type {string | null} */ (null))
    const [newStrategyPattern, setNewStrategyPattern] = useState('')
    const [newPatternStrategy, setNewPatternStrategy] =
        useState(/** @type {ScrollStrategy} */ ('viewport-ratio'))
    const [strategyPatternError, setStrategyPatternError] =
        useState(/** @type {string | null} */ (null))

    useEffect(() => {
        let isMounted = true

        void Promise.all([
            getThemePreference(),
            getScrollInsertPosition(),
            getQueryIdentitySettings(),
            getScrollStrategySettings(),
        ]).then(([preference, position, settings, strategySettings]) => {
            if (!isMounted) return
            setThemePreference(preference)
            setMarkInsertPosition(position)
            setQueryIdentitySettings(settings)
            setScrollStrategySettings(strategySettings)
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
        const unsubscribeScrollStrategySettings = subscribeToStorageKey(
            SCROLL_STRATEGY_SETTINGS_KEY,
            async () => {
                if (!isMounted) return
                setScrollStrategySettings(await getScrollStrategySettings())
            }
        )

        return () => {
            isMounted = false
            unsubscribe()
            unsubscribeMarkInsertPosition()
            unsubscribeQueryIdentitySettings()
            unsubscribeScrollStrategySettings()
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

    const updateScrollStrategySettings = useCallback(
        /** @param {(current: ScrollStrategySettings) => ScrollStrategySettings} updater */
        (updater) => {
            /** @type {(current: ScrollStrategySettings) => ScrollStrategySettings} */
            const applyUpdate = (current) => {
                const next = updater(current)
                void setStoredScrollStrategySettings(next)
                return next
            }

            setScrollStrategySettings(applyUpdate)
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

    const onGlobalScrollStrategyChange = useCallback(
        /** @param {ScrollStrategy} strategy */
        (strategy) => {
            updateScrollStrategySettings(
                /** @param {ScrollStrategySettings} current */
                (current) =>
                setGlobalScrollStrategy(current, strategy)
            )
        },
        [updateScrollStrategySettings]
    )

    const onURLPatternStrategyChange = useCallback(
        /** @param {string} pattern @param {ScrollStrategy} strategy */
        (pattern, strategy) => {
            updateScrollStrategySettings(
                /** @param {ScrollStrategySettings} current */
                (current) =>
                setURLPatternScrollStrategy(current, pattern, strategy)
            )
        },
        [updateScrollStrategySettings]
    )

    const onRemoveURLPatternStrategyOverride = useCallback(
        /** @param {string} pattern */
        (pattern) => {
            updateScrollStrategySettings(
                /** @param {ScrollStrategySettings} current */
                (current) =>
                removeURLPatternScrollStrategy(current, pattern)
            )
        },
        [updateScrollStrategySettings]
    )

    const onAddURLPatternStrategyOverride = useCallback(() => {
        const normalizedPattern = normalizeURLPattern(newStrategyPattern)

        if (!normalizedPattern) {
            setStrategyPatternError('Enter a valid hostname or path, such as news.ycombinator.com/item.')
            return
        }

        setStrategyPatternError(null)
        updateScrollStrategySettings(
            /** @param {ScrollStrategySettings} current */
            (current) =>
                setURLPatternScrollStrategy(
                    current,
                    normalizedPattern,
                    newPatternStrategy
                )
        )
        setNewStrategyPattern('')
    }, [newStrategyPattern, newPatternStrategy, updateScrollStrategySettings])

    const hostnameEntries = Object.entries(queryIdentitySettings.perHostMode).sort(
        ([leftHostname], [rightHostname]) =>
            leftHostname.localeCompare(rightHostname)
    )
    const strategyPatternEntries = Object.entries(
        scrollStrategySettings.perURLPatternStrategy
    ).sort(
        ([leftPattern], [rightPattern]) =>
            leftPattern.localeCompare(rightPattern)
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
                    <p class="settings-section__eyebrow">Jump Strategy Rules</p>
                    <div class="settings-section__help settings-section__help--spaced">
                        <p>The Default rule is used unless a more specific hostname or path prefix matches.</p>
                        <p>
                            Page ratio uses the saved position relative to the full page height. Use it for pages where
                            the overall document structure stays stable.
                        </p>
                        <p>
                            Screen ratio uses the saved top position relative to the viewport height. Use it for pages
                            that append content, such as chats or comment sections.
                        </p>
                        <p>
                            If the page has not changed, both strategies should usually land in the same place.
                            The difference is how jumps behave when content is added or removed after the mark was
                            created.
                        </p>
                    </div>

                    <div class="settings-rule-builder">
                        <input
                            value=${newStrategyPattern}
                            placeholder="example.com/docs"
                            onInput=${
                                /** @param {InputEvent & {currentTarget: HTMLInputElement}} event */
                                (event) => {
                                    setNewStrategyPattern(event.currentTarget.value)
                                    setStrategyPatternError(null)
                                }
                            }
                            onKeyDown=${
                                /** @param {KeyboardEvent} event */
                                (event) => {
                                    if (event.key !== 'Enter') return
                                    event.preventDefault()
                                    onAddURLPatternStrategyOverride()
                                }
                            }
                            class="settings-input settings-input--fill"
                        />
                        <select
                            value=${newPatternStrategy}
                            onChange=${
                                /** @param {Event & {currentTarget: HTMLSelectElement}} event */
                                (event) => {
                                    const nextStrategy = parseScrollStrategy(event.currentTarget.value)
                                    if (nextStrategy) {
                                        setNewPatternStrategy(nextStrategy)
                                    }
                                }
                            }
                            class="settings-rule-item__select"
                        >
                            <option value="page-ratio">Page ratio</option>
                            <option value="viewport-ratio">Screen ratio</option>
                        </select>
                        <button
                            type="button"
                            onClick=${onAddURLPatternStrategyOverride}
                            class="button button--primary settings-add-button"
                        >
                            Add
                        </button>
                    </div>

                    ${strategyPatternError
                        ? html`<p class="settings-error">${strategyPatternError}</p>`
                        : null}

                    <div class="settings-rule-list">
                        <div class="settings-rule-item">
                            <span class="settings-rule-item__hostname">Default</span>
                            <select
                                value=${scrollStrategySettings.globalStrategy}
                                onChange=${
                                    /** @param {Event & {currentTarget: HTMLSelectElement}} event */
                                    (event) => {
                                        const nextStrategy = parseScrollStrategy(
                                            event.currentTarget.value
                                        )
                                        if (nextStrategy) {
                                            onGlobalScrollStrategyChange(nextStrategy)
                                        }
                                    }
                                }
                                class="settings-rule-item__select"
                            >
                                <option value="page-ratio">Page ratio</option>
                                <option value="viewport-ratio">Screen ratio</option>
                            </select>
                            <button
                                type="button"
                                disabled=${true}
                                title="The default rule cannot be removed"
                                aria-label="The default rule cannot be removed"
                                class="icon-button settings-rule-item__remove"
                            >
                                <${Icon} icon="trashCan" className="icon icon--xs" />
                            </button>
                        </div>

                        ${strategyPatternEntries.map(([pattern, strategy]) => html`
                            <div key=${pattern} class="settings-rule-item">
                                <span class="settings-rule-item__hostname">${pattern}</span>
                                <select
                                    value=${strategy}
                                    onChange=${
                                        /** @param {Event & {currentTarget: HTMLSelectElement}} event */
                                        (event) => {
                                            const nextStrategy = parseScrollStrategy(
                                                event.currentTarget.value
                                            )
                                            if (nextStrategy) {
                                                onURLPatternStrategyChange(pattern, nextStrategy)
                                            }
                                        }
                                    }
                                    class="settings-rule-item__select"
                                >
                                    <option value="page-ratio">Page ratio</option>
                                    <option value="viewport-ratio">Screen ratio</option>
                                </select>
                                <button
                                    type="button"
                                    onClick=${() => onRemoveURLPatternStrategyOverride(pattern)}
                                    title="Remove strategy rule"
                                    aria-label=${`Remove strategy rule for ${pattern}`}
                                    class="icon-button settings-rule-item__remove"
                                >
                                    <${Icon} icon="trashCan" className="icon icon--xs" />
                                </button>
                            </div>
                        `)}
                    </div>
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
