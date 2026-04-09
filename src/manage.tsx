import {createRoot} from 'react-dom/client'
import {useState, useEffect} from 'react'
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome'
import {faAngleUp, faAngleDown, faTrashCan, faBookBookmark, faMagnifyingGlass} from '@fortawesome/free-solid-svg-icons'

import {
    GenericScroll,
    SortableScrollList,
    usePageDataState,
} from './common'
import {initializeTheme} from './theme'

import type {PageData, PageDetailsByURL, ScrollDetails} from './types'

const {entries} = Object
const allOrigins = ['<all_urls>']

type PageEntry = [string, PageData]

const parseTimestamp = (iso: string): number => {
    const timestamp = new Date(iso).getTime()
    return Number.isFinite(timestamp) ? timestamp : 0
}

const latestUpdateTimestamp = ({scrolls}: PageData): number =>
    scrolls.reduce((latest, scroll) => {
        const timestamp = parseTimestamp(scroll.dateISO)
        return timestamp > latest ? timestamp : latest
    }, 0)

const comparePagesByNewestUpdate = (
    [leftURL, leftDetails]: PageEntry,
    [rightURL, rightDetails]: PageEntry
): number => {
    const byNewestUpdate =
        latestUpdateTimestamp(rightDetails) - latestUpdateTimestamp(leftDetails)

    if (byNewestUpdate !== 0) return byNewestUpdate
    return leftURL.localeCompare(rightURL)
}

const isPageData = (value: unknown): value is PageData => {
    if (!value || typeof value !== 'object') return false
    return Array.isArray((value as {scrolls?: unknown}).scrolls)
}

const extractPageDetailsByURL = (
    storageData: Record<string, unknown>
): PageDetailsByURL =>
    entries(storageData).reduce<PageDetailsByURL>((accumulator, [key, value]) => {
        if (!isPageData(value)) return accumulator

        accumulator[key] = value
        return accumulator
    }, {})

const main = async () => {
    await initializeTheme()

    const pageDetailsByURL = extractPageDetailsByURL(
        await chrome.storage.local.get()
    )

    createRoot(document.getElementById('app')!).render(
        <App pageDetailsByURL={pageDetailsByURL} />
    )
}

interface AppProps {
    pageDetailsByURL: PageDetailsByURL
}

const App = ({pageDetailsByURL}: AppProps) => {
    const [searchText, setSearchText] = useState<string | null>(null)
    const [pagesByURL, setPagesByURL] = useState(pageDetailsByURL)
    const [showPermissionPrompt, setShowPermissionPrompt] = useState(false)
    const [pendingJump, setPendingJump] = useState<{
        url: string
        details: ScrollDetails
    } | null>(null)

    useEffect(() => {
        const onStorageChange: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (
            changes,
            areaName
        ) => {
            if (areaName !== 'local') return

            setPagesByURL((current) => {
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
            })
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

    const handleMissingAutoJumpPermission = (url: string, details: ScrollDetails) => {
        setPendingJump({url, details})
        setShowPermissionPrompt(true)
    }

    const filteredEntries = entries(pagesByURL).filter(
        ([url, details]) =>
            !searchText ||
            url.includes(searchText) ||
            details.title?.includes(searchText) ||
            details.scrolls.some(
                (s) =>
                    s.note?.includes(searchText) ||
                    s.name?.includes(searchText)
            )
    )

    const visibleEntries = [...filteredEntries].sort(comparePagesByNewestUpdate)

    const totalMarks = entries(pagesByURL).reduce(
        (sum, [, details]) => sum + details.scrolls.length, 0
    )

    return (
        <div className="manage-page">
            <div className="manage-page__topbar" />

            <header className="manage-page__header">
                <div className="manage-page__header-inner">
                    <div className="manage-page__hero">
                        <div className="manage-page__hero-icon">
                            <FontAwesomeIcon icon={faBookBookmark} className="icon icon--lg icon--inverse" />
                        </div>
                        <div>
                            <h1 className="manage-page__title">
                                Your Reading Marks
                            </h1>
                            <p className="manage-page__subtitle">
                                {filteredEntries.length} page{filteredEntries.length !== 1 ? 's' : ''} &middot; {totalMarks} mark{totalMarks !== 1 ? 's' : ''} total
                            </p>
                        </div>
                    </div>

                    <div className="manage-search">
                        <FontAwesomeIcon
                            icon={faMagnifyingGlass}
                            className="manage-search__icon icon icon--sm"
                        />
                        <input
                            type="text"
                            placeholder="Search pages, marks, notes..."
                            onChange={(e) => setSearchText(e.target.value || null)}
                            className="manage-search__input"
                        />
                    </div>
                </div>
            </header>

            <main className="manage-page__content animate-fade-in-up">
                {showPermissionPrompt && (
                    <div className="permission-modal">
                        <div className="permission-modal__card">
                            <h3 className="permission-modal__title">
                                Enable auto-jump permission
                            </h3>
                            <p className="permission-modal__text">
                                Auto-jump requires all-sites access. If you want to jump directly to saved scroll
                                positions, enable this permission. If you prefer not to enable it, you can still open
                                pages normally by clicking their title or URL.
                            </p>
                            <div className="permission-modal__actions">
                                <button
                                    onClick={() => {
                                        setPendingJump(null)
                                        setShowPermissionPrompt(false)
                                    }}
                                    className="button button--secondary"
                                >
                                    Hide
                                </button>
                                <button
                                    onClick={() => {
                                        void handleEnableAutoJump()
                                    }}
                                    className="button button--primary"
                                >
                                    Enable
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {filteredEntries.length === 0 ? (
                    <div className="manage-empty-state">
                        <div className="manage-empty-state__icon-wrap">
                            <FontAwesomeIcon icon={faBookBookmark} className="icon icon--xl manage-empty-state__icon" />
                        </div>
                        <p className="manage-empty-state__title">
                            {searchText ? 'No marks match your search' : 'No saved marks yet'}
                        </p>
                        <p className="manage-empty-state__text">
                            {searchText ? 'Try a different search term' : 'Use the extension popup to mark scroll positions'}
                        </p>
                    </div>
                ) : (
                    <div className="manage-page__list">
                        {visibleEntries.map(([url]) => (
                            <Page
                                {...{url, setPagesByURL}}
                                onMissingPermission={handleMissingAutoJumpPermission}
                                key={url}
                            />
                        ))}
                    </div>
                )}
            </main>
        </div>
    )
}

interface PageProps {
    url: string
    setPagesByURL: React.Dispatch<React.SetStateAction<PageDetailsByURL>>
    onMissingPermission: (url: string, details: ScrollDetails) => void
}

const relativeDate = (iso: string): string => {
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

const jumpToScrollPosition = ({
    scrollPosition,
    viewportHeight,
    contentHeight,
}: Pick<ScrollDetails, 'scrollPosition' | 'viewportHeight' | 'contentHeight'>) => {
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

const waitForTabToFinishLoading = (tabId: number): Promise<void> =>
    new Promise((resolve) => {
        const onUpdated = (
            updatedTabId: number,
            changeInfo: {status?: string}
        ) => {
            if (updatedTabId === tabId && changeInfo.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(onUpdated)
                resolve()
            }
        }

        chrome.tabs.onUpdated.addListener(onUpdated)
    })

const hasAllSitesPermission = async (): Promise<boolean> => {
    if (!chrome.permissions?.contains) return true
    return chrome.permissions.contains({origins: allOrigins})
}

const requestAllSitesPermission = async (): Promise<boolean> => {
    if (!chrome.permissions?.request) return true

    try {
        return await chrome.permissions.request({origins: allOrigins})
    } catch {
        return false
    }
}

const jumpToMarkedPosition = async (url: string, scrollDetails: ScrollDetails): Promise<boolean> => {
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

const Page = ({url, setPagesByURL, onMissingPermission}: PageProps) => {
    const [pageData, setPageData, patchScroll] = usePageDataState(url)

    const [expand, setExpand] = useState(false)
    const [jumpError, setJumpError] = useState<string | null>(null)

    const handleExpand = () => {
        setExpand(!expand)
    }

    const handlePageDelete = () => {
        chrome.storage.local.remove([url])
        setPagesByURL((current) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const {[url]: _, ...rest} = current
            return rest
        })
    }

    const handleJump = async (details: ScrollDetails) => {
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
        ? relativeDate(pageData.scrolls.reduce((latest, s) =>
            s.dateISO > latest ? s.dateISO : latest, pageData.scrolls[0].dateISO))
        : null

    return (
        <div className="page-card">
            <div className="page-card__row">
                <div className="page-card__info">
                    <a href={'http://' + url} target="_blank" className="page-card__title">
                        {pageData.title}
                    </a>
                    <span className="page-card__meta-row">
                        <a href={'http://' + url} target="_blank" className="page-card__url">
                            {url}
                        </a>
                        <span className="page-card__count">
                            {pageData.scrolls.length} mark{pageData.scrolls.length !== 1 ? 's' : ''}
                        </span>
                    </span>
                </div>
                {lastMarkedDate && (
                    <span className="page-card__updated">
                        {lastMarkedDate}
                    </span>
                )}
                <div className="page-card__actions">
                    <button
                        onClick={handleExpand}
                        className="icon-button page-card__toggle"
                    >
                        <FontAwesomeIcon icon={expand ? faAngleUp : faAngleDown} className="icon icon--sm" />
                    </button>
                    <button
                        onClick={handlePageDelete}
                        className="icon-button page-card__delete"
                    >
                        <FontAwesomeIcon icon={faTrashCan} className="icon icon--xs" />
                    </button>
                </div>
            </div>
            {expand && (
                <div className="page-card__details animate-fade-in-up">
                    <SortableScrollList
                        children={pageData.scrolls.map((details) => (
                            <GenericScroll
                                scrollDetails={details}
                                key={details.uuid}
                                onJump={() => {
                                    void handleJump(details)
                                }}
                                patchScroll={patchScroll}
                                setPageData={setPageData}
                                pageData={pageData}
                            />
                        ))}
                        pageData={pageData}
                        setPageData={setPageData}
                    />
                </div>
            )}
            {jumpError && (
                <p className="page-card__error">
                    {jumpError}
                </p>
            )}
        </div>
    )
}

main()
