// @ts-check

/** @typedef {import('./preferences.js').ScrollStrategy} ScrollStrategy */

/**
 * @typedef {object} PageScrollSnapshot
 * @property {number} scrollPosition
 * @property {number} viewportHeight
 * @property {number} contentHeight
 * @property {string} title
 */

/** @param {string | null} [scrollContainerSelector] @returns {PageScrollSnapshot} */
export const capturePageScrollSnapshot = (scrollContainerSelector = null) => {
    /** @param {string | null} selector @returns {HTMLElement | null} */
    const resolveScrollContainer = (selector) => {
        if (!selector) return null

        try {
            const element = document.querySelector(selector)
            if (!(element instanceof HTMLElement)) return null
            if (element.scrollHeight <= element.clientHeight) return null
            return element
        } catch {
            return null
        }
    }

    const scrollContainer = resolveScrollContainer(scrollContainerSelector)

    if (scrollContainer) {
        return {
            scrollPosition: Math.min(
                scrollContainer.scrollTop,
                Math.max(scrollContainer.scrollHeight - scrollContainer.clientHeight, 0)
            ),
            viewportHeight: scrollContainer.clientHeight,
            contentHeight: scrollContainer.scrollHeight,
            title: document.title,
        }
    }

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

/** @param {number} value @returns {number} */
const normalizePercentage = (value) => {
    if (!Number.isFinite(value)) return 0
    return Math.min(1, Math.max(0, value))
}

/**
 * @param {JumpToScrollPositionArgs} scrollDetails
 * @param {ScrollStrategy} strategy
 * @returns {number}
 */
export const calculateScrollRatio = (
    {scrollPosition, viewportHeight, contentHeight},
    strategy = 'page-ratio'
) => {
    if (strategy === 'viewport-ratio') {
        return viewportHeight > 0 ? scrollPosition / viewportHeight : 0
    }

    const savedScrollableHeight = Math.max(contentHeight - viewportHeight, 0)
    return savedScrollableHeight > 0 ? scrollPosition / savedScrollableHeight : 0
}

/**
 * @param {JumpToScrollPositionArgs} scrollDetails
 * @param {ScrollStrategy} strategy
 * @returns {number}
 */
export const calculateScrollProgressPercentage = (
    scrollDetails,
    strategy = 'page-ratio'
) => {
    const {viewportHeight, contentHeight} = scrollDetails

    if (contentHeight <= 0) return 0

    const scrollableHeight = Math.max(contentHeight - viewportHeight, 0)
    const estimatedScrollPosition = calculateJumpPosition(
        scrollDetails,
        viewportHeight,
        scrollableHeight,
        strategy
    )
    const progress = (estimatedScrollPosition + viewportHeight) / contentHeight

    return Math.ceil(normalizePercentage(progress) * 100)
}

/**
 * @param {JumpToScrollPositionArgs} scrollDetails
 * @param {number} currentViewportHeight
 * @param {number} currentScrollableHeight
 * @param {ScrollStrategy} strategy
 * @returns {number}
 */
export const calculateJumpPosition = (
    scrollDetails,
    currentViewportHeight,
    currentScrollableHeight,
    strategy = 'page-ratio'
) => {
    const ratio = calculateScrollRatio(scrollDetails, strategy)
    const targetPosition = strategy === 'viewport-ratio'
        ? ratio * currentViewportHeight
        : normalizePercentage(ratio) * currentScrollableHeight

    return Math.min(currentScrollableHeight, Math.max(0, targetPosition))
}

/**
 * @param {JumpToScrollPositionArgs} args
 * @param {ScrollStrategy} [strategy]
 * @param {string | null} [scrollContainerSelector]
 */
export const jumpToScrollPosition = (
    args,
    strategy = 'page-ratio',
    scrollContainerSelector = null
) => {
    /** @param {number} value @returns {number} */
    const clampPercentage = (value) => {
        if (!Number.isFinite(value)) return 0
        return Math.min(1, Math.max(0, value))
    }

    /** @param {string | null} selector @returns {HTMLElement | null} */
    const resolveScrollContainer = (selector) => {
        if (!selector) return null

        try {
            const element = document.querySelector(selector)
            if (!(element instanceof HTMLElement)) return null
            if (element.scrollHeight <= element.clientHeight) return null
            return element
        } catch {
            return null
        }
    }

    const scrollContainer = resolveScrollContainer(scrollContainerSelector)
    const currentContentHeight = Math.max(
        scrollContainer?.scrollHeight || 0,
        scrollContainer ? 0 : document.documentElement?.scrollHeight || 0,
        scrollContainer ? 0 : document.body?.scrollHeight || 0
    )
    const currentViewportHeight = scrollContainer
        ? scrollContainer.clientHeight
        : window.innerHeight

    const currentScrollableHeight = Math.max(
        currentContentHeight - currentViewportHeight,
        0
    )
    const savedScrollableHeight = Math.max(
        args.contentHeight - args.viewportHeight,
        0
    )
    const ratio = strategy === 'viewport-ratio'
        ? args.viewportHeight > 0 ? args.scrollPosition / args.viewportHeight : 0
        : savedScrollableHeight > 0
            ? args.scrollPosition / savedScrollableHeight
            : 0
    const rawJumpPositionY = strategy === 'viewport-ratio'
        ? ratio * currentViewportHeight
        : clampPercentage(ratio) * currentScrollableHeight
    const toJumpPositionY = Math.min(
        currentScrollableHeight,
        Math.max(0, rawJumpPositionY)
    )

    if (scrollContainer) {
        scrollContainer.scrollTop = toJumpPositionY
    } else {
        window.scrollTo(0, toJumpPositionY)
    }
}
