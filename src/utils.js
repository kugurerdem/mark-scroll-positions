const
    {useState, useEffect} = require('react'),

    {useSortable} = require('@dnd-kit/sortable'),
    {CSS} = require('@dnd-kit/utilities'),

    {assign} = Object,

    TextInput = ({
        label, value,
        onChange = () => {},
        onBlur = () => {},
        type='input',
        className,
    }) => {
        const
            [currentText, setCurrentText] = useState(value),
            [savedText, setSavedText] = useState(value),

            handleInputChange = (e) => {
                setCurrentText(e.target.value)
                onChange(e.target.value)
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


        return <div className={className}>
            { label && <label> {label} </label> }
            { type == 'input' ? <input {...props}/> : <textarea {...props} /> }
        </div>
    },

    Button = ({text, icon, onClick, ...buttonProps}) => {
        const iconPath = `./assets/svgs/${icon}.svg`
        return <button {...buttonProps} onClick={onClick}>
            {icon && <img src={iconPath} className="icon"/>}
            {text && <span> {text} </span>}
        </button>
    },

    GenericScroll = ({
        scrollDetails,
        onJump,
        pageData, setPageData, patchScroll,
    }) => {
        const
            {name, note, scrollPosition, viewportHeight,
                contentHeight, dateISO, uuid} = scrollDetails,

            [displayNote, setDisplayNote] = useState(Boolean(note)),

            {attributes, listeners, setNodeRef,
                transform, transition} = useSortable({id: uuid}),

            style = {
                transform: CSS.Transform.toString(transform),
                transition,
            },

            handleAddNote = () => { setDisplayNote(true) },
            onNoteChange = (note) => { patchScroll(uuid, {note}) },
            onNameChange = (name) => { patchScroll(uuid, {name}) },

            onRemove = () => {
                const scrolls = pageData.scrolls.filter(s => s.uuid != uuid)
                setPageData({...pageData, scrolls})
            }

        return <div ref={setNodeRef} className="scroll" style={style} >
            <TextInput label="Scroll name" value={name} onBlur={onNameChange}/>
            <div className="scroll-details">
                <span> {calculateScrollPercentage(scrollDetails)}% </span>
                <span> { dateISO.slice(0, 'XXXX-XX-XX'.length) } </span>
                <span>
                    <Button onClick={onJump} icon="location-arrow" />
                    <Button onClick={onRemove} icon="trash-can" />
                    {!displayNote &&
                        <Button onClick={handleAddNote} icon="note-sticky" />}
                    <Button icon="up-down-left-right"
                        {...attributes} {...listeners} />
                </span>
            </div>
            { displayNote &&
                <TextInput
                    type="textarea"
                    label="Note" value={note} onBlur={onNoteChange} /> }
        </div>
    },

    usePageDataState = (absoluteURL) => {
        const
            [pageData, setPageData] = useState({scrolls: [], title: null}),

            customSetPageData = data =>
                chrome.storage.local.set({[absoluteURL] : data})
                    .then(() => setPageData(data)),

            patchScroll = (uuid, patch) => {
                const scrolls = pageData.scrolls.map(s => {
                    if (s.uuid == uuid)
                        assign(s, patch)
                    return s
                })

                customSetPageData({...pageData, scrolls})
            }

        useEffect(() => {
            chrome.storage.local.get(absoluteURL).then(r => {
                const p = r[absoluteURL]
                if ( p && p.scrolls?.length && p.title )
                    setPageData(p)
            })
        }, [])

        return [pageData, customSetPageData, patchScroll]
    },

    calculateScrollPercentage = (d) =>
        Math.ceil(100 * (d.scrollPosition + d.viewportHeight) / d.contentHeight)


module.exports = {
    TextInput, Button, GenericScroll,
    usePageDataState, calculateScrollPercentage,
}
