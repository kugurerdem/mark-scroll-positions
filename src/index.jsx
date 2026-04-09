// @ts-check

import {createRoot} from 'react-dom/client'
import {useCallback, useEffect, useState, createContext, useContext} from 'react'
import {GenericScroll, SortableScrollList, usePageDataState} from './common.jsx'
import {Icon} from './icons.jsx'
import {initializeTheme} from './theme.js'
import {
    QUERY_IDENTITY_SETTINGS_KEY,
    getQueryIdentitySettings,
    normalizeQueryIdentitySettings,
    resolveQueryIdentityMode,
    resolvePageStorageKey,
    setQueryIdentitySettings as setStoredQueryIdentitySettings,
} from './url-identity.js'

/** @typedef {import('./types.js').ScrollDetails} ScrollDetails */
/** @typedef {import('./types.js').PageData} PageData */
/** @typedef {import('./types.js').BootContextValue} BootContextValue */
/** @typedef {import('./types.js').ScrollInsertPosition} ScrollInsertPosition */
/** @typedef {import('./types.js').QueryIdentitySettings} QueryIdentitySettings */
/** @typedef {import('./types.js').QueryIdentityMode} QueryIdentityMode */

const Context = createContext(/** @type {BootContextValue | null} */ (null))

/** @returns {BootContextValue} */
const useBootContext = () => {
    const context = useContext(Context)
    if (!context) {
        throw new Error('useBootContext must be used within a Boot provider')
    }
    return context
}

const main = async () => {
    await initializeTheme()

    const [activeTab] = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true,
    })

    if (!activeTab?.url) {
        throw new Error('Could not resolve the active tab URL')
    }

    const queryIdentitySettings = await getQueryIdentitySettings()
    const rootElement = document.getElementById('app')

    if (!(rootElement instanceof HTMLElement)) {
        throw new Error('Missing app root element')
    }

    createRoot(rootElement).render(
        <Boot
            activeTab={activeTab}
            initialQueryIdentitySettings={queryIdentitySettings}
        />
    )
}

/**
 * @typedef {object} BootProps
 * @property {chrome.tabs.Tab} activeTab
 * @property {QueryIdentitySettings} initialQueryIdentitySettings
 */

/** @param {BootProps} props */
const Boot = ({activeTab, initialQueryIdentitySettings}) => {
    const [queryIdentitySettings, setQueryIdentitySettings] =
        useState(initialQueryIdentitySettings)

    if (!activeTab.url) {
        throw new Error('Could not resolve the active tab URL')
    }

    const activeURL = new URL(activeTab.url)
    const hasQueryParameters = activeURL.search.length > 0
    const hostname = activeURL.hostname
    const queryIdentityMode = resolveQueryIdentityMode(
        queryIdentitySettings,
        hostname
    )
    const absoluteURL = resolvePageStorageKey(activeURL, queryIdentitySettings)

    const [pageData, setPageData, patchScroll] = usePageDataState(absoluteURL)

    useEffect(() => {
        /** @param {{[key: string]: chrome.storage.StorageChange}} changes @param {string} areaName */
        const onStorageChange = (changes, areaName) => {
            if (areaName !== 'local') return

            const settingsChange = changes[QUERY_IDENTITY_SETTINGS_KEY]
            if (!settingsChange) return

            setQueryIdentitySettings(
                normalizeQueryIdentitySettings(settingsChange.newValue)
            )
        }

        chrome.storage.onChanged.addListener(onStorageChange)

        return () => {
            chrome.storage.onChanged.removeListener(onStorageChange)
        }
    }, [])

    const onQueryIdentityModeChange = useCallback(
        /** @param {QueryIdentityMode} nextMode */
        (nextMode) => {
            setQueryIdentitySettings((current) => {
                const nextSettings = {
                    ...current,
                    perHostMode: {
                        ...current.perHostMode,
                        [hostname]: nextMode,
                    },
                }

                void setStoredQueryIdentitySettings(nextSettings)

                return nextSettings
            })
        },
        [hostname]
    )

    return (
        <Context.Provider
            value={{activeTab, absoluteURL, pageData, setPageData, patchScroll}}
        >
            <App
                hasQueryParameters={hasQueryParameters}
                hostname={hostname}
                queryIdentityMode={queryIdentityMode}
                onQueryIdentityModeChange={onQueryIdentityModeChange}
            />
        </Context.Provider>
    )
}

/**
 * @typedef {object} AppProps
 * @property {boolean} hasQueryParameters
 * @property {string} hostname
 * @property {QueryIdentityMode} queryIdentityMode
 * @property {(mode: QueryIdentityMode) => void} onQueryIdentityModeChange
 */

/** @param {AppProps} props */
const App = ({
    hasQueryParameters,
    hostname,
    queryIdentityMode,
    onQueryIdentityModeChange,
}) => {
    const {activeTab, absoluteURL, pageData, setPageData} = useBootContext()

    const onOpenSettings = useCallback(() => {
        if (chrome.runtime.openOptionsPage) {
            void chrome.runtime.openOptionsPage()
            return
        }

        window.open('./settings.html')
    }, [])

    const onSave = useCallback(() => {
        if (!activeTab.id) return

        void chrome.scripting.executeScript({
            target: {tabId: activeTab.id},
            func: saveScrollDetails,
            args: [absoluteURL],
        })
    }, [activeTab.id, absoluteURL])

    const onOpenAllMarks = useCallback(async () => {
        const manageURL = chrome.runtime.getURL('src/manage.html')
        const [existingManageTab] = await chrome.tabs.query({url: manageURL})

        if (existingManageTab?.id) {
            await chrome.tabs.update(existingManageTab.id, {active: true})

            if (existingManageTab.windowId !== undefined) {
                await chrome.windows.update(existingManageTab.windowId, {focused: true})
            }

            return
        }

        await chrome.tabs.create({url: manageURL})
    }, [])

    return (
        <div className="popup animate-fade-in-up">
            <div className="popup__header">
                <h1 className="popup__title">
                    Mark Scroll Positions
                </h1>
                <span className="popup__header-actions">
                    <span className="popup__count">
                        {pageData.scrolls.length} mark{pageData.scrolls.length !== 1 ? 's' : ''}
                    </span>
                    <button
                        onClick={onOpenSettings}
                        className="icon-button icon-button--compact popup__settings-button"
                        title="Open settings"
                        aria-label="Open settings"
                    >
                        <Icon icon="gear" className="icon icon--xs" />
                    </button>
                </span>
            </div>
            <div className="popup__actions">
                <button
                    onClick={onSave}
                    className="button button--primary button--fill"
                >
                    <Icon icon="bookmark" className="icon icon--sm" />
                    Mark
                </button>
                <button
                    onClick={() => {
                        void onOpenAllMarks()
                    }}
                    className="button button--secondary button--fill"
                >
                    <Icon icon="bookBookmark" className="icon icon--sm" />
                    All Marks
                </button>
            </div>

            {hasQueryParameters && (
                <div className="popup__query-row">
                    <label className="popup__query-label">
                        <input
                            type="checkbox"
                            checked={queryIdentityMode === 'include'}
                            onChange={(e) => {
                                onQueryIdentityModeChange(
                                    e.target.checked ? 'include' : 'ignore'
                                )
                            }}
                            className="checkbox checkbox--small"
                        />
                        <span>
                            Use query params for <span className="popup__query-host">{hostname}</span>
                        </span>
                    </label>
                    <button
                        onClick={onOpenSettings}
                        className="popup__info-button"
                        title="Query parameters are the ?key=value parts of a URL. When enabled, pages with different query parameters are treated as separate pages for marks. Enable this if the content of your page depends on query parameters, otherwise leave it as is."
                        aria-label="Query parameters are the ?key=value parts of a URL. When enabled, pages with different query parameters are treated as separate pages for marks. Enable this if the content of your page depends on query parameters, otherwise leave it as is."
                    >
                        <Icon icon="circleInfo" className="icon icon--xs" />
                    </button>
                </div>
            )}

            {pageData.scrolls.length === 0 ? (
                <div className="popup__empty-state">
                    No marks on this page yet
                </div>
            ) : (
                <SortableScrollList
                    children={pageData.scrolls.map((details) => (
                        <Scroll scrollDetails={details} key={details.uuid} />
                    ))}
                    pageData={pageData}
                    setPageData={setPageData}
                    interactionMode="pointer"
                />
            )}
        </div>
    )
}

/** @param {{scrollDetails: ScrollDetails}} props */
const Scroll = ({scrollDetails}) => {
    const {activeTab, pageData, setPageData, patchScroll} = useBootContext()

    const onJump = () => {
        if (!activeTab.id) return

        void chrome.scripting.executeScript({
            target: {tabId: activeTab.id},
            func: jumpToScrollPosition,
            args: [scrollDetails],
        })
    }

    return GenericScroll({
        scrollDetails,
        onJump,
        pageData,
        setPageData,
        patchScroll,
    })
}

// CONTENT SCRIPTS

// NOTE: Below are content scripts, they run on a seperate environment and
// thus they cannot use things in outer scope of their function

/** @param {string} absoluteURL @returns {Promise<PageData>} */
const saveScrollDetails = async (absoluteURL) => {
    const markInsertPositionKey = 'markInsertPosition'

    /** @param {unknown} value @returns {value is ScrollInsertPosition} */
    const isScrollInsertPosition = (value) =>
        value === 'top' || value === 'bottom'

    /** @param {unknown} value @returns {value is PageData} */
    const isPageData = (value) =>
        Boolean(value) &&
        typeof value === 'object' &&
        Array.isArray(/** @type {{scrolls?: unknown}} */ (value).scrolls)

    const uuid = crypto.randomUUID()
    const storedPageData = (await chrome.storage.local.get(absoluteURL))[absoluteURL]

    /** @type {PageData} */
    const pageData = isPageData(storedPageData)
        ? storedPageData
        : {
            scrolls: [],
            title: document.title,
        }

    const markNumber = pageData.scrolls.length + 1

    const settings = await chrome.storage.local.get(markInsertPositionKey)
    const markInsertPosition = isScrollInsertPosition(settings[markInsertPositionKey])
        ? settings[markInsertPositionKey]
        : 'bottom'

    const contentHeight = Math.max(
        document.documentElement?.scrollHeight || 0,
        document.body?.scrollHeight || 0
    )

    const maxScrollPosition = Math.max(contentHeight - window.innerHeight, 0)
    const scrollPosition = Math.min(window.pageYOffset, maxScrollPosition)

    /** @type {ScrollDetails} */
    const scrollDetails = {
        scrollPosition,
        viewportHeight: window.innerHeight,
        contentHeight,
        dateISO: new Date().toISOString(),
        uuid,
        name: `Mark #${markNumber}`,
        note: '',
    }

    if (markInsertPosition === 'top') {
        pageData.scrolls.unshift(scrollDetails)
    } else {
        pageData.scrolls.push(scrollDetails)
    }

    await chrome.storage.local.set({[absoluteURL]: pageData})

    return pageData
}

/**
 * @typedef {object} JumpToScrollPositionArgs
 * @property {number} scrollPosition
 * @property {number} viewportHeight
 * @property {number} contentHeight
 */

/** @param {JumpToScrollPositionArgs} args */
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

    const toJumpPositionY =
        normalizedPercentage * currentScrollableHeight

    window.scrollTo(0, toJumpPositionY)
}

void main()
