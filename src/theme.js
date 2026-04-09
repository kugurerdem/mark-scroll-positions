// @ts-check

/** @typedef {'light' | 'dark'} ThemeMode */
/** @typedef {ThemeMode | 'system'} ThemePreference */

const THEME_PREFERENCE_KEY = 'themePreference'
const prefersDarkThemeMediaQuery = '(prefers-color-scheme: dark)'
const systemThemeQuery = window.matchMedia(prefersDarkThemeMediaQuery)

/** @type {ThemePreference} */
let currentPreference = 'system'
let listenersAttached = false

/** @param {unknown} value @returns {value is ThemePreference} */
const isThemePreference = (value) =>
    value === 'light' || value === 'dark' || value === 'system'

/** @returns {Promise<ThemePreference>} */
const readThemePreference = async () => {
    try {
        const result = await chrome.storage.local.get(THEME_PREFERENCE_KEY)
        const preference = result[THEME_PREFERENCE_KEY]
        return isThemePreference(preference) ? preference : 'system'
    } catch {
        return 'system'
    }
}

/** @returns {Promise<ThemePreference>} */
export const getThemePreference = () =>
    readThemePreference()

/** @returns {Promise<ThemeMode | null>} */
const readBrowserSettingsColorScheme = async () => {
    const browserSettings = /** @type {{
        browserSettings?: {
            overrideContentColorScheme?: {
                get?: (details: object) => Promise<{value?: string}>
            }
        }
    }} */ (chrome).browserSettings

    const getColorScheme = browserSettings
        ?.overrideContentColorScheme
        ?.get

    if (!getColorScheme) return null

    try {
        const {value} = await getColorScheme({})

        if (value === 'light' || value === 'dark') {
            return value
        }

        return null
    } catch {
        return null
    }
}

/** @returns {Promise<ThemeMode>} */
const resolveSystemTheme = async () => {
    const browserSettingsTheme = await readBrowserSettingsColorScheme()

    if (browserSettingsTheme) {
        return browserSettingsTheme
    }

    return systemThemeQuery.matches ? 'dark' : 'light'
}

/** @param {ThemePreference} preference @returns {Promise<ThemeMode>} */
const resolveTheme = async (preference) => {
    if (preference === 'system') {
        return resolveSystemTheme()
    }

    return preference
}

const applyCurrentTheme = async () => {
    const resolvedTheme = await resolveTheme(currentPreference)
    document.documentElement.dataset.theme = resolvedTheme
}

/** @param {{[key: string]: chrome.storage.StorageChange}} changes @param {string} areaName */
const handleStoragePreferenceChange = (changes, areaName) => {
    if (areaName !== 'local') return

    const themePreferenceChange = changes[THEME_PREFERENCE_KEY]
    if (!themePreferenceChange) return

    const updatedPreference = themePreferenceChange.newValue
    if (!isThemePreference(updatedPreference)) return

    currentPreference = updatedPreference
    void applyCurrentTheme()
}

/** @param {(preference: ThemePreference) => void} onPreferenceChange */
export const subscribeThemePreference = (onPreferenceChange) => {
    /** @param {{[key: string]: chrome.storage.StorageChange}} changes @param {string} areaName */
    const handlePreferenceChange = (changes, areaName) => {
        if (areaName !== 'local') return

        const themePreferenceChange = changes[THEME_PREFERENCE_KEY]
        if (!themePreferenceChange) return

        const updatedPreference = themePreferenceChange.newValue
        if (!isThemePreference(updatedPreference)) return

        onPreferenceChange(updatedPreference)
    }

    chrome.storage.onChanged.addListener(handlePreferenceChange)

    return () => {
        chrome.storage.onChanged.removeListener(handlePreferenceChange)
    }
}

const handleSystemThemeChange = () => {
    if (currentPreference !== 'system') return
    void applyCurrentTheme()
}

const attachThemeListeners = () => {
    if (listenersAttached) return

    chrome.storage.onChanged.addListener(handleStoragePreferenceChange)

    if (typeof systemThemeQuery.addEventListener === 'function') {
        systemThemeQuery.addEventListener('change', handleSystemThemeChange)
    } else {
        systemThemeQuery.addListener(handleSystemThemeChange)
    }

    listenersAttached = true
}

/** @param {ThemePreference} preference @returns {Promise<void>} */
export const setThemePreference = async (preference) => {
    await chrome.storage.local.set({[THEME_PREFERENCE_KEY]: preference})
    currentPreference = preference
    await applyCurrentTheme()
}

/** @returns {Promise<void>} */
export const initializeTheme = async () => {
    try {
        currentPreference = await readThemePreference()
        await applyCurrentTheme()
        attachThemeListeners()
    } finally {
        document.documentElement.dataset.themeReady = 'true'
    }
}
