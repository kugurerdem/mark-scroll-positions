const
    {useState} = require('react'),

    TextInput = ({
        label, value,
        onChange = () => {},
        onBlur = () => {},
        type='input',
        className,
    }) => {
        const
            [currentText, setCurrentText] = useState(value),
            [savedText, setSavedText] = useState(value),

            handleInputChange = (e) => {
                setCurrentText(e.target.value)
                onChange(e.target.value)
            },

            handleBlur = () => {
                if (savedText != currentText)
                    onBlur(currentText)
                setSavedText(currentText)
            },

            props = {
                type: 'text',
                value: currentText,
                onChange: handleInputChange,
                onBlur: handleBlur,
            }


        return <div className={className}>
            { label && <label> {label} </label> }
            { type == 'input' ? <input {...props}/> : <textarea {...props} /> }
        </div>
    },

    Button = ({text, icon, onClick}) => {
        const iconPath = `./assets/svgs/${icon}.svg`
        return <button onClick={onClick}>
            {icon && <img src={iconPath} className="icon"/>}
            {text && <span> {text} </span>}
        </button>
    },


    calculateScrollPercentage = (d) => Math.ceil(
        100 * (d.scrollPosition + d.viewportHeight) / d.contentHeight
    )


module.exports = {TextInput, Button, calculateScrollPercentage}
