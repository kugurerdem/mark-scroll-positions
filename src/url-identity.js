// @ts-check

/** @typedef {import('./types.js').QueryIdentityMode} QueryIdentityMode */
/** @typedef {import('./types.js').QueryIdentitySettings} QueryIdentitySettings */

export const QUERY_IDENTITY_SETTINGS_KEY = 'queryIdentitySettings'

const hasOwnProperty = Object.prototype.hasOwnProperty

/** @type {QueryIdentitySettings} */
const defaultQueryIdentitySettings = {
    globalMode: 'ignore',
    perHostMode: {},
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isRecord = (value) =>
    Boolean(value && typeof value === 'object' && !Array.isArray(value))

/** @param {unknown} value @returns {value is QueryIdentityMode} */
export const isQueryIdentityMode = (value) =>
    value === 'ignore' || value === 'include'

/** @param {unknown} value @returns {Record<string, QueryIdentityMode>} */
const normalizePerHostMode = (value) => {
    if (!isRecord(value)) return {}

    return Object.entries(value).reduce((acc, [hostname, mode]) => {
        const normalizedHostname = hostname.trim().toLowerCase()
        if (!normalizedHostname || !isQueryIdentityMode(mode)) return acc

        acc[normalizedHostname] = mode
        return acc
    }, /** @type {Record<string, QueryIdentityMode>} */ ({}))
}

/** @param {unknown} value @returns {QueryIdentitySettings} */
export const normalizeQueryIdentitySettings = (value) => {
    if (!isRecord(value)) {
        return {
            ...defaultQueryIdentitySettings,
            perHostMode: {},
        }
    }

    const globalMode = isQueryIdentityMode(value.globalMode)
        ? value.globalMode
        : defaultQueryIdentitySettings.globalMode

    const perHostMode = normalizePerHostMode(value.perHostMode)

    return {
        globalMode,
        perHostMode,
    }
}

/** @param {URLSearchParams} searchParams @returns {string} */
const buildCanonicalSearch = (searchParams) => {
    const sortedEntries = [...searchParams.entries()].sort(
        ([leftKey, leftValue], [rightKey, rightValue]) => {
            const keyComparison = leftKey.localeCompare(rightKey)
            if (keyComparison !== 0) return keyComparison

            return leftValue.localeCompare(rightValue)
        }
    )

    const normalizedSearchParams = new URLSearchParams()

    for (const [key, value] of sortedEntries) {
        normalizedSearchParams.append(key, value)
    }

    const normalizedSearch = normalizedSearchParams.toString()
    return normalizedSearch ? `?${normalizedSearch}` : ''
}

/** @param {QueryIdentitySettings} settings @param {string} hostname @returns {QueryIdentityMode} */
export const resolveQueryIdentityMode = (settings, hostname) => {
    const normalizedHostname = hostname.trim().toLowerCase()

    if (normalizedHostname && hasOwnProperty.call(settings.perHostMode, normalizedHostname)) {
        return settings.perHostMode[normalizedHostname]
    }

    return settings.globalMode
}

/** @param {URL} url @param {QueryIdentityMode} mode @returns {string} */
export const buildPageStorageKey = (url, mode) => {
    const baseURL = url.hostname.concat(url.pathname)

    if (mode === 'ignore') return baseURL

    const canonicalSearch = buildCanonicalSearch(url.searchParams)
    return canonicalSearch ? baseURL.concat(canonicalSearch) : baseURL
}

/** @param {URL} url @param {QueryIdentitySettings} settings @returns {string} */
export const resolvePageStorageKey = (url, settings) => {
    const mode = resolveQueryIdentityMode(settings, url.hostname)
    return buildPageStorageKey(url, mode)
}

/** @returns {Promise<QueryIdentitySettings>} */
export const getQueryIdentitySettings = async () => {
    const result = await chrome.storage.local.get(QUERY_IDENTITY_SETTINGS_KEY)
    return normalizeQueryIdentitySettings(result[QUERY_IDENTITY_SETTINGS_KEY])
}

/** @param {QueryIdentitySettings} settings @returns {Promise<void>} */
export const setQueryIdentitySettings = async (settings) => {
    await chrome.storage.local.set({
        [QUERY_IDENTITY_SETTINGS_KEY]: normalizeQueryIdentitySettings(settings),
    })
}
