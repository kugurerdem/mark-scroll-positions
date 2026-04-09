// @ts-check

/** @typedef {import('react').ButtonHTMLAttributes<HTMLButtonElement>} ButtonHTMLAttributes */
/** @typedef {import('react').ReactElement} ReactElement */
/** @typedef {import('./icons.jsx').IconName} IconName */

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
 * @property {ReactElement[]} children
 * @property {PageData} pageData
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
 * @typedef {ButtonHTMLAttributes & {
 *   text?: string,
 *   icon?: IconName,
 * }} ButtonProps
 */

/**
 * @typedef {[PageData, SetPageData, PatchScroll]} UsePageDataStateReturn
 */

export {}
