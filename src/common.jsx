// @ts-check

import {useState, useEffect, useRef} from 'react'
import {Icon} from './icons.jsx'

/** @typedef {import('./types.js').ScrollDetails} ScrollDetails */
/** @typedef {import('./types.js').PageData} PageData */
/** @typedef {import('./types.js').TextInputProps} TextInputProps */
/** @typedef {import('./types.js').ButtonProps} ButtonProps */
/** @typedef {import('./types.js').GenericScrollProps} GenericScrollProps */
/** @typedef {import('./types.js').SortableScrollListProps} SortableScrollListProps */
/** @typedef {import('./types.js').UsePageDataStateReturn} UsePageDataStateReturn */

const {assign} = Object
const DRAG_THRESHOLD_PX = 4
const dateFormatter = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
})

/** @param {EventTarget | null} target @returns {boolean} */
const isInteractiveTarget = (target) => {
    if (!(target instanceof HTMLElement)) return false

    return Boolean(
        target.closest(
            'input, textarea, select, button, a, label, [contenteditable="true"]'
        )
    )
}

/** @param {TextInputProps} props */
export const TextInput = ({
    label,
    value,
    onChange = () => {},
    onBlur = () => {},
    type = 'input',
    className,
}) => {
    const [currentText, setCurrentText] = useState(value)
    const [savedText, setSavedText] = useState(value)

    /** @param {import('react').ChangeEvent<HTMLInputElement | HTMLTextAreaElement>} e */
    const handleInputChange = (e) => {
        setCurrentText(e.target.value)
        onChange(e.target.value)
    }

    const handleBlur = () => {
        if (savedText !== currentText) onBlur(currentText)
        setSavedText(currentText)
    }

    /** @param {import('react').KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>} e */
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            /** @type {HTMLElement} */ (e.target).blur()
        }
    }

    const inputClasses = 'text-field__control'

    const props = {
        type: 'text',
        value: currentText,
        onChange: handleInputChange,
        onBlur: handleBlur,
        onKeyDown: type === 'input' ? handleKeyDown : undefined,
        className: inputClasses,
        draggable: false,
    }

    return (
        <div className={`text-field ${className || ''}`.trim()}>
            {label && <label className="text-field__label"> {label} </label>}
            {type === 'input' ? <input {...props} /> : <textarea {...props} />}
        </div>
    )
}

/** @param {ButtonProps} props */
export const Button = ({text, icon, onClick, ...buttonProps}) => {
    return (
        <button
            {...buttonProps}
            onClick={onClick}
            className="icon-button"
        >
            {icon && <Icon icon={icon} className="icon icon--sm" />}
            {text && <span className="icon-button__text"> {text} </span>}
        </button>
    )
}

/** @param {{percentage: number}} props */
const CircularProgress = ({percentage}) => {
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

/**
 * @typedef {object} PointerDragState
 * @property {number | null} pointerId
 * @property {string | null} originId
 * @property {number} startX
 * @property {number} startY
 * @property {boolean} active
 * @property {string | null} dragOverId
 */

/** @param {SortableScrollListProps} props */
export const SortableScrollList = ({
    children,
    pageData,
    setPageData,
    interactionMode = 'native',
}) => {
    const [draggedId, setDraggedId] = useState(/** @type {string | null} */ (null))
    const [dragOverId, setDragOverId] = useState(/** @type {string | null} */ (null))
    const [dragOffset, setDragOffset] = useState({x: 0, y: 0})
    const pointerDragState = useRef(/** @type {PointerDragState} */ ({
        pointerId: null,
        originId: null,
        startX: 0,
        startY: 0,
        active: false,
        dragOverId: null,
    }))

    /** @param {string} sourceUuid @param {string} targetUuid */
    const moveScroll = (sourceUuid, targetUuid) => {
        if (sourceUuid === targetUuid) return

        const scrolls = [...pageData.scrolls]
        const dragIdx = scrolls.findIndex((s) => s.uuid === sourceUuid)
        const dropIdx = scrolls.findIndex((s) => s.uuid === targetUuid)

        if (dragIdx < 0 || dropIdx < 0) return

        const [removed] = scrolls.splice(dragIdx, 1)
        if (!removed) return
        scrolls.splice(dropIdx, 0, removed)
        setPageData({...pageData, scrolls})
    }

    /** @param {import('react').DragEvent<HTMLDivElement>} e @param {string} uuid */
    const handleDragStart = (e, uuid) => {
        if (isInteractiveTarget(e.target)) {
            e.preventDefault()
            return
        }

        setDraggedId(uuid)
        e.dataTransfer.effectAllowed = 'move'
    }

    /** @param {import('react').DragEvent<HTMLDivElement>} e @param {string} uuid */
    const handleDragOver = (e, uuid) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        if (uuid !== draggedId) {
            setDragOverId(uuid)
        }
    }

    const handleDragLeave = () => {
        setDragOverId(null)
    }

    /** @param {string} targetUuid */
    const handleDrop = (targetUuid) => {
        if (draggedId) moveScroll(draggedId, targetUuid)
        setDraggedId(null)
        setDragOverId(null)
    }

    const handleDragEnd = () => {
        setDraggedId(null)
        setDragOverId(null)
    }

    /** @param {import('react').PointerEvent<HTMLDivElement>} e */
    const handlePointerDownCapture = (e) => {
        if (interactionMode === 'pointer') return
        e.currentTarget.draggable = !isInteractiveTarget(e.target)
    }

    /** @param {import('react').PointerEvent<HTMLDivElement>} e */
    const restoreDraggable = (e) => {
        if (interactionMode === 'pointer') return
        e.currentTarget.draggable = true
    }

    const resetPointerDrag = () => {
        pointerDragState.current = {
            pointerId: null,
            originId: null,
            startX: 0,
            startY: 0,
            active: false,
            dragOverId: null,
        }
        setDraggedId(null)
        setDragOverId(null)
        setDragOffset({x: 0, y: 0})
    }

    /** @param {number} clientX @param {number} clientY @returns {string | null} */
    const resolveDropTarget = (clientX, clientY) => {
        const element = document.elementFromPoint(clientX, clientY)
        if (!(element instanceof HTMLElement)) return null

        const dropTarget = element.closest('[data-scroll-id]')
        return dropTarget instanceof HTMLElement
            ? dropTarget.dataset.scrollId ?? null
            : null
    }

    /** @param {import('react').PointerEvent<HTMLDivElement>} e @param {string} uuid */
    const handlePointerDragStart = (e, uuid) => {
        if (interactionMode !== 'pointer') {
            handlePointerDownCapture(e)
            return
        }

        if (isInteractiveTarget(e.target)) return

        pointerDragState.current = {
            pointerId: e.pointerId,
            originId: uuid,
            startX: e.clientX,
            startY: e.clientY,
            active: false,
            dragOverId: null,
        }

        e.currentTarget.setPointerCapture(e.pointerId)
    }

    /** @param {import('react').PointerEvent<HTMLDivElement>} e */
    const handlePointerDragMove = (e) => {
        if (interactionMode !== 'pointer') return

        const state = pointerDragState.current
        if (state.pointerId !== e.pointerId || !state.originId) return

        const movedEnough =
            Math.abs(e.clientX - state.startX) >= DRAG_THRESHOLD_PX ||
            Math.abs(e.clientY - state.startY) >= DRAG_THRESHOLD_PX

        if (!state.active) {
            if (!movedEnough) return

            state.active = true
            setDraggedId(state.originId)
        }

        e.preventDefault()

        setDragOffset({
            x: e.clientX - state.startX,
            y: e.clientY - state.startY,
        })

        const nextDragOverId = resolveDropTarget(e.clientX, e.clientY)
        const resolvedDragOverId =
            nextDragOverId && nextDragOverId !== state.originId
                ? nextDragOverId
                : null

        state.dragOverId = resolvedDragOverId
        setDragOverId(resolvedDragOverId)
    }

    /** @param {import('react').PointerEvent<HTMLDivElement>} e */
    const handlePointerDragEnd = (e) => {
        if (interactionMode !== 'pointer') {
            restoreDraggable(e)
            return
        }

        const state = pointerDragState.current
        if (state.pointerId !== e.pointerId) return

        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId)
        }

        if (state.active && state.originId && state.dragOverId) {
            moveScroll(state.originId, state.dragOverId)
        }

        resetPointerDrag()
    }

    return (
        <div className="scroll-list">
            {pageData.scrolls.map((scroll) => {
                const isDragged = scroll.uuid === draggedId
                const isDragOver = scroll.uuid === dragOverId
                const shellStyle =
                    interactionMode === 'pointer' && isDragged
                        ? {
                            transform: `translate(${dragOffset.x}px, ${dragOffset.y}px) scale(1.02)`,
                        }
                        : undefined
                const matchingChild = children.find(
                    (child) =>
                        typeof child === 'object' &&
                        child !== null &&
                        'key' in child &&
                        child.key === scroll.uuid
                )

                return (
                    <div
                        key={scroll.uuid}
                        data-scroll-id={scroll.uuid}
                        draggable={interactionMode === 'native'}
                        onPointerDownCapture={(e) => handlePointerDragStart(e, scroll.uuid)}
                        onPointerMoveCapture={handlePointerDragMove}
                        onPointerUpCapture={handlePointerDragEnd}
                        onPointerCancelCapture={handlePointerDragEnd}
                        onDragStart={interactionMode === 'native'
                            ? (e) => handleDragStart(e, scroll.uuid)
                            : undefined}
                        onDragOver={interactionMode === 'native'
                            ? (e) => handleDragOver(e, scroll.uuid)
                            : undefined}
                        onDragLeave={interactionMode === 'native'
                            ? handleDragLeave
                            : undefined}
                        onDrop={interactionMode === 'native'
                            ? () => handleDrop(scroll.uuid)
                            : undefined}
                        onDragEnd={interactionMode === 'native'
                            ? handleDragEnd
                            : undefined}
                        className={`scroll-list__item-shell${
                            isDragged ? ' scroll-list__item-shell--dragged' : ''
                        }${interactionMode === 'pointer' && isDragged
                            ? ' scroll-list__item-shell--pointer-dragged'
                            : ''
                        }${isDragOver ? ' scroll-list__item-shell--drag-over' : ''}`}
                        style={shellStyle}
                    >
                        {matchingChild ?? null}
                    </div>
                )
            })}
        </div>
    )
}

/** @param {GenericScrollProps} props */
export const GenericScroll = ({
    scrollDetails,
    onJump,
    pageData,
    setPageData,
    patchScroll,
}) => {
    const {name, note, dateISO, uuid} = scrollDetails
    const hasNote = note.trim().length > 0

    const [displayNote, setDisplayNote] = useState(Boolean(note))
    const [editingName, setEditingName] = useState(false)
    const [nameValue, setNameValue] = useState(name)

    const handleAddNote = () => {
        setDisplayNote(true)
    }

    /** @param {string} nextNote */
    const onNoteChange = (nextNote) => {
        patchScroll(uuid, {note: nextNote})
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

    /** @param {import('react').KeyboardEvent<HTMLInputElement>} e */
    const handleNameKeyDown = (e) => {
        if (e.key === 'Enter') {
            /** @type {HTMLInputElement} */ (e.target).blur()
        }
    }

    const onRemove = () => {
        const scrolls = pageData.scrolls.filter((s) => s.uuid !== uuid)
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
                            <Icon
                                icon="noteSticky"
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
                        <Icon icon="play" className="icon icon--xs" />
                    </button>
                    <Button
                        onClick={() => setExpanded(!expanded)}
                        icon={expanded ? 'angleUp' : 'angleDown'}
                    />
                </span>
            </div>
            {expanded && (
                <div className="scroll-card__details animate-fade-in-up">
                    <div className="scroll-card__details-header">
                        <span className="scroll-card__date"> {dateFormatter.format(new Date(dateISO))} </span>
                        <span className="scroll-card__detail-actions">
                            <Button onClick={onRemove} icon="trashCan" />
                            {!displayNote && (
                                <Button onClick={handleAddNote} icon="noteSticky" />
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

/** @param {string} absoluteURL @returns {UsePageDataStateReturn} */
export const usePageDataState = (absoluteURL) => {
    const [pageData, setPageData] = useState(/** @type {PageData} */ ({
        scrolls: [],
        title: null,
    }))

    /** @param {PageData} data */
    const customSetPageData = (data) => {
        chrome.storage.local.set({[absoluteURL]: data}).then(() => setPageData(data))
    }

    /** @param {string} uuid @param {Partial<ScrollDetails>} patch */
    const patchScroll = (uuid, patch) => {
        const scrolls = pageData.scrolls.map((s) => {
            if (s.uuid === uuid) assign(s, patch)
            return s
        })

        customSetPageData({...pageData, scrolls})
    }

    useEffect(() => {
        /** @param {PageData | undefined} data */
        const applyPageData = (data) => {
            setPageData(data ?? {scrolls: [], title: null})
        }

        chrome.storage.local.get(absoluteURL).then((result) => {
            applyPageData(/** @type {PageData | undefined} */ (result[absoluteURL]))
        })

        /** @param {{[key: string]: chrome.storage.StorageChange}} changes @param {string} areaName */
        const onStorageChange = (changes, areaName) => {
            if (areaName !== 'local') return

            const changed = changes[absoluteURL]
            if (!changed) return

            applyPageData(/** @type {PageData | undefined} */ (changed.newValue))
        }

        chrome.storage.onChanged.addListener(onStorageChange)

        return () => {
            chrome.storage.onChanged.removeListener(onStorageChange)
        }
    }, [absoluteURL])

    return [pageData, customSetPageData, patchScroll]
}

/** @param {ScrollDetails} d @returns {number} */
export const calculateScrollPercentage = (d) => {
    if (d.contentHeight <= 0) return 0

    const rawPercentage =
        (100 * (d.scrollPosition + d.viewportHeight)) / d.contentHeight

    if (!Number.isFinite(rawPercentage)) return 0

    return Math.min(100, Math.max(0, Math.ceil(rawPercentage)))
}
