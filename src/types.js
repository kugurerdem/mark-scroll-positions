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
 * @property {string | null} pageURL
 */

/** @typedef {'top' | 'bottom'} ScrollInsertPosition */
/** @typedef {'ignore' | 'include'} QueryIdentityMode */

/**
 * @typedef {object} QueryIdentitySettings
 * @property {QueryIdentityMode} globalMode
 * @property {Record<string, QueryIdentityMode>} perHostMode
 */

/**
 * @typedef {object} PageIdentity
 * @property {string} storageKey
 * @property {string | null} pageURL
 */

/**
 * @typedef {object} PageRecord
 * @property {PageIdentity} identity
 * @property {PageData} pageData
 */

/** @typedef {Record<string, PageRecord>} PageRecordByStorageKey */

/** @typedef {(data: PageData) => Promise<void>} SetPageData */
/** @typedef {(uuid: string, patch: Partial<ScrollDetails>) => Promise<void>} PatchScroll */
/** @typedef {(scrollDetails: ScrollDetails) => unknown} RenderScroll */

/**
 * @typedef {object} BootContextValue
 * @property {chrome.tabs.Tab} activeTab
 * @property {PageIdentity} pageIdentity
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
