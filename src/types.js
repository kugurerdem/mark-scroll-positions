// @ts-check

/** @typedef {import('./icons.js').IconName} IconName */

/**
 * @typedef {object} ScrollDetails
 * @property {string} uuid
 * @property {number} scrollPosition
 * @property {number} viewportHeight
 * @property {number} contentHeight
 * @property {string} dateISO
 * @property {string} name
 * @property {string} note
 */

/**
 * @typedef {object} PageData
 * @property {ScrollDetails[]} scrolls
 * @property {string | null} title
 */

/** @typedef {'top' | 'bottom'} ScrollInsertPosition */
/** @typedef {'ignore' | 'include'} QueryIdentityMode */

/**
 * @typedef {object} QueryIdentitySettings
 * @property {QueryIdentityMode} globalMode
 * @property {Record<string, QueryIdentityMode>} perHostMode
 */

/** @typedef {Record<string, PageData>} PageDetailsByURL */

/** @typedef {(data: PageData) => void} SetPageData */
/** @typedef {(uuid: string, patch: Partial<ScrollDetails>) => void} PatchScroll */
/** @typedef {(scrollDetails: ScrollDetails) => unknown} RenderScroll */

/**
 * @typedef {object} BootContextValue
 * @property {chrome.tabs.Tab} activeTab
 * @property {string} absoluteURL
 * @property {PageData} pageData
 * @property {SetPageData} setPageData
 * @property {PatchScroll} patchScroll
 */

/**
 * @typedef {object} GenericScrollProps
 * @property {ScrollDetails} scrollDetails
 * @property {() => void} onJump
 * @property {PageData} pageData
 * @property {SetPageData} setPageData
 * @property {PatchScroll} patchScroll
 */

/**
 * @typedef {object} SortableScrollListProps
 * @property {PageData} pageData
 * @property {RenderScroll} renderItem
 * @property {SetPageData} setPageData
 * @property {'native' | 'pointer'} [interactionMode]
 */

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

/**
 * @typedef {[PageData, SetPageData, PatchScroll]} UsePageDataStateReturn
 */

export {}
