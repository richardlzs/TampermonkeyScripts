// ==UserScript==
// @name         EFTarkov 物价天梯增强 + 官方分类筛选
// @namespace    https://www.eftarkov.com/
// @version      3.0.2
// @description  为 EFTarkov PvE、PvP、PvP Season 物价天梯补充 10,000~49,999 ₽/格档位，并按官方分类筛选
// @author       Richard
// @homepageURL  https://github.com/richardlzs/TampermonkeyScripts
// @updateURL    https://raw.githubusercontent.com/richardlzs/TampermonkeyScripts/main/eftarkov/eft-price.user.js
// @downloadURL  https://raw.githubusercontent.com/richardlzs/TampermonkeyScripts/main/eftarkov/eft-price.user.js
// @match        https://www.eftarkov.com/news/web_210.html*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    const MODE_CONFIG = {
        pve: { apiId: '9', label: 'PvE' },
        pvp: { apiId: '10', label: 'PvP' },
        season: { apiId: '16', label: 'PvP Season' }
    };
    const MODE_BY_API_ID = new Map(
        Object.entries(MODE_CONFIG).map(([mode, config]) => [config.apiId, mode])
    );
    const FILTER_STORAGE_PREFIX = 'eftarkov-filter-';

    // 原站右下角模式按钮在首次访问时默认“赛季”，但价格页在尚无 currentMode 时默认 PvP。
    // 在 document-start 对齐这两个原站默认值，避免首屏原始档位与扩展档位串模式。
    if (localStorage.getItem('currentMode') === null) {
        localStorage.setItem('currentMode', 'season');
    }

    const MIN_VALUE_PER_SLOT = 10000;
    const ORIGINAL_MIN_VALUE_PER_SLOT = 50000;
    const UNCATEGORIZED_KEY = '__tm_uncategorized__';
    const UNCATEGORIZED_LABEL = '未分类（接口无分类）';

    const EXTRA_RANGES = [
        { id: 'tm-eft-range-40k', min: 40000, max: 50000, label: '40,000 - 49,999' },
        { id: 'tm-eft-range-30k', min: 30000, max: 40000, label: '30,000 - 39,999' },
        { id: 'tm-eft-range-20k', min: 20000, max: 30000, label: '20,000 - 29,999' },
        { id: 'tm-eft-range-10k', min: 10000, max: 20000, label: '10,000 - 19,999' }
    ];

    const EXTRA_BLOCK_CLASS = 'tm-eft-extra-range';
    const FILTER_PANEL_ID = 'tm-eft-category-filter';

    const nativeFetch = window.fetch ? window.fetch.bind(window) : null;
    // 原站只在页面加载或本页切换模式时更新自己的 currentMode。
    // 其他标签页改写共享 localStorage 时，本页仍应保持原站正在展示的模式。
    let currentPageMode = localStorage.getItem('currentMode') || 'pvp';

    const modeStates = Object.fromEntries(
        Object.keys(MODE_CONFIG).map(mode => [mode, createModeState(mode)])
    );
    let initializedDom = false;
    let currentObservedMode = null;
    let originalRangeObservers = [];
    let applyFilterTimer = null;

    function createModeState(mode) {
        return {
            mode,
            apiItems: null,
            displayItems: [],
            itemById: new Map(),
            categoryIndex: new Map(),
            filterState: loadFilterState(mode),
            fallbackTimer: null,
            fetchInFlight: null,
            siteRequestsInFlight: 0,
            firstSiteRequestAt: null,
            siteRequestSerial: 0,
            lastAppliedSiteRequest: 0
        };
    }

    function loadFilterState(mode) {
        const empty = () => ({
            showAll: true,
            selectedTops: new Set(),
            selectedSubsByTop: new Map()
        });

        try {
            const saved = JSON.parse(localStorage.getItem(`${FILTER_STORAGE_PREFIX}${mode}`));
            if (!saved || typeof saved !== 'object') return empty();

            const selectedTops = new Set(
                Array.isArray(saved.selectedTops)
                    ? saved.selectedTops.filter(value => typeof value === 'string')
                    : []
            );
            const selectedSubsByTop = new Map();
            if (saved.selectedSubsByTop && typeof saved.selectedSubsByTop === 'object') {
                for (const [top, subs] of Object.entries(saved.selectedSubsByTop)) {
                    if (Array.isArray(subs)) {
                        selectedSubsByTop.set(top, new Set(subs.filter(value => typeof value === 'string')));
                    }
                }
            }

            return {
                showAll: saved.showAll !== false,
                selectedTops,
                selectedSubsByTop
            };
        } catch (error) {
            console.warn(`[EFTarkov 扩展] 无法读取 ${mode} 分类设置:`, error);
            return empty();
        }
    }

    function saveFilterState(mode) {
        const filterState = modeStates[mode]?.filterState;
        if (!filterState) return;

        try {
            localStorage.setItem(`${FILTER_STORAGE_PREFIX}${mode}`, JSON.stringify({
                showAll: filterState.showAll,
                selectedTops: [...filterState.selectedTops],
                selectedSubsByTop: Object.fromEntries(
                    [...filterState.selectedSubsByTop].map(([top, subs]) => [top, [...subs]])
                )
            }));
        } catch (error) {
            console.warn(`[EFTarkov 扩展] 无法保存 ${mode} 分类设置:`, error);
        }
    }

    function getCurrentState() {
        return modeStates[getCurrentMode()] || null;
    }

    // ---------------------------------------------------------------------
    // 1. 优先复用原网页三种模式各自的 API 请求
    // ---------------------------------------------------------------------

    function resolveModeFromApiRequest(input) {
        try {
            const rawUrl = typeof input === 'string' ? input : input?.url;
            if (!rawUrl) return null;

            const url = new URL(rawUrl, location.href);
            if (
                url.hostname === 'api.eftarkov.com' &&
                url.pathname === '/boss.php'
            ) {
                return MODE_BY_API_ID.get(url.searchParams.get('id')) || null;
            }
            return null;
        } catch (_) {
            return null;
        }
    }

    function installFetchInterceptor() {
        if (!nativeFetch) return;

        window.fetch = function (...args) {
            const mode = resolveModeFromApiRequest(args[0]);
            const state = mode ? modeStates[mode] : null;
            const requestSerial = state ? ++state.siteRequestSerial : 0;
            if (state) {
                if (currentPageMode !== mode) {
                    currentPageMode = mode;
                    if (initializedDom) syncMode();
                }
                if (state.siteRequestsInFlight === 0) state.firstSiteRequestAt = Date.now();
                state.siteRequestsInFlight += 1;
            }

            return nativeFetch(...args).then(response => {
                if (mode && response.ok) {
                    response.clone().json()
                        .then(data => captureApiData(mode, data, 'site', requestSerial))
                        .catch(error => {
                            console.warn(`[EFTarkov 扩展] 无法读取原站 ${MODE_CONFIG[mode].label} 响应副本:`, error);
                        })
                        .finally(() => finishSiteRequest(state));
                } else if (state) {
                    finishSiteRequest(state);
                }
                return response;
            }, error => {
                if (state) finishSiteRequest(state);
                throw error;
            });
        };
    }

    function finishSiteRequest(state) {
        state.siteRequestsInFlight -= 1;
        if (state.siteRequestsInFlight === 0) state.firstSiteRequestAt = null;
    }

    installFetchInterceptor();

    function captureApiData(mode, data, source, requestSerial = 0) {
        const items = data?.raw_api_data?.data?.items;
        if (!Array.isArray(items)) return false;

        const state = modeStates[mode];
        if (source === 'fallback' && state.apiItems !== null) return true;
        if (source === 'site' && requestSerial < state.lastAppliedSiteRequest) return true;
        if (source === 'site') state.lastAppliedSiteRequest = requestSerial;

        state.apiItems = items;
        clearTimeout(state.fallbackTimer);
        state.fallbackTimer = null;
        processModeItems(state);

        console.log(`[EFTarkov 扩展] 已取得 ${MODE_CONFIG[mode].label} API 数据，共 ${items.length} 件物品`);

        if (initializedDom && getCurrentMode() === mode) {
            renderModeState(mode);
        }

        return true;
    }

    function scheduleFallbackFetch(mode, delay = 1500) {
        const state = modeStates[mode];
        if (state.apiItems !== null || state.fetchInFlight || state.fallbackTimer || !nativeFetch) return;

        state.fallbackTimer = setTimeout(() => {
            state.fallbackTimer = null;

            if (state.apiItems === null && getCurrentMode() === mode) {
                // 原站请求仍在进行时先等它的响应；长时间无响应才自行请求。
                if (state.siteRequestsInFlight > 0 && Date.now() - state.firstSiteRequestAt < 15000) {
                    scheduleFallbackFetch(mode, 1500);
                } else {
                    fetchModeDataDirectly(mode);
                }
            }
        }, delay);
    }

    async function fetchModeDataDirectly(mode) {
        const state = modeStates[mode];
        if (state.apiItems !== null) return;
        if (state.fetchInFlight) return state.fetchInFlight;

        setPanelStatus(`正在读取 ${MODE_CONFIG[mode].label} 分类数据…`);
        setExtraRangesLoading();

        state.fetchInFlight = (async () => {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 20000);
            try {
                const response = await nativeFetch(`https://api.eftarkov.com/boss.php?id=${MODE_CONFIG[mode].apiId}`, {
                    method: 'GET',
                    headers: { Accept: 'application/json' },
                    cache: 'no-store',
                    signal: controller.signal
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status} ${response.statusText}`);
                }

                const data = await response.json();
                if (!captureApiData(mode, data, 'fallback')) {
                    throw new Error('API 中未找到 raw_api_data.data.items');
                }
            } catch (error) {
                console.error(`[EFTarkov 扩展] ${MODE_CONFIG[mode].label} API 请求失败:`, error);

                if (state.apiItems === null && getCurrentMode() === mode) {
                    const message = error?.name === 'AbortError'
                        ? `${MODE_CONFIG[mode].label} 分类数据请求超时`
                        : `${MODE_CONFIG[mode].label} 分类数据读取失败：${error?.message || error}`;

                    setPanelStatus(message, true);
                    setExtraRangesError();
                }
            } finally {
                clearTimeout(timer);
                state.fetchInFlight = null;
            }
        })();

        return state.fetchInFlight;
    }

    // ---------------------------------------------------------------------
    // 2. 数据计算：严格沿用原网页的单格价值算法
    // ---------------------------------------------------------------------

    function calculateItem(item) {
        const traderPrices = Array.isArray(item.traderPrices) ? item.traderPrices : [];
        const maxTraderPrice = traderPrices.length
            ? Math.max(...traderPrices.map(tp => Number(tp?.priceRUB) || 0))
            : 0;

        const fleaPrice = item.lastLowPrice;
        const highestPrice = fleaPrice !== null && fleaPrice !== undefined
            ? Math.max(Number(fleaPrice) || 0, maxTraderPrice)
            : maxTraderPrice;

        const width = Number(item.width) || 0;
        const height = Number(item.height) || 0;
        const volume = width * height;
        const valuePerSlot = volume > 0 ? highestPrice / volume : 0;

        const categoryInfo = getCategoryInfo(item);

        return {
            itemData: item,
            highestPrice,
            valuePerSlot,
            categoryInfo,
            displayData: {
                formattedPrice: formatPrice(highestPrice),
                offerCount: formatPrice(item.lastOfferCount || 0),
                updatedTime: timeSince(new Date(item.updated)),
                valuePerSlot: Math.round(valuePerSlot)
            }
        };
    }

    function processModeItems(state) {
        state.displayItems = state.apiItems
            .map(calculateItem)
            .filter(item => item.valuePerSlot >= MIN_VALUE_PER_SLOT)
            .sort((a, b) => b.valuePerSlot - a.valuePerSlot);

        state.itemById = new Map(state.displayItems.map(item => [String(item.itemData.id), item]));
        state.categoryIndex = buildCategoryIndex(state.displayItems);

        sanitizeFilterState(state);
    }

    function renderModeState(mode) {
        if (!initializedDom || getCurrentMode() !== mode) return;
        const state = modeStates[mode];
        renderExtraRanges(state);
        renderFilterControls(state);
        applyCategoryFilter(state);

        console.log(
            `[EFTarkov 扩展] ${MODE_CONFIG[mode].label} ≥${formatPrice(MIN_VALUE_PER_SLOT)} ₽/格：` +
            `${state.displayItems.length} 件；顶级分类：${state.categoryIndex.size} 个`
        );
    }

    function getCategoryInfo(item) {
        const names = Array.isArray(item.handbookCategories)
            ? item.handbookCategories
                .map(category => String(category?.name || '').trim())
                .filter(Boolean)
            : [];

        if (!names.length) {
            return {
                topKey: UNCATEGORIZED_KEY,
                topLabel: UNCATEGORIZED_LABEL,
                path: [],
                descendants: []
            };
        }

        const topLabel = names[names.length - 1];
        const descendants = [...new Set(names.slice(0, -1))];

        return {
            topKey: topLabel,
            topLabel,
            path: names,
            descendants
        };
    }

    function buildCategoryIndex(items) {
        const index = new Map();

        for (const item of items) {
            const info = item.categoryInfo;

            if (!index.has(info.topKey)) {
                index.set(info.topKey, {
                    key: info.topKey,
                    label: info.topLabel,
                    count: 0,
                    descendants: new Map()
                });
            }

            const top = index.get(info.topKey);
            top.count += 1;

            for (const name of info.descendants) {
                top.descendants.set(name, (top.descendants.get(name) || 0) + 1);
            }
        }

        return index;
    }

    // ---------------------------------------------------------------------
    // 3. 页面结构：新增 40k/30k/20k/10k 四档
    // ---------------------------------------------------------------------

    function findTemplateBlock(container) {
        let node = container?.parentElement;
        let fallback = null;

        for (let i = 0; node && i < 7; i++) {
            const ranges = node.querySelectorAll('[id^="value-range-"]');

            if (ranges.length === 1) {
                fallback = node;
                const text = node.textContent || '';

                if (
                    /50\s*,?\s*000/.test(text) ||
                    /99\s*,?\s*999/.test(text)
                ) {
                    return node;
                }
            }

            if (ranges.length > 1) break;
            node = node.parentElement;
        }

        return fallback || container?.parentElement || null;
    }

    function ensureExtraRanges() {
        if (document.getElementById(EXTRA_RANGES[0].id)) return true;

        const sourceContainer = document.getElementById('value-range-5');
        if (!sourceContainer) return false;

        const templateBlock = findTemplateBlock(sourceContainer);
        if (!templateBlock) return false;

        let insertAfter = templateBlock;

        for (const range of EXTRA_RANGES) {
            const block = templateBlock.cloneNode(true);
            block.classList.add(EXTRA_BLOCK_CLASS);
            block.dataset.tmEftRange = range.id;

            let container = block.querySelector('#value-range-5');
            if (!container) {
                container = block.querySelector('[id^="value-range-"]');
            }
            if (!container) continue;

            // 删除克隆区块内除目标物品容器外的重复 id。
            block.querySelectorAll('[id]').forEach(element => {
                if (element !== container) element.removeAttribute('id');
            });

            container.id = range.id;
            container.innerHTML = '<div class="category-loading">数据加载中...</div>';

            replaceRangeTitle(block, container, range);

            insertAfter.insertAdjacentElement('afterend', block);
            insertAfter = block;
        }

        return true;
    }

    function replaceRangeTitle(block, itemContainer, range) {
        let changed = false;
        const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
        const textNodes = [];

        while (walker.nextNode()) textNodes.push(walker.currentNode);

        for (const node of textNodes) {
            if (itemContainer.contains(node)) continue;

            const before = node.nodeValue;
            let after = before;

            after = after
                .replace(/50\s*,\s*000/g, formatPrice(range.min))
                .replace(/99\s*,\s*999/g, formatPrice(range.max - 1))
                .replace(/\b50000\b/g, String(range.min))
                .replace(/\b99999\b/g, String(range.max - 1));

            if (after !== before) {
                node.nodeValue = after;
                changed = true;
            }
        }

        if (!changed) {
            const title = document.createElement('h5');
            title.className = 'tm-generated-range-title';
            title.textContent = `单格 ${range.label}`;
            itemContainer.before(title);
        }
    }

    function renderExtraRanges(state) {
        const extraItems = state.displayItems.filter(
            item => item.valuePerSlot < ORIGINAL_MIN_VALUE_PER_SLOT
        );

        for (const range of EXTRA_RANGES) {
            const container = document.getElementById(range.id);
            if (!container) continue;

            const itemsInRange = extraItems.filter(
                item => item.valuePerSlot >= range.min && item.valuePerSlot < range.max
            );

            container.innerHTML = '';

            if (!itemsInRange.length) {
                container.innerHTML = '<div class="category-loading">该区间暂无数据</div>';
                continue;
            }

            for (const item of itemsInRange) {
                container.insertAdjacentHTML('beforeend', createItemHtml(item));
            }

            bindTooltipPosition(container);
        }
    }

    function createItemHtml(item) {
        const data = item.itemData;
        const display = item.displayData;
        const traderPrices = Array.isArray(data.traderPrices) ? data.traderPrices : [];

        const traderHtml = traderPrices.length
            ? traderPrices.map(tp =>
                `${escapeHtml(tp?.trader?.name || '未知商人')}: ${formatPrice(tp?.priceRUB)}`
            ).join('<br>')
            : '无';

        const fleaHtml = data.lastLowPrice !== null && data.lastLowPrice !== undefined
            ? formatPrice(data.lastLowPrice)
            : '不能上架';

        return `
            <div class="item tm-eft-extra-item" data-tm-item-id="${escapeAttr(data.id)}">
                <a href="/news/id/${escapeAttr(data.id)}.html" target="_blank">
                    <img
                        src="${escapeAttr(data.iconLink || '')}"
                        data-src="${escapeAttr(data.iconLink || '')}"
                        alt="${escapeAttr(data.name || '')}"
                        class="lazy-img"
                        loading="lazy"
                        style="width:100%;height:auto;min-height:40px;background:#1a1a1a;"
                    />
                </a>
                <div class="shortName">${escapeHtml(data.shortName || '')}</div>
                <div class="tooltip">
                    <div style="font-weight:bold;">${escapeHtml(data.name || '')} (${escapeHtml(data.shortName || '')})</div>
                    <p>跳蚤报价数量: ${display.offerCount}</p>
                    <p>最高价格: ${display.formattedPrice}</p>
                    <p>单格价格: ${formatPrice(display.valuePerSlot)}</p><br>
                    <p>跳蚤市场: ${fleaHtml}</p>
                    <p>商人价格:<br>${traderHtml}</p>
                    <p>更新时间: ${display.updatedTime}</p>
                </div>
            </div>
        `;
    }

    function setExtraRangesLoading() {
        for (const range of EXTRA_RANGES) {
            const container = document.getElementById(range.id);
            if (container) {
                container.innerHTML = '<div class="category-loading">数据加载中...</div>';
            }
        }
    }

    function setExtraRangesError() {
        for (const range of EXTRA_RANGES) {
            const container = document.getElementById(range.id);
            if (container) {
                container.innerHTML = '<div class="category-loading">扩展数据加载失败，请刷新页面重试</div>';
            }
        }
    }

    function setExtraRangesVisible(visible) {
        document.querySelectorAll(`.${EXTRA_BLOCK_CLASS}`).forEach(block => {
            block.style.display = visible ? '' : 'none';
        });
    }

    // ---------------------------------------------------------------------
    // 4. 官方分类筛选 UI
    // ---------------------------------------------------------------------

    function ensureFilterPanel() {
        if (document.getElementById(FILTER_PANEL_ID)) return true;

        const firstContainer = document.getElementById('value-range-1');
        if (!firstContainer) return false;

        injectStyles();

        const panel = document.createElement('section');
        panel.id = FILTER_PANEL_ID;
        panel.innerHTML = `
            <div class="tm-filter-head">
                <div>
                    <strong id="tm-filter-title">物品分类筛选</strong>
                    <span class="tm-filter-subtitle">（分类来自 API handbookCategories）</span>
                </div>
                <div class="tm-filter-actions">
                    <button type="button" data-action="all">全部</button>
                    <button type="button" data-action="clear">清空</button>
                </div>
            </div>
            <div id="tm-filter-status" class="tm-filter-status">等待数据…</div>
            <div id="tm-filter-top" class="tm-filter-section"></div>
            <div id="tm-filter-sub" class="tm-filter-section tm-filter-subsection"></div>
        `;

        const firstBlock = findTemplateBlock(firstContainer);
        if (firstBlock?.parentNode) {
            firstBlock.parentNode.insertBefore(panel, firstBlock);
        } else {
            firstContainer.before(panel);
        }

        panel.querySelector('[data-action="all"]').addEventListener('click', () => {
            const mode = getCurrentMode();
            const filterState = modeStates[mode]?.filterState;
            if (!filterState) return;
            filterState.showAll = true;
            filterState.selectedTops.clear();
            filterState.selectedSubsByTop.clear();
            saveFilterState(mode);
            renderFilterControls();
            applyCategoryFilter();
        });

        panel.querySelector('[data-action="clear"]').addEventListener('click', () => {
            const mode = getCurrentMode();
            const filterState = modeStates[mode]?.filterState;
            if (!filterState) return;
            filterState.showAll = false;
            filterState.selectedTops.clear();
            filterState.selectedSubsByTop.clear();
            saveFilterState(mode);
            renderFilterControls();
            applyCategoryFilter();
        });

        return true;
    }

    function renderFilterControls(state = getCurrentState()) {
        const panel = document.getElementById(FILTER_PANEL_ID);
        const topContainer = document.getElementById('tm-filter-top');
        const subContainer = document.getElementById('tm-filter-sub');
        if (!state || !panel || !topContainer || !subContainer) return;

        const { categoryIndex, filterState } = state;

        topContainer.innerHTML = '';
        subContainer.innerHTML = '';

        const categories = [...categoryIndex.values()]
            .sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'));

        if (!categories.length) {
            setPanelStatus('当前 ≥10,000 ₽/格的数据中没有可用分类', true);
            return;
        }

        const topTitle = document.createElement('div');
        topTitle.className = 'tm-filter-section-title';
        topTitle.textContent = '顶级分类（可多选）';
        topContainer.appendChild(topTitle);

        const topOptions = document.createElement('div');
        topOptions.className = 'tm-filter-options';

        for (const category of categories) {
            const label = createCheckboxLabel(
                category.label,
                category.count,
                !filterState.showAll && filterState.selectedTops.has(category.key)
            );

            const input = label.querySelector('input');
            input.addEventListener('change', () => {
                if (getCurrentState() !== state) return;
                filterState.showAll = false;

                if (input.checked) {
                    filterState.selectedTops.add(category.key);
                } else {
                    filterState.selectedTops.delete(category.key);
                    filterState.selectedSubsByTop.delete(category.key);
                }

                saveFilterState(getCurrentMode());
                renderFilterControls();
                applyCategoryFilter();
            });

            topOptions.appendChild(label);
        }

        topContainer.appendChild(topOptions);

        if (!filterState.showAll && filterState.selectedTops.size > 0) {
            const subTitle = document.createElement('div');
            subTitle.className = 'tm-filter-section-title';
            subTitle.textContent = '下级分类（可多选；某大类未勾选下级分类时，显示该大类全部）';
            subContainer.appendChild(subTitle);

            const selectedTopEntries = [...filterState.selectedTops]
                .map(key => categoryIndex.get(key))
                .filter(Boolean)
                .sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'));

            for (const top of selectedTopEntries) {
                const descendants = [...top.descendants.entries()]
                    .sort((a, b) => a[0].localeCompare(b[0], 'zh-CN'));

                const group = document.createElement('div');
                group.className = 'tm-filter-subgroup';

                const groupHead = document.createElement('div');
                groupHead.className = 'tm-filter-subgroup-head';

                const groupName = document.createElement('strong');
                groupName.textContent = top.label;
                groupHead.appendChild(groupName);

                const resetButton = document.createElement('button');
                resetButton.type = 'button';
                resetButton.className = 'tm-mini-button';
                resetButton.textContent = '该类全部';
                resetButton.addEventListener('click', () => {
                    if (getCurrentState() !== state) return;
                    filterState.selectedSubsByTop.delete(top.key);
                    saveFilterState(getCurrentMode());
                    renderFilterControls();
                    applyCategoryFilter();
                });
                groupHead.appendChild(resetButton);
                group.appendChild(groupHead);

                if (!descendants.length) {
                    const empty = document.createElement('span');
                    empty.className = 'tm-filter-muted';
                    empty.textContent = '无下级分类';
                    group.appendChild(empty);
                } else {
                    const options = document.createElement('div');
                    options.className = 'tm-filter-options';
                    const selectedSubs = filterState.selectedSubsByTop.get(top.key) || new Set();

                    for (const [subName, count] of descendants) {
                        const label = createCheckboxLabel(subName, count, selectedSubs.has(subName));
                        const input = label.querySelector('input');

                        input.addEventListener('change', () => {
                            if (getCurrentState() !== state) return;
                            filterState.showAll = false;
                            filterState.selectedTops.add(top.key);

                            let set = filterState.selectedSubsByTop.get(top.key);
                            if (!set) {
                                set = new Set();
                                filterState.selectedSubsByTop.set(top.key, set);
                            }

                            if (input.checked) set.add(subName);
                            else set.delete(subName);

                            if (set.size === 0) {
                                filterState.selectedSubsByTop.delete(top.key);
                            }

                            saveFilterState(getCurrentMode());
                            renderFilterControls();
                            applyCategoryFilter();
                        });

                        options.appendChild(label);
                    }

                    group.appendChild(options);
                }

                subContainer.appendChild(group);
            }
        }

        updateFilterSummary(state);
    }

    function createCheckboxLabel(text, count, checked) {
        const label = document.createElement('label');
        label.className = 'tm-filter-option';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = checked;

        const span = document.createElement('span');
        span.textContent = `${text} (${count})`;

        label.append(input, span);
        return label;
    }

    function sanitizeFilterState(state) {
        const { filterState, categoryIndex } = state;
        if (filterState.showAll) return;
        let changed = false;

        for (const top of [...filterState.selectedTops]) {
            if (!categoryIndex.has(top)) {
                filterState.selectedTops.delete(top);
                filterState.selectedSubsByTop.delete(top);
                changed = true;
            }
        }

        for (const [top, selectedSubs] of [...filterState.selectedSubsByTop.entries()]) {
            const entry = categoryIndex.get(top);
            if (!entry || !filterState.selectedTops.has(top)) {
                filterState.selectedSubsByTop.delete(top);
                changed = true;
                continue;
            }

            for (const sub of [...selectedSubs]) {
                if (!entry.descendants.has(sub)) {
                    selectedSubs.delete(sub);
                    changed = true;
                }
            }

            if (!selectedSubs.size) {
                filterState.selectedSubsByTop.delete(top);
                changed = true;
            }
        }

        if (changed) saveFilterState(state.mode);
    }

    function matchesCategoryFilter(item, filterState) {
        if (filterState.showAll) return true;
        if (!filterState.selectedTops.size) return false;

        const info = item.categoryInfo;
        if (!filterState.selectedTops.has(info.topKey)) return false;

        const selectedSubs = filterState.selectedSubsByTop.get(info.topKey);
        if (!selectedSubs || selectedSubs.size === 0) return true;

        return info.descendants.some(name => selectedSubs.has(name));
    }

    function applyCategoryFilter(state = getCurrentState()) {
        if (!state || state.apiItems === null || getCurrentState() !== state) return;

        // 原站五档 + 新增四档全部统一筛选。
        const containerIds = [
            'value-range-1',
            'value-range-2',
            'value-range-3',
            'value-range-4',
            'value-range-5',
            ...EXTRA_RANGES.map(range => range.id)
        ];

        for (const id of containerIds) {
            const container = document.getElementById(id);
            if (container) filterContainer(container, state);
        }

        updateFilterSummary(state);
    }

    function filterContainer(container, state) {
        const itemElements = [...container.querySelectorAll('.item')];
        if (!itemElements.length) {
            removeFilterEmptyMessage(container);
            return;
        }

        let visibleCount = 0;

        for (const element of itemElements) {
            const id = getItemIdFromElement(element);
            const item = id ? state.itemById.get(id) : null;
            const visible = item ? matchesCategoryFilter(item, state.filterState) : state.filterState.showAll;

            element.style.display = visible ? '' : 'none';
            if (visible) visibleCount += 1;
        }

        updateFilterEmptyMessage(container, visibleCount, state.filterState);
    }

    function getItemIdFromElement(element) {
        const direct = element.dataset.tmItemId;
        if (direct) return String(direct);

        const href = element.querySelector('a[href*="/news/id/"]')?.getAttribute('href') || '';
        const match = href.match(/\/news\/id\/([^/?#]+)\.html/i);
        return match ? String(match[1]) : null;
    }

    function updateFilterEmptyMessage(container, visibleCount, filterState) {
        let message = container.querySelector(':scope > .tm-filter-empty');

        if (visibleCount === 0 && !filterState.showAll) {
            if (!message) {
                message = document.createElement('div');
                message.className = 'category-loading tm-filter-empty';
                message.textContent = '当前分类筛选下无物品';
                container.appendChild(message);
            }
        } else if (message) {
            message.remove();
        }
    }

    function removeFilterEmptyMessage(container) {
        container.querySelectorAll(':scope > .tm-filter-empty').forEach(node => node.remove());
    }

    function restoreOriginalRanges() {
        for (let i = 1; i <= 5; i++) {
            const container = document.getElementById(`value-range-${i}`);
            if (!container) continue;

            container.querySelectorAll('.item').forEach(item => {
                item.style.display = '';
            });
            removeFilterEmptyMessage(container);
        }
    }

    function updateFilterSummary(state = getCurrentState()) {
        const status = document.getElementById('tm-filter-status');
        if (!status || !state || state.apiItems === null) return;

        const { filterState, displayItems } = state;
        const visible = displayItems.filter(item => matchesCategoryFilter(item, filterState)).length;
        let filterText = '全部官方分类';

        if (!filterState.showAll) {
            filterText = filterState.selectedTops.size
                ? `已选 ${filterState.selectedTops.size} 个顶级分类`
                : '未选择任何分类';
        }

        status.classList.remove('tm-error');
        status.textContent = `当前显示 ${visible} / ${displayItems.length} 件（单格 ≥ ${formatPrice(MIN_VALUE_PER_SLOT)} ₽）｜${filterText}`;
    }

    function setPanelStatus(text, isError = false) {
        const status = document.getElementById('tm-filter-status');
        if (!status) return;

        status.textContent = text;
        status.classList.toggle('tm-error', isError);
    }

    // ---------------------------------------------------------------------
    // 5. 模式切换、原站重新渲染监听
    // ---------------------------------------------------------------------

    function getCurrentMode() {
        return currentPageMode;
    }

    function syncMode(force = false) {
        const mode = getCurrentMode();
        if (!force && mode === currentObservedMode) return;

        currentObservedMode = mode;
        const state = modeStates[mode];

        const panel = document.getElementById(FILTER_PANEL_ID);
        if (panel) panel.style.display = state ? '' : 'none';

        setExtraRangesVisible(Boolean(state));
        restoreOriginalRanges();

        if (!state) {
            console.warn(`[EFTarkov 扩展] 未识别的页面模式: ${mode}`);
            return;
        }

        const title = document.getElementById('tm-filter-title');
        if (title) title.textContent = `${MODE_CONFIG[mode].label} 物品分类筛选`;

        if (state.apiItems !== null) {
            renderModeState(mode);
        } else {
            document.getElementById('tm-filter-top').replaceChildren();
            document.getElementById('tm-filter-sub').replaceChildren();
            setPanelStatus(`等待原网页的 ${MODE_CONFIG[mode].label} 数据…`);
            setExtraRangesLoading();
            scheduleFallbackFetch(mode);
        }
    }

    function observeOriginalRanges() {
        originalRangeObservers.forEach(observer => observer.disconnect());
        originalRangeObservers = [];

        for (let i = 1; i <= 5; i++) {
            const container = document.getElementById(`value-range-${i}`);
            if (!container) continue;

            const observer = new MutationObserver(() => {
                clearTimeout(applyFilterTimer);
                applyFilterTimer = setTimeout(() => {
                    const state = getCurrentState();
                    if (state && state.apiItems !== null) applyCategoryFilter(state);
                    else restoreOriginalRanges();
                }, 80);
            });

            observer.observe(container, { childList: true });
            originalRangeObservers.push(observer);
        }
    }

    // ---------------------------------------------------------------------
    // 6. Tooltip 与通用工具
    // ---------------------------------------------------------------------

    function bindTooltipPosition(container) {
        container.querySelectorAll('.tm-eft-extra-item').forEach(item => {
            item.addEventListener('mouseenter', function () {
                const tooltip = this.querySelector('.tooltip');
                if (!tooltip) return;

                const rect = tooltip.getBoundingClientRect();
                const windowWidth = window.innerWidth;

                if (rect.right > windowWidth) {
                    tooltip.style.left = 'auto';
                    tooltip.style.right = '0';
                    tooltip.style.transform = 'none';
                } else if (rect.left < 0) {
                    tooltip.style.left = '0';
                    tooltip.style.right = 'auto';
                    tooltip.style.transform = 'none';
                } else {
                    tooltip.style.left = '50%';
                    tooltip.style.right = '';
                    tooltip.style.transform = 'translateX(-50%)';
                }
            });
        });
    }

    function formatPrice(price) {
        if (price === null || price === undefined || price === '') return '';
        const amount = Number(price);
        return Number.isFinite(amount) ? amount.toLocaleString('en-US') : '未知';
    }

    function timeSince(date) {
        const timestamp = date instanceof Date ? date.getTime() : NaN;
        if (!Number.isFinite(timestamp)) return '未知';

        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        let minutes = Math.floor(seconds / 60);

        if (minutes < 1) return '刚刚';
        if (minutes < 60) return `${minutes}分钟前`;

        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}小时前`;

        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}天前`;
        if (days < 28) return `${Math.floor(days / 7)}周前`;

        const months = Math.floor(days / 30);
        if (months < 12) return `${months}个月前`;

        return `${Math.floor(months / 12)}年前`;
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function escapeAttr(value) {
        return escapeHtml(value);
    }

    function injectStyles() {
        if (document.getElementById('tm-eft-filter-style')) return;

        const style = document.createElement('style');
        style.id = 'tm-eft-filter-style';
        style.textContent = `
            #${FILTER_PANEL_ID} {
                margin: 14px 0 20px;
                padding: 14px 16px;
                border: 1px solid rgba(255,255,255,.16);
                border-radius: 6px;
                background: rgba(20,20,20,.92);
                color: #ddd;
                line-height: 1.5;
            }
            #${FILTER_PANEL_ID} .tm-filter-head {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                flex-wrap: wrap;
                margin-bottom: 8px;
            }
            #${FILTER_PANEL_ID} .tm-filter-subtitle,
            #${FILTER_PANEL_ID} .tm-filter-muted {
                opacity: .68;
                font-size: 12px;
            }
            #${FILTER_PANEL_ID} .tm-filter-actions,
            #${FILTER_PANEL_ID} .tm-filter-options {
                display: flex;
                flex-wrap: wrap;
                gap: 7px 10px;
                align-items: center;
            }
            #${FILTER_PANEL_ID} button {
                cursor: pointer;
                border: 1px solid rgba(255,255,255,.22);
                border-radius: 4px;
                padding: 4px 10px;
                background: rgba(255,255,255,.07);
                color: inherit;
            }
            #${FILTER_PANEL_ID} button:hover {
                background: rgba(255,255,255,.13);
            }
            #${FILTER_PANEL_ID} .tm-mini-button {
                padding: 2px 7px;
                font-size: 12px;
            }
            #${FILTER_PANEL_ID} .tm-filter-status {
                margin: 7px 0 10px;
                font-size: 13px;
                opacity: .82;
            }
            #${FILTER_PANEL_ID} .tm-filter-status.tm-error {
                opacity: 1;
                font-weight: 600;
            }
            #${FILTER_PANEL_ID} .tm-filter-section-title {
                margin: 10px 0 6px;
                font-weight: 600;
                font-size: 13px;
            }
            #${FILTER_PANEL_ID} .tm-filter-option {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                cursor: pointer;
                user-select: none;
                padding: 2px 0;
                font-size: 13px;
            }
            #${FILTER_PANEL_ID} .tm-filter-option input {
                margin: 0;
            }
            #${FILTER_PANEL_ID} .tm-filter-subgroup {
                margin-top: 8px;
                padding: 8px 10px;
                border-left: 2px solid rgba(255,255,255,.16);
                background: rgba(255,255,255,.025);
            }
            #${FILTER_PANEL_ID} .tm-filter-subgroup-head {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 5px;
            }
            .tm-filter-empty {
                width: 100%;
            }
        `;

        (document.head || document.documentElement).appendChild(style);
    }

    // ---------------------------------------------------------------------
    // 7. 启动
    // ---------------------------------------------------------------------

    function initializeDom() {
        if (initializedDom) return;

        const timer = setInterval(() => {
            const range1 = document.getElementById('value-range-1');
            const range5 = document.getElementById('value-range-5');
            if (!range1 || !range5) return;

            clearInterval(timer);

            ensureExtraRanges();
            ensureFilterPanel();
            observeOriginalRanges();

            initializedDom = true;

            syncMode(true);
        }, 100);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeDom, { once: true });
    } else {
        initializeDom();
    }
})();
