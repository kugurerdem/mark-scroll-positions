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
            .render(<Boot activeTab={activeTab} />)
    },

    Boot = ({activeTab}) => {
        const
            {hostname, pathname} = new URL(activeTab.url),

            absoluteURL = hostname.concat(pathname),

            [scrolls, setScrolls] = useState([])

        return <Context.Provider value={{
            activeTab, absoluteURL,
            scrolls, setScrolls,
        }}>
            <App />
        </Context.Provider>
    },

    App = () => {
        const
            {activeTab, absoluteURL, scrolls, setScrolls} = useContext(Context),

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
        dateISO,
        uuid,
    }) => {
        const
            {activeTab, absoluteURL, setScrolls} = useContext(Context),

            onJump = () => {
                chrome.scripting.executeScript({
                    target: {tabId: activeTab.id},
                    func: jumpToScrollPosition,
                    args: [{scrollPosition, viewportHeight, contentHeight}],
                })
            },

            onRemove = async () => {
                const pageData =
                    (await chrome.storage.local.get(absoluteURL))[absoluteURL]

                pageData.scrolls = pageData.scrolls.filter(s => s.uuid != uuid)

                chrome.storage.local.set({[absoluteURL] : pageData})
                    .then(() => {
                        setScrolls(pageData.scrolls)
                    })
            }

        return <div className="scroll">
            <span>
                {Math.ceil(
                    100 * ((scrollPosition + viewportHeight) / contentHeight))
                }%
            </span>
            <span>
                { dateISO.slice(0, 'XXXX-XX-XX'.length) }
            </span>
            <button onClick={onJump}>
                <img src="./assets/svgs/up.svg"/>
            </button>
            <button onClick={onRemove}>
                <img src="./assets/svgs/trash-can.svg"/>
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
                dateISO: (new Date()).toISOString(),
                uuid: crypto.randomUUID(),
            },

            pageData =
            // eslint-disable-next-line max-len
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
