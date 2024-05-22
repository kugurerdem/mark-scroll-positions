const
    {createRoot} = require('react-dom/client'),

    {useState, useCallback, useEffect,
        createContext, useContext, useRef} = require('react'),

    Context = createContext(),

    {assign} = Object,

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
            {activeTab,
                pageData, setPageData} = useContext(Context),

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
            <button type="button" onClick={onSave}>
                <img src="./assets/svgs/bookmark.svg" className="icon"/>
                <span> Mark </span>
            </button>

            { pageData.scrolls.map(
                (details) =>
                    <Scroll {...details} key={details.uuid} />,
            ) }
        </>
    },

    Scroll = ({
        scrollPosition,
        viewportHeight,
        contentHeight,
        dateISO,
        uuid,
        name,
        note,
    }) => {
        const
            {activeTab, pageData,
                setPageData, patchScroll} = useContext(Context),

            [displayNote, setDisplayNote] = useState(Boolean(note)),

            onJump = () => {
                chrome.scripting.executeScript({
                    target: {tabId: activeTab.id},
                    func: jumpToScrollPosition,
                    args: [{scrollPosition, viewportHeight, contentHeight}],
                })
            },

            onRemove = () => {
                const scrolls = pageData.scrolls.filter(s => s.uuid != uuid)
                setPageData({...pageData, scrolls})
            },

            handleNameInputSave = (name) => {
                patchScroll(uuid, {name})
            },

            handleNoteInputSave = (note) => {
                patchScroll(uuid, {note})
            },

            handleAddNote = () => {
                setDisplayNote(true)
            }

        return <div className="scroll">
            <TextInput
                label="Scroll name" value={name} onBlur={handleNameInputSave}/>
            <div className="scroll-details">
                <span>
                    {Math.ceil(
                        100 * (scrollPosition + viewportHeight) / contentHeight)
                    }%
                </span>
                <span> { dateISO.slice(0, 'XXXX-XX-XX'.length) } </span>
                <span>
                    <button onClick={onJump}>
                        <img
                            src="./assets/svgs/location-arrow.svg"
                            className="icon"
                        />
                    </button>
                    <button onClick={onRemove}>
                        <img
                            src="./assets/svgs/trash-can.svg"
                            className="icon"
                        />
                    </button>

                    { !displayNote &&
                        <button onClick={handleAddNote}>
                            <img src="./assets/svgs/pen.svg" className="icon"/>
                        </button> }
                </span>
            </div>
            { displayNote &&
            <TextInput
                type="textarea"
                label="Note" value={note} onBlur={handleNoteInputSave} /> }
        </div>
    },

    TextInput = ({label, value, onBlur = () => {}, type='input'}) => {
        const
            [currentText, setCurrentText] = useState(value),
            [savedText, setSavedText] = useState(value),

            handleInputChange = (e) => {
                setCurrentText(e.target.value)
            },

            handleBlur = () => {
                if (savedText != currentText)
                    onBlur(currentText)
                setSavedText(currentText)
            },

            props = {
                type: 'text',
                value: currentText,
                onChange: handleInputChange,
                onBlur: handleBlur,
            }


        return (<>
            {label && <label> {label} </label>}
            { type == 'input' ? <input {...props}/> : <textarea {...props} /> }
        </>)
    },

    usePageDataState = (absoluteURL) => {
        const
            [pageData, setPageData] = useState({
                scrolls: [],
                title: null,
            }),

            customSetPageData = data =>
                chrome.storage.local.set({[absoluteURL] : data})
                    .then(() => setPageData(data)),

            patchScroll = (uuid, patch) => {
                const scrolls = pageData.scrolls.map(s => {
                    if (s.uuid == uuid)
                        assign(s, patch)
                    return s
                })

                customSetPageData({
                    ...pageData,
                    scrolls,
                })
            }

        useEffect(() => {
            chrome.storage.local.get(absoluteURL)
                .then(r => {
                    if (
                        r[absoluteURL]
                        && r[absoluteURL].scrolls?.length
                        && r[absoluteURL].title
                    )
                        setPageData(r[absoluteURL])
                })
        }, [])

        return [pageData, customSetPageData, patchScroll]
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
            // eslint-disable-next-line max-len
                (await chrome.storage.local.get(absoluteURL))[absoluteURL] || {}

        pageData.scrolls = pageData.scrolls || []
        pageData.title = pageData.title || document.title
        pageData.scrolls.push(scrollDetails)

        await chrome.storage.local.set({
            [absoluteURL]: pageData,
        })

        return pageData
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
