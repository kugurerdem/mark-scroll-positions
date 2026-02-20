import type {QueryIdentityMode, QueryIdentitySettings} from './types'

export const QUERY_IDENTITY_SETTINGS_KEY = 'queryIdentitySettings'

const hasOwnProperty = Object.prototype.hasOwnProperty

const defaultQueryIdentitySettings: QueryIdentitySettings = {
    globalMode: 'ignore',
    perHostMode: {},
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value && typeof value === 'object' && !Array.isArray(value))

export const isQueryIdentityMode = (value: unknown): value is QueryIdentityMode =>
    value === 'ignore' || value === 'include'

const normalizePerHostMode = (value: unknown): Record<string, QueryIdentityMode> => {
    if (!isRecord(value)) return {}

    return Object.entries(value).reduce<Record<string, QueryIdentityMode>>((acc, [hostname, mode]) => {
        const normalizedHostname = hostname.trim().toLowerCase()
        if (!normalizedHostname || !isQueryIdentityMode(mode)) return acc

        acc[normalizedHostname] = mode
        return acc
    }, {})
}

export const normalizeQueryIdentitySettings = (value: unknown): QueryIdentitySettings => {
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

const buildCanonicalSearch = (searchParams: URLSearchParams): string => {
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

export const resolveQueryIdentityMode = (
    settings: QueryIdentitySettings,
    hostname: string
): QueryIdentityMode => {
    const normalizedHostname = hostname.trim().toLowerCase()

    if (normalizedHostname && hasOwnProperty.call(settings.perHostMode, normalizedHostname)) {
        return settings.perHostMode[normalizedHostname]
    }

    return settings.globalMode
}

export const buildPageStorageKey = (url: URL, mode: QueryIdentityMode): string => {
    const baseURL = url.hostname.concat(url.pathname)

    if (mode === 'ignore') return baseURL

    const canonicalSearch = buildCanonicalSearch(url.searchParams)
    return canonicalSearch ? baseURL.concat(canonicalSearch) : baseURL
}

export const resolvePageStorageKey = (
    url: URL,
    settings: QueryIdentitySettings
): string => {
    const mode = resolveQueryIdentityMode(settings, url.hostname)
    return buildPageStorageKey(url, mode)
}

export const getQueryIdentitySettings = async (): Promise<QueryIdentitySettings> => {
    const result = await chrome.storage.local.get(QUERY_IDENTITY_SETTINGS_KEY)
    return normalizeQueryIdentitySettings(result[QUERY_IDENTITY_SETTINGS_KEY])
}

export const setQueryIdentitySettings = async (
    settings: QueryIdentitySettings
): Promise<void> => {
    await chrome.storage.local.set({
        [QUERY_IDENTITY_SETTINGS_KEY]: normalizeQueryIdentitySettings(settings),
    })
}
