// @ts-check

import {useEffect, useState} from './ui.js'
import {
    createEmptyPageData,
    getPageData as getStoredPageData,
    setPageData as setStoredPageData,
    subscribeToPageData,
} from './page-store.js'

/** @typedef {import('./page-store.js').ScrollDetails} ScrollDetails */
/** @typedef {import('./page-store.js').PageData} PageData */
/** @typedef {import('./page-identity.js').PageIdentity} PageIdentity */
/** @typedef {(data: PageData) => Promise<void>} SetPageData */
/** @typedef {(uuid: string, patch: Partial<ScrollDetails>) => Promise<void>} PatchScroll */

/** @param {PageIdentity} pageIdentity @returns {[PageData, SetPageData, PatchScroll]} */
export const usePageDataState = (pageIdentity) => {
    const [pageData, setPageData] = useState(createEmptyPageData())

    /** @param {PageData} nextPageData @returns {Promise<void>} */
    const persistPageData = async (nextPageData) => {
        setPageData(await setStoredPageData(pageIdentity, nextPageData))
    }

    /** @param {string} uuid @param {Partial<ScrollDetails>} patch @returns {Promise<void>} */
    const patchScroll = async (uuid, patch) => {
        await persistPageData({
            ...pageData,
            scrolls: pageData.scrolls.map(
                /** @param {ScrollDetails} scroll */
                (scroll) =>
                scroll.uuid === uuid ? {...scroll, ...patch} : scroll
            ),
        })
    }

    useEffect(() => {
        let isMounted = true

        void getStoredPageData(pageIdentity).then((nextPageData) => {
            if (isMounted) {
                setPageData(nextPageData)
            }
        })

        const unsubscribe = subscribeToPageData(pageIdentity, (nextPageData) => {
            if (isMounted) {
                setPageData(nextPageData)
            }
        })

        return () => {
            isMounted = false
            unsubscribe()
        }
    }, [pageIdentity.pageURL, pageIdentity.storageKey])

    return [pageData, persistPageData, patchScroll]
}
