// @ts-check

import {h, html, useState} from '../lib/ui.js'
import {Icon} from './icons.js'
import {Button, TextInput} from './form-controls.js'

/** @typedef {import('../lib/page-store.js').ScrollDetails} ScrollDetails */
/** @typedef {import('../lib/page-store.js').PageData} PageData */

/** @typedef {(data: PageData) => Promise<void>} SetPageData */
/** @typedef {(uuid: string, patch: Partial<ScrollDetails>) => Promise<void>} PatchScroll */

/**
 * @typedef {object} GenericScrollProps
 * @property {ScrollDetails} scrollDetails
 * @property {() => void} onJump
 * @property {PageData} pageData
 * @property {SetPageData} setPageData
 * @property {PatchScroll} patchScroll
 */

const dateFormatter = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
})

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

/** @param {ScrollDetails} scrollDetails @returns {number} */
const calculateScrollPercentage = (scrollDetails) => {
    if (scrollDetails.contentHeight <= 0) return 0

    const rawPercentage =
        (100 * (scrollDetails.scrollPosition + scrollDetails.viewportHeight)) /
        scrollDetails.contentHeight

    if (!Number.isFinite(rawPercentage)) return 0

    return Math.min(100, Math.max(0, Math.ceil(rawPercentage)))
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
    const [displayNote, setDisplayNote] = useState(Boolean(note))
    const [editingName, setEditingName] = useState(false)
    const [nameValue, setNameValue] = useState(name)
    const [expanded, setExpanded] = useState(false)

    const hasNote = note.trim().length > 0
    const percentage = calculateScrollPercentage(scrollDetails)
    const nameInputSize = Math.min(Math.max((nameValue || '').length + 1, 10), 40)

    const handleNameBlur = () => {
        setEditingName(false)

        if (nameValue !== name) {
            void patchScroll(uuid, {name: nameValue})
        }
    }

    /** @param {KeyboardEvent & {currentTarget: HTMLInputElement}} event */
    const handleNameKeyDown = (event) => {
        if (event.key === 'Enter') {
            event.currentTarget.blur()
        }
    }

    const handleRemove = () => {
        void setPageData({
            ...pageData,
            scrolls: pageData.scrolls.filter((scroll) => scroll.uuid !== uuid),
        })
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
                            onInput:
                                /** @param {InputEvent & {currentTarget: HTMLInputElement}} event */
                                (event) => {
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
                                <${Button} onClick=${handleRemove} icon="trashCan" />
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
                                    onBlur=${
                                        /** @param {string} nextNote */
                                        (nextNote) => {
                                        void patchScroll(uuid, {note: nextNote})
                                        }
                                    }
                                />
                            `
                            : null}
                    </div>
                `
                : null}
        </div>
    `
}
