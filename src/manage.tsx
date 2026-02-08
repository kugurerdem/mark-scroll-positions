import {createRoot} from 'react-dom/client'
import {useState} from 'react'
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome'
import {faAngleUp, faAngleDown, faTrashCan} from '@fortawesome/free-solid-svg-icons'

import {
    TextInput,
    GenericScroll,
    SortableScrollList,
    calculateScrollPercentage,
    usePageDataState,
} from './common'

import type {PageDetailsByURL} from './types'

const {entries} = Object

const main = async () => {
    const pageDetailsByURL =
        (await chrome.storage.local.get()) as PageDetailsByURL

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

    return (
        <main className="bg-cream-50 mx-auto my-10 p-8 rounded-2xl shadow-lg shadow-black/5 max-w-4xl animate-fade-in-up">
            <div className="text-center mb-6">
                <h1 className="font-display text-3xl font-bold text-ink-900 tracking-tight mb-1">
                    Your Reading Marks
                </h1>
                <p className="text-ink-400 text-sm">
                    {filteredEntries.length} page{filteredEntries.length !== 1 ? 's' : ''} saved
                </p>
            </div>
            <TextInput
                label="search"
                value=""
                onChange={setSearchText}
                className="mx-auto max-w-xs mb-6"
            />

            {filteredEntries.length === 0 ? (
                <div className="text-center py-12 text-ink-300 italic">
                    No saved marks yet
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {filteredEntries.map(([url]) => (
                        <Page {...{url, setPagesByURL}} key={url} />
                    ))}
                </div>
            )}
        </main>
    )
}

interface PageProps {
    url: string
    setPagesByURL: React.Dispatch<React.SetStateAction<PageDetailsByURL>>
}

const Page = ({url, setPagesByURL}: PageProps) => {
    const [pageData, setPageData, patchScroll] = usePageDataState(url)

    const [expand, setExpand] = useState(false)

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

    const maxPercentage = Math.max(
        0,
        ...pageData.scrolls.map(calculateScrollPercentage)
    )

    return (
        <div className="bg-white border border-cream-300 rounded-2xl p-5 transition-all duration-200 hover:border-amber-200 hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.06),0_1px_6px_-1px_rgba(245,158,11,0.08)]">
            <div className="w-full flex items-center gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center">
                    <span className="text-amber-700 font-display font-bold text-sm">{maxPercentage}%</span>
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                    <a href={'http://' + url} target="_blank" className="text-ink-900 font-display font-semibold text-[15px] hover:text-amber-700 transition-colors truncate">
                        {pageData.title}
                    </a>
                    <a href={'http://' + url} target="_blank" className="text-ink-400 text-xs hover:text-amber-600 transition-colors truncate">
                        {url}
                    </a>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                        onClick={handleExpand}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cream-300 bg-cream-100 text-ink-500 text-xs font-medium cursor-pointer transition-all hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700"
                    >
                        <FontAwesomeIcon icon={expand ? faAngleUp : faAngleDown} className="w-3 h-3 text-current pointer-events-none" />
                        {expand ? 'Collapse' : 'Expand'}
                    </button>
                    <button
                        onClick={handlePageDelete}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-ink-400 cursor-pointer transition-all hover:bg-red-50 hover:text-red-500 hover:scale-105"
                    >
                        <FontAwesomeIcon icon={faTrashCan} className="w-3.5 h-3.5 text-current pointer-events-none" />
                    </button>
                </div>
            </div>
            {expand && (
                <div className="mt-4 pt-3 border-t border-cream-200 animate-fade-in-up">
                    <SortableScrollList
                        children={pageData.scrolls.map((details) => (
                            <GenericScroll
                                scrollDetails={details}
                                key={details.uuid}
                                onJump={() => {
                                    window.open('http://' + url)
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
        </div>
    )
}

main()
