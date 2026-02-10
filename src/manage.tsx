import {createRoot} from 'react-dom/client'
import {useState} from 'react'
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

    const totalMarks = entries(pagesByURL).reduce(
        (sum, [, details]) => sum + details.scrolls.length, 0
    )

    return (
        <div className="min-h-screen bg-cream-200">
            {/* Decorative top bar */}
            <div className="h-1 bg-gradient-to-r from-accent-300 via-accent-500 to-accent-700" />

            {/* Header area */}
            <header className="bg-cream-50 border-b border-cream-300 shadow-[0_1px_8px_-2px_rgba(0,0,0,0.04)]">
                <div className="max-w-4xl mx-auto px-8 py-6">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center shadow-sm shadow-accent-500/20">
                            <FontAwesomeIcon icon={faBookBookmark} className="w-5 h-5 text-white pointer-events-none" />
                        </div>
                        <div>
                            <h1 className="font-display text-2xl font-bold text-ink-900 tracking-tight leading-tight">
                                Your Reading Marks
                            </h1>
                            <p className="text-ink-400 text-xs mt-0.5">
                                {filteredEntries.length} page{filteredEntries.length !== 1 ? 's' : ''} &middot; {totalMarks} mark{totalMarks !== 1 ? 's' : ''} total
                            </p>
                        </div>
                    </div>

                    {/* Search bar */}
                    <div className="relative max-w-sm">
                        <FontAwesomeIcon
                            icon={faMagnifyingGlass}
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-300 pointer-events-none"
                        />
                        <input
                            type="text"
                            placeholder="Search pages, marks, notes..."
                            onChange={(e) => setSearchText(e.target.value || null)}
                            className="w-full pl-9 pr-4 py-2.5 border border-cream-300 rounded-xl bg-cream-100 font-body text-[13px] text-ink-700 outline-none transition-all focus:border-accent-400 focus:bg-cream-50 focus:shadow-[0_0_0_3px_rgba(62,114,183,0.14)] placeholder:text-ink-300"
                        />
                    </div>
                </div>
            </header>

            {/* Content area */}
            <main className="max-w-4xl mx-auto px-8 py-6 animate-fade-in-up">
                {showPermissionPrompt && (
                    <div className="fixed inset-0 z-50 bg-transparent flex items-center justify-center px-4">
                        <div className="w-full max-w-md rounded-2xl border border-cream-300 bg-cream-50 p-5 shadow-[0_20px_48px_-18px_rgba(0,0,0,0.3)]">
                            <h3 className="font-display text-lg font-semibold text-ink-900 leading-tight">
                                Enable auto-jump permission
                            </h3>
                            <p className="mt-2 text-sm text-ink-500 leading-relaxed">
                                Auto-jump requires all-sites access. If you want to jump directly to saved scroll
                                positions, enable this permission. If you prefer not to enable it, you can still open
                                pages normally by clicking their title or URL.
                            </p>
                            <div className="mt-4 flex items-center justify-end gap-2">
                                <button
                                    onClick={() => {
                                        setPendingJump(null)
                                        setShowPermissionPrompt(false)
                                    }}
                                    className="px-3.5 py-2 rounded-lg border border-cream-300 bg-cream-100 text-ink-600 text-sm font-medium transition-colors hover:bg-cream-200"
                                >
                                    Hide
                                </button>
                                <button
                                    onClick={() => {
                                        void handleEnableAutoJump()
                                    }}
                                    className="px-3.5 py-2 rounded-lg bg-accent-500 text-white text-sm font-medium transition-colors hover:bg-accent-600"
                                >
                                    Enable
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {filteredEntries.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="w-16 h-16 rounded-2xl bg-cream-300/60 flex items-center justify-center mx-auto mb-4">
                            <FontAwesomeIcon icon={faBookBookmark} className="w-7 h-7 text-ink-300 pointer-events-none" />
                        </div>
                        <p className="text-ink-400 font-display text-lg italic">
                            {searchText ? 'No marks match your search' : 'No saved marks yet'}
                        </p>
                        <p className="text-ink-300 text-xs mt-1">
                            {searchText ? 'Try a different search term' : 'Use the extension popup to mark scroll positions'}
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {filteredEntries.map(([url]) => (
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
        <div className="group bg-cream-50 border border-cream-300 rounded-2xl px-5 py-3.5 transition-all duration-200 hover:border-accent-200 hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.06),0_1px_6px_-1px_rgba(62,114,183,0.12)]">
            <div className="w-full flex items-center gap-3">
                {/* Page info */}
                <div className="flex flex-col min-w-0 flex-1">
                    <a href={'http://' + url} target="_blank" className="self-start text-ink-900 font-display font-semibold text-[15px] hover:text-accent-700 transition-colors truncate">
                        {pageData.title}
                    </a>
                    <span className="flex items-center gap-2">
                        <a href={'http://' + url} target="_blank" className="text-ink-400 text-xs hover:text-accent-600 transition-colors truncate">
                            {url}
                        </a>
                        <span className="flex-shrink-0 text-[10px] text-ink-300 font-medium">
                            {pageData.scrolls.length} mark{pageData.scrolls.length !== 1 ? 's' : ''}
                        </span>
                    </span>
                </div>
                {/* Last marked date */}
                {lastMarkedDate && (
                    <span className="flex-shrink-0 text-[11px] text-ink-300 font-medium">
                        {lastMarkedDate}
                    </span>
                )}
                {/* Actions */}
                <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button
                        onClick={handleExpand}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-ink-400 cursor-pointer transition-all hover:bg-accent-50 hover:text-accent-700"
                    >
                        <FontAwesomeIcon icon={expand ? faAngleUp : faAngleDown} className="w-3.5 h-3.5 text-current pointer-events-none" />
                    </button>
                    <button
                        onClick={handlePageDelete}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-ink-400 cursor-pointer transition-all opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500"
                    >
                        <FontAwesomeIcon icon={faTrashCan} className="w-3 h-3 text-current pointer-events-none" />
                    </button>
                </div>
            </div>
            {expand && (
                <div className="mt-3 pt-3 border-t border-cream-200 animate-fade-in-up">
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
                <p className="mt-2 text-[11px] text-red-600 font-medium">
                    {jumpError}
                </p>
            )}
        </div>
    )
}

main()
