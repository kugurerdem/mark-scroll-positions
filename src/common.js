// @ts-check

import {h, html, useEffect, useRef, useState} from './ui.js'
import {Icon} from './icons.js'

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

    /** @param {InputEvent & {currentTarget: HTMLInputElement | HTMLTextAreaElement}} event */
    const handleInputChange = (event) => {
        setCurrentText(event.currentTarget.value)
        onChange(event.currentTarget.value)
    }

    const handleBlur = () => {
        if (savedText !== currentText) onBlur(currentText)
        setSavedText(currentText)
    }

    /** @param {KeyboardEvent & {currentTarget: HTMLInputElement | HTMLTextAreaElement}} event */
    const handleKeyDown = (event) => {
        if (event.key === 'Enter') {
            event.currentTarget.blur()
        }
    }

    const controlProps = {
        type: 'text',
        value: currentText,
        onInput: handleInputChange,
        onBlur: handleBlur,
        onKeyDown: type === 'input' ? handleKeyDown : undefined,
        class: 'text-field__control',
        draggable: false,
    }

    const control = h(type === 'input' ? 'input' : 'textarea', controlProps)

    return html`
        <div class=${`text-field ${className || ''}`.trim()}>
            ${label
                ? html`<label class="text-field__label">${label}</label>`
                : null}
            ${control}
        </div>
    `
}

/** @param {ButtonProps} props */
export const Button = ({text, icon, onClick}) => html`
    <button type="button" onClick=${onClick} class="icon-button">
        ${icon ? html`<${Icon} icon=${icon} className="icon icon--sm" />` : null}
        ${text ? html`<span class="icon-button__text">${text}</span>` : null}
    </button>
`

/** @param {{percentage: number}} props */
const CircularProgress = ({percentage}) => {
    const size = 26
    const strokeWidth = 2.5
    const radius = (size - strokeWidth) / 2
    const circumference = 2 * Math.PI * radius
    const offset = circumference - (percentage / 100) * circumference

    return html`
        <svg width=${size} height=${size} class="progress-ring">
            <circle
                cx=${size / 2}
                cy=${size / 2}
                r=${radius}
                fill="none"
                stroke="var(--color-cream-300)"
                stroke-width=${strokeWidth}
            />
            <circle
                cx=${size / 2}
                cy=${size / 2}
                r=${radius}
                fill="none"
                stroke="var(--color-accent-600)"
                stroke-width=${strokeWidth}
                stroke-dasharray=${circumference}
                stroke-dashoffset=${offset}
                stroke-linecap="round"
                class="progress-ring__value"
            />
        </svg>
    `
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
    pageData,
    renderItem,
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
        const dragIdx = scrolls.findIndex((scroll) => scroll.uuid === sourceUuid)
        const dropIdx = scrolls.findIndex((scroll) => scroll.uuid === targetUuid)

        if (dragIdx < 0 || dropIdx < 0) return

        const [removed] = scrolls.splice(dragIdx, 1)
        if (!removed) return

        scrolls.splice(dropIdx, 0, removed)
        setPageData({...pageData, scrolls})
    }

    /** @param {DragEvent & {currentTarget: HTMLDivElement}} event @param {string} uuid */
    const handleDragStart = (event, uuid) => {
        if (isInteractiveTarget(event.target)) {
            event.preventDefault()
            return
        }

        if (!event.dataTransfer) return

        setDraggedId(uuid)
        event.dataTransfer.effectAllowed = 'move'
    }

    /** @param {DragEvent & {currentTarget: HTMLDivElement}} event @param {string} uuid */
    const handleDragOver = (event, uuid) => {
        event.preventDefault()
        if (!event.dataTransfer) return
        event.dataTransfer.dropEffect = 'move'

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

    /** @param {PointerEvent & {currentTarget: HTMLDivElement}} event */
    const handlePointerDownCapture = (event) => {
        if (interactionMode === 'pointer') return
        event.currentTarget.draggable = !isInteractiveTarget(event.target)
    }

    /** @param {PointerEvent & {currentTarget: HTMLDivElement}} event */
    const restoreDraggable = (event) => {
        if (interactionMode === 'pointer') return
        event.currentTarget.draggable = true
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

    /** @param {PointerEvent & {currentTarget: HTMLDivElement}} event @param {string} uuid */
    const handlePointerDragStart = (event, uuid) => {
        if (interactionMode !== 'pointer') {
            handlePointerDownCapture(event)
            return
        }

        if (isInteractiveTarget(event.target)) return

        pointerDragState.current = {
            pointerId: event.pointerId,
            originId: uuid,
            startX: event.clientX,
            startY: event.clientY,
            active: false,
            dragOverId: null,
        }

        event.currentTarget.setPointerCapture(event.pointerId)
    }

    /** @param {PointerEvent & {currentTarget: HTMLDivElement}} event */
    const handlePointerDragMove = (event) => {
        if (interactionMode !== 'pointer') return

        const state = pointerDragState.current
        if (state.pointerId !== event.pointerId || !state.originId) return

        const movedEnough =
            Math.abs(event.clientX - state.startX) >= DRAG_THRESHOLD_PX ||
            Math.abs(event.clientY - state.startY) >= DRAG_THRESHOLD_PX

        if (!state.active) {
            if (!movedEnough) return

            state.active = true
            setDraggedId(state.originId)
        }

        event.preventDefault()

        setDragOffset({
            x: event.clientX - state.startX,
            y: event.clientY - state.startY,
        })

        const nextDragOverId = resolveDropTarget(event.clientX, event.clientY)
        const resolvedDragOverId =
            nextDragOverId && nextDragOverId !== state.originId
                ? nextDragOverId
                : null

        state.dragOverId = resolvedDragOverId
        setDragOverId(resolvedDragOverId)
    }

    /** @param {PointerEvent & {currentTarget: HTMLDivElement}} event */
    const handlePointerDragEnd = (event) => {
        if (interactionMode !== 'pointer') {
            restoreDraggable(event)
            return
        }

        const state = pointerDragState.current
        if (state.pointerId !== event.pointerId) return

        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId)
        }

        if (state.active && state.originId && state.dragOverId) {
            moveScroll(state.originId, state.dragOverId)
        }

        resetPointerDrag()
    }

    return html`
        <div class="scroll-list">
            ${pageData.scrolls.map((scroll) => {
                const isDragged = scroll.uuid === draggedId
                const isDragOver = scroll.uuid === dragOverId
                const shellStyle =
                    interactionMode === 'pointer' && isDragged
                        ? `transform: translate(${dragOffset.x}px, ${dragOffset.y}px) scale(1.02);`
                        : undefined

                return html`
                    <div
                        key=${scroll.uuid}
                        data-scroll-id=${scroll.uuid}
                        draggable=${interactionMode === 'native'}
                        onPointerDownCapture=${
                            /** @param {PointerEvent & {currentTarget: HTMLDivElement}} event */
                            (event) => handlePointerDragStart(event, scroll.uuid)
                        }
                        onPointerMoveCapture=${handlePointerDragMove}
                        onPointerUpCapture=${handlePointerDragEnd}
                        onPointerCancelCapture=${handlePointerDragEnd}
                        onDragStart=${interactionMode === 'native'
                            ? /** @param {DragEvent & {currentTarget: HTMLDivElement}} event */
                                (event) => handleDragStart(event, scroll.uuid)
                            : undefined}
                        onDragOver=${interactionMode === 'native'
                            ? /** @param {DragEvent & {currentTarget: HTMLDivElement}} event */
                                (event) => handleDragOver(event, scroll.uuid)
                            : undefined}
                        onDragLeave=${interactionMode === 'native'
                            ? handleDragLeave
                            : undefined}
                        onDrop=${interactionMode === 'native'
                            ? () => handleDrop(scroll.uuid)
                            : undefined}
                        onDragEnd=${interactionMode === 'native'
                            ? handleDragEnd
                            : undefined}
                        class=${`scroll-list__item-shell${
                            isDragged ? ' scroll-list__item-shell--dragged' : ''
                        }${interactionMode === 'pointer' && isDragged
                            ? ' scroll-list__item-shell--pointer-dragged'
                            : ''
                        }${isDragOver ? ' scroll-list__item-shell--drag-over' : ''}`}
                        style=${shellStyle}
                    >
                        ${renderItem(scroll)}
                    </div>
                `
            })}
        </div>
    `
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
    const [expanded, setExpanded] = useState(false)

    const percentage = calculateScrollPercentage(scrollDetails)
    const nameInputSize = Math.min(Math.max((nameValue || '').length + 1, 10), 40)

    /** @param {string} nextNote */
    const onNoteChange = (nextNote) => {
        patchScroll(uuid, {note: nextNote})
    }

    const handleNameBlur = () => {
        setEditingName(false)
        if (nameValue !== name) {
            patchScroll(uuid, {name: nameValue})
        }
    }

    /** @param {KeyboardEvent & {currentTarget: HTMLInputElement}} event */
    const handleNameKeyDown = (event) => {
        if (event.key === 'Enter') {
            event.currentTarget.blur()
        }
    }

    const onRemove = () => {
        const scrolls = pageData.scrolls.filter((scroll) => scroll.uuid !== uuid)
        setPageData({...pageData, scrolls})
    }

    return html`
        <div class="scroll-card">
            <div class="scroll-card__main">
                <${CircularProgress} percentage=${percentage} />
                <div class="scroll-card__content">
                    ${editingName
                        ? h('input', {
                            type: 'text',
                            value: nameValue,
                            size: nameInputSize,
                            onInput: /** @param {InputEvent & {currentTarget: HTMLInputElement}} event */ (event) => {
                                setNameValue(event.currentTarget.value)
                            },
                            onBlur: handleNameBlur,
                            onKeyDown: handleNameKeyDown,
                            draggable: false,
                            autoFocus: true,
                            class: 'scroll-card__name-input',
                        })
                        : html`
                            <span
                                class=${`scroll-card__name${
                                    name ? '' : ' scroll-card__name--empty'
                                }`}
                                onClick=${() => setEditingName(true)}
                            >
                                ${name || 'Add a title'}
                            </span>
                        `}
                    <span class="scroll-card__meta">
                        <span class="scroll-card__percentage">${percentage}% scrolled</span>
                        ${!expanded && hasNote
                            ? html`
                                <${Icon}
                                    icon="noteSticky"
                                    className="icon icon--tiny scroll-card__note-indicator"
                                    title="This mark has a note"
                                    ariaLabel="This mark has a note"
                                />
                            `
                            : null}
                    </span>
                </div>
                <span class="scroll-card__actions">
                    <button
                        type="button"
                        onClick=${onJump}
                        class="icon-button icon-button--accent"
                    >
                        <${Icon} icon="play" className="icon icon--xs" />
                    </button>
                    <${Button}
                        onClick=${() => setExpanded(!expanded)}
                        icon=${expanded ? 'angleUp' : 'angleDown'}
                    />
                </span>
            </div>
            ${expanded
                ? html`
                    <div class="scroll-card__details animate-fade-in-up">
                        <div class="scroll-card__details-header">
                            <span class="scroll-card__date">
                                ${dateFormatter.format(new Date(dateISO))}
                            </span>
                            <span class="scroll-card__detail-actions">
                                <${Button} onClick=${onRemove} icon="trashCan" />
                                ${!displayNote
                                    ? html`
                                        <${Button}
                                            onClick=${() => setDisplayNote(true)}
                                            icon="noteSticky"
                                        />
                                    `
                                    : null}
                            </span>
                        </div>
                        ${displayNote
                            ? html`
                                <${TextInput}
                                    type="textarea"
                                    label="Note"
                                    value=${note}
                                    onBlur=${onNoteChange}
                                />
                            `
                            : null}
                    </div>
                `
                : null}
        </div>
    `
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
        /** @type {ScrollDetails[]} */
        const currentScrolls = pageData.scrolls
        const scrolls = currentScrolls.map((scroll) => {
            if (scroll.uuid === uuid) assign(scroll, patch)
            return scroll
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

/** @param {ScrollDetails} scrollDetails @returns {number} */
export const calculateScrollPercentage = (scrollDetails) => {
    if (scrollDetails.contentHeight <= 0) return 0

    const rawPercentage =
        (100 * (scrollDetails.scrollPosition + scrollDetails.viewportHeight)) /
        scrollDetails.contentHeight

    if (!Number.isFinite(rawPercentage)) return 0

    return Math.min(100, Math.max(0, Math.ceil(rawPercentage)))
}
