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
    SCROLL_CONTAINER_SETTINGS_KEY,
    SCROLL_STRATEGY_SETTINGS_KEY,
    defaultScrollContainerSettings,
    defaultScrollStrategySettings,
    getScrollContainerSettings,
    getScrollInsertPosition,
    getScrollStrategySettings,
    isScrollInsertPosition,
    normalizeScrollContainerSettings,
    normalizeURLPattern,
    parseScrollStrategy,
    removeURLPatternScrollContainerSelector,
    removeURLPatternScrollStrategy,
    setScrollContainerSettings as setStoredScrollContainerSettings,
    setGlobalScrollStrategy,
    setURLPatternScrollContainerSelector,
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
/** @typedef {import('../../shared/lib/preferences.js').ScrollContainerSettings} ScrollContainerSettings */

/**
 * @typedef {object} ScrollContainerRuleExample
 * @property {string} name
 * @property {string} urlPattern
 * @property {string} selector
 * @property {string} description
 */

const SCROLL_CONTAINER_RULE_EXAMPLES_PATH =
    'src/shared/data/scroll-container-rule-examples.json'

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

/** @param {string} selector @returns {boolean} */
const isValidCSSSelector = (selector) => {
    try {
        document.createDocumentFragment().querySelector(selector)
        return true
    } catch {
        return false
    }
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isRecord = (value) =>
    Boolean(value && typeof value === 'object' && !Array.isArray(value))

/** @param {unknown} value @returns {ScrollContainerRuleExample[]} */
const normalizeScrollContainerRuleExamples = (value) => {
    if (!Array.isArray(value)) return []

    return value.reduce(
        /** @param {ScrollContainerRuleExample[]} examples @param {unknown} item */
        (examples, item) => {
            if (!isRecord(item)) return examples

            const name = typeof item.name === 'string' ? item.name.trim() : ''
            const normalizedPattern = typeof item.urlPattern === 'string'
                ? normalizeURLPattern(item.urlPattern)
                : null
            const selector = typeof item.selector === 'string'
                ? item.selector.trim()
                : ''
            const description = typeof item.description === 'string'
                ? item.description.trim()
                : ''

            if (
                !name ||
                !normalizedPattern ||
                !selector ||
                !isValidCSSSelector(selector)
            ) {
                return examples
            }

            examples.push({
                name,
                urlPattern: normalizedPattern,
                selector,
                description,
            })
            return examples
        },
        []
    )
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
    const [scrollContainerSettings, setScrollContainerSettings] =
        useState(defaultScrollContainerSettings)
    const [newHostname, setNewHostname] = useState('')
    const [newHostnameMode, setNewHostnameMode] =
        useState(/** @type {QueryIdentityMode} */ ('include'))
    const [hostnameError, setHostnameError] = useState(/** @type {string | null} */ (null))
    const [newStrategyPattern, setNewStrategyPattern] = useState('')
    const [newPatternStrategy, setNewPatternStrategy] =
        useState(/** @type {ScrollStrategy} */ ('viewport-ratio'))
    const [strategyPatternError, setStrategyPatternError] =
        useState(/** @type {string | null} */ (null))
    const [newContainerPattern, setNewContainerPattern] = useState('')
    const [newContainerSelector, setNewContainerSelector] = useState('')
    const [containerRuleError, setContainerRuleError] =
        useState(/** @type {string | null} */ (null))
    const [scrollContainerRuleExamples, setScrollContainerRuleExamples] =
        useState(/** @type {ScrollContainerRuleExample[]} */ ([]))
    const [ruleExamplesError, setRuleExamplesError] =
        useState(/** @type {string | null} */ (null))
    const [areRuleExamplesExpanded, setAreRuleExamplesExpanded] = useState(false)

    useEffect(() => {
        let isMounted = true

        void Promise.all([
            getThemePreference(),
            getScrollInsertPosition(),
            getQueryIdentitySettings(),
            getScrollStrategySettings(),
            getScrollContainerSettings(),
        ]).then(([preference, position, settings, strategySettings, containerSettings]) => {
            if (!isMounted) return
            setThemePreference(preference)
            setMarkInsertPosition(position)
            setQueryIdentitySettings(settings)
            setScrollStrategySettings(strategySettings)
            setScrollContainerSettings(containerSettings)
        })

        void fetch(chrome.runtime.getURL(SCROLL_CONTAINER_RULE_EXAMPLES_PATH))
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error('Unable to load example rules.')
                }

                return response.json()
            })
            .then((value) => {
                if (!isMounted) return

                setScrollContainerRuleExamples(
                    normalizeScrollContainerRuleExamples(value)
                )
            })
            .catch(() => {
                if (!isMounted) return
                setRuleExamplesError('Example rules could not be loaded.')
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
        const unsubscribeScrollContainerSettings = subscribeToStorageKey(
            SCROLL_CONTAINER_SETTINGS_KEY,
            (change) => {
                if (!isMounted) return
                setScrollContainerSettings(
                    normalizeScrollContainerSettings(change.newValue)
                )
            }
        )

        return () => {
            isMounted = false
            unsubscribe()
            unsubscribeMarkInsertPosition()
            unsubscribeQueryIdentitySettings()
            unsubscribeScrollStrategySettings()
            unsubscribeScrollContainerSettings()
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

    const updateScrollContainerSettings = useCallback(
        /** @param {(current: ScrollContainerSettings) => ScrollContainerSettings} updater */
        (updater) => {
            /** @type {(current: ScrollContainerSettings) => ScrollContainerSettings} */
            const applyUpdate = (current) => {
                const next = updater(current)
                void setStoredScrollContainerSettings(next)
                return next
            }

            setScrollContainerSettings(applyUpdate)
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

    const onAddScrollContainerRule = useCallback(() => {
        const normalizedPattern = normalizeURLPattern(newContainerPattern)
        const normalizedSelector = newContainerSelector.trim()

        if (!normalizedPattern) {
            setContainerRuleError('Enter a valid hostname or path, such as chatgpt.com/c.')
            return
        }

        if (!normalizedSelector) {
            setContainerRuleError('Enter a CSS selector for the scroll container.')
            return
        }

        if (!isValidCSSSelector(normalizedSelector)) {
            setContainerRuleError('Enter a valid CSS selector.')
            return
        }

        setContainerRuleError(null)
        updateScrollContainerSettings(
            /** @param {ScrollContainerSettings} current */
            (current) =>
                setURLPatternScrollContainerSelector(
                    current,
                    normalizedPattern,
                    normalizedSelector
                )
        )
        setNewContainerPattern('')
        setNewContainerSelector('')
    }, [newContainerPattern, newContainerSelector, updateScrollContainerSettings])

    const onRemoveScrollContainerRule = useCallback(
        /** @param {string} pattern */
        (pattern) => {
            updateScrollContainerSettings(
                /** @param {ScrollContainerSettings} current */
                (current) =>
                removeURLPatternScrollContainerSelector(current, pattern)
            )
        },
        [updateScrollContainerSettings]
    )

    const onAddScrollContainerRuleExample = useCallback(
        /** @param {ScrollContainerRuleExample} example */
        (example) => {
            updateScrollContainerSettings(
                /** @param {ScrollContainerSettings} current */
                (current) =>
                    setURLPatternScrollContainerSelector(
                        current,
                        example.urlPattern,
                        example.selector
                    )
            )
        },
        [updateScrollContainerSettings]
    )

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
    const scrollContainerEntries = Object.entries(
        scrollContainerSettings.perURLPatternSelector
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
                    <p class="settings-section__eyebrow">Scroll Container Rules</p>
                    <p class="settings-section__help settings-section__help--spaced">
                        Use these only for sites where scrolling happens inside a page element instead of the document.
                        Rules use the same hostname or path prefix matching as jump strategy rules.
                    </p>

                    <div class="settings-rule-builder">
                        <input
                            value=${newContainerPattern}
                            placeholder="example.com/docs"
                            onInput=${
                                /** @param {InputEvent & {currentTarget: HTMLInputElement}} event */
                                (event) => {
                                    setNewContainerPattern(event.currentTarget.value)
                                    setContainerRuleError(null)
                                }
                            }
                            onKeyDown=${
                                /** @param {KeyboardEvent} event */
                                (event) => {
                                    if (event.key !== 'Enter') return
                                    event.preventDefault()
                                    onAddScrollContainerRule()
                                }
                            }
                            class="settings-input settings-input--fill"
                        />
                        <input
                            value=${newContainerSelector}
                            placeholder="CSS selector"
                            onInput=${
                                /** @param {InputEvent & {currentTarget: HTMLInputElement}} event */
                                (event) => {
                                    setNewContainerSelector(event.currentTarget.value)
                                    setContainerRuleError(null)
                                }
                            }
                            onKeyDown=${
                                /** @param {KeyboardEvent} event */
                                (event) => {
                                    if (event.key !== 'Enter') return
                                    event.preventDefault()
                                    onAddScrollContainerRule()
                                }
                            }
                            class="settings-input settings-input--fill"
                        />
                        <button
                            type="button"
                            onClick=${onAddScrollContainerRule}
                            class="button button--primary settings-add-button"
                        >
                            Add
                        </button>
                    </div>

                    ${containerRuleError
                        ? html`<p class="settings-error">${containerRuleError}</p>`
                        : null}

                    ${scrollContainerEntries.length === 0
                        ? html`
                            <p class="settings-empty-state">No custom scroll containers yet.</p>
                        `
                        : html`
                            <div class="settings-rule-list">
                                ${scrollContainerEntries.map(([pattern, selector]) => html`
                                    <div key=${pattern} class="settings-rule-item">
                                        <span class="settings-rule-item__hostname">${pattern}</span>
                                        <span
                                            class="settings-rule-item__selector"
                                            title=${selector}
                                        >
                                            ${selector}
                                        </span>
                                        <button
                                            type="button"
                                            onClick=${() => onRemoveScrollContainerRule(pattern)}
                                            title="Remove scroll container rule"
                                            aria-label=${`Remove scroll container rule for ${pattern}`}
                                            class="icon-button settings-rule-item__remove"
                                        >
                                            <${Icon} icon="trashCan" className="icon icon--xs" />
                                        </button>
                                    </div>
                                `)}
                            </div>
                        `}

                    <div class="settings-subsection">
                        <button
                            type="button"
                            onClick=${() =>
                                setAreRuleExamplesExpanded(
                                    /** @param {boolean} isExpanded */
                                    (isExpanded) => !isExpanded
                                )}
                            class="settings-disclosure"
                            aria-expanded=${areRuleExamplesExpanded}
                        >
                            <span>Example Rules</span>
                            <span class="settings-disclosure__summary">
                                ${scrollContainerRuleExamples.length} available
                            </span>
                            <${Icon}
                                icon=${areRuleExamplesExpanded ? 'angleUp' : 'angleDown'}
                                className="icon icon--xs"
                            />
                        </button>

                        ${areRuleExamplesExpanded
                            ? html`
                                <div class="settings-notice">
                                    <${Icon} icon="circleInfo" className="icon icon--xs" />
                                    <p>
                                        These examples may become outdated when websites change. If an example is missing or no
                                        longer works, use the
                                        <a
                                            href="https://github.com/kugurerdem/mark-scroll-positions#finding-a-custom-scroll-container-selector"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            custom selector guide
                                        </a>
                                        and feel free to open a PR with updated selectors.
                                    </p>
                                </div>

                                ${ruleExamplesError
                                    ? html`<p class="settings-error">${ruleExamplesError}</p>`
                                    : null}

                                ${scrollContainerRuleExamples.length === 0 && !ruleExamplesError
                                    ? html`<p class="settings-empty-state">No example rules available.</p>`
                                    : html`
                                        <div class="settings-example-rule-list">
                                            ${scrollContainerRuleExamples.map(
                                                /** @param {ScrollContainerRuleExample} example */
                                                (example) => {
                                                    const existingSelector =
                                                        scrollContainerSettings.perURLPatternSelector[
                                                            example.urlPattern
                                                        ]
                                                    const isAdded = existingSelector === example.selector

                                                    return html`
                                                        <div
                                                            key=${example.urlPattern}
                                                            class="settings-example-rule"
                                                        >
                                                            <div class="settings-example-rule__main">
                                                                <span class="settings-example-rule__name">
                                                                    ${example.name}
                                                                </span>
                                                                <span
                                                                    class="settings-example-rule__pattern"
                                                                    title=${example.urlPattern}
                                                                >
                                                                    ${example.urlPattern}
                                                                </span>
                                                                <span
                                                                    class="settings-example-rule__selector"
                                                                    title=${example.selector}
                                                                >
                                                                    ${example.selector}
                                                                </span>
                                                                ${example.description
                                                                    ? html`
                                                                        <p class="settings-example-rule__description">
                                                                            ${example.description}
                                                                        </p>
                                                                    `
                                                                    : null}
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick=${() =>
                                                                    onAddScrollContainerRuleExample(
                                                                        example
                                                                    )}
                                                                disabled=${isAdded}
                                                                class=${`button settings-example-rule__button${
                                                                    isAdded
                                                                        ? ' button--secondary'
                                                                        : ' button--primary'
                                                                }`}
                                                            >
                                                                ${isAdded ? 'Added' : 'Add'}
                                                            </button>
                                                        </div>
                                                    `
                                                }
                                            )}
                                        </div>
                                    `}
                            `
                            : html`
                                ${ruleExamplesError
                                    ? html`<p class="settings-error">${ruleExamplesError}</p>`
                                    : null}
                            `}
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
