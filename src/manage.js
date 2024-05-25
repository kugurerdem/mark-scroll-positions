const
    {createRoot} = require('react-dom/client'),
    {useState} = require('react'),

    {TextInput, Button, calculateScrollPercentage} = require('./utils.js'),

    {entries} = Object,

    main = async () => {
        const pageDetailsByURL = await chrome.storage.local.get()

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

    Page = ({
        url,
        details,
    }) => {
        const
            [expand, setExpand] = useState(false),

            handleExpand = () => {
                setExpand(!expand)
            },

            maxPercentage = Math.max(
                0, ...details.scrolls.map(calculateScrollPercentage)
            )

        return <div className="page">
            <div className="pageInfo">
                <span> {maxPercentage}% </span>
                <div className="pageHeader">
                    <span> {details.title} </span>
                    <span> {url} </span>
                </div>
                <div>
                    <Button icon="angle-down"
                        text="Expand" onClick={handleExpand}/>
                    <Button icon="trash-can" text="Delete" />
                </div>
            </div>
            {expand && <> expanded </>}
        </div>
    }

    // TODO: Get Scrolls from


main()
