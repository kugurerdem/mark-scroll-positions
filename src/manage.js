// @ts-check

import {html, render, useEffect, useState} from './ui.js'
import {getAppRoot} from './app-root.js'
import {Icon} from './icons.js'
import {getNavigablePageURL} from './page-identity.js'
import {jumpToScrollPosition} from './page-dom.js'
import {
    applyPageRecordChanges,
    getAllPageRecords,
    removePageData,
} from './page-store.js'
import {GenericScroll} from './scroll-card.js'
import {SortableScrollList} from './sortable-scroll-list.js'
import {subscribeToLocalStorageChanges} from './storage.js'
import {initializeTheme} from './theme.js'
import {usePageDataState} from './use-page-data-state.js'

/** @typedef {import('./page-identity.js').PageIdentity} PageIdentity */
/** @typedef {import('./page-store.js').PageRecord} PageRecord */
/** @typedef {import('./page-store.js').PageRecordByStorageKey} PageRecordByStorageKey */
/** @typedef {import('./page-store.js').ScrollDetails} ScrollDetails */

const {values} = Object
const allOrigins = ['<all_urls>']

/** @param {PageRecord} pageRecord @returns {number} */
const latestUpdateTimestamp = ({pageData: {scrolls}}) =>
    scrolls.reduce((latest, scroll) => {
        const timestamp = new Date(scroll.dateISO).getTime()
        return timestamp > latest ? timestamp : latest
    }, 0)

/** @param {PageRecord} left @param {PageRecord} right @returns {number} */
const comparePagesByNewestUpdate = (left, right) => {
    const byNewestUpdate = latestUpdateTimestamp(right) - latestUpdateTimestamp(left)

    if (byNewestUpdate !== 0) return byNewestUpdate
    return left.identity.storageKey.localeCompare(right.identity.storageKey)
}

const main = async () => {
    await initializeTheme()

    const pageRecordsByStorageKey = await getAllPageRecords()
    render(
        html`<${App} pageRecordsByStorageKey=${pageRecordsByStorageKey} />`,
        getAppRoot()
    )
}

/** @param {{pageRecordsByStorageKey: PageRecordByStorageKey}} props */
const App = ({pageRecordsByStorageKey}) => {
    const [searchText, setSearchText] = useState(/** @type {string | null} */ (null))
    const [pageRecords, setPageRecords] = useState(pageRecordsByStorageKey)
    const [showPermissionPrompt, setShowPermissionPrompt] = useState(false)
    const [pendingJump, setPendingJump] = useState(
        /** @type {{pageIdentity: PageIdentity, details: ScrollDetails} | null} */ (null)
    )

    useEffect(() => {
        return subscribeToLocalStorageChanges((changes) => {
            setPageRecords(
                /** @param {PageRecordByStorageKey} current */
                (current) => applyPageRecordChanges(current, changes)
            )
        })
    }, [])

    const handleEnableAutoJump = async () => {
        const granted = await requestAllSitesPermission()
        if (!granted) return

        setShowPermissionPrompt(false)

        if (!pendingJump) return

        const {pageIdentity, details} = pendingJump
        setPendingJump(null)
        await jumpToMarkedPosition(pageIdentity, details)
    }

    /** @param {PageIdentity} pageIdentity @param {ScrollDetails} details */
    const handleMissingAutoJumpPermission = (pageIdentity, details) => {
        setPendingJump({pageIdentity, details})
        setShowPermissionPrompt(true)
    }

    const filteredRecords = values(pageRecords).filter(
        ({identity, pageData}) =>
            !searchText ||
            identity.storageKey.includes(searchText) ||
            identity.pageURL?.includes(searchText) ||
            pageData.title?.includes(searchText) ||
            pageData.scrolls.some(
                /** @param {ScrollDetails} scroll */
                (scroll) =>
                    scroll.note?.includes(searchText) ||
                    scroll.name?.includes(searchText)
            )
    )

    const visibleRecords = [...filteredRecords].sort(comparePagesByNewestUpdate)
    const totalMarks = values(pageRecords).reduce(
        (sum, {pageData}) => sum + pageData.scrolls.length,
        0
    )
    const subtitle = `${filteredRecords.length} page${filteredRecords.length !== 1 ? 's' : ''} · ${totalMarks} mark${totalMarks !== 1 ? 's' : ''} total`

    /** @param {PageRecord} pageRecord */
    const renderPage = (pageRecord) => html`
        <${Page}
            key=${pageRecord.identity.storageKey}
            identity=${pageRecord.identity}
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
                                        onClick=${handleEnableAutoJump}
                                        class="button button--primary"
                                    >
                                        Enable
                                    </button>
                                </div>
                            </div>
                        </div>
                    `
                    : null}

                ${filteredRecords.length === 0
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
                            ${visibleRecords.map((pageRecord) => renderPage(pageRecord))}
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

/** @param {PageIdentity} pageIdentity @param {ScrollDetails} scrollDetails @returns {Promise<boolean>} */
const jumpToMarkedPosition = async (pageIdentity, scrollDetails) => {
    const tab = await chrome.tabs.create({url: getNavigablePageURL(pageIdentity)})
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
 * @property {PageIdentity} identity
 * @property {(pageIdentity: PageIdentity, details: ScrollDetails) => void} onMissingPermission
 */

/** @param {PageProps} props */
const Page = ({identity, onMissingPermission}) => {
    const [pageData, setPageData, patchScroll] = usePageDataState(identity)
    const [expand, setExpand] = useState(false)
    const [jumpError, setJumpError] = useState(/** @type {string | null} */ (null))
    const href = getNavigablePageURL(identity)

    /** @param {ScrollDetails} details */
    const renderScrollItem = (details) => html`
        <${GenericScroll}
            scrollDetails=${details}
            onJump=${() => void handleJump(details)}
            patchScroll=${patchScroll}
            setPageData=${setPageData}
            pageData=${pageData}
        />
    `

    const handlePageDelete = () => {
        void removePageData(identity)
    }

    /** @param {ScrollDetails} details */
    const handleJump = async (details) => {
        setJumpError(null)

        const hasPermission = await hasAllSitesPermission()
        if (!hasPermission) {
            onMissingPermission(identity, details)
            return
        }

        const didJump = await jumpToMarkedPosition(identity, details)
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
                        ${pageData.title || identity.storageKey}
                    </a>
                    <span class="page-card__meta-row">
                        <a href=${href} target="_blank" class="page-card__url">
                            ${identity.storageKey}
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
                        onClick=${() =>
                            setExpand(
                                /** @param {boolean} current */
                                (current) => !current
                            )}
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
