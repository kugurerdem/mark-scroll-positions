// @ts-check

/**
 * @param {(changes: {[key: string]: chrome.storage.StorageChange}) => void} onChange
 * @returns {() => void}
 */
export const subscribeToLocalStorageChanges = (onChange) => {
    /** @param {{[key: string]: chrome.storage.StorageChange}} changes @param {string} areaName */
    const handleStorageChange = (changes, areaName) => {
        if (areaName !== 'local') return
        onChange(changes)
    }

    chrome.storage.onChanged.addListener(handleStorageChange)

    return () => {
        chrome.storage.onChanged.removeListener(handleStorageChange)
    }
}

/**
 * @template T
 * @param {string} key
 * @param {(change: chrome.storage.StorageChange) => T} onChange
 * @returns {() => void}
 */
export const subscribeToStorageKey = (key, onChange) =>
    subscribeToLocalStorageChanges((changes) => {
        const change = changes[key]
        if (change) {
            onChange(change)
        }
    })
