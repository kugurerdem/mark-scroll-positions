import {createRoot} from 'react-dom/client'
import {useCallback, useEffect, useState, createContext, useContext} from 'react'
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome'
import {
    faBookmark,
    faBookBookmark,
    faCircleInfo,
    faGear,
} from '@fortawesome/free-solid-svg-icons'
import {GenericScroll, SortableScrollList, usePageDataState} from './common'
import {initializeTheme} from './theme'
import {
    QUERY_IDENTITY_SETTINGS_KEY,
    getQueryIdentitySettings,
    normalizeQueryIdentitySettings,
    resolveQueryIdentityMode,
    resolvePageStorageKey,
    setQueryIdentitySettings as setStoredQueryIdentitySettings,
} from './url-identity'

import type {
    ScrollDetails,
    PageData,
    BootContextValue,
    ScrollInsertPosition,
    QueryIdentitySettings,
    QueryIdentityMode,
} from './types'

const Context = createContext<BootContextValue | null>(null)

const useBootContext = (): BootContextValue => {
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

    const queryIdentitySettings = await getQueryIdentitySettings()

    createRoot(document.getElementById('app')!).render(
        <Boot
            activeTab={activeTab}
            initialQueryIdentitySettings={queryIdentitySettings}
        />
    )
}

interface BootProps {
    activeTab: chrome.tabs.Tab
    initialQueryIdentitySettings: QueryIdentitySettings
}

const Boot = ({activeTab, initialQueryIdentitySettings}: BootProps) => {
    const [queryIdentitySettings, setQueryIdentitySettings] =
        useState<QueryIdentitySettings>(initialQueryIdentitySettings)

    const activeURL = new URL(activeTab.url!)
    const hasQueryParameters = activeURL.search.length > 0
    const hostname = activeURL.hostname
    const queryIdentityMode = resolveQueryIdentityMode(
        queryIdentitySettings,
        hostname
    )
    const absoluteURL = resolvePageStorageKey(activeURL, queryIdentitySettings)

    const [pageData, setPageData, patchScroll] = usePageDataState(absoluteURL)

    useEffect(() => {
        const onStorageChange: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (
            changes,
            areaName
        ) => {
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
        (nextMode: QueryIdentityMode) => {
            setQueryIdentitySettings((current) => {
                const nextSettings: QueryIdentitySettings = {
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
            children={(
                <App
                    hasQueryParameters={hasQueryParameters}
                    hostname={hostname}
                    queryIdentityMode={queryIdentityMode}
                    onQueryIdentityModeChange={onQueryIdentityModeChange}
                />
            )}
        />
    )
}

interface AppProps {
    hasQueryParameters: boolean
    hostname: string
    queryIdentityMode: QueryIdentityMode
    onQueryIdentityModeChange: (mode: QueryIdentityMode) => void
}

const App = ({
    hasQueryParameters,
    hostname,
    queryIdentityMode,
    onQueryIdentityModeChange,
}: AppProps) => {
    const {activeTab, absoluteURL, pageData, setPageData} = useBootContext()

    const onOpenSettings = useCallback(() => {
        if (chrome.runtime.openOptionsPage) {
            void chrome.runtime.openOptionsPage()
            return
        }

        window.open('./settings.html')
    }, [])

    const onSave = useCallback(() => {
        chrome.scripting
            .executeScript({
                target: {tabId: activeTab.id!},
                func: saveScrollDetails,
                args: [absoluteURL],
            })
    }, [activeTab.id, absoluteURL, setPageData])

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
                        <FontAwesomeIcon icon={faGear} className="icon icon--xs" />
                    </button>
                </span>
            </div>
            <div className="popup__actions">
                <button
                    onClick={onSave}
                    className="button button--primary button--fill"
                >
                    <FontAwesomeIcon icon={faBookmark} className="icon icon--sm" />
                    Mark
                </button>
                <button
                    onClick={() => {
                        void onOpenAllMarks()
                    }}
                    className="button button--secondary button--fill"
                >
                    <FontAwesomeIcon icon={faBookBookmark} className="icon icon--sm" />
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
                        <FontAwesomeIcon icon={faCircleInfo} className="icon icon--xs" />
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
                />
            )}
        </div>
    )
}

interface ScrollProps {
    scrollDetails: ScrollDetails
}

const Scroll = ({scrollDetails}: ScrollProps) => {
    const {activeTab, pageData, setPageData, patchScroll} = useBootContext()

    const onJump = () => {
        chrome.scripting.executeScript({
            target: {tabId: activeTab.id!},
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

const saveScrollDetails = async (absoluteURL: string): Promise<PageData> => {
    const markInsertPositionKey = 'markInsertPosition'
    const isScrollInsertPosition = (value: unknown): value is ScrollInsertPosition =>
        value === 'top' || value === 'bottom'
    const isPageData = (value: unknown): value is PageData =>
        !!value &&
        typeof value === 'object' &&
        Array.isArray((value as {scrolls?: unknown}).scrolls)

    const uuid = crypto.randomUUID()
    const storedPageData = (await chrome.storage.local.get(absoluteURL))[absoluteURL]

    const pageData: PageData =
        isPageData(storedPageData) ? storedPageData : {
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

    const scrollDetails: ScrollDetails = {
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

interface JumpToScrollPositionArgs {
    scrollPosition: number
    viewportHeight: number
    contentHeight: number
}

const jumpToScrollPosition = ({
    scrollPosition,
    viewportHeight,
    contentHeight,
}: JumpToScrollPositionArgs) => {
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

main()
