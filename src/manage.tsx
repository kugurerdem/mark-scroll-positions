import {createRoot} from 'react-dom/client'
import {useState} from 'react'

import {
    TextInput,
    Button,
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

    return (
        <main className="bg-white mx-auto my-8 p-4 rounded-xl shadow-lg max-w-4xl">
            <h1 className="text-2xl font-bold text-center text-slate-800 mb-4"> Your Marked Scroll Positions </h1>
            <TextInput
                label="search"
                value=""
                onChange={setSearchText}
                className="mx-auto w-48"
            />
            {entries(pagesByURL)
                .filter(
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
                .map(([url]) => (
                    <Page {...{url, setPagesByURL}} key={url} />
                ))}
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
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mx-auto my-4 max-w-3xl">
            <div className="w-full flex items-center justify-around">
                <span className="text-slate-600 font-medium"> {maxPercentage}% </span>
                <div className="flex flex-col w-80">
                    <a href={'http://' + url} target="_blank" className="text-blue-600 font-semibold hover:text-blue-800 hover:underline">
                        {pageData.title}
                    </a>
                    <a href={'http://' + url} target="_blank" className="text-blue-600 text-sm hover:text-blue-800 hover:underline truncate">
                        {url}
                    </a>
                </div>
                <div>
                    {expand ? (
                        <Button
                            icon="angle-up"
                            text="Collapse"
                            onClick={handleExpand}
                        />
                    ) : (
                        <Button
                            icon="angle-down"
                            text="Expand"
                            onClick={handleExpand}
                        />
                    )}

                    <Button
                        icon="trash-can"
                        text="Delete"
                        onClick={handlePageDelete}
                    />
                </div>
            </div>
            {expand && (
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
            )}
        </div>
    )
}

main()
