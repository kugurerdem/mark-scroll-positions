// @ts-check

/**
 * @typedef {object} PageScrollSnapshot
 * @property {number} scrollPosition
 * @property {number} viewportHeight
 * @property {number} contentHeight
 * @property {string} title
 */

/** @returns {PageScrollSnapshot} */
export const capturePageScrollSnapshot = () => {
    const contentHeight = Math.max(
        document.documentElement?.scrollHeight || 0,
        document.body?.scrollHeight || 0
    )

    const maxScrollPosition = Math.max(contentHeight - window.innerHeight, 0)
    const scrollPosition = Math.min(window.pageYOffset, maxScrollPosition)

    return {
        scrollPosition,
        viewportHeight: window.innerHeight,
        contentHeight,
        title: document.title,
    }
}

/**
 * @typedef {object} JumpToScrollPositionArgs
 * @property {number} scrollPosition
 * @property {number} viewportHeight
 * @property {number} contentHeight
 */

/** @param {JumpToScrollPositionArgs} args */
export const jumpToScrollPosition = ({
    scrollPosition,
    viewportHeight,
    contentHeight,
}) => {
    const savedScrollableHeight = Math.max(contentHeight - viewportHeight, 0)
    const percentage =
        savedScrollableHeight > 0 ? scrollPosition / savedScrollableHeight : 0

    const normalizedPercentage = Math.min(1, Math.max(0, percentage))

    const currentContentHeight = Math.max(
        document.documentElement?.scrollHeight || 0,
        document.body?.scrollHeight || 0
    )

    const currentScrollableHeight = Math.max(
        currentContentHeight - window.innerHeight,
        0
    )

    const toJumpPositionY = normalizedPercentage * currentScrollableHeight
    window.scrollTo(0, toJumpPositionY)
}
