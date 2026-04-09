// @ts-check

/** @returns {HTMLElement} */
export const getAppRoot = () => {
    const rootElement = document.getElementById('app')

    if (!(rootElement instanceof HTMLElement)) {
        throw new Error('Missing app root element')
    }

    return rootElement
}
