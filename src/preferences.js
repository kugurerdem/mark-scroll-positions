// @ts-check

/** @typedef {'top' | 'bottom'} ScrollInsertPosition */

export const MARK_INSERT_POSITION_KEY = 'markInsertPosition'

/** @param {unknown} value @returns {value is ScrollInsertPosition} */
export const isScrollInsertPosition = (value) =>
    value === 'top' || value === 'bottom'

/** @returns {Promise<ScrollInsertPosition>} */
export const getScrollInsertPosition = async () => {
    const result = await chrome.storage.local.get(MARK_INSERT_POSITION_KEY)
    const value = result[MARK_INSERT_POSITION_KEY]
    return isScrollInsertPosition(value) ? value : 'bottom'
}

/** @param {ScrollInsertPosition} position @returns {Promise<void>} */
export const setScrollInsertPosition = async (position) => {
    await chrome.storage.local.set({[MARK_INSERT_POSITION_KEY]: position})
}
