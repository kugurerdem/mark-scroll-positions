import {useState, useEffect} from 'react'
import {SortableContext, arrayMove} from '@dnd-kit/sortable'
import {DndContext, DragEndEvent} from '@dnd-kit/core'
import {restrictToVerticalAxis} from '@dnd-kit/modifiers'
import {useSortable} from '@dnd-kit/sortable'
import {CSS} from '@dnd-kit/utilities'

import type {
    ScrollDetails,
    PageData,
    TextInputProps,
    ButtonProps,
    GenericScrollProps,
    SortableScrollListProps,
    UsePageDataStateReturn,
} from './types'

const {assign} = Object

export const TextInput = ({
    label,
    value,
    onChange = () => {},
    onBlur = () => {},
    type = 'input',
    className,
}: TextInputProps) => {
    const [currentText, setCurrentText] = useState(value)
    const [savedText, setSavedText] = useState(value)

    const handleInputChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        setCurrentText(e.target.value)
        onChange(e.target.value)
    }

    const handleBlur = () => {
        if (savedText != currentText) onBlur(currentText)
        setSavedText(currentText)
    }

    const handleKeyDown = (
        e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        if (e.key == 'Enter') (e.target as HTMLElement).blur()
    }

    const props = {
        type: 'text' as const,
        value: currentText,
        onChange: handleInputChange,
        onBlur: handleBlur,
        onKeyDown: type == 'input' ? handleKeyDown : undefined,
    }

    return (
        <div className={className}>
            {label && <label> {label} </label>}
            {type == 'input' ? <input {...props} /> : <textarea {...props} />}
        </div>
    )
}

export const Button = ({text, icon, onClick, ...buttonProps}: ButtonProps) => {
    const iconPath = `/assets/svgs/${icon}.svg`
    return (
        <button {...buttonProps} onClick={onClick}>
            {icon && <img src={iconPath} className="icon" />}
            {text && <span> {text} </span>}
        </button>
    )
}

export const SortableScrollList = ({
    children,
    pageData,
    setPageData,
}: SortableScrollListProps) => {
    const handleDragEnd = (e: DragEndEvent) => {
        if (e.over && e.active.id != e.over.id) {
            const [oldIndex, newIndex] = [e.active.id, e.over.id].map((id) =>
                pageData.scrolls.findIndex((s) => s.uuid == id)
            )

            setPageData({
                ...pageData,
                scrolls: arrayMove(pageData.scrolls, oldIndex, newIndex),
            })
        }
    }

    return (
        <DndContext onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis]}>
            <SortableContext
                items={pageData.scrolls.map((s) => ({...s, id: s.uuid}))}
                children={children}
            />
        </DndContext>
    )
}

export const GenericScroll = ({
    scrollDetails,
    onJump,
    pageData,
    setPageData,
    patchScroll,
}: GenericScrollProps) => {
    const {name, note, dateISO, uuid} = scrollDetails

    const [displayNote, setDisplayNote] = useState(Boolean(note))

    const {attributes, listeners, setNodeRef, transform, transition} =
        useSortable({id: uuid})

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    }

    const handleAddNote = () => {
        setDisplayNote(true)
    }
    const onNoteChange = (note: string) => {
        patchScroll(uuid, {note})
    }
    const onNameChange = (name: string) => {
        patchScroll(uuid, {name})
    }

    const onRemove = () => {
        const scrolls = pageData.scrolls.filter((s) => s.uuid != uuid)
        setPageData({...pageData, scrolls})
    }

    return (
        <div ref={setNodeRef} className="scroll" style={style}>
            <TextInput label="Scroll name" value={name} onBlur={onNameChange} />
            <div className="scroll-details">
                <span> {calculateScrollPercentage(scrollDetails)}% </span>
                <span> {dateISO.slice(0, 'XXXX-XX-XX'.length)} </span>
                <span>
                    <Button onClick={onJump} icon="location-arrow" />
                    <Button onClick={onRemove} icon="trash-can" />
                    {!displayNote && (
                        <Button onClick={handleAddNote} icon="note-sticky" />
                    )}
                    <Button icon="up-down-left-right" {...attributes} {...listeners} />
                </span>
            </div>
            {displayNote && (
                <TextInput
                    type="textarea"
                    label="Note"
                    value={note}
                    onBlur={onNoteChange}
                />
            )}
        </div>
    )
}

export const usePageDataState = (absoluteURL: string): UsePageDataStateReturn => {
    const [pageData, setPageData] = useState<PageData>({scrolls: [], title: null})

    const customSetPageData = (data: PageData) => {
        chrome.storage.local.set({[absoluteURL]: data}).then(() => setPageData(data))
    }

    const patchScroll = (uuid: string, patch: Partial<ScrollDetails>) => {
        const scrolls = pageData.scrolls.map((s) => {
            if (s.uuid == uuid) assign(s, patch)
            return s
        })

        customSetPageData({...pageData, scrolls})
    }

    useEffect(() => {
        chrome.storage.local.get(absoluteURL).then((r) => {
            const p = r[absoluteURL] as PageData | undefined
            if (p && p.scrolls?.length && p.title) setPageData(p)
        })
    }, [])

    return [pageData, customSetPageData, patchScroll]
}

export const calculateScrollPercentage = (d: ScrollDetails): number =>
    Math.ceil((100 * (d.scrollPosition + d.viewportHeight)) / d.contentHeight)
