import type {ThemePreference} from './theme'

interface ThemeToggleProps {
    value: ThemePreference
    onChange: (preference: ThemePreference) => void
    compact?: boolean
}

const options: Array<{value: ThemePreference; label: string}> = [
    {value: 'system', label: 'System'},
    {value: 'light', label: 'Light'},
    {value: 'dark', label: 'Dark'},
]

export const ThemeToggle = ({
    value,
    onChange,
    compact = false,
}: ThemeToggleProps) => {
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
