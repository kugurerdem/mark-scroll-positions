const MAX_BADGE_COUNT = 9
const BADGE_COLOR = '#3e72b7'

const isPageDataLike = (value) =>
    Boolean(
        value &&
            typeof value === 'object' &&
            Array.isArray(value.scrolls)
    )

const toStorageKey = (urlString) => {
    if (!urlString) return null

    try {
        const url = new URL(urlString)
        if (!['http:', 'https:'].includes(url.protocol)) return null
        return url.hostname.concat(url.pathname)
    } catch {
        return null
    }
}

const setBadge = async (tabId, markCount) => {
    if (!Number.isInteger(tabId)) return

    if (!Number.isFinite(markCount) || markCount <= 0) {
        await chrome.action.setBadgeText({tabId, text: ''})
        return
    }

    const badgeText =
        markCount > MAX_BADGE_COUNT
            ? `${MAX_BADGE_COUNT}+`
            : String(markCount)

    await chrome.action.setBadgeBackgroundColor({tabId, color: BADGE_COLOR})
    await chrome.action.setBadgeText({tabId, text: badgeText})
}

const updateBadgeForTab = async (tabId, urlString) => {
    const storageKey = toStorageKey(urlString)
    if (!storageKey) {
        await setBadge(tabId, 0)
        return
    }

    const stored = await chrome.storage.local.get(storageKey)
    const pageData = stored[storageKey]
    const markCount = isPageDataLike(pageData) ? pageData.scrolls.length : 0

    await setBadge(tabId, markCount)
}

const refreshActiveTabBadge = async () => {
    const [activeTab] = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true,
    })

    if (!activeTab?.id) return
    await updateBadgeForTab(activeTab.id, activeTab.url)
}

chrome.runtime.onInstalled.addListener(() => {
    void refreshActiveTabBadge()
})

chrome.runtime.onStartup.addListener(() => {
    void refreshActiveTabBadge()
})

chrome.tabs.onActivated.addListener(({tabId}) => {
    void chrome.tabs
        .get(tabId)
        .then((tab) => updateBadgeForTab(tabId, tab.url))
        .catch(() => setBadge(tabId, false))
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (!changeInfo.url && changeInfo.status !== 'complete') return

    void updateBadgeForTab(tabId, changeInfo.url || tab.url)
})

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return

    const markDataChanged = Object.values(changes).some(
        ({oldValue, newValue}) =>
            isPageDataLike(oldValue) || isPageDataLike(newValue)
    )

    if (!markDataChanged) return
    void refreshActiveTabBadge()
})
