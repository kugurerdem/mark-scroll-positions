const
    {createRoot} = require('react-dom/client'),
    {useState} = require('react'),

    {TextInput, Button, GenericScroll,
        calculateScrollPercentage, usePageDataState} = require('./utils.js'),

    {entries} = Object,

    main = async () => {
        const pageDetailsByURL = await chrome.storage.local.get()
        // TODO: Change this with a state

        createRoot(document.getElementById('app'))
            .render(<App pageDetailsByURL={pageDetailsByURL} />)
    },

    App = ({pageDetailsByURL}) => {
        const [searchText, setSearchText] = useState(null)
        return <main>
            <h1> Your Marked Scroll Positions </h1>
            <TextInput label="search"
                onChange={setSearchText} className="search"/>
            <p> {searchText} </p>
            { entries(pageDetailsByURL)
                .filter(([url, details]) => (
                    !searchText
                    || url.includes(searchText)
                    || details.title.includes(searchText)
                    || details.scrolls.some(s => s.note?.includes(searchText))
                ))
                .map(([url, details], idx) =>
                    <Page {...{url, details}} key={idx}/>) }
        </main>
    },

    Page = ({ url }) => {
        const
            [pageData, setPageData, patchScroll] = usePageDataState(url),

            [expand, setExpand] = useState(false),

            handleExpand = () => {
                setExpand(!expand)
            },

            maxPercentage = Math.max(
                0, ...pageData.scrolls.map(calculateScrollPercentage)
            )

        return <div className="page">
            <div className="pageInfo">
                <span> {maxPercentage}% </span>
                <div className="pageHeader">
                    <span> {pageData.title} </span>
                    <span> {url} </span>
                </div>
                <div>
                    <Button icon="angle-down"
                        text="Expand" onClick={handleExpand}/>
                    <Button icon="trash-can" text="Delete" />
                </div>
            </div> {expand && <> {
                pageData.scrolls.map(d => <GenericScroll
                    {...d} key={d.uuid}
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
