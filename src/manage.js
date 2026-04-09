// @ts-check

import {html, render, useEffect, useState} from './ui.js'
import {getAppRoot} from './app-root.js'
import {GenericScroll, SortableScrollList, usePageDataState} from './common.js'
import {Icon} from './icons.js'
import {initializeTheme} from './theme.js'

/** @typedef {import('./types.js').PageData} PageData */
/** @typedef {import('./types.js').PageDetailsByURL} PageDetailsByURL */
/** @typedef {import('./types.js').ScrollDetails} ScrollDetails */

/** @typedef {[string, PageData]} PageEntry */
/** @typedef {(current: PageDetailsByURL | ((current: PageDetailsByURL) => PageDetailsByURL)) => void} SetPagesByURL */

const {entries} = Object
const allOrigins = ['<all_urls>']
const middot = String.fromCharCode(183)

/** @param {string} iso @returns {number} */
const parseTimestamp = (iso) => {
    const timestamp = new Date(iso).getTime()
    return Number.isFinite(timestamp) ? timestamp : 0
}

/** @param {PageData} pageData @returns {number} */
const latestUpdateTimestamp = ({scrolls}) =>
    scrolls.reduce((latest, scroll) => {
        const timestamp = parseTimestamp(scroll.dateISO)
        return timestamp > latest ? timestamp : latest
    }, 0)

/** @param {PageEntry} left @param {PageEntry} right @returns {number} */
const comparePagesByNewestUpdate = (
    [leftURL, leftDetails],
    [rightURL, rightDetails]
) => {
    const byNewestUpdate =
        latestUpdateTimestamp(rightDetails) - latestUpdateTimestamp(leftDetails)

    if (byNewestUpdate !== 0) return byNewestUpdate
    return leftURL.localeCompare(rightURL)
}

/** @param {unknown} value @returns {value is PageData} */
const isPageData = (value) => {
    if (!value || typeof value !== 'object') return false
    return Array.isArray(/** @type {{scrolls?: unknown}} */ (value).scrolls)
}

/** @param {Record<string, unknown>} storageData @returns {PageDetailsByURL} */
const extractPageDetailsByURL = (storageData) =>
    entries(storageData).reduce((accumulator, [key, value]) => {
        if (!isPageData(value)) return accumulator

        accumulator[key] = value
        return accumulator
    }, /** @type {PageDetailsByURL} */ ({}))

const main = async () => {
    await initializeTheme()

    const pageDetailsByURL = extractPageDetailsByURL(
        /** @type {Record<string, unknown>} */ (await chrome.storage.local.get())
    )

    render(html`<${App} pageDetailsByURL=${pageDetailsByURL} />`, getAppRoot())
}

/** @param {{pageDetailsByURL: PageDetailsByURL}} props */
const App = ({pageDetailsByURL}) => {
    const [searchText, setSearchText] = useState(/** @type {string | null} */ (null))
    const [pagesByURL, setPagesByURL] = useState(pageDetailsByURL)
    const [showPermissionPrompt, setShowPermissionPrompt] = useState(false)
    const [pendingJump, setPendingJump] = useState(
        /** @type {{url: string, details: ScrollDetails} | null} */ (null)
    )

    useEffect(() => {
        /** @param {{[key: string]: chrome.storage.StorageChange}} changes @param {string} areaName */
        const onStorageChange = (changes, areaName) => {
            if (areaName !== 'local') return

            /** @param {PageDetailsByURL} current */
            const updatePages = (current) => {
                const next = {...current}
                let hasChanged = false

                for (const [key, {oldValue, newValue}] of entries(changes)) {
                    const hadPageData = isPageData(oldValue)
                    const hasPageData = isPageData(newValue)

                    if (!hadPageData && !hasPageData) continue

                    if (!hasPageData) {
                        if (key in next) {
                            delete next[key]
                            hasChanged = true
                        }
                        continue
                    }

                    next[key] = newValue
                    hasChanged = true
                }

                return hasChanged ? next : current
            }

            setPagesByURL(updatePages)
        }

        chrome.storage.onChanged.addListener(onStorageChange)

        return () => {
            chrome.storage.onChanged.removeListener(onStorageChange)
        }
    }, [])

    const handleEnableAutoJump = async () => {
        const granted = await requestAllSitesPermission()
        if (!granted) return

        setShowPermissionPrompt(false)

        if (!pendingJump) return

        const {url, details} = pendingJump
        setPendingJump(null)
        await jumpToMarkedPosition(url, details)
    }

    /** @param {string} url @param {ScrollDetails} details */
    const handleMissingAutoJumpPermission = (url, details) => {
        setPendingJump({url, details})
        setShowPermissionPrompt(true)
    }

    const filteredEntries = entries(pagesByURL).filter(
        ([url, details]) =>
            !searchText ||
            url.includes(searchText) ||
            details.title?.includes(searchText) ||
            details.scrolls.some(
                /** @param {ScrollDetails} scroll */
                (scroll) =>
                    scroll.note?.includes(searchText) ||
                    scroll.name?.includes(searchText)
            )
    )

    const visibleEntries = [...filteredEntries].sort(comparePagesByNewestUpdate)
    const totalMarks = entries(pagesByURL).reduce(
        (sum, [, details]) => sum + details.scrolls.length,
        0
    )
    const subtitle = `${filteredEntries.length} page${filteredEntries.length !== 1 ? 's' : ''} ${middot} ${totalMarks} mark${totalMarks !== 1 ? 's' : ''} total`

    /** @param {string} url */
    const renderPage = (url) => html`
        <${Page}
            key=${url}
            url=${url}
            setPagesByURL=${setPagesByURL}
            onMissingPermission=${handleMissingAutoJumpPermission}
        />
    `

    return html`
        <div class="manage-page">
            <div class="manage-page__topbar"></div>

            <header class="manage-page__header">
                <div class="manage-page__header-inner">
                    <div class="manage-page__hero">
                        <div class="manage-page__hero-icon">
                            <${Icon}
                                icon="bookBookmark"
                                className="icon icon--lg icon--inverse"
                            />
                        </div>
                        <div>
                            <h1 class="manage-page__title">Your Reading Marks</h1>
                            <p class="manage-page__subtitle">${subtitle}</p>
                        </div>
                    </div>

                    <div class="manage-search">
                        <${Icon}
                            icon="magnifyingGlass"
                            className="manage-search__icon icon icon--sm"
                        />
                        <input
                            type="text"
                            placeholder="Search pages, marks, notes..."
                            onInput=${
                                /** @param {InputEvent & {currentTarget: HTMLInputElement}} event */
                                (event) => {
                                    setSearchText(event.currentTarget.value || null)
                                }
                            }
                            class="manage-search__input"
                        />
                    </div>
                </div>
            </header>

            <main class="manage-page__content animate-fade-in-up">
                ${showPermissionPrompt
                    ? html`
                        <div class="permission-modal">
                            <div class="permission-modal__card">
                                <h3 class="permission-modal__title">
                                    Enable auto-jump permission
                                </h3>
                                <p class="permission-modal__text">
                                    Auto-jump requires all-sites access. If you want to jump directly to saved scroll
                                    positions, enable this permission. If you prefer not to enable it, you can still
                                    open pages normally by clicking their title or URL.
                                </p>
                                <div class="permission-modal__actions">
                                    <button
                                        type="button"
                                        onClick=${() => {
                                            setPendingJump(null)
                                            setShowPermissionPrompt(false)
                                        }}
                                        class="button button--secondary"
                                    >
                                        Hide
                                    </button>
                                    <button
                                        type="button"
                                        onClick=${() => {
                                            void handleEnableAutoJump()
                                        }}
                                        class="button button--primary"
                                    >
                                        Enable
                                    </button>
                                </div>
                            </div>
                        </div>
                    `
                    : null}

                ${filteredEntries.length === 0
                    ? html`
                        <div class="manage-empty-state">
                            <div class="manage-empty-state__icon-wrap">
                                <${Icon}
                                    icon="bookBookmark"
                                    className="icon icon--xl manage-empty-state__icon"
                                />
                            </div>
                            <p class="manage-empty-state__title">
                                ${searchText ? 'No marks match your search' : 'No saved marks yet'}
                            </p>
                            <p class="manage-empty-state__text">
                                ${searchText
                                    ? 'Try a different search term'
                                    : 'Use the extension popup to mark scroll positions'}
                            </p>
                        </div>
                    `
                    : html`
                        <div class="manage-page__list">
                            ${visibleEntries.map(([url]) => renderPage(url))}
                        </div>
                    `}
            </main>
        </div>
    `
}

/** @param {string} iso @returns {string} */
const relativeDate = (iso) => {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 30) return `${days}d ago`
    const months = Math.floor(days / 30)
    return `${months}mo ago`
}

/**
 * @param {{
 *   scrollPosition: number,
 *   viewportHeight: number,
 *   contentHeight: number,
 * }} args
 */
const jumpToScrollPosition = ({
    scrollPosition,
    viewportHeight,
    contentHeight,
}) => {
    const savedScrollableHeight = Math.max(contentHeight - viewportHeight, 0)
    const percentage =
        savedScrollableHeight > 0 ? scrollPosition / savedScrollableHeight : 0

    const normalizedPercentage = Math.min(1, Math.max(0, percentage))

    const currentContentHeight = Math.max(
        document.documentElement?.scrollHeight || 0,
        document.body?.scrollHeight || 0
    )

    const currentScrollableHeight = Math.max(
        currentContentHeight - window.innerHeight,
        0
    )

    const toJumpPositionY = normalizedPercentage * currentScrollableHeight
    window.scrollTo(0, toJumpPositionY)
}

/** @param {number} tabId @returns {Promise<void>} */
const waitForTabToFinishLoading = (tabId) =>
    new Promise((resolve) => {
        /** @param {number} updatedTabId @param {{status?: string}} changeInfo */
        const onUpdated = (updatedTabId, changeInfo) => {
            if (updatedTabId === tabId && changeInfo.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(onUpdated)
                resolve()
            }
        }

        chrome.tabs.onUpdated.addListener(onUpdated)
    })

/** @returns {Promise<boolean>} */
const hasAllSitesPermission = async () => {
    if (!chrome.permissions?.contains) return true
    return chrome.permissions.contains({origins: allOrigins})
}

/** @returns {Promise<boolean>} */
const requestAllSitesPermission = async () => {
    if (!chrome.permissions?.request) return true

    try {
        return await chrome.permissions.request({origins: allOrigins})
    } catch {
        return false
    }
}

/** @param {string} url @param {ScrollDetails} scrollDetails @returns {Promise<boolean>} */
const jumpToMarkedPosition = async (url, scrollDetails) => {
    const tab = await chrome.tabs.create({url: 'http://' + url})
    if (!tab.id) return false

    await waitForTabToFinishLoading(tab.id)

    try {
        await chrome.scripting.executeScript({
            target: {tabId: tab.id},
            func: jumpToScrollPosition,
            args: [scrollDetails],
        })
        return true
    } catch {
        return false
    }
}

/**
 * @typedef {object} PageProps
 * @property {string} url
 * @property {SetPagesByURL} setPagesByURL
 * @property {(url: string, details: ScrollDetails) => void} onMissingPermission
 */

/** @param {PageProps} props */
const Page = ({url, setPagesByURL, onMissingPermission}) => {
    const [pageData, setPageData, patchScroll] = usePageDataState(url)
    const [expand, setExpand] = useState(false)
    const [jumpError, setJumpError] = useState(/** @type {string | null} */ (null))
    const href = `http://${url}`

    /** @param {ScrollDetails} details */
    const renderScrollItem = (details) => html`
        <${GenericScroll}
            scrollDetails=${details}
            onJump=${() => {
                void handleJump(details)
            }}
            patchScroll=${patchScroll}
            setPageData=${setPageData}
            pageData=${pageData}
        />
    `

    const handlePageDelete = () => {
        void chrome.storage.local.remove([url])
        setPagesByURL((current) => {
            const next = {...current}
            delete next[url]
            return next
        })
    }

    /** @param {ScrollDetails} details */
    const handleJump = async (details) => {
        setJumpError(null)

        const hasPermission = await hasAllSitesPermission()
        if (!hasPermission) {
            onMissingPermission(url, details)
            return
        }

        const didJump = await jumpToMarkedPosition(url, details)
        if (!didJump) {
            setJumpError('Could not jump on this page.')
        }
    }

    const lastMarkedDate = pageData.scrolls.length > 0
        ? relativeDate(
            pageData.scrolls.reduce(
                (latest, scroll) => (scroll.dateISO > latest ? scroll.dateISO : latest),
                pageData.scrolls[0].dateISO
            )
        )
        : null

    return html`
        <div class="page-card">
            <div class="page-card__row">
                <div class="page-card__info">
                    <a href=${href} target="_blank" class="page-card__title">
                        ${pageData.title}
                    </a>
                    <span class="page-card__meta-row">
                        <a href=${href} target="_blank" class="page-card__url">
                            ${url}
                        </a>
                        <span class="page-card__count">
                            ${pageData.scrolls.length} mark${pageData.scrolls.length !== 1 ? 's' : ''}
                        </span>
                    </span>
                </div>
                ${lastMarkedDate
                    ? html`<span class="page-card__updated">${lastMarkedDate}</span>`
                    : null}
                <div class="page-card__actions">
                    <button
                        type="button"
                        onClick=${() => setExpand(!expand)}
                        class="icon-button page-card__toggle"
                    >
                        <${Icon}
                            icon=${expand ? 'angleUp' : 'angleDown'}
                            className="icon icon--sm"
                        />
                    </button>
                    <button
                        type="button"
                        onClick=${handlePageDelete}
                        class="icon-button page-card__delete"
                    >
                        <${Icon} icon="trashCan" className="icon icon--xs" />
                    </button>
                </div>
            </div>
            ${expand
                ? html`
                    <div class="page-card__details animate-fade-in-up">
                        <${SortableScrollList}
                            pageData=${pageData}
                            setPageData=${setPageData}
                            renderItem=${renderScrollItem}
                        />
                    </div>
                `
                : null}
            ${jumpError ? html`<p class="page-card__error">${jumpError}</p>` : null}
        </div>
    `
}

void main()
