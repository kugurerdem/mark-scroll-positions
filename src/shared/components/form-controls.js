// @ts-check

import {h, html, useEffect, useState} from '../lib/ui.js'
import {Icon} from './icons.js'

/** @typedef {import('./icons.js').IconName} IconName */

/**
 * @typedef {object} TextInputProps
 * @property {string} value
 * @property {string} [label]
 * @property {(value: string) => void} [onChange]
 * @property {(value: string) => void} [onBlur]
 * @property {'input' | 'textarea'} [type]
 * @property {string} [className]
 */

/**
 * @typedef {object} ButtonProps
 * @property {string} [text]
 * @property {IconName} [icon]
 * @property {() => void} [onClick]
 */

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

    useEffect(() => {
        setCurrentText(value)
    }, [value])

    /** @param {InputEvent & {currentTarget: HTMLInputElement | HTMLTextAreaElement}} event */
    const handleInputChange = (event) => {
        const nextValue = event.currentTarget.value
        setCurrentText(nextValue)
        onChange(nextValue)
    }

    const handleBlur = () => {
        if (currentText !== value) {
            onBlur(currentText)
        }
    }

    /** @param {KeyboardEvent & {currentTarget: HTMLInputElement | HTMLTextAreaElement}} event */
    const handleKeyDown = (event) => {
        if (event.key === 'Enter') {
            event.currentTarget.blur()
        }
    }

    return html`
        <div class=${`text-field ${className || ''}`.trim()}>
            ${label
                ? html`<label class="text-field__label">${label}</label>`
                : null}
            ${h(type === 'input' ? 'input' : 'textarea', {
                type: 'text',
                value: currentText,
                onInput: handleInputChange,
                onBlur: handleBlur,
                onKeyDown: type === 'input' ? handleKeyDown : undefined,
                class: 'text-field__control',
                draggable: false,
            })}
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
