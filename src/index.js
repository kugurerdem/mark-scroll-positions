const
    {createRoot} = require('react-dom/client'),

    {useState, useCallback, useEffect,
        createContext, useContext} = require('react'),

    {DndContext} = require('@dnd-kit/core'),
    {SortableContext, useSortable, arrayMove} = require('@dnd-kit/sortable'),
    {CSS} = require('@dnd-kit/utilities'),
    {restrictToVerticalAxis} = require('@dnd-kit/modifiers'),

    {calculateScrollPercentage, Button, TextInput} = require('./utils'),

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
            }, []),

            handleDragEnd = (e) => {
                const {active, over} = e

                console.log({active, over})

                if(over && active.id != over.id){
                    const
                        oldIndex =
                            pageData.scrolls.findIndex(s => s.uuid == active.id),

                        newIndex =
                            pageData.scrolls.findIndex(s => s.uuid == over.id)

                    setPageData({
                        ...pageData,
                        scrolls: arrayMove(pageData.scrolls, oldIndex, newIndex)
                    })
                }
            }

        return <>
            <Button icon="bookmark" text="Mark" onClick={onSave} />
            <DndContext
                onDragEnd={handleDragEnd}
                modifiers={[restrictToVerticalAxis]}
            >
                <SortableContext items={
                    pageData.scrolls.map(s => ({...s, id: s.uuid}))
                }>
                    {pageData.scrolls.map(
                        (details) =>
                            <Scroll {...details} key={details.uuid} />,
                    )}
                </SortableContext>
            </DndContext>
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

            {attributes, listeners, setNodeRef,
                transform, transition} = useSortable({id: uuid}),

            style = {
                transform: CSS.Transform.toString(transform),
                transition,
            },

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

        return (<div
            ref={setNodeRef}
            className="scroll"
            style={style}
        >
            <TextInput
                label="Scroll name" value={name} onBlur={handleNameInputSave}/>
            <div className="scroll-details">
                <span>
                {calculateScrollPercentage(
                    {scrollPosition, viewportHeight, contentHeight},
                )}%
                </span>
                <span> { dateISO.slice(0, 'XXXX-XX-XX'.length) } </span>
                <span>
                    <Button onClick={onJump} icon="location-arrow" />
                    <Button onClick={onRemove} icon="trash-can" />

                    { !displayNote
                        && <Button onClick={handleAddNote} icon="pen" /> }

                    <button {...attributes} {...listeners}>
                        <img src="./assets/svgs/up-down-left-right.svg"
                            className="icon" />
                    </button>
                </span>
            </div>
            { displayNote &&
            <TextInput
                type="textarea"
                label="Note" value={note} onBlur={handleNoteInputSave} /> }
        </div>)
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
