import {useState, useEffect} from 'react'
import {format} from 'date-fns'
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome'
import {
    faArrowDownWideShort,
    faArrowUpWideShort,
    faAngleUp,
    faAngleDown,
    faTrashCan,
    faNoteSticky,
} from '@fortawesome/free-solid-svg-icons'

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

    const inputClasses = "w-full px-3 py-2 border border-cream-300 rounded-lg bg-white font-body text-[13px] text-ink-700 outline-none transition-all focus:border-amber-400 focus:shadow-[0_0_0_3px_rgba(245,158,11,0.1)] placeholder:text-ink-300"

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
            {label && <label className="block text-xs font-medium text-ink-400 mb-1 uppercase tracking-wider"> {label} </label>}
            {type == 'input' ? <input {...props} /> : <textarea {...props} />}
        </div>
    )
}

export const Button = ({text, icon, onClick, ...buttonProps}: ButtonProps) => {
    return (
        <button
            {...buttonProps}
            onClick={onClick}
            className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-transparent text-ink-500 cursor-pointer transition-all hover:bg-amber-100 hover:text-amber-700 hover:scale-110"
        >
            {icon && <FontAwesomeIcon icon={icon} className="w-3.5 h-3.5 text-current pointer-events-none" />}
            {text && <span className="ml-1 text-sm font-medium text-ink-700 pointer-events-none"> {text} </span>}
        </button>
    )
}

const CircularProgress = ({percentage}: {percentage: number}) => {
    const size = 26
    const strokeWidth = 2.5
    const radius = (size - strokeWidth) / 2
    const circumference = 2 * Math.PI * radius
    const offset = circumference - (percentage / 100) * circumference

    return (
        <svg width={size} height={size} className="transform -rotate-90 flex-shrink-0">
            <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="#ede4d6"
                strokeWidth={strokeWidth}
            />
            <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="#d97706"
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                className="transition-all duration-500"
            />
        </svg>
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
        <div className="flex flex-col gap-1.5">
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
                            isDragged ? 'opacity-40 scale-[0.97]' : ''
                        } ${isDragOver ? 'outline-2 outline-amber-400 outline-offset-2 rounded-xl' : ''}`}
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

    const [expanded, setExpanded] = useState(false)
    const percentage = calculateScrollPercentage(scrollDetails)
    const nameInputSize = Math.min(Math.max((nameValue || '').length + 1, 10), 40)
    const jumpIcon = percentage > 50 ? faArrowUpWideShort : faArrowDownWideShort
    const jumpLabel =
        percentage > 50
            ? 'Jump up to saved position'
            : 'Jump down to saved position'

    return (
        <div className="bg-cream-100 border border-cream-300 rounded-xl px-3.5 py-2.5 cursor-grab transition-all duration-200 hover:border-amber-300 hover:shadow-[0_2px_12px_-2px_rgba(245,158,11,0.12),0_1px_4px_-1px_rgba(0,0,0,0.05)] hover:-translate-y-px active:cursor-grabbing">
            <div className="flex items-center gap-2.5">
                <CircularProgress percentage={percentage} />
                <div className="flex flex-col min-w-0 flex-1 cursor-grab">
                    {editingName ? (
                        <input
                            type="text"
                            value={nameValue}
                            size={nameInputSize}
                            onChange={(e) => setNameValue(e.target.value)}
                            onBlur={handleNameBlur}
                            onKeyDown={handleNameKeyDown}
                            autoFocus
                            className="text-ink-700 font-medium text-sm min-w-0 max-w-full self-start px-1.5 py-0.5 border border-amber-300 rounded-md bg-white outline-none cursor-text focus:shadow-[0_0_0_2px_rgba(245,158,11,0.15)]"
                        />
                    ) : (
                        <span
                            className={`inline-block w-fit font-medium text-sm cursor-text truncate max-w-48 transition-colors hover:text-amber-700 ${name ? 'text-ink-700' : 'text-ink-300 italic'}`}
                            onClick={handleNameClick}
                        >
                            {name || 'Add a title'}
                        </span>
                    )}
                    <span className="text-[10px] text-ink-300 font-medium">
                        {percentage}% scrolled
                    </span>
                </div>
                <span className="ml-auto flex-shrink-0 flex items-center gap-0.5">
                    <button
                        onClick={onJump}
                        title={jumpLabel}
                        aria-label={jumpLabel}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-amber-500/10 text-amber-700 cursor-pointer transition-all hover:bg-amber-500/20 hover:scale-110"
                    >
                        <FontAwesomeIcon icon={jumpIcon} className="w-3 h-3 text-current pointer-events-none" />
                    </button>
                    <Button onClick={() => setExpanded(!expanded)} icon={expanded ? faAngleUp : faAngleDown} />
                </span>
            </div>
            {expanded && (
                <div className="mt-2 pt-2 border-t border-cream-300/60 animate-fade-in-up">
                    <div className="w-full flex items-center justify-between">
                        <span className="text-ink-400 text-xs"> {format(new Date(dateISO), 'MMM d, yyyy')} </span>
                        <span className="flex items-center gap-0.5">
                            <Button onClick={onRemove} icon={faTrashCan} />
                            {!displayNote && (
                                <Button onClick={handleAddNote} icon={faNoteSticky} />
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
