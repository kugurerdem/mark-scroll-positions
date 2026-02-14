import {createRoot} from 'react-dom/client'
import {useCallback, createContext, useContext} from 'react'
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome'
import {
    faBookmark,
    faBookBookmark,
    faGear,
} from '@fortawesome/free-solid-svg-icons'
import {GenericScroll, SortableScrollList, usePageDataState} from './common'
import {initializeTheme} from './theme'

import type {ScrollDetails, PageData, BootContextValue} from './types'

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

    createRoot(document.getElementById('app')!).render(
        <Boot activeTab={activeTab} />
    )
}

interface BootProps {
    activeTab: chrome.tabs.Tab
}

const Boot = ({activeTab}: BootProps) => {
    const {hostname, pathname} = new URL(activeTab.url!)
    const absoluteURL = hostname.concat(pathname)

    const [pageData, setPageData, patchScroll] = usePageDataState(absoluteURL)

    return (
        <Context.Provider
            value={{activeTab, absoluteURL, pageData, setPageData, patchScroll}}
            children={<App />}
        />
    )
}

const App = () => {
    const {activeTab, pageData, setPageData} = useBootContext()

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
            })
            .then((injectionResults) => {
                const {result} = injectionResults[0]
                setPageData(result as PageData)
            })
    }, [])

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
        <div className="animate-fade-in-up w-[360px] p-3 bg-cream-50">
            <div className="flex items-center justify-between mb-3">
                <h1 className="font-display text-lg font-semibold text-ink-900 tracking-tight">
                    Mark Scroll Positions
                </h1>
                <span className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-accent-700 uppercase tracking-widest">
                        {pageData.scrolls.length} mark{pageData.scrolls.length !== 1 ? 's' : ''}
                    </span>
                    <button
                        onClick={onOpenSettings}
                        className="inline-flex items-center justify-center w-6 h-6 rounded-md border border-cream-300 bg-cream-100 text-ink-500 cursor-pointer transition-all hover:border-accent-300 hover:bg-accent-50 hover:text-accent-700"
                        title="Open settings"
                        aria-label="Open settings"
                    >
                        <FontAwesomeIcon icon={faGear} className="w-3 h-3 text-current pointer-events-none" />
                    </button>
                </span>
            </div>
            <div className="flex gap-2 mb-3">
                <button
                    onClick={onSave}
                    className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-accent-500 text-white font-medium text-sm cursor-pointer hover:bg-accent-600 transition-colors shadow-sm shadow-accent-500/20"
                >
                    <FontAwesomeIcon icon={faBookmark} className="w-3.5 h-3.5 text-current pointer-events-none" />
                    Mark
                </button>
                <button
                    onClick={() => {
                        void onOpenAllMarks()
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-cream-300 bg-cream-100 text-ink-700 font-medium text-sm cursor-pointer hover:border-accent-300 hover:bg-accent-50 transition-all"
                >
                    <FontAwesomeIcon icon={faBookBookmark} className="w-3.5 h-3.5 text-current pointer-events-none" />
                    All Marks
                </button>
            </div>

            {pageData.scrolls.length === 0 ? (
                <div className="text-center py-8 text-ink-300 text-sm italic">
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

const saveScrollDetails = async (): Promise<PageData> => {
    const absoluteURL = window.location.hostname.concat(window.location.pathname)

    const uuid = crypto.randomUUID()

    const pageData: PageData =
        (await chrome.storage.local.get(absoluteURL))[absoluteURL] || {
            scrolls: [],
            title: document.title,
        }

    const markNumber = pageData.scrolls.length + 1

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

    pageData.scrolls.push(scrollDetails)

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
