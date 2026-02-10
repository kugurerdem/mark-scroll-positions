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
    const containerPadding = compact ? 'p-0.5' : 'p-1'
    const buttonPadding = compact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1.5 text-[11px]'

    return (
        <div
            className={`inline-flex items-center gap-0.5 rounded-lg border border-cream-300 bg-cream-100 ${containerPadding}`}
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
                        className={`${buttonPadding} rounded-md font-medium transition-colors cursor-pointer ${
                            isSelected
                                ? 'bg-accent-500 text-white shadow-sm shadow-accent-500/20'
                                : 'text-ink-500 hover:bg-cream-50 hover:text-ink-700'
                        }`}
                    >
                        {option.label}
                    </button>
                )
            })}
        </div>
    )
}
