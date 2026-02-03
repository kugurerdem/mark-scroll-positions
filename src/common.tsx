import {useState, useEffect} from 'react'
import {format} from 'date-fns'

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

    const inputClasses = "w-full px-3 py-2 border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"

    const props = {
        type: 'text' as const,
        value: currentText,
        onChange: handleInputChange,
        onBlur: handleBlur,
        onKeyDown: type == 'input' ? handleKeyDown : undefined,
        className: inputClasses,
    }

    return (
        <div className={`mb-2 ${className || ''}`}>
            {label && <label className="block text-sm text-slate-600 mb-1"> {label} </label>}
            {type == 'input' ? <input {...props} /> : <textarea {...props} />}
        </div>
    )
}

export const Button = ({text, icon, onClick, ...buttonProps}: ButtonProps) => {
    const iconPath = `/assets/svgs/${icon}.svg`
    return (
        <button
            {...buttonProps}
            onClick={onClick}
            className="p-2 hover:scale-110 transition-transform cursor-pointer"
        >
            {icon && <img src={iconPath} className="w-4 h-4 inline-block pointer-events-none" />}
            {text && <span className="ml-1 pointer-events-none"> {text} </span>}
        </button>
    )
}

export const SortableScrollList = ({
    children,
    pageData,
    setPageData,
}: SortableScrollListProps) => {
    const [draggedId, setDraggedId] = useState<string | null>(null)
    const [dragOverId, setDragOverId] = useState<string | null>(null)

    const handleDragStart = (e: React.DragEvent, uuid: string) => {
        setDraggedId(uuid)
        e.dataTransfer.effectAllowed = 'move'
    }

    const handleDragOver = (e: React.DragEvent, uuid: string) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        if (uuid !== draggedId) {
            setDragOverId(uuid)
        }
    }

    const handleDragLeave = () => {
        setDragOverId(null)
    }

    const handleDrop = (targetUuid: string) => {
        if (draggedId && draggedId !== targetUuid) {
            const scrolls = [...pageData.scrolls]
            const dragIdx = scrolls.findIndex((s) => s.uuid === draggedId)
            const dropIdx = scrolls.findIndex((s) => s.uuid === targetUuid)
            const [removed] = scrolls.splice(dragIdx, 1)
            scrolls.splice(dropIdx, 0, removed)
            setPageData({...pageData, scrolls})
        }
        setDraggedId(null)
        setDragOverId(null)
    }

    const handleDragEnd = () => {
        setDraggedId(null)
        setDragOverId(null)
    }

    return (
        <div>
            {pageData.scrolls.map((scroll) => {
                const isDragged = scroll.uuid === draggedId
                const isDragOver = scroll.uuid === dragOverId

                return (
                    <div
                        key={scroll.uuid}
                        draggable
                        onDragStart={(e) => handleDragStart(e, scroll.uuid)}
                        onDragOver={(e) => handleDragOver(e, scroll.uuid)}
                        onDragLeave={handleDragLeave}
                        onDrop={() => handleDrop(scroll.uuid)}
                        onDragEnd={handleDragEnd}
                        className={`transition-all duration-150 ${
                            isDragged ? 'opacity-50 scale-95' : ''
                        } ${isDragOver ? 'ring-2 ring-blue-400 ring-offset-2 rounded-xl' : ''}`}
                    >
                        {children.find((child: any) => child.key === scroll.uuid)}
                    </div>
                )
            })}
        </div>
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
    const [editingName, setEditingName] = useState(false)
    const [nameValue, setNameValue] = useState(name)

    const handleAddNote = () => {
        setDisplayNote(true)
    }
    const onNoteChange = (note: string) => {
        patchScroll(uuid, {note})
    }
    const handleNameClick = () => {
        setEditingName(true)
    }
    const handleNameBlur = () => {
        setEditingName(false)
        if (nameValue !== name) {
            patchScroll(uuid, {name: nameValue})
        }
    }
    const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            (e.target as HTMLInputElement).blur()
        }
    }

    const onRemove = () => {
        const scrolls = pageData.scrolls.filter((s) => s.uuid != uuid)
        setPageData({...pageData, scrolls})
    }

    return (
        <div className="bg-white border border-slate-200 rounded-xl p-4 m-2 shadow-sm cursor-grab">
            {editingName ? (
                <input
                    type="text"
                    value={nameValue}
                    onChange={(e) => setNameValue(e.target.value)}
                    onBlur={handleNameBlur}
                    onKeyDown={handleNameKeyDown}
                    autoFocus
                    className="text-slate-700 font-medium mb-2 w-full px-1 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            ) : (
                <div
                    className="text-slate-700 font-medium mb-2 cursor-text hover:text-blue-600"
                    onClick={handleNameClick}
                >
                    {name}
                </div>
            )}
            <div className="w-full flex items-center justify-between">
                <span className="text-slate-600"> {calculateScrollPercentage(scrollDetails)}% </span>
                <span className="text-slate-500 text-sm"> {format(new Date(dateISO), 'MMM d, yyyy')} </span>
                <span>
                    <Button onClick={onJump} icon="location-arrow" />
                    <Button onClick={onRemove} icon="trash-can" />
                    {!displayNote && (
                        <Button onClick={handleAddNote} icon="note-sticky" />
                    )}
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
