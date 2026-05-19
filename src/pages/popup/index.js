// @ts-check

import {createContext, html, render, useCallback, useContext, useEffect, useState} from '../../shared/lib/ui.js'
import {getAppRoot} from '../../shared/lib/app-root.js'
import {Icon} from '../../shared/components/icons.js'
import {createPageIdentity} from '../../shared/lib/page-identity.js'
import {capturePageScrollSnapshot, jumpToScrollPosition} from '../../shared/lib/page-dom.js'
import {
    SCROLL_CONTAINER_SETTINGS_KEY,
    SCROLL_STRATEGY_SETTINGS_KEY,
    getScrollContainerSettings,
    getScrollInsertPosition,
    getScrollStrategySettings,
    normalizeScrollContainerSettings,
    normalizeScrollStrategySettings,
    parseScrollStrategy,
    resolveScrollContainerSelector,
    resolveScrollStrategy,
    setURLPatternScrollStrategy,
    setScrollStrategySettings as setStoredScrollStrategySettings,
} from '../../shared/lib/preferences.js'
import {
    getPageData as getStoredPageData,
    setPageData as setStoredPageData,
} from '../../shared/lib/page-store.js'
import {GenericScroll} from '../../shared/components/scroll-card.js'
import {SortableScrollList} from '../../shared/components/sortable-scroll-list.js'
import {subscribeToStorageKey} from '../../shared/lib/storage.js'
import {initializeTheme} from '../../shared/lib/theme.js'
import {
    QUERY_IDENTITY_SETTINGS_KEY,
    getQueryIdentitySettings,
    normalizeQueryIdentitySettings,
    resolveQueryIdentityMode,
    setHostnameQueryIdentityMode,
    setQueryIdentitySettings as setStoredQueryIdentitySettings,
} from '../../shared/lib/url-identity.js'
import {usePageDataState} from '../../shared/hooks/use-page-data-state.js'

/** @typedef {import('../../shared/lib/page-store.js').PageData} PageData */
/** @typedef {import('../../shared/lib/page-store.js').ScrollDetails} ScrollDetails */
/** @typedef {import('../../shared/lib/page-identity.js').PageIdentity} PageIdentity */
/** @typedef {import('../../shared/lib/url-identity.js').QueryIdentityMode} QueryIdentityMode */
/** @typedef {import('../../shared/lib/url-identity.js').QueryIdentitySettings} QueryIdentitySettings */
/** @typedef {import('../../shared/lib/preferences.js').ScrollStrategy} ScrollStrategy */
/** @typedef {import('../../shared/lib/preferences.js').ScrollStrategySettings} ScrollStrategySettings */
/** @typedef {import('../../shared/lib/preferences.js').ScrollContainerSettings} ScrollContainerSettings */
/** @typedef {import('../../shared/lib/page-dom.js').PageScrollSnapshot} PageScrollSnapshot */

/** @typedef {(data: PageData) => Promise<void>} SetPageData */
/** @typedef {(uuid: string, patch: Partial<ScrollDetails>) => Promise<void>} PatchScroll */

/**
 * @typedef {object} BootContextValue
 * @property {chrome.tabs.Tab} activeTab
 * @property {PageIdentity} pageIdentity
 * @property {PageData} pageData
 * @property {SetPageData} setPageData
 * @property {PatchScroll} patchScroll
 */

const Context = createContext(/** @type {BootContextValue | null} */ (null))

/** @returns {BootContextValue} */
const useBootContext = () => {
    const context = useContext(Context)
    if (!context) {
        throw new Error('useBootContext must be used within a Boot provider')
    }

    return context
}

const main = async () => {
    await initializeTheme()

    const [activeTab] = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true,
    })

    if (!activeTab?.url) {
        throw new Error('Could not resolve the active tab URL')
    }

    const [
        queryIdentitySettings,
        scrollStrategySettings,
        scrollContainerSettings,
    ] = await Promise.all([
        getQueryIdentitySettings(),
        getScrollStrategySettings(),
        getScrollContainerSettings(),
    ])

    render(
        html`
            <${Boot}
                activeTab=${activeTab}
                initialQueryIdentitySettings=${queryIdentitySettings}
                initialScrollStrategySettings=${scrollStrategySettings}
                initialScrollContainerSettings=${scrollContainerSettings}
            />
        `,
        getAppRoot()
    )
}

/**
 * @typedef {object} BootProps
 * @property {chrome.tabs.Tab} activeTab
 * @property {QueryIdentitySettings} initialQueryIdentitySettings
 * @property {ScrollStrategySettings} initialScrollStrategySettings
 * @property {ScrollContainerSettings} initialScrollContainerSettings
 */

/** @param {BootProps} props */
const Boot = ({
    activeTab,
    initialQueryIdentitySettings,
    initialScrollStrategySettings,
    initialScrollContainerSettings,
}) => {
    const [queryIdentitySettings, setQueryIdentitySettings] =
        useState(initialQueryIdentitySettings)
    const [scrollStrategySettings, setScrollStrategySettings] =
        useState(initialScrollStrategySettings)
    const [scrollContainerSettings, setScrollContainerSettings] =
        useState(initialScrollContainerSettings)

    if (!activeTab.url) {
        throw new Error('Could not resolve the active tab URL')
    }

    const activeURL = new URL(activeTab.url)
    const hasQueryParameters = activeURL.search.length > 0
    const hostname = activeURL.hostname
    const queryIdentityMode = resolveQueryIdentityMode(
        queryIdentitySettings,
        hostname
    )
    const scrollStrategy = resolveScrollStrategy(scrollStrategySettings, activeURL)
    const scrollContainerSelector = resolveScrollContainerSelector(
        scrollContainerSettings,
        activeURL
    )
    const pageIdentity = createPageIdentity(activeURL, queryIdentitySettings)
    const [pageData, setPageData, patchScroll] = usePageDataState(pageIdentity)

    useEffect(() => {
        return subscribeToStorageKey(QUERY_IDENTITY_SETTINGS_KEY, (change) => {
            setQueryIdentitySettings(normalizeQueryIdentitySettings(change.newValue))
        })
    }, [])

    useEffect(() => {
        return subscribeToStorageKey(SCROLL_STRATEGY_SETTINGS_KEY, (change) => {
            setScrollStrategySettings(normalizeScrollStrategySettings(change.newValue))
        })
    }, [])

    useEffect(() => {
        return subscribeToStorageKey(SCROLL_CONTAINER_SETTINGS_KEY, (change) => {
            setScrollContainerSettings(normalizeScrollContainerSettings(change.newValue))
        })
    }, [])

    const onQueryIdentityModeChange = useCallback(
        /** @param {QueryIdentityMode} nextMode */
        (nextMode) => {
            /** @param {QueryIdentitySettings} current */
            const updateSettings = (current) => {
                const nextSettings = setHostnameQueryIdentityMode(
                    current,
                    hostname,
                    nextMode
                )

                void setStoredQueryIdentitySettings(nextSettings)
                return nextSettings
            }

            setQueryIdentitySettings(updateSettings)
        },
        [hostname]
    )

    const onScrollStrategyChange = useCallback(
        /** @param {ScrollStrategy} nextStrategy */
        (nextStrategy) => {
            /** @param {ScrollStrategySettings} current */
            const updateSettings = (current) => {
                const nextSettings = setURLPatternScrollStrategy(
                    current,
                    activeURL.href,
                    nextStrategy
                )

                void setStoredScrollStrategySettings(nextSettings)
                return nextSettings
            }

            setScrollStrategySettings(updateSettings)
        },
        [activeURL.href]
    )

    return html`
        <${Context.Provider}
            value=${{activeTab, pageIdentity, pageData, setPageData, patchScroll}}
        >
            <${App}
                hasQueryParameters=${hasQueryParameters}
                hostname=${hostname}
                queryIdentityMode=${queryIdentityMode}
                onQueryIdentityModeChange=${onQueryIdentityModeChange}
                scrollStrategy=${scrollStrategy}
                onScrollStrategyChange=${onScrollStrategyChange}
                scrollContainerSelector=${scrollContainerSelector}
            />
        </${Context.Provider}>
    `
}

/**
 * @typedef {object} AppProps
 * @property {boolean} hasQueryParameters
 * @property {string} hostname
 * @property {QueryIdentityMode} queryIdentityMode
 * @property {(mode: QueryIdentityMode) => void} onQueryIdentityModeChange
 * @property {ScrollStrategy} scrollStrategy
 * @property {(strategy: ScrollStrategy) => void} onScrollStrategyChange
 * @property {string | null} scrollContainerSelector
 */

/** @param {AppProps} props */
const App = ({
    hasQueryParameters,
    hostname,
    queryIdentityMode,
    onQueryIdentityModeChange,
    scrollStrategy,
    onScrollStrategyChange,
    scrollContainerSelector,
}) => {
    const {activeTab, pageIdentity, pageData, setPageData} = useBootContext()
    const [autoEditScrollId, setAutoEditScrollId] = useState(
        /** @type {string | null} */ (null)
    )
    const markCountLabel = `${pageData.scrolls.length} mark${pageData.scrolls.length !== 1 ? 's' : ''}`

    const onOpenSettings = useCallback(() => {
        if (chrome.runtime.openOptionsPage) {
            void chrome.runtime.openOptionsPage()
            return
        }

        window.open(chrome.runtime.getURL('src/pages/settings/index.html'))
    }, [])

    const onSave = useCallback(async () => {
        if (!activeTab.id) return

        const injectionResults = await chrome.scripting.executeScript({
            target: {tabId: activeTab.id},
            func: capturePageScrollSnapshot,
            args: [scrollContainerSelector],
        })

        const snapshot = injectionResults[0]?.result
        if (!snapshot) return

        const scrollDetails = await saveCurrentMark(pageIdentity, snapshot)
        setAutoEditScrollId(scrollDetails.uuid)
    }, [activeTab.id, pageIdentity, scrollContainerSelector])

    const onOpenAllMarks = useCallback(async () => {
        const manageURL = chrome.runtime.getURL('src/pages/manage/index.html')
        const [existingManageTab] = await chrome.tabs.query({url: manageURL})

        if (existingManageTab?.id) {
            await chrome.tabs.update(existingManageTab.id, {active: true})

            if (existingManageTab.windowId !== undefined) {
                await chrome.windows.update(existingManageTab.windowId, {focused: true})
            }

            return
        }

        await chrome.tabs.create({url: manageURL})
    }, [])

    /** @param {ScrollDetails} details */
    const renderScrollItem = (details) => html`
        <${Scroll}
            scrollDetails=${details}
            scrollStrategy=${scrollStrategy}
            scrollContainerSelector=${scrollContainerSelector}
            autoEditName=${details.uuid === autoEditScrollId}
            onAutoEditNameHandled=${() => setAutoEditScrollId(null)}
        />
    `

    return html`
        <div class="popup animate-fade-in-up">
            <div class="popup__header">
                <h1 class="popup__title">Mark Scroll Positions</h1>
                <span class="popup__header-actions">
                    <span class="popup__count">${markCountLabel}</span>
                    <button
                        type="button"
                        onClick=${onOpenSettings}
                        class="icon-button icon-button--compact popup__settings-button"
                        title="Open settings"
                        aria-label="Open settings"
                    >
                        <${Icon} icon="gear" className="icon icon--xs" />
                    </button>
                </span>
            </div>
            <div class="popup__actions">
                <button
                    type="button"
                    onClick=${onSave}
                    class="button button--primary button--fill"
                >
                    <${Icon} icon="bookmark" className="icon icon--sm" />
                    Mark
                </button>
                <button
                    type="button"
                    onClick=${onOpenAllMarks}
                    class="button button--secondary button--fill"
                >
                    <${Icon} icon="bookBookmark" className="icon icon--sm" />
                    All Marks
                </button>
            </div>

            ${hasQueryParameters
                ? html`
                    <div class="popup__query-row">
                        <label class="popup__query-label">
                            <input
                                type="checkbox"
                                checked=${queryIdentityMode === 'include'}
                                onChange=${
                                    /** @param {Event & {currentTarget: HTMLInputElement}} event */
                                    (event) => {
                                        onQueryIdentityModeChange(
                                            event.currentTarget.checked ? 'include' : 'ignore'
                                        )
                                    }
                                }
                                class="checkbox checkbox--small"
                            />
                            <span>
                                Use query params for
                                <span class="popup__query-host">${hostname}</span>
                            </span>
                        </label>
                        <button
                            type="button"
                            onClick=${onOpenSettings}
                            class="popup__info-button"
                            title="Query parameters are the ?key=value parts of a URL. When enabled, pages with different query parameters are treated as separate pages for marks. Enable this if the content of your page depends on query parameters, otherwise leave it as is."
                            aria-label="Query parameters are the ?key=value parts of a URL. When enabled, pages with different query parameters are treated as separate pages for marks. Enable this if the content of your page depends on query parameters, otherwise leave it as is."
                        >
                            <${Icon} icon="circleInfo" className="icon icon--xs" />
                        </button>
                    </div>
                `
                : null}

            ${pageData.scrolls.length === 0
                ? html`<div class="popup__empty-state">No marks on this page yet</div>`
                : html`
                    <${SortableScrollList}
                        pageData=${pageData}
                        setPageData=${setPageData}
                        interactionMode="pointer"
                        renderItem=${renderScrollItem}
                    />
                `}

            ${scrollContainerSelector
                ? html`
                    <div
                        class="popup__container-row"
                        title=${`Using custom scroll container: ${scrollContainerSelector}`}
                        aria-label=${`Using custom scroll container: ${scrollContainerSelector}`}
                    >
                        <span class="popup__strategy-label">Scroll container: Custom</span>
                        <${Icon} icon="circleInfo" className="icon icon--xs" />
                    </div>
                `
                : null}

            <div class="popup__strategy-row">
                <span class="popup__strategy-label-wrap">
                    <span class="popup__strategy-label">This website's default</span>
                    <button
                        type="button"
                        onClick=${onOpenSettings}
                        class="popup__info-button"
                        title=${`Sets the default jump strategy for ${hostname}. Page ratio jumps to the same relative position in the full page. Screen ratio uses the saved top position relative to screen height, which can work better when page content grows or shrinks.`}
                        aria-label=${`Sets the default jump strategy for ${hostname}. Page ratio jumps to the same relative position in the full page. Screen ratio uses the saved top position relative to screen height, which can work better when page content grows or shrinks.`}
                    >
                        <${Icon} icon="circleInfo" className="icon icon--xs" />
                    </button>
                </span>
                <select
                    value=${scrollStrategy}
                    onChange=${
                        /** @param {Event & {currentTarget: HTMLSelectElement}} event */
                        (event) => {
                            const nextStrategy = parseScrollStrategy(event.currentTarget.value)
                            if (nextStrategy) {
                                onScrollStrategyChange(nextStrategy)
                            }
                        }
                    }
                    class="popup__strategy-select"
                >
                    <option value="page-ratio">Page ratio</option>
                    <option value="viewport-ratio">Screen ratio</option>
                </select>
            </div>
        </div>
    `
}

/**
 * @param {object} props
 * @param {ScrollDetails} props.scrollDetails
 * @param {ScrollStrategy} props.scrollStrategy
 * @param {string | null} props.scrollContainerSelector
 * @param {boolean} [props.autoEditName]
 * @param {() => void} [props.onAutoEditNameHandled]
 */
const Scroll = ({
    scrollDetails,
    scrollStrategy,
    scrollContainerSelector,
    autoEditName = false,
    onAutoEditNameHandled,
}) => {
    const {activeTab, pageData, setPageData, patchScroll} = useBootContext()

    const onJump = () => {
        if (!activeTab.id) return

        void chrome.scripting.executeScript({
            target: {tabId: activeTab.id},
            func: jumpToScrollPosition,
            args: [scrollDetails, scrollStrategy, scrollContainerSelector],
        })
    }

    return html`
        <${GenericScroll}
            scrollDetails=${scrollDetails}
            onJump=${onJump}
            pageData=${pageData}
            setPageData=${setPageData}
            patchScroll=${patchScroll}
            scrollStrategy=${scrollStrategy}
            autoEditName=${autoEditName}
            onAutoEditNameHandled=${onAutoEditNameHandled}
        />
    `
}

/**
 * @param {PageIdentity} pageIdentity
 * @param {PageScrollSnapshot} snapshot
 * @returns {Promise<ScrollDetails>}
 */
const saveCurrentMark = async (pageIdentity, snapshot) => {
    const pageData = await getStoredPageData(pageIdentity)
    const markInsertPosition = await getScrollInsertPosition()

    const scrollDetails = {
        scrollPosition: snapshot.scrollPosition,
        viewportHeight: snapshot.viewportHeight,
        contentHeight: snapshot.contentHeight,
        dateISO: new Date().toISOString(),
        uuid: crypto.randomUUID(),
        name: `Mark #${pageData.scrolls.length + 1}`,
        note: '',
    }

    const scrolls = [...pageData.scrolls]

    if (markInsertPosition === 'top') {
        scrolls.unshift(scrollDetails)
    } else {
        scrolls.push(scrollDetails)
    }

    const nextPageData = {
        ...pageData,
        scrolls,
        title: snapshot.title || pageData.title,
    }

    await setStoredPageData(pageIdentity, nextPageData)

    return scrollDetails
}

void main()
