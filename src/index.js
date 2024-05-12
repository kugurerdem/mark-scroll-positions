const
    {createRoot} = require('react-dom/client'),

    main = () => {
        createRoot(document.getElementById('app')).render(<App />)
    },

    App = () => {
        return <div> Boom! </div>
    }


main()
