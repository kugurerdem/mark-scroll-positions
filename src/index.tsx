import {createRoot} from 'react-dom/client'
import {useCallback, createContext, useContext} from 'react'
import {Button, GenericScroll, SortableScrollList, usePageDataState} from './common'

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

    return (
        <>
            <Button icon="bookmark" text="Mark" onClick={onSave} />
            <Button
                icon="book-bookmark"
                text="All Marks"
                onClick={() => {
                    window.open('./manage.html')
                }}
            />

            <SortableScrollList
                children={pageData.scrolls.map((details) => (
                    <Scroll scrollDetails={details} key={details.uuid} />
                ))}
                pageData={pageData}
                setPageData={setPageData}
            />
        </>
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

    const scrollDetails: ScrollDetails = {
        // NOTE: scrollPosition + viewportHeight = contentHeight
        scrollPosition: window.pageYOffset,
        viewportHeight: window.innerHeight,
        contentHeight: document.body.scrollHeight,
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
    const percentage = scrollPosition / (contentHeight - viewportHeight)
    const toJumpPositionY =
        percentage * (document.body.scrollHeight - window.innerHeight)

    window.scrollTo(0, toJumpPositionY)
}

main()
