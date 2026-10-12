const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'eft-price.user.js'), 'utf8');
const instrumented = source.replace(/\}\)\(\);\s*$/, 'window.__testHooks = { modeStates, calculateItem, captureApiData, getCurrentMode, createItemHtml, formatPrice, createDefaultFilterState, loadFilterState, saveFilterState, matchesFilters, hasActiveFilters, parseOfferCountRange, updateOfferCountRange, resetFilters, resolveRankingMode, loadRankingFilterState, saveRankingFilterState, parseRankingOfferCount, readRankingItem, matchesNameAndOfferFilters };\n})();');
assert.notEqual(instrumented, source, '无法注入测试观察点');

const storage = new Map();
const pending = [];
const localStorage = {
    getItem: key => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, String(value))
};
const window = {
    fetch(input) {
        const url = typeof input === 'string' ? input : input.url;
        return new Promise((resolve, reject) => pending.push({ url, resolve, reject }));
    }
};

vm.runInNewContext(instrumented, {
    window,
    document: { readyState: 'loading', addEventListener() {} },
    localStorage,
    location: { href: 'https://www.eftarkov.com/news/web_210.html' },
    URL,
    AbortController,
    setTimeout,
    clearTimeout,
    console: { log() {}, warn() {}, error() {} }
}, { filename: 'eft-price.user.js' });

const rememberedStorage = new Map([['currentMode', 'pve']]);
const rememberedWindow = { fetch: () => Promise.reject(new Error('不应请求')) };
vm.runInNewContext(instrumented, {
    window: rememberedWindow,
    document: { readyState: 'loading', addEventListener() {} },
    localStorage: {
        getItem: key => rememberedStorage.has(key) ? rememberedStorage.get(key) : null,
        setItem: (key, value) => rememberedStorage.set(key, String(value))
    },
    location: { href: 'https://www.eftarkov.com/news/web_210.html' },
    URL,
    AbortController,
    setTimeout,
    clearTimeout,
    console: { log() {}, warn() {}, error() {} }
}, { filename: 'eft-price.user.js' });
assert.equal(rememberedStorage.get('currentMode'), 'pve', '再次访问不得覆盖上次选择的 PvE');
assert.equal(rememberedWindow.__testHooks.getCurrentMode(), 'pve');
rememberedStorage.set('currentMode', 'season');
assert.equal(rememberedWindow.__testHooks.getCurrentMode(), 'pve', '其他标签页切换模式不得改变本页展示模式');

function item(id, price, top, sub) {
    return {
        id,
        name: id,
        shortName: id,
        width: 1,
        height: 1,
        lastLowPrice: price,
        traderPrices: [],
        handbookCategories: sub ? [{ name: sub }, { name: top }] : [{ name: top }]
    };
}

function response(items) {
    const data = { raw_api_data: { data: { items } } };
    return {
        ok: true,
        clone: () => ({ json: async () => data }),
        json: async () => data
    };
}

async function complete(request, items) {
    request.resolve(response(items));
    await new Promise(setImmediate);
}

(async () => {
    const states = window.__testHooks.modeStates;
    assert.equal(storage.get('currentMode'), 'season', '首次访问应与原站赛季角标一致');
    storage.set('currentMode', 'pvp');
    assert.equal(window.__testHooks.getCurrentMode(), 'season', '共享 storage 变化不等于本页模式切换');

    // 同模式较早发出的请求后返回时，不得覆盖较新的原站响应。
    const oldPvp = window.fetch('https://api.eftarkov.com/boss.php?id=10');
    assert.equal(window.__testHooks.getCurrentMode(), 'pvp', '本页发起 PvP 请求后应切换展示模式');
    const newPvp = window.fetch({ url: 'https://api.eftarkov.com/boss.php?id=10' });
    await complete(pending[1], [item('pvp-new', 30000, '装备', '背包')]);
    await newPvp;
    await complete(pending[0], [item('pvp-old', 20000, '弹药', '子弹')]);
    await oldPvp;
    assert.equal(states.pvp.apiItems[0].id, 'pvp-new');
    assert.equal(states.pvp.siteRequestsInFlight, 0);

    // 三种模式的价格、分类索引和原始响应分别保存，10k 下限保持不变。
    const pve = window.fetch('https://api.eftarkov.com/boss.php?id=9');
    const season = window.fetch('https://api.eftarkov.com/boss.php?id=16');
    await complete(pending[2], [item('pve-10k', 10000, '弹药'), item('pve-below', 9999, '弹药')]);
    await complete(pending[3], [item('season-50k', 50000, '钥匙')]);
    await Promise.all([pve, season]);
    assert.deepEqual([...states.pve.itemById.keys()], ['pve-10k']);
    assert.deepEqual([...states.season.itemById.keys()], ['season-50k']);
    assert.deepEqual([...states.pvp.itemById.keys()], ['pvp-new']);
    assert.equal(states.pve.categoryIndex.has('弹药'), true);
    assert.equal(states.season.categoryIndex.has('钥匙'), true);
    assert.equal(states.pvp.categoryIndex.has('装备'), true);

    const fallbackAccepted = window.__testHooks.captureApiData(
        'pvp', { raw_api_data: { data: { items: [item('wrong-fallback', 40000, '钥匙')] } } },
        'fallback'
    );
    assert.equal(fallbackAccepted, true);
    assert.equal(states.pvp.apiItems[0].id, 'pvp-new', '延迟完成的 fallback 不得覆盖原站响应');

    // API 数字字段异常时，新增物品的 HTML 不得包含可执行标记。
    const hostilePrice = '<img src=x onerror=alert(1)>';
    const hostileTrader = item('bad-trader', 20000, '装备');
    hostileTrader.lastOfferCount = hostilePrice;
    hostileTrader.traderPrices = [{ priceRUB: hostilePrice, trader: { name: '商人' } }];
    const hostileFlea = item('bad-flea', hostilePrice, '装备');
    hostileFlea.traderPrices = [{ priceRUB: 20000, trader: { name: '商人' } }];
    for (const unsafeItem of [hostileTrader, hostileFlea]) {
        const html = window.__testHooks.createItemHtml(window.__testHooks.calculateItem(unsafeItem));
        assert.equal(html.includes('onerror='), false, '异常价格和报价数量不得注入 HTML');
    }
    assert.equal(window.__testHooks.formatPrice(20000), '20,000');

    const hooks = window.__testHooks;
    function searchableItem(id, price, name, shortName, count, top = '医疗物品') {
        return hooks.calculateItem({
            ...item(id, price, top, '急救包'), name, shortName, lastOfferCount: count
        });
    }
    const candidates = [
        searchableItem('original-50k', 60000, 'Salewa 急救包', '急救', 10),
        searchableItem('extra-20k', 20000, '急救包', 'SAL', '20'),
        searchableItem('above-count', 20000, 'Salewa', 'SAL', 21),
        searchableItem('wrong-category', 20000, 'Salewa', 'SAL', 15, '装备'),
        searchableItem('wrong-name', 20000, '绷带', 'Bandage', 15),
        searchableItem('missing-count', 20000, 'Salewa', 'SAL', null)
    ];
    const filters = hooks.createDefaultFilterState();
    filters.searchQuery = '  sAl  ';
    filters.minOfferCount = 10;
    filters.maxOfferCount = 20;
    assert.deepEqual(candidates.filter(entry => hooks.matchesFilters(entry, filters)).map(entry => entry.itemData.id),
        ['original-50k', 'extra-20k', 'wrong-category'], '名称、数量范围应包含两端，且覆盖 50k 上下物品');
    filters.showAll = false;
    filters.selectedTops.add('医疗物品');
    filters.selectedSubsByTop.set('医疗物品', new Set(['急救包']));
    assert.deepEqual(candidates.filter(entry => hooks.matchesFilters(entry, filters)).map(entry => entry.itemData.id),
        ['original-50k', 'extra-20k'], '分类、名称和数量需同时满足');

    const unrestricted = hooks.createDefaultFilterState();
    const zeroCount = searchableItem('zero', 20000, '物品', 'item', 0);
    const unknownCounts = [undefined, null, '', ' ', 'abc', true, -1, 1.5, Infinity]
        .map(count => searchableItem('unknown', 20000, '物品', 'item', count));
    for (const entry of unknownCounts) {
        assert.equal(entry.offerCount, null, '缺失或异常报价数量不可当作 0');
        assert.equal(hooks.matchesFilters(entry, unrestricted), true, '未启用数量范围时不排除未知数量');
    }
    unrestricted.maxOfferCount = 0;
    assert.equal(hooks.matchesFilters(zeroCount, unrestricted), true, '真实 0 应包含在最大值 0 的范围内');
    for (const entry of unknownCounts) assert.equal(hooks.matchesFilters(entry, unrestricted), false);
    unrestricted.maxOfferCount = null;
    unrestricted.minOfferCount = 20;
    assert.equal(hooks.matchesFilters(candidates[1], unrestricted), true, '仅最小值包含下边界');
    assert.equal(hooks.matchesFilters(candidates[0], unrestricted), false);
    unrestricted.minOfferCount = null;
    unrestricted.maxOfferCount = 10;
    assert.equal(hooks.matchesFilters(candidates[0], unrestricted), true, '仅最大值包含上边界');
    assert.equal(hooks.matchesFilters(candidates[1], unrestricted), false);

    for (const [min, max] of [['-1', ''], ['1.5', ''], ['1e2', ''], ['abc', ''], ['9007199254740992', ''], ['21', '20']]) {
        assert.equal(hooks.parseOfferCountRange(min, max).valid, false, '无效范围应拒绝应用');
    }
    const blankRange = hooks.parseOfferCountRange(' ', '');
    assert.equal(blankRange.valid, true);
    assert.equal(blankRange.min, null);
    assert.equal(blankRange.max, null);
    const bounded = hooks.parseOfferCountRange('0', ' 20 ');
    assert.equal(bounded.valid, true);
    assert.equal(bounded.min, 0);
    assert.equal(bounded.max, 20);
    assert.equal(hooks.updateOfferCountRange(states.pve, '10', '20'), true);
    assert.equal(hooks.updateOfferCountRange(states.pve, '21', '20'), false);
    assert.equal(states.pve.filterState.minOfferCount, 10, '无效输入应保留最后一次有效范围');
    assert.equal(states.pve.filterState.maxOfferCount, 20);
    assert.equal(states.pve.offerRangeDraft.min, '21');
    assert.notEqual(states.pve.offerRangeDraft.error, '');

    // 旧设置无需迁移即可加载；新增条件与分类按模式共同持久化。
    storage.set('eftarkov-filter-pvp', JSON.stringify({
        showAll: false, selectedTops: ['装备'], selectedSubsByTop: { 装备: ['背包'] }
    }));
    const legacy = hooks.loadFilterState('pvp');
    assert.equal(legacy.selectedTops.has('装备'), true);
    assert.equal(legacy.selectedSubsByTop.get('装备').has('背包'), true);
    assert.equal(legacy.searchQuery, '');
    assert.equal(legacy.minOfferCount, null);
    assert.equal(legacy.maxOfferCount, null);
    states.pve.filterState.searchQuery = 'Salewa';
    hooks.saveFilterState('pve');
    const restored = hooks.loadFilterState('pve');
    assert.equal(restored.searchQuery, 'Salewa');
    assert.equal(restored.minOfferCount, 10, '无效草稿不能覆盖持久化范围');
    assert.equal(restored.maxOfferCount, 20);
    assert.equal(hooks.loadFilterState('pvp').searchQuery, '', '不同模式的名称和数量设置不得串用');
    storage.set('eftarkov-filter-season', JSON.stringify({ minOfferCount: 30, maxOfferCount: 20 }));
    assert.equal(hooks.loadFilterState('season').minOfferCount, null);
    assert.equal(hooks.loadFilterState('season').maxOfferCount, null);
    hooks.resetFilters(states.pve);
    assert.equal(hooks.hasActiveFilters(states.pve.filterState), false);
    assert.equal(states.pve.offerRangeDraft.min, '');
    assert.equal(states.pve.offerRangeDraft.error, '');

    // 新版使用页面模式和原站卡片字段，不启动旧 API，也不改写原站旧模式设置。
    for (const href of ['https://www.eftarkov.com/ranking', 'https://www.eftarkov.com/ranking/?mode=pve&category=keys']) {
        const rankingStorage = new Map();
        const rankingFetch = () => { throw new Error('新版不应请求旧接口'); };
        const rankingWindow = { fetch: rankingFetch };
        vm.runInNewContext(source, {
            window: rankingWindow, document: { readyState: 'loading', addEventListener() {} },
            location: { href }, URL,
            localStorage: {
                getItem: key => rankingStorage.get(key) ?? null,
                setItem: (key, value) => rankingStorage.set(key, value)
            }
        });
        assert.equal(rankingWindow.fetch, rankingFetch);
        assert.equal(rankingStorage.size, 0, '新版入口不得触发旧版 currentMode 初始化');
    }
    assert.equal(hooks.resolveRankingMode('https://www.eftarkov.com/ranking?mode=pve', '/ranking?mode=pvp'), 'pve');
    assert.equal(hooks.resolveRankingMode('https://www.eftarkov.com/ranking', '/ranking?mode=season'), 'season');
    assert.equal(hooks.resolveRankingMode('https://www.eftarkov.com/ranking?mode=invalid', '/ranking?mode=pvp'), 'pvp');
    assert.equal(hooks.resolveRankingMode('https://www.eftarkov.com/ranking'), 'pvp');
    for (const text of [undefined, '', '报价数量：未知', '报价数量：-1', '报价数量：1.5', '报价数量：1e2',
        '报价数量：12,34', '报价数量：9007199254740992', '24小时最高：1', '报价数量：']) {
        assert.equal(hooks.parseRankingOfferCount(text), null);
    }
    assert.equal(hooks.parseRankingOfferCount(' 报价数量：0 '), 0);
    assert.equal(hooks.parseRankingOfferCount('报价数量：1,234'), 1234);
    assert.equal(hooks.parseRankingOfferCount('报价数量: 20'), 20);
    const rankingElement = {
        querySelector(selector) {
            return {
                '.ranking-tooltip-source > b': { textContent: 'TerraGroup 仓库钥匙卡' },
                '.ranking-item-name': { textContent: ' 化工厂 ' }
            }[selector];
        },
        querySelectorAll() { return [{ textContent: '当前最低价：4,500,000 ₽' }, { textContent: '报价数量：10' }]; }
    };
    const rankingItem = hooks.readRankingItem(rankingElement);
    const rankingFilters = { searchQuery: '  TERRAGROUP  ', minOfferCount: 10, maxOfferCount: 10 };
    assert.equal(hooks.matchesNameAndOfferFilters(rankingItem, rankingFilters), true);
    rankingFilters.searchQuery = '化工';
    assert.equal(hooks.matchesNameAndOfferFilters(rankingItem, rankingFilters), true, '新版应同时支持完整名称与简称');
    rankingFilters.maxOfferCount = 9;
    assert.equal(hooks.matchesNameAndOfferFilters(rankingItem, rankingFilters), false);

    const legacyPveSettings = storage.get('eftarkov-filter-pve');
    const inherited = hooks.loadRankingFilterState('pve');
    assert.equal(inherited.searchQuery, 'Salewa');
    assert.equal(inherited.minOfferCount, 10);
    assert.equal(Object.hasOwn(inherited, 'selectedTops'), false, '新版不继承旧版分类限制');
    const newRankingState = { mode: 'pve', filterState: { searchQuery: '钥匙', minOfferCount: 0, maxOfferCount: 5 } };
    hooks.saveRankingFilterState(newRankingState);
    assert.equal(storage.get('eftarkov-filter-pve'), legacyPveSettings, '新版保存不得覆盖旧版筛选');
    assert.equal(hooks.loadRankingFilterState('pve').searchQuery, '钥匙');
    assert.equal(hooks.loadRankingFilterState('pvp').searchQuery, '');
    hooks.updateOfferCountRange(newRankingState, '6', '5');
    hooks.saveRankingFilterState(newRankingState);
    assert.equal(hooks.loadRankingFilterState('pve').minOfferCount, 0, '新版非法草稿不得覆盖有效设置');
    storage.set('eftarkov-ranking-filter-season', JSON.stringify({ minOfferCount: 30, maxOfferCount: 20 }));
    assert.equal(hooks.loadRankingFilterState('season').minOfferCount, null);

    console.log('EFTarkov 新旧版模式、响应隔离、价格边界、HTML 安全、名称/数量筛选和设置兼容检查通过');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
