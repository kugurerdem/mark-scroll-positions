// @ts-check

/** @typedef {import('./theme.js').ThemePreference} ThemePreference */

/**
 * @typedef {object} ThemeToggleProps
 * @property {ThemePreference} value
 * @property {(preference: ThemePreference) => void} onChange
 * @property {boolean} [compact]
 */

/** @type {{value: ThemePreference, label: string}[]} */
const options = [
    {value: 'system', label: 'System'},
    {value: 'light', label: 'Light'},
    {value: 'dark', label: 'Dark'},
]

/** @param {ThemeToggleProps} props */
export const ThemeToggle = ({
    value,
    onChange,
    compact = false,
}) => {
    const containerClassName = compact
        ? 'theme-toggle theme-toggle--compact'
        : 'theme-toggle'

    return (
        <div
            className={containerClassName}
            role="group"
            aria-label="Theme preference"
        >
            {options.map((option) => {
                const isSelected = value === option.value

                return (
                    <button
                        key={option.value}
                        type="button"
                        onClick={() => onChange(option.value)}
                        aria-pressed={isSelected}
                        className={`theme-toggle__button${
                            compact ? ' theme-toggle__button--compact' : ''
                        }${isSelected ? ' theme-toggle__button--selected' : ''}`}
                    >
                        {option.label}
                    </button>
                )
            })}
        </div>
    )
}
