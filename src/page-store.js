// @ts-check

import {createStoredPageIdentity, normalizePageURL} from './page-identity.js'
import {subscribeToStorageKey} from './storage.js'

/** @typedef {import('./page-identity.js').PageIdentity} PageIdentity */

/**
 * @typedef {object} ScrollDetails
 * @property {string} uuid
 * @property {number} scrollPosition
 * @property {number} viewportHeight
 * @property {number} contentHeight
 * @property {string} dateISO
 * @property {string} name
 * @property {string} note
 */

/**
 * @typedef {object} PageData
 * @property {ScrollDetails[]} scrolls
 * @property {string | null} title
 * @property {string | null} pageURL
 */

/**
 * @typedef {object} PageRecord
 * @property {PageIdentity} identity
 * @property {PageData} pageData
 */

/** @typedef {Record<string, PageRecord>} PageRecordByStorageKey */

const {entries, fromEntries} = Object

/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isRecord = (value) =>
    Boolean(value && typeof value === 'object' && !Array.isArray(value))

/** @param {unknown} value @returns {value is PageData} */
export const isPageData = (value) =>
    Boolean(
        value &&
            typeof value === 'object' &&
            Array.isArray(/** @type {{scrolls?: unknown}} */ (value).scrolls)
    )

/** @returns {PageData} */
export const createEmptyPageData = () => ({
    scrolls: [],
    title: null,
    pageURL: null,
})

/**
 * @param {unknown} value
 * @param {PageIdentity | null} [pageIdentity]
 * @returns {PageData}
 */
export const normalizePageData = (value, pageIdentity = null) => {
    if (!isRecord(value) || !Array.isArray(value.scrolls)) {
        return {
            ...createEmptyPageData(),
            pageURL: pageIdentity?.pageURL || null,
        }
    }

    return {
        scrolls: value.scrolls,
        title: typeof value.title === 'string' ? value.title : null,
        pageURL: normalizePageURL(value.pageURL) || pageIdentity?.pageURL || null,
    }
}

/**
 * @param {string} storageKey
 * @param {unknown} value
 * @returns {PageRecord}
 */
const createPageRecord = (storageKey, value) => {
    const pageData = normalizePageData(value)

    return {
        identity: createStoredPageIdentity(storageKey, pageData.pageURL),
        pageData,
    }
}

/** @param {PageIdentity} pageIdentity @returns {Promise<PageData>} */
export const getPageData = async (pageIdentity) => {
    const stored = await chrome.storage.local.get(pageIdentity.storageKey)
    return normalizePageData(stored[pageIdentity.storageKey], pageIdentity)
}

/**
 * @param {PageIdentity} pageIdentity
 * @param {PageData} pageData
 * @returns {Promise<PageData>}
 */
export const setPageData = async (pageIdentity, pageData) => {
    const normalizedPageData = normalizePageData(pageData, pageIdentity)

    await chrome.storage.local.set({
        [pageIdentity.storageKey]: normalizedPageData,
    })

    return normalizedPageData
}

/** @param {PageIdentity} pageIdentity @returns {Promise<void>} */
export const removePageData = async (pageIdentity) => {
    await chrome.storage.local.remove([pageIdentity.storageKey])
}

/** @returns {Promise<PageRecordByStorageKey>} */
export const getAllPageRecords = async () => {
    const storageData = /** @type {Record<string, unknown>} */ (
        await chrome.storage.local.get()
    )

    return fromEntries(
        entries(storageData)
            .filter(([, value]) => isPageData(value))
            .map(([storageKey, value]) => [storageKey, createPageRecord(storageKey, value)])
    )
}

/**
 * @param {PageRecordByStorageKey} currentRecords
 * @param {{[key: string]: chrome.storage.StorageChange}} changes
 * @returns {PageRecordByStorageKey}
 */
export const applyPageRecordChanges = (currentRecords, changes) => {
    const nextRecords = {...currentRecords}
    let hasChanged = false

    for (const [storageKey, {oldValue, newValue}] of entries(changes)) {
        const hadPageData = isPageData(oldValue)
        const hasPageData = isPageData(newValue)

        if (!hadPageData && !hasPageData) continue

        if (!hasPageData) {
            if (storageKey in nextRecords) {
                delete nextRecords[storageKey]
                hasChanged = true
            }
            continue
        }

        nextRecords[storageKey] = createPageRecord(storageKey, newValue)
        hasChanged = true
    }

    return hasChanged ? nextRecords : currentRecords
}

/**
 * @param {PageIdentity} pageIdentity
 * @param {(pageData: PageData) => void} onChange
 * @returns {() => void}
 */
export const subscribeToPageData = (pageIdentity, onChange) => {
    return subscribeToStorageKey(pageIdentity.storageKey, (change) => {
        onChange(normalizePageData(change.newValue, pageIdentity))
    })
}
