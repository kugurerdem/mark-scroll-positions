export type ThemeMode = 'light' | 'dark'
export type ThemePreference = ThemeMode | 'system'

const THEME_PREFERENCE_KEY = 'themePreference'
const prefersDarkThemeMediaQuery = '(prefers-color-scheme: dark)'
const systemThemeQuery = window.matchMedia(prefersDarkThemeMediaQuery)

let currentPreference: ThemePreference = 'system'
let listenersAttached = false

const isThemePreference = (value: unknown): value is ThemePreference =>
    value === 'light' || value === 'dark' || value === 'system'

const readThemePreference = async (): Promise<ThemePreference> => {
    try {
        const result = await chrome.storage.local.get(THEME_PREFERENCE_KEY)
        const preference = result[THEME_PREFERENCE_KEY]
        return isThemePreference(preference) ? preference : 'system'
    } catch {
        return 'system'
    }
}

export const getThemePreference = (): Promise<ThemePreference> =>
    readThemePreference()

const readBrowserSettingsColorScheme = async (): Promise<ThemeMode | null> => {
    const browserSettings = (chrome as unknown as {
        browserSettings?: {
            overrideContentColorScheme?: {
                get?: (details: object) => Promise<{value?: string}>
            }
        }
    }).browserSettings

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

const resolveSystemTheme = async (): Promise<ThemeMode> => {
    const browserSettingsTheme = await readBrowserSettingsColorScheme()

    if (browserSettingsTheme) {
        return browserSettingsTheme
    }

    return systemThemeQuery.matches ? 'dark' : 'light'
}

const resolveTheme = async (preference: ThemePreference): Promise<ThemeMode> => {
    if (preference === 'system') {
        return resolveSystemTheme()
    }

    return preference
}

const applyCurrentTheme = async () => {
    const resolvedTheme = await resolveTheme(currentPreference)
    document.documentElement.dataset.theme = resolvedTheme
}

const handleStoragePreferenceChange = (
    changes: {[key: string]: chrome.storage.StorageChange},
    areaName: string
) => {
    if (areaName !== 'local') return

    const themePreferenceChange = changes[THEME_PREFERENCE_KEY]
    if (!themePreferenceChange) return

    const updatedPreference = themePreferenceChange.newValue
    if (!isThemePreference(updatedPreference)) return

    currentPreference = updatedPreference
    void applyCurrentTheme()
}

export const subscribeThemePreference = (
    onPreferenceChange: (preference: ThemePreference) => void
) => {
    const handlePreferenceChange = (
        changes: {[key: string]: chrome.storage.StorageChange},
        areaName: string
    ) => {
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

export const setThemePreference = async (
    preference: ThemePreference
): Promise<void> => {
    await chrome.storage.local.set({[THEME_PREFERENCE_KEY]: preference})
    currentPreference = preference
    await applyCurrentTheme()
}

export const initializeTheme = async (): Promise<void> => {
    try {
        currentPreference = await readThemePreference()
        await applyCurrentTheme()
        attachThemeListeners()
    } finally {
        document.documentElement.dataset.themeReady = 'true'
    }
}
