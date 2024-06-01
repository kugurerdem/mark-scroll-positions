const
    {createRoot} = require('react-dom/client'),
    {useState} = require('react'),

    {TextInput, Button, GenericScroll,
        calculateScrollPercentage, usePageDataState} = require('./utils.js'),

    {entries} = Object,

    main = async () => {
        const pageDetailsByURL = await chrome.storage.local.get()

        createRoot(document.getElementById('app'))
            .render(<App pageDetailsByURL={pageDetailsByURL} />)
    },

    App = ({pageDetailsByURL}) => {
        const
            [searchText, setSearchText] = useState(null),
            [pagesByURL, setPagesByURL] = useState(pageDetailsByURL)

        return <main>
            <h1> Your Marked Scroll Positions </h1>
            <TextInput label="search"
                onChange={setSearchText} className="search"/>
            { entries(pagesByURL)
                .filter(([url, details]) => (
                    !searchText
                    || url.includes(searchText)
                    || details.title.includes(searchText)
                    || details.scrolls.some(s => s.note?.includes(searchText))
                ))
                .map(([url]) =>
                    <Page {...{url, setPagesByURL}} key={url}/>) }
        </main>
    },

    Page = ({url, setPagesByURL}) => {
        const
            [pageData, setPageData, patchScroll] = usePageDataState(url),

            [expand, setExpand] = useState(false),

            handleExpand = () => {
                setExpand(!expand)
            },

            handlePageDelete = () => {
                chrome.storage.local.remove([url])
                setPagesByURL(current => {
                    // eslint-disable-next-line no-unused-vars
                    const {[url]: _, ...rest} = current
                    return rest
                })
            },

            maxPercentage = Math.max(
                0, ...pageData.scrolls.map(calculateScrollPercentage),
            )

        return <div className="page">
            <div className="pageInfo">
                <span> {maxPercentage}% </span>
                <div className="pageHeader">
                    <a href={'http://' + url} target="_blank">
                        {pageData.title}
                    </a>
                    <a href={'http://' + url} target="_blank"> {url} </a>
                </div>
                <div>
                    { expand
                        ? <Button
                            icon="angle-up"
                            text="Collapse"
                            onClick={handleExpand} />
                        : <Button
                            icon="angle-down"
                            text="Expand"
                            onClick={handleExpand}/> }

                    <Button icon="trash-can"
                        text="Delete" onClick={handlePageDelete}/>
                </div>
            </div> {expand && <> {
                pageData.scrolls.map(d => <GenericScroll
                    scrollDetails={d} key={d.uuid}
                    onJump={() => { window.open('http://' + url) }}
                    // TODO: add fragmented identifiers
                    patchScroll={patchScroll}
                    setPageData={setPageData}
                    pageData={pageData}
                />)
            } </>}
        </div>
    }


main()
