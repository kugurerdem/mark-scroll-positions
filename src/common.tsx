import {useState, useEffect} from 'react'
import {format} from 'date-fns'
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome'
import {faPlay, faAngleUp, faAngleDown, faTrashCan, faNoteSticky} from '@fortawesome/free-solid-svg-icons'

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

const isInteractiveTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) return false

    return Boolean(
        target.closest(
            'input, textarea, select, button, a, label, [contenteditable="true"]'
        )
    )
}

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

    const inputClasses = 'text-field__control'

    const props = {
        type: 'text' as const,
        value: currentText,
        onChange: handleInputChange,
        onBlur: handleBlur,
        onKeyDown: type == 'input' ? handleKeyDown : undefined,
        className: inputClasses,
        draggable: false,
    }

    return (
        <div className={`text-field ${className || ''}`.trim()}>
            {label && <label className="text-field__label"> {label} </label>}
            {type == 'input' ? <input {...props} /> : <textarea {...props} />}
        </div>
    )
}

export const Button = ({text, icon, onClick, ...buttonProps}: ButtonProps) => {
    return (
        <button
            {...buttonProps}
            onClick={onClick}
            className="icon-button"
        >
            {icon && <FontAwesomeIcon icon={icon} className="icon icon--sm" />}
            {text && <span className="icon-button__text"> {text} </span>}
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
        <svg width={size} height={size} className="progress-ring">
            <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="var(--color-cream-300)"
                strokeWidth={strokeWidth}
            />
            <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="var(--color-accent-600)"
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                className="progress-ring__value"
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
        if (isInteractiveTarget(e.target)) {
            e.preventDefault()
            return
        }

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

    const handlePointerDownCapture = (e: React.PointerEvent<HTMLDivElement>) => {
        e.currentTarget.draggable = !isInteractiveTarget(e.target)
    }

    const restoreDraggable = (e: React.PointerEvent<HTMLDivElement>) => {
        e.currentTarget.draggable = true
    }

    return (
        <div className="scroll-list">
            {pageData.scrolls.map((scroll) => {
                const isDragged = scroll.uuid === draggedId
                const isDragOver = scroll.uuid === dragOverId

                return (
                    <div
                        key={scroll.uuid}
                        draggable
                        onPointerDownCapture={handlePointerDownCapture}
                        onPointerUpCapture={restoreDraggable}
                        onPointerCancelCapture={restoreDraggable}
                        onDragStart={(e) => handleDragStart(e, scroll.uuid)}
                        onDragOver={(e) => handleDragOver(e, scroll.uuid)}
                        onDragLeave={handleDragLeave}
                        onDrop={() => handleDrop(scroll.uuid)}
                        onDragEnd={handleDragEnd}
                        className={`scroll-list__item-shell${
                            isDragged ? ' scroll-list__item-shell--dragged' : ''
                        }${isDragOver ? ' scroll-list__item-shell--drag-over' : ''}`}
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
    const hasNote = note.trim().length > 0

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

    return (
        <div className="scroll-card">
            <div className="scroll-card__main">
                <CircularProgress percentage={percentage} />
                <div className="scroll-card__content">
                    {editingName ? (
                        <input
                            type="text"
                            value={nameValue}
                            size={nameInputSize}
                            onChange={(e) => setNameValue(e.target.value)}
                            onBlur={handleNameBlur}
                            onKeyDown={handleNameKeyDown}
                            draggable={false}
                            autoFocus
                            className="scroll-card__name-input"
                        />
                    ) : (
                        <span
                            className={`scroll-card__name${
                                name ? '' : ' scroll-card__name--empty'
                            }`}
                            onClick={handleNameClick}
                        >
                            {name || 'Add a title'}
                        </span>
                    )}
                    <span className="scroll-card__meta">
                        <span className="scroll-card__percentage">{percentage}% scrolled</span>
                        {!expanded && hasNote && (
                            <FontAwesomeIcon
                                icon={faNoteSticky}
                                className="icon icon--tiny scroll-card__note-indicator"
                                title="This mark has a note"
                                aria-label="This mark has a note"
                            />
                        )}
                    </span>
                </div>
                <span className="scroll-card__actions">
                    <button
                        onClick={onJump}
                        className="icon-button icon-button--accent"
                    >
                        <FontAwesomeIcon icon={faPlay} className="icon icon--xs" />
                    </button>
                    <Button onClick={() => setExpanded(!expanded)} icon={expanded ? faAngleUp : faAngleDown} />
                </span>
            </div>
            {expanded && (
                <div className="scroll-card__details animate-fade-in-up">
                    <div className="scroll-card__details-header">
                        <span className="scroll-card__date"> {format(new Date(dateISO), 'MMM d, yyyy')} </span>
                        <span className="scroll-card__detail-actions">
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
        const applyPageData = (data: PageData | undefined) => {
            setPageData(data ?? {scrolls: [], title: null})
        }

        chrome.storage.local.get(absoluteURL).then((result) => {
            applyPageData(result[absoluteURL] as PageData | undefined)
        })

        const onStorageChange: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (
            changes,
            areaName
        ) => {
            if (areaName !== 'local') return

            const changed = changes[absoluteURL]
            if (!changed) return

            applyPageData(changed.newValue as PageData | undefined)
        }

        chrome.storage.onChanged.addListener(onStorageChange)

        return () => {
            chrome.storage.onChanged.removeListener(onStorageChange)
        }
    }, [absoluteURL])

    return [pageData, customSetPageData, patchScroll]
}

export const calculateScrollPercentage = (d: ScrollDetails): number => {
    if (d.contentHeight <= 0) return 0

    const rawPercentage =
        (100 * (d.scrollPosition + d.viewportHeight)) / d.contentHeight

    if (!Number.isFinite(rawPercentage)) return 0

    return Math.min(100, Math.max(0, Math.ceil(rawPercentage)))
}
