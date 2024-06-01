const
    {createRoot} = require('react-dom/client'),

    {useCallback, createContext, useContext} = require('react'),

    {Button, GenericScroll,
        SortableScrollList, usePageDataState} = require('./common'),

    Context = createContext(),

    main = async () => {
        const [activeTab] =
            await chrome.tabs.query({active: true, lastFocusedWindow: true})

        createRoot(document.getElementById('app'))
            .render(<Boot activeTab={activeTab} />)
    },

    Boot = ({activeTab}) => {
        const
            {hostname, pathname} = new URL(activeTab.url),
            absoluteURL = hostname.concat(pathname),

            [pageData, setPageData, patchScroll] = usePageDataState(absoluteURL)

        return <Context.Provider
            value={{activeTab, absoluteURL, pageData, setPageData, patchScroll}}
            children = { <App/> }
        />
    },

    App = () => {
        const
            {activeTab, pageData, setPageData} = useContext(Context),

            onSave = useCallback(() => {
                chrome.scripting.executeScript({
                    target: {tabId: activeTab.id},
                    func: saveScrollDetails,
                })
                    .then((injectionResults) => {
                        const {result} = injectionResults[0]
                        setPageData(result)
                    })
            }, [])

        return <>
            <Button icon="bookmark" text="Mark" onClick={onSave} />
            <Button icon="book-bookmark" text="All Marks"
                onClick={() => {window.open('./manage.html')}}/>

            <SortableScrollList
                children={pageData.scrolls.map((details) =>
                    <Scroll scrollDetails={details} key={details.uuid} />)}
                pageData={pageData}
                setPageData={setPageData}
            />
        </>
    },

    Scroll = ({scrollDetails}) => {
        const
            {activeTab, pageData,
                setPageData, patchScroll} = useContext(Context),

            onJump = () => {
                chrome.scripting.executeScript({
                    target: {tabId: activeTab.id},
                    func: jumpToScrollPosition,
                    args: [scrollDetails],
                })
            }


        return GenericScroll({
            scrollDetails,
            onJump,
            pageData, setPageData, patchScroll,
        })
    },


    // CONTENT SCRIPTS

    // NOTE: Below are content scripts, they run on a seperate environment and
    // thus they cannot use things in outer scope of their function

    saveScrollDetails = async () => {
        const
            absoluteURL =
                window.location.hostname.concat(window.location.pathname),

            uuid = crypto.randomUUID(),

            scrollDetails = {
                // NOTE: scrollPosition + viewportHeight = contentHeight
                scrollPosition: window.pageYOffset,
                viewportHeight: window.innerHeight,
                contentHeight: document.body.scrollHeight,
                dateISO: (new Date()).toISOString(),
                uuid,
                name: uuid,
                note: '',
            },

            pageData =
                ((await chrome.storage.local.get(absoluteURL))[absoluteURL]
                    || {scrolls: [], title: document.title})

        pageData.scrolls.push(scrollDetails)

        await chrome.storage.local.set({[absoluteURL]: pageData})

        return pageData
    },

    jumpToScrollPosition = ({
        scrollPosition, viewportHeight, contentHeight,
    }) => {
        const
            percentage = scrollPosition / (contentHeight - viewportHeight),
            toJumpPositionY =
                percentage * (document.body.scrollHeight - window.innerHeight)

        window.scrollTo(0, toJumpPositionY)
    }


main()
