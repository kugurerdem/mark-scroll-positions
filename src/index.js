const
    {createRoot} = require('react-dom/client'),

    {useState, useCallback, useEffect,
        createContext, useContext} = require('react'),

    Context = createContext(),

    main = async () => {
        const
            [activeTab] = await chrome.tabs.query(
                {active: true, lastFocusedWindow: true},
            )

        createRoot(document.getElementById('app'))
            .render(
                <Context.Provider value={{activeTab}}>
                    <App />
                </Context.Provider>,
            )
    },

    App = () => {
        const
            [scrolls, setScrolls] = useState([]),
            {activeTab} = useContext(Context),

            onSave = useCallback(() => {
                chrome.scripting.executeScript({
                    target: {tabId: activeTab.id},
                    func: saveScrollDetails,
                })
                    .then((injectionResults) => {
                        const {result} = injectionResults[0]
                        console.log(result)
                        setScrolls(result)
                    })
            }, [])

        useEffect(() => {
            const
                {hostname, pathname} = new URL(activeTab.url),

                absoluteURL = hostname.concat(pathname)

            chrome.storage.local.get(absoluteURL)
                .then(r => setScrolls(r[absoluteURL]?.scrolls || []))
        }, [])

        return <>
            <button type="button" className="save-btn" onClick={onSave}>
                Save Scroll Position
            </button>
            { scrolls.map(
                (details, idx) =>
                    <Scroll {...details} key={idx} />,
            ) }
        </>
    },

    Scroll = ({
        scrollPosition,
        viewportHeight,
        contentHeight,
    }) => {
        const
            {activeTab} = useContext(Context),

            onJump = () => {
                chrome.scripting.executeScript({
                    target: {tabId: activeTab.id},
                    func: jumpToScrollPosition,
                    args: [{scrollPosition, viewportHeight, contentHeight}],
                })
            }

        return <div className="scroll">
            <span>
                {Math.ceil(
                    100 * ((scrollPosition + viewportHeight) / contentHeight))
                }%
            </span>
            <button onClick={onJump}>
                <img src="./assets/svgs/up.svg"/>
            </button>
        </div>
    },

    // CONTENT SCRIPTS

    // NOTE: Below are content scripts, they run on a seperate environment and
    // thus they cannot use things in outer scope of their function

    saveScrollDetails = async () => {
        const
            absoluteURL =
                window.location.hostname.concat(window.location.pathname),

            scrollDetails = {
                // NOTE: scrollPosition + viewportHeight = contentHeight
                scrollPosition: window.pageYOffset,
                viewportHeight: window.innerHeight,
                contentHeight: document.body.scrollHeight,
            },

            pageData =
                (await chrome.storage.local.get(absoluteURL))[absoluteURL] || {},

            scrolls = pageData.scrolls || [],

            title = pageData.title || document.title

        scrolls.push(scrollDetails)
        await chrome.storage.local.set({
            [absoluteURL]: {title, scrolls},
        })

        return scrolls
    },

    jumpToScrollPosition = ({
        scrollPosition,
        viewportHeight,
        contentHeight,
    }) => {
        const
            percentage = scrollPosition / (contentHeight - viewportHeight),
            toJumpPositionY =
                percentage * (document.body.scrollHeight - window.innerHeight)

        window.scrollTo(0, toJumpPositionY)
    }


main()
