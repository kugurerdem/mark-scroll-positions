// @ts-check

import {buildPageStorageKey, resolveQueryIdentityMode} from './url-identity.js'

/** @typedef {import('./url-identity.js').QueryIdentitySettings} QueryIdentitySettings */

/**
 * @typedef {object} PageIdentity
 * @property {string} storageKey
 * @property {string | null} pageURL
 */

const LEGACY_PAGE_URL_PROTOCOL = 'http://'

/** @param {unknown} value @returns {string | null} */
export const normalizePageURL = (value) => {
    if (typeof value !== 'string') return null

    try {
        const parsedURL = new URL(value)
        if (!['http:', 'https:'].includes(parsedURL.protocol)) return null

        parsedURL.hash = ''
        return parsedURL.origin.concat(parsedURL.pathname, parsedURL.search)
    } catch {
        return null
    }
}

/** @param {URL} url @returns {string} */
const buildPageURL = (url) => {
    const normalizedURL = new URL(url.href)
    normalizedURL.hash = ''
    return normalizedURL.origin.concat(normalizedURL.pathname, normalizedURL.search)
}

/**
 * @param {URL} url
 * @param {QueryIdentitySettings} queryIdentitySettings
 * @returns {PageIdentity}
 */
export const createPageIdentity = (url, queryIdentitySettings) => {
    const queryIdentityMode = resolveQueryIdentityMode(queryIdentitySettings, url.hostname)

    return {
        storageKey: buildPageStorageKey(url, queryIdentityMode),
        pageURL: buildPageURL(url),
    }
}

/**
 * @param {string} storageKey
 * @param {unknown} pageURL
 * @returns {PageIdentity}
 */
export const createStoredPageIdentity = (storageKey, pageURL) => ({
    storageKey,
    pageURL: normalizePageURL(pageURL),
})

/** @param {PageIdentity} pageIdentity @returns {string} */
export const getNavigablePageURL = (pageIdentity) =>
    pageIdentity.pageURL || LEGACY_PAGE_URL_PROTOCOL.concat(pageIdentity.storageKey)
