// @ts-check

/** @typedef {'top' | 'bottom'} ScrollInsertPosition */
/** @typedef {'page-ratio' | 'viewport-ratio'} ScrollStrategy */

/**
 * @typedef {object} ScrollStrategySettings
 * @property {ScrollStrategy} globalStrategy
 * @property {Record<string, ScrollStrategy>} perURLPatternStrategy
 * @property {Record<string, ScrollStrategy>} perHostStrategy
 */

/**
 * @typedef {object} ScrollContainerSettings
 * @property {Record<string, string>} perURLPatternSelector
 */

export const MARK_INSERT_POSITION_KEY = 'markInsertPosition'
export const SCROLL_STRATEGY_SETTINGS_KEY = 'scrollStrategySettings'
export const SCROLL_CONTAINER_SETTINGS_KEY = 'scrollContainerSettings'

const hasOwnProperty = Object.prototype.hasOwnProperty

/** @type {ScrollStrategySettings} */
export const defaultScrollStrategySettings = {
    globalStrategy: 'page-ratio',
    perURLPatternStrategy: {},
    perHostStrategy: {},
}

/** @type {ScrollContainerSettings} */
export const defaultScrollContainerSettings = {
    perURLPatternSelector: {},
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isRecord = (value) =>
    Boolean(value && typeof value === 'object' && !Array.isArray(value))

/** @param {unknown} value @returns {value is ScrollInsertPosition} */
export const isScrollInsertPosition = (value) =>
    value === 'top' || value === 'bottom'

/** @param {unknown} value @returns {value is ScrollStrategy} */
export const isScrollStrategy = (value) =>
    value === 'page-ratio' || value === 'viewport-ratio'

/** @param {unknown} value @returns {ScrollStrategy | null} */
export const parseScrollStrategy = (value) =>
    isScrollStrategy(value) ? value : null

/** @returns {Promise<ScrollInsertPosition>} */
export const getScrollInsertPosition = async () => {
    const result = await chrome.storage.local.get(MARK_INSERT_POSITION_KEY)
    const value = result[MARK_INSERT_POSITION_KEY]
    return isScrollInsertPosition(value) ? value : 'bottom'
}

/** @param {ScrollInsertPosition} position @returns {Promise<void>} */
export const setScrollInsertPosition = async (position) => {
    await chrome.storage.local.set({[MARK_INSERT_POSITION_KEY]: position})
}

/** @param {string} pattern @returns {string | null} */
export const normalizeURLPattern = (pattern) => {
    const trimmed = pattern.trim().toLowerCase()
    if (!trimmed) return null

    const normalizedURL = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
        ? trimmed
        : `https://${trimmed}`

    try {
        const parsedURL = new URL(normalizedURL)
        if (!parsedURL.hostname) return null

        const pathname = parsedURL.pathname.replace(/\/+$/, '')
        return parsedURL.hostname.concat(pathname === '/' ? '' : pathname)
    } catch {
        return null
    }
}

/** @param {unknown} value @returns {Record<string, ScrollStrategy>} */
const normalizePerURLPatternStrategy = (value) => {
    if (!isRecord(value)) return {}

    return Object.entries(value).reduce((acc, [pattern, strategy]) => {
        const normalizedPattern = normalizeURLPattern(pattern)
        if (!normalizedPattern || !isScrollStrategy(strategy)) return acc

        acc[normalizedPattern] = strategy
        return acc
    }, /** @type {Record<string, ScrollStrategy>} */ ({}))
}

/** @param {unknown} value @returns {Record<string, string>} */
const normalizePerURLPatternSelector = (value) => {
    if (!isRecord(value)) return {}

    return Object.entries(value).reduce((acc, [pattern, selector]) => {
        const normalizedPattern = normalizeURLPattern(pattern)
        if (!normalizedPattern || typeof selector !== 'string') return acc

        const normalizedSelector = selector.trim()
        if (!normalizedSelector) return acc

        acc[normalizedPattern] = normalizedSelector
        return acc
    }, /** @type {Record<string, string>} */ ({}))
}

/** @param {unknown} value @returns {ScrollStrategySettings} */
export const normalizeScrollStrategySettings = (value) => {
    if (!isRecord(value)) {
        return {
            ...defaultScrollStrategySettings,
            perURLPatternStrategy: {},
            perHostStrategy: {},
        }
    }

    const perURLPatternStrategy = {
        ...normalizePerURLPatternStrategy(value.perHostStrategy),
        ...normalizePerURLPatternStrategy(value.perURLPatternStrategy),
    }

    return {
        globalStrategy: isScrollStrategy(value.globalStrategy)
            ? value.globalStrategy
            : defaultScrollStrategySettings.globalStrategy,
        perURLPatternStrategy,
        perHostStrategy: perURLPatternStrategy,
    }
}

/** @param {string} pagePattern @param {string} rulePattern @returns {boolean} */
const matchesURLPattern = (pagePattern, rulePattern) => {
    if (pagePattern === rulePattern) return true
    return pagePattern.startsWith(rulePattern.endsWith('/') ? rulePattern : `${rulePattern}/`)
}

/**
 * @param {string[]} patterns
 * @param {string | URL} urlOrPattern
 * @returns {string | null}
 */
const resolveURLPattern = (patterns, urlOrPattern) => {
    const normalizedPattern = normalizeURLPattern(String(urlOrPattern))
    if (!normalizedPattern) return null

    const [matchedPattern] = patterns
        .filter((pattern) => matchesURLPattern(normalizedPattern, pattern))
        .sort((left, right) => right.length - left.length)

    return matchedPattern || null
}

/** @param {ScrollStrategySettings} settings @param {string | URL} urlOrPattern @returns {ScrollStrategy} */
export const resolveScrollStrategy = (settings, urlOrPattern) => {
    const matchedPattern = resolveURLPattern(
        Object.keys(settings.perURLPatternStrategy),
        urlOrPattern
    )

    if (
        matchedPattern &&
        hasOwnProperty.call(settings.perURLPatternStrategy, matchedPattern)
    ) {
        return settings.perURLPatternStrategy[matchedPattern]
    }

    return settings.globalStrategy
}

/** @param {unknown} value @returns {ScrollContainerSettings} */
export const normalizeScrollContainerSettings = (value) => {
    if (!isRecord(value)) {
        return {
            ...defaultScrollContainerSettings,
            perURLPatternSelector: {},
        }
    }

    return {
        perURLPatternSelector: normalizePerURLPatternSelector(
            value.perURLPatternSelector
        ),
    }
}

/** @param {ScrollContainerSettings} settings @param {string | URL} urlOrPattern @returns {string | null} */
export const resolveScrollContainerSelector = (settings, urlOrPattern) => {
    const matchedPattern = resolveURLPattern(
        Object.keys(settings.perURLPatternSelector),
        urlOrPattern
    )

    if (
        matchedPattern &&
        hasOwnProperty.call(settings.perURLPatternSelector, matchedPattern)
    ) {
        return settings.perURLPatternSelector[matchedPattern]
    }

    return null
}

/**
 * @param {ScrollStrategySettings} settings
 * @param {ScrollStrategy} strategy
 * @returns {ScrollStrategySettings}
 */
export const setGlobalScrollStrategy = (settings, strategy) => ({
    globalStrategy: strategy,
    perURLPatternStrategy: Object.entries(settings.perURLPatternStrategy).reduce(
        (nextPerURLPatternStrategy, [pattern, patternStrategy]) => {
            if (patternStrategy !== strategy) {
                nextPerURLPatternStrategy[pattern] = patternStrategy
            }

            return nextPerURLPatternStrategy
        },
        /** @type {Record<string, ScrollStrategy>} */ ({})
    ),
    perHostStrategy: Object.entries(settings.perURLPatternStrategy).reduce(
        (nextPerHostStrategy, [pattern, patternStrategy]) => {
            if (patternStrategy !== strategy) {
                nextPerHostStrategy[pattern] = patternStrategy
            }

            return nextPerHostStrategy
        },
        /** @type {Record<string, ScrollStrategy>} */ ({})
    ),
})

/**
 * @param {ScrollStrategySettings} settings
 * @param {string} pattern
 * @param {ScrollStrategy} strategy
 * @returns {ScrollStrategySettings}
 */
export const setURLPatternScrollStrategy = (settings, pattern, strategy) => {
    const normalizedPattern = normalizeURLPattern(pattern)
    if (!normalizedPattern) return settings

    const nextPerURLPatternStrategy = {...settings.perURLPatternStrategy}

    if (strategy === settings.globalStrategy) {
        delete nextPerURLPatternStrategy[normalizedPattern]
    } else {
        nextPerURLPatternStrategy[normalizedPattern] = strategy
    }

    return {
        ...settings,
        perURLPatternStrategy: nextPerURLPatternStrategy,
        perHostStrategy: nextPerURLPatternStrategy,
    }
}

/**
 * @param {ScrollStrategySettings} settings
 * @param {string} pattern
 * @returns {ScrollStrategySettings}
 */
export const removeURLPatternScrollStrategy = (settings, pattern) => {
    const normalizedPattern = normalizeURLPattern(pattern)

    if (
        !normalizedPattern ||
        !hasOwnProperty.call(settings.perURLPatternStrategy, normalizedPattern)
    ) {
        return settings
    }

    const nextPerURLPatternStrategy = {...settings.perURLPatternStrategy}
    delete nextPerURLPatternStrategy[normalizedPattern]

    return {
        ...settings,
        perURLPatternStrategy: nextPerURLPatternStrategy,
        perHostStrategy: nextPerURLPatternStrategy,
    }
}

export const setHostnameScrollStrategy = setURLPatternScrollStrategy
export const removeHostnameScrollStrategy = removeURLPatternScrollStrategy

/**
 * @param {ScrollContainerSettings} settings
 * @param {string} pattern
 * @param {string} selector
 * @returns {ScrollContainerSettings}
 */
export const setURLPatternScrollContainerSelector = (
    settings,
    pattern,
    selector
) => {
    const normalizedPattern = normalizeURLPattern(pattern)
    const normalizedSelector = selector.trim()
    if (!normalizedPattern || !normalizedSelector) return settings

    return {
        ...settings,
        perURLPatternSelector: {
            ...settings.perURLPatternSelector,
            [normalizedPattern]: normalizedSelector,
        },
    }
}

/**
 * @param {ScrollContainerSettings} settings
 * @param {string} pattern
 * @returns {ScrollContainerSettings}
 */
export const removeURLPatternScrollContainerSelector = (settings, pattern) => {
    const normalizedPattern = normalizeURLPattern(pattern)

    if (
        !normalizedPattern ||
        !hasOwnProperty.call(settings.perURLPatternSelector, normalizedPattern)
    ) {
        return settings
    }

    const nextPerURLPatternSelector = {...settings.perURLPatternSelector}
    delete nextPerURLPatternSelector[normalizedPattern]

    return {
        ...settings,
        perURLPatternSelector: nextPerURLPatternSelector,
    }
}

/** @returns {Promise<ScrollStrategySettings>} */
export const getScrollStrategySettings = async () => {
    const result = await chrome.storage.local.get(SCROLL_STRATEGY_SETTINGS_KEY)
    return normalizeScrollStrategySettings(result[SCROLL_STRATEGY_SETTINGS_KEY])
}

/** @param {ScrollStrategySettings} settings @returns {Promise<void>} */
export const setScrollStrategySettings = async (settings) => {
    await chrome.storage.local.set({
        [SCROLL_STRATEGY_SETTINGS_KEY]: normalizeScrollStrategySettings(settings),
    })
}

/** @returns {Promise<ScrollContainerSettings>} */
export const getScrollContainerSettings = async () => {
    const result = await chrome.storage.local.get(SCROLL_CONTAINER_SETTINGS_KEY)
    return normalizeScrollContainerSettings(result[SCROLL_CONTAINER_SETTINGS_KEY])
}

/** @param {ScrollContainerSettings} settings @returns {Promise<void>} */
export const setScrollContainerSettings = async (settings) => {
    await chrome.storage.local.set({
        [SCROLL_CONTAINER_SETTINGS_KEY]: normalizeScrollContainerSettings(settings),
    })
}
