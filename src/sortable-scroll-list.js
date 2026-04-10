// @ts-check

import {html, useRef, useState} from './ui.js'

/** @typedef {import('./types.js').SortableScrollListProps} SortableScrollListProps */

const DRAG_THRESHOLD_PX = 4

/** @param {EventTarget | null} target @returns {boolean} */
const isInteractiveTarget = (target) => {
    if (!(target instanceof HTMLElement)) return false

    return Boolean(
        target.closest(
            'input, textarea, select, button, a, label, [contenteditable="true"]'
        )
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
    pageData,
    renderItem,
    setPageData,
    interactionMode = 'native',
}) => {
    const isNativeInteraction = interactionMode === 'native'
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
        const dragIndex = scrolls.findIndex((scroll) => scroll.uuid === sourceUuid)
        const dropIndex = scrolls.findIndex((scroll) => scroll.uuid === targetUuid)

        if (dragIndex < 0 || dropIndex < 0) return

        const [removed] = scrolls.splice(dragIndex, 1)
        if (!removed) return

        scrolls.splice(dropIndex, 0, removed)
        void setPageData({...pageData, scrolls})
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

    const clearDragState = () => {
        setDraggedId(null)
        setDragOverId(null)
    }

    /** @param {string} targetUuid */
    const handleDrop = (targetUuid) => {
        if (draggedId) {
            moveScroll(draggedId, targetUuid)
        }

        clearDragState()
    }

    /** @param {PointerEvent & {currentTarget: HTMLDivElement}} event */
    const handlePointerDownCapture = (event) => {
        if (!isNativeInteraction) return
        event.currentTarget.draggable = !isInteractiveTarget(event.target)
    }

    /** @param {PointerEvent & {currentTarget: HTMLDivElement}} event */
    const restoreDraggable = (event) => {
        if (!isNativeInteraction) return
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
        clearDragState()
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
        if (isNativeInteraction) {
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
        if (isNativeInteraction) return

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
        if (isNativeInteraction) {
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
                    !isNativeInteraction && isDragged
                        ? `transform: translate(${dragOffset.x}px, ${dragOffset.y}px) scale(1.02);`
                        : undefined

                return html`
                    <div
                        key=${scroll.uuid}
                        data-scroll-id=${scroll.uuid}
                        draggable=${isNativeInteraction}
                        onPointerDownCapture=${
                            /** @param {PointerEvent & {currentTarget: HTMLDivElement}} event */
                            (event) => handlePointerDragStart(event, scroll.uuid)
                        }
                        onPointerMoveCapture=${handlePointerDragMove}
                        onPointerUpCapture=${handlePointerDragEnd}
                        onPointerCancelCapture=${handlePointerDragEnd}
                        onDragStart=${isNativeInteraction
                            ? /** @param {DragEvent & {currentTarget: HTMLDivElement}} event */
                                (event) => handleDragStart(event, scroll.uuid)
                            : undefined}
                        onDragOver=${isNativeInteraction
                            ? /** @param {DragEvent & {currentTarget: HTMLDivElement}} event */
                                (event) => handleDragOver(event, scroll.uuid)
                            : undefined}
                        onDragLeave=${isNativeInteraction ? clearDragState : undefined}
                        onDrop=${isNativeInteraction ? () => handleDrop(scroll.uuid) : undefined}
                        onDragEnd=${isNativeInteraction ? clearDragState : undefined}
                        class=${`scroll-list__item-shell${
                            isDragged ? ' scroll-list__item-shell--dragged' : ''
                        }${!isNativeInteraction && isDragged
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
