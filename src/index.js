const
    {createRoot} = require('react-dom/client'),
    {useState, useCallback, useEffect} = require('react'),

    main = async () => {
        const
            [activeTab] = await chrome.tabs.query(
                { active: true, lastFocusedWindow: true }
            )

        createRoot(document.getElementById('app'))
            .render(<App activeTab={activeTab}/>)
    },

    App = ({activeTab}) => {
        const
            [scrolls, setScrolls] = useState([]),

            onSave = useCallback(() => {
                chrome.scripting.executeScript({
                    target: { tabId: activeTab.id },
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
                .then(r => setScrolls(r[absoluteURL] || []))
        }, [])

        return <>
            <button type="button" className="save-btn" onClick={onSave}>
                Save Scroll Position
            </button>
            <span>
            { JSON.stringify(scrolls) }
            </span>
        </>
    },

    // CONTENT SCRIPTS

    // NOTE: Below are content scripts, they run on a seperate environment and
    // thus they cannot use things in outer scope of their function

    saveScrollDetails = async () => {
        const
            absoluteURL =
                window.location.hostname.concat(window.location.pathname),

            scrollDetails = {
                offset: window.pageYOffset,
                total: document.body.scrollHeight,
            },

            scrolls =
                (await chrome.storage.local.get(absoluteURL))[absoluteURL] || []

        scrolls.push(scrollDetails)
        await chrome.storage.local.set({ [absoluteURL]: scrolls })
        return scrolls
    }


main()
