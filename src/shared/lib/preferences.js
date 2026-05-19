// @ts-check

/** @typedef {'top' | 'bottom'} ScrollInsertPosition */
/** @typedef {'page-ratio' | 'viewport-ratio'} ScrollStrategy */

/**
 * @typedef {object} ScrollStrategySettings
 * @property {ScrollStrategy} globalStrategy
 * @property {Record<string, ScrollStrategy>} perHostStrategy
 */

export const MARK_INSERT_POSITION_KEY = 'markInsertPosition'
export const SCROLL_STRATEGY_SETTINGS_KEY = 'scrollStrategySettings'

const hasOwnProperty = Object.prototype.hasOwnProperty

/** @type {ScrollStrategySettings} */
export const defaultScrollStrategySettings = {
    globalStrategy: 'page-ratio',
    perHostStrategy: {},
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

/** @param {string} hostname @returns {string | null} */
const normalizeHostname = (hostname) => {
    const normalizedHostname = hostname.trim().toLowerCase()
    return normalizedHostname || null
}

/** @param {unknown} value @returns {Record<string, ScrollStrategy>} */
const normalizePerHostStrategy = (value) => {
    if (!isRecord(value)) return {}

    return Object.entries(value).reduce((acc, [hostname, strategy]) => {
        const normalizedHostname = normalizeHostname(hostname)
        if (!normalizedHostname || !isScrollStrategy(strategy)) return acc

        acc[normalizedHostname] = strategy
        return acc
    }, /** @type {Record<string, ScrollStrategy>} */ ({}))
}

/** @param {unknown} value @returns {ScrollStrategySettings} */
export const normalizeScrollStrategySettings = (value) => {
    if (!isRecord(value)) {
        return {
            ...defaultScrollStrategySettings,
            perHostStrategy: {},
        }
    }

    return {
        globalStrategy: isScrollStrategy(value.globalStrategy)
            ? value.globalStrategy
            : defaultScrollStrategySettings.globalStrategy,
        perHostStrategy: normalizePerHostStrategy(value.perHostStrategy),
    }
}

/** @param {ScrollStrategySettings} settings @param {string} hostname @returns {ScrollStrategy} */
export const resolveScrollStrategy = (settings, hostname) => {
    const normalizedHostname = normalizeHostname(hostname)

    if (
        normalizedHostname &&
        hasOwnProperty.call(settings.perHostStrategy, normalizedHostname)
    ) {
        return settings.perHostStrategy[normalizedHostname]
    }

    return settings.globalStrategy
}

/**
 * @param {ScrollStrategySettings} settings
 * @param {ScrollStrategy} strategy
 * @returns {ScrollStrategySettings}
 */
export const setGlobalScrollStrategy = (settings, strategy) => ({
    globalStrategy: strategy,
    perHostStrategy: Object.entries(settings.perHostStrategy).reduce(
        (nextPerHostStrategy, [hostname, hostStrategy]) => {
            if (hostStrategy !== strategy) {
                nextPerHostStrategy[hostname] = hostStrategy
            }

            return nextPerHostStrategy
        },
        /** @type {Record<string, ScrollStrategy>} */ ({})
    ),
})

/**
 * @param {ScrollStrategySettings} settings
 * @param {string} hostname
 * @param {ScrollStrategy} strategy
 * @returns {ScrollStrategySettings}
 */
export const setHostnameScrollStrategy = (settings, hostname, strategy) => {
    const normalizedHostname = normalizeHostname(hostname)
    if (!normalizedHostname) return settings

    const nextPerHostStrategy = {...settings.perHostStrategy}

    if (strategy === settings.globalStrategy) {
        delete nextPerHostStrategy[normalizedHostname]
    } else {
        nextPerHostStrategy[normalizedHostname] = strategy
    }

    return {
        ...settings,
        perHostStrategy: nextPerHostStrategy,
    }
}

/**
 * @param {ScrollStrategySettings} settings
 * @param {string} hostname
 * @returns {ScrollStrategySettings}
 */
export const removeHostnameScrollStrategy = (settings, hostname) => {
    const normalizedHostname = normalizeHostname(hostname)

    if (
        !normalizedHostname ||
        !hasOwnProperty.call(settings.perHostStrategy, normalizedHostname)
    ) {
        return settings
    }

    const nextPerHostStrategy = {...settings.perHostStrategy}
    delete nextPerHostStrategy[normalizedHostname]

    return {
        ...settings,
        perHostStrategy: nextPerHostStrategy,
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
