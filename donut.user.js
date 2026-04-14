// ==UserScript==
// @name         VK Donut — Спонсорские кнопки (Superhive & Gumroad)
// @namespace    https://blendars.ru
// @version      13
// @description  VKID SDK + Яндекс Диск + Gumroad header
// @match        https://superhivemarket.com/*
// @match        https://*.superhivemarket.com/*
// @match        https://gumroad.com/*
// @match        https://*.gumroad.com/*
// @match        https://blendars.ru/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @connect      blendars.ru
// @connect      id.vk.ru
// @connect      api.vk.com
// @connect      cloud-api.yandex.net
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // КОНФИГ
    const CONFIG = {
        VK_APP_ID           : '54454085',
        SERVER_CHECK_URL    : 'https://blendars.ru/api/check-don',
        VK_CALLBACK_URL     : 'https://blendars.ru/api/vk-callback.html',
        VK_DONUT_URL        : 'https://vk.com/donut/H360ru',
        YANDEX_DOWNLOAD_URL : 'https://blendars.ru/api/yandex-download',
        YANDEX_FOLDER_URL   : 'https://blendars.ru/api/yandex-folder',
        CACHE_STATUS_MS     : 72 * 60 * 60 * 1000,  // 24 часа
        YANDEX_CACHE_MS     : 10 * 60 * 1000,
        YANDEX_LIST_CACHE_MS: 10 * 60 * 1000,  // Кэш списка файлов — 10 мин
    };

    // Настройки якорей для каждого сайта
    const SITE_CONFIG = {
        superhive : {
            selector  : '.price-box',
            insert    : 'append',
        },
        gumroad   : {
            selector  : 'header h1',
            insert    : 'after',
        },
        blendars  : {
            selector  : '.price-box',
            insert    : 'append',
        },
    };

    // PKCE генератор (RFC-7636)
    async function generatePKCE() {
        const code_verifier = Array.from(crypto.getRandomValues(new Uint8Array(32)))
            .map(b => b.toString(16).padStart(2, '0')).join('');

        const encoder = new TextEncoder();
        const data = encoder.encode(code_verifier);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const code_challenge = btoa(String.fromCharCode(...hashArray))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

        return { code_verifier, code_challenge };
    }

    // СТИЛИ
    GM_addStyle(`
        .vkd-wrapper {
            margin: 8px 8px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            animation: vkdFadeIn 0.3s ease;
        }
        @keyframes vkdFadeIn {
            from { opacity:0; transform:translateY(6px); }
            to   { opacity:1; transform:translateY(0); }
        }
        .vkd-divider {
            display:flex; align-items:center; gap:8px;
            margin-bottom:12px; color:#aaa; font-size:11px;
            font-weight:600; text-transform:uppercase; letter-spacing:0.5px;
        }
        .vkd-divider::before,.vkd-divider::after {
            content:''; flex:1; height:1px; background:#e0e0e0;
        }
        .vkd-btn {
            gap:5px;width:50%; box-sizing:border-box;
        }
        .vkd-btn:hover  { opacity:.90; box-shadow:0 4px 14px rgba(0,0,0,.15); }
        .vkd-btn:active { opacity:1; box-shadow:none; }

        .vkd-btn-gold {
            background: linear-gradient(to right, #b85e00, #f5a623) !important;
            color: #fff !important;
        }
        .vkd-btn-donut {
            background: linear-gradient(to right, #b85e00, #f5a623);
            color: #fff !important;
        }
        .vkd-btn-outline {
            background: transparent;
            color: #3a7ef6 !important;
            border: 2px solid #3a7ef6;
            width:100%;
        }
        .vkd-btn-outline:hover { background: #f0f5ff; }
        .vkd-btn-disabled {
            background: #e0e0e0 !important; color:#999 !important;
            cursor:not-allowed !important; pointer-events:none; opacity:.6;
        }
        .not-active:hover {
            transform: none !important;
            box-shadow: none !important;
        }
        .vkd-not-don {
            background: linear-gradient(135deg,#fff8f0,#fff3e3);
            border:2px solid #f5c87a; border-radius:.5rem;
            padding:12px 14px; font-size:13px; color:#7a4f00;
            text-align:center;
            margin-bottom:10px;

        }
        .vkd-not-don a { color:#c47200; font-weight:700; text-decoration:underline; }
        .vkd-spinner {
            display:inline-block; width:14px; height:14px;
            border:2px solid rgba(255,255,255,0.4);
            border-top-color:#fff; border-radius:50%;
            animation:vkdSpin 0.6s linear infinite; vertical-align:middle;
        }
        @keyframes vkdSpin { to { transform:rotate(360deg); } }

        /* Gumroad header: wrapper fills header width */
        header .vkd-wrapper {
            width: 100%;
        }
        header .vkd-divider {
            margin-top: 4px;
        }

        /* Gumroad header: wrapper fills header width */
        .vkd-btn-row {
            display: flex !important;
            gap: 8px !important;
            align-items: center !important;
            font-weight:bold;
            justify-content: center;
        }
        .vkd-btn-row .vkd-btn:not(.gumroad-btn) {
            flex: 1 1 0 !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 4px !important;
            font-size: 0.8rem !important;
            font-weight: 600 !important;
            transition: all 0.15s ease !important;
            box-shadow: 0 3px 0 rgba(0, 0, 0, 0.15) !important;
            transform: translateY(0) !important;
            cursor: pointer !important;
            line-height: 1.2 !important;
        }
        .vkd-btn-row .vkd-btn .vkd-btn-icon {
            font-size: 2em !important;
            line-height: 1 !important;
        }

        /* Hover — приподнять кнопку (только не-Gumroad) */
        .vkd-btn-row .vkd-btn:not(.gumroad-btn):hover {
            transform: translateY(-3px) !important;
            box-shadow: 0 6px 12px rgba(0, 0, 0, 0.2) !important;
        }

        /* Active — эффект нажатия (только не-Gumroad) */
        .vkd-btn-row .vkd-btn:not(.gumroad-btn):active {
            transform: translateY(1px) !important;
            box-shadow: 0 1px 0 rgba(0, 0, 0, 0.1) !important;
        }

        /* Disabled — отключаем hover (только не-Gumroad) */
        .vkd-btn-row .vkd-btn:not(.gumroad-btn).not-active:hover,
        .vkd-btn-row .vkd-btn:not(.gumroad-btn).vkd-btn-disabled:hover {
            transform: none !important;
            box-shadow: 0 3px 0 rgba(0, 0, 0, 0.1) !important;
            cursor: not-allowed !important;
        }

        /* Кнопка папки */
        .vkd-btn-folder {
            flex: 0 0 auto !important;
            min-width: auto !important;
            max-width: 120px !important;
        }

        .vkd-btn-row{
            display: flex !important;
            grid-template-columns: 1fr !important;
            gap: 12px !important;
            align-items: stretch !important;
            margin-bottom: .5rem;
            text-transform: uppercase;
            text-shadow: 1px 1px #00000082;
        }
        @media (min-width: 768px) {
            .vkd-btn-row{
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)) !important;
            }
        }
        .vkd-btn-row .vkd-btn-folder {
            justify-self: start !important;
        }

        /* Gumroad button base styles */
        .gumroad-btn {
            cursor: pointer !important;
            text-align: center !important;
            font: inherit !important;
            font-size: 0.875rem !important;
            line-height: 1.375 !important;
            border: none !important;
            text-decoration: none !important;
            display: flex !important;
            flex-direction: row !important;
            border-radius: 0.5rem !important;
            padding: 1rem !important;
            transition: all 0.15s ease !important;
            align-items: center !important;
            justify-content: center !important;
            box-shadow: 0.25rem 0.25rem 0 currentColor !important;
            transform: translate(0, 0) !important;
        }
        .gumroad-btn .vkd-btn-icon {
            font-size: 1.3em !important;
            line-height: 1 !important;
            flex-shrink: 0 !important;
            margin-right: .25rem;
        }

        /* Hover — поднимаем кнопку и усиливаем тень */
        .gumroad-btn:hover {
            transform: translate(-0.25rem, -0.25rem) !important;
            box-shadow: 0.5rem 0.5rem 0 currentColor !important;
        }

        /* Active — возвращаем на место */
        .gumroad-btn:active {
            transform: translate(0, 0) !important;
            box-shadow: 0.125rem 0.125rem 0 currentColor !important;
        }

        /* Disabled — отключаем hover */
        .gumroad-btn.not-active:hover,
        .gumroad-btn.vkd-btn-disabled:hover {
            transform: none !important;
            box-shadow: 0.25rem 0.25rem 0 currentColor !important;
            cursor: not-allowed !important;
        }

        /* Специальные кнопки на Gumroad — сохраняем градиенты + добавляем тень */
        .gumroad-btn.vkd-btn-gold,
        .vkd-btn-row .vkd-btn-gold {
            background: linear-gradient(to right, #b85e00, #f5a623) !important;
            color: #fff !important;
        }
        .gumroad-btn.vkd-btn-gold:hover,
        .vkd-btn-row .vkd-btn-gold:hover {
            box-shadow: 0 6px 16px rgba(245, 166, 35, 0.4) !important;
        }

        .gumroad-btn.vkd-btn-chat,
        .vkd-btn-row .vkd-btn-chat {
            background: linear-gradient(to right, #0077FF, #00AAFF) !important;
            color: #fff !important;
        }
        .gumroad-btn.vkd-btn-chat:hover,
        .vkd-btn-row .vkd-btn-chat:hover {
            box-shadow: 0 6px 16px rgba(0, 119, 255, 0.35) !important;
        }

        .gumroad-btn.vkd-btn-folder,
        .vkd-btn-row .vkd-btn-folder {
            background: linear-gradient(to right, #4CAF50, #66BB6A) !important;
            color: #fff !important;
        }
        .gumroad-btn.vkd-btn-folder:hover,
        .vkd-btn-row .vkd-btn-folder:hover {
            box-shadow: 0 6px 16px rgba(76, 175, 80, 0.35) !important;
        }

        .gumroad-btn.vkd-btn-donut,
        .vkd-btn-row .vkd-btn-donut {
            background: linear-gradient(to right, #b85e00, #f5a623) !important;
            color: #fff !important;
        }
        .gumroad-btn.vkd-btn-donut:hover,
        .vkd-btn-row .vkd-btn-donut:hover {
            box-shadow: 0 6px 16px rgba(245, 166, 35, 0.4) !important;
        }

        .gumroad-btn.vkd-btn-outline,
        .vkd-btn-row .vkd-btn-outline {
            background: transparent !important;
            color: #3a7ef6 !important;
            border: 2px solid #3a7ef6 !important;
            box-shadow: 0 3px 0 rgba(58, 126, 246, 0.2) !important;
        }
        .gumroad-btn.vkd-btn-outline:hover,
        .vkd-btn-row .vkd-btn-outline:hover {
            background: #f0f5ff !important;
            box-shadow: 0 6px 16px rgba(58, 126, 246, 0.25) !important;
        }

        /* Disabled кнопки */
        .gumroad-btn.vkd-btn-disabled,
        .vkd-btn-row .vkd-btn-disabled {
            background: #e0e0e0 !important;
            color: #999 !important;
            box-shadow: 0 3px 0 rgba(0, 0, 0, 0.1) !important;
        }
        .gumroad-btn.vkd-btn-disabled:hover,
        .vkd-btn-row .vkd-btn-disabled:hover,
        .gumroad-btn.not-active:hover,
        .vkd-btn-row .not-active:hover {
            transform: none !important;
            cursor: not-allowed !important;
        }
    `);

    // Определение сайта
    function detectSite() {
        const host = window.location.hostname;
        if (host.includes('superhivemarket.com')) return 'superhive';
        if (host.includes('gumroad.com'))         return 'gumroad';
        if (host.includes('blendars.ru'))         return 'blendars';
        return null;
    }

    // Slug из URL
    function getSlugFromUrl(site) {
        const path = window.location.pathname;
        if (site === 'superhive') {
            return path.match(/\/products\/([^/?#]+)/)?.[1]?.toLowerCase() ?? null;
        }
        if (site === 'gumroad') {
            // /l/speedretopo  или  pitiwazou-1.gumroad.com/l/speedretopo
            return path.match(/\/l\/([^/?#]+)/)?.[1]?.toLowerCase() ?? null;
        }
        if (site === 'blendars') {
            const parts = path.split('/').filter(Boolean);
            return parts[parts.length - 1]?.toLowerCase() ?? 'test';
        }
        return null;
    }

    // Ожидание якорного элемента (SPA)
    function waitForAnchor(site, timeout = 15000) {
        return new Promise((resolve) => {
            const cfg = SITE_CONFIG[site];
            // Поддерживаем как selector (строка), так и selectors (массив)
            const selectors = cfg.selectors || [cfg.selector];

            const tryFind = () => {
                for (const sel of selectors) {
                    const el = document.querySelector(sel);
                    if (el) return el;
                }
                return null;
            };

            const el = tryFind();
            if (el) return resolve(el);

            const obs = new MutationObserver(() => {
                const found = tryFind();
                if (found) { obs.disconnect(); resolve(found); }
            });
            obs.observe(document.body, { childList: true, subtree: true });
            setTimeout(() => { obs.disconnect(); resolve(null); }, timeout);
        });
    }

    // Вставка блока в DOM
    function insertWrapper(anchor, wrapper, insertMode) {
        switch (insertMode) {
            case 'append':
                anchor.appendChild(wrapper);
                break;
            case 'prepend':
                anchor.prepend(wrapper);
                break;
            case 'after':
                anchor.insertAdjacentElement('afterend', wrapper);
                break;
            case 'before':
                anchor.insertAdjacentElement('beforebegin', wrapper);
                break;
            default:
                anchor.appendChild(wrapper);
        }
    }

    // Ссылка на папку Яндекс Диска (с сервера)
    function fetchYandexFolderUrl() {
        GM_xmlhttpRequest({
            method: 'GET',
            url: CONFIG.YANDEX_FOLDER_URL,
            onload: (res) => {
                try {
                    const data = JSON.parse(res.responseText);
                    if (data.url) {
                        GM_setValue('yandex_folder_url', data.url);
                    }
                } catch(e) {}
            },
        });
    }

    // Яндекс Диск — список файлов и скачивание

    /**
     * Получает список всех файлов с Яндекс Диска (с кэшем).
     * Возвращает массив: [{ name, slug, path, size, updated }]
     */
    function getYandexFileList() {
        return new Promise((resolve) => {
            const cacheKey  = 'yandex_file_list';
            const timeKey   = 'yandex_file_list_time';
            const cached    = GM_getValue(cacheKey, null);
            const cachedAt  = GM_getValue(timeKey, 0);

            // Есть свежий кэш
            if (cached && Date.now() - cachedAt < CONFIG.YANDEX_LIST_CACHE_MS) {
                console.log(`[VKDonut] ☁️ Кэш списка: ${cached.length} файлов`);
                return resolve(cached);
            }

            console.log('[VKDonut] ☁️ Запрашиваю список файлов с сервера...');

            GM_xmlhttpRequest({
                method : 'GET',
                url    : `${CONFIG.YANDEX_DOWNLOAD_URL.replace('yandex-download', 'yandex-list')}`,
                onload : (res) => {
                    console.log(`[VKDonut] 📨 Ответ сервера: ${res.status}, длина: ${res.responseText.length}`);
                    try {
                        const data = JSON.parse(res.responseText);
                        const files = data.files || [];
                        console.log(`[VKDonut] 📊 Файлов получено: ${files.length}`);
                        if (files.length > 0) {
                            console.log(`[VKDonut] 📁 Первый файл: ${files[0].name}`);
                            console.log(`[VKDonut] 📁 Последний файл: ${files[files.length - 1].name}`);
                        }
                        GM_setValue(cacheKey, files);
                        GM_setValue(timeKey, Date.now());
                        console.log(`[VKDonut] ✅ Кэш списка обновлён: ${files.length} файлов`);
                        resolve(files);
                    } catch(e) {
                        console.error('[VKDonut] Ошибка парсинга списка:', e);
                        console.error('[VKDonut] Raw ответ:', res.responseText.substring(0, 200));
                        resolve([]);
                    }
                },
                onerror : () => {
                    console.error('[VKDonut] ❌ Ошибка запроса списка файлов');
                    resolve([]);
                },
            });
        });
    }

    /**
     * Ищет файл по slug и получает ссылку на скачивание.
     * Сначала ищет в кэше списка файлов, затем запрашивает ссылку.
     */
    function getYandexDownloadUrl(slug) {
        return new Promise((resolve) => {
            console.log(`[VKDonut] 🔗 getYandexDownloadUrl вызвана для slug: "${slug}"`);

            if (!slug) {
                console.warn('[VKDonut] ⚠️ Slug пустой!');
                return resolve(null);
            }

            // Кэш готовой ссылки (для уже найденных файлов)
            const cacheKey  = `yadisk_url_${slug}`;
            const timeKey   = `yadisk_time_${slug}`;
            const cachedUrl = GM_getValue(cacheKey, null);
            const cachedAt  = GM_getValue(timeKey, 0);

            if (cachedUrl && Date.now() - cachedAt < CONFIG.YANDEX_CACHE_MS) {
                console.log(`[VKDonut] ☁️ Кэш ссылки: "${slug}"`);
                return resolve(cachedUrl);
            }

            // Сначала ищем в кэше списка файлов
            const cachedList = GM_getValue('yandex_file_list', null);
            const listTime   = GM_getValue('yandex_file_list_time', 0);
            const listFresh  = cachedList && Date.now() - listTime < CONFIG.YANDEX_LIST_CACHE_MS;

            console.log(`[VKDonut] 📦 Кэш списка: ${cachedList ? cachedList.length + ' файлов' : 'НЕТ'}, свежий: ${listFresh}`);

            if (listFresh && cachedList && cachedList.length > 0) {
                const normalized = normalizeSlug(slug);
                console.log(`[VKDonut] 🔎 Нормализованный slug: "${normalized}"`);
                const found = findFileBySlug(cachedList, normalized);

                if (found) {
                    console.log(`[VKDonut] ☁️ Найдено в кэше списка: "${found.name}"`);
                    return fetchDownloadUrl(found.path, slug, resolve);
                } else {
                    console.warn(`[VKDonut] ⚠️ Файл "${slug}" не найден в кэше (${cachedList.length} файлов)`);
                    return resolve(null);
                }
            }

            // Кэш списка устарел или пуст — сначала обновим его
            console.log('[VKDonut] 🔄 Кэш списка устарел, запрашиваем новый...');
            getYandexFileList().then(files => {
                if (!files || files.length === 0) {
                    console.warn('[VKDonut] ⚠️ Список файлов пуст');
                    return resolve(null);
                }

                console.log(`[VKDonut] ✅ Получено ${files.length} файлов`);
                const normalized = normalizeSlug(slug);
                console.log(`[VKDonut] 🔎 Нормализованный slug: "${normalized}"`);
                const found = findFileBySlug(files, normalized);

                if (found) {
                    console.log(`[VKDonut] ☁️ Найдено: "${found.name}"`);
                    console.log(`[VKDonut] 📍 Path: "${found.path}"`);
                    fetchDownloadUrl(found.path, slug, resolve);
                } else {
                    console.warn(`[VKDonut] ⚠️ Не найден: "${slug}" (${files.length} файлов в списке)`);
                    resolve(null);
                }
            });
        });
    }

    /**
     * Ищет файл в списке. Порядок приоритета:
     * 1. Точное совпадение slug
     * 2. Файл начинается с slug (easyref → easyref-v-2-0-0)
     * 3. Slug содержится в имени файла
     */
    function findFileBySlug(files, slug) {
        console.log(`[VKDonut] 🔎 findFileBySlug: ищем "${slug}" в ${files.length} файлах`);

        let bestMatch = null;
        let bestScore = 0;

        for (const f of files) {
            let score = 0;

            if (f.slug === slug) {
                score = 100;
                console.log(`[VKDonut]    ✅ ТОЧНОЕ совпадение: "${f.slug}"`);
            } else if (f.slug.startsWith(slug + '-') || f.slug.startsWith(slug + '_')) {
                score = 90;
                console.log(`[VKDonut]    🟡 Начало с slug: "${f.slug}" (score: ${score})`);
            } else if (f.slug.startsWith(slug)) {
                score = 80;
                console.log(`[VKDonut]    🟠 Начинается с slug: "${f.slug}" (score: ${score})`);
            } else if (f.slug.includes(slug)) {
                score = 60;
                console.log(`[VKDonut]    🔵 Содержит slug: "${f.slug}" (score: ${score})`);
            }

            if (score > bestScore) {
                bestScore = score;
                bestMatch = f;
            }
        }

        if (bestMatch) {
            console.log(`[VKDonut] 🏆 Лучший результат: "${bestMatch.name}" (score: ${bestScore})`);
        } else {
            console.log(`[VKDonut] ❌ Ничего не найдено`);
        }

        return bestScore > 0 ? bestMatch : null;
    }

    /**
     * Запрашивает ссылку на скачивание для конкретного файла.
     * Также сохраняет путь к папке файла.
     */
    function fetchDownloadUrl(filePath, slug, resolve) {
        // Сохраняем путь к папке (без имени файла)
        const parts = filePath.split('/');
        parts.pop(); // убираем имя файла
        const folderPath = '/' + parts.filter(Boolean).join('/');

        if (folderPath) {
            GM_setValue(`yadisk_folder_${slug}`, folderPath);
        }

        GM_xmlhttpRequest({
            method : 'GET',
            url    : `${CONFIG.YANDEX_DOWNLOAD_URL}?path=${encodeURIComponent(filePath)}`,
            onload : (res) => {
                try {
                    const data = JSON.parse(res.responseText);
                    const url  = data.url ?? null;
                    if (url) {
                        const cacheKey = `yadisk_url_${slug}`;
                        const timeKey  = `yadisk_time_${slug}`;
                        GM_setValue(cacheKey, url);
                        GM_setValue(timeKey, Date.now());
                        console.log(`[VKDonut] ✅ Ссылка получена: "${slug}"`);
                    } else {
                        console.warn(`[VKDonut] ⚠️ Нет ссылки для: "${slug}"`);
                    }
                    resolve(url);
                } catch(e) {
                    console.error('[VKDonut] Ошибка парсинга:', e);
                    resolve(null);
                }
            },
            onerror : () => {
                console.error('[VKDonut] ❌ Ошибка запроса ссылки');
                resolve(null);
            },
        });
    }

    /**
     * Нормализует slug для сравнения (нижний регистр, дефисы вместо подчёркиваний).
     */
    function normalizeSlug(str) {
        return str.toLowerCase()
            .replace(/[\s_\.]+/g, '-')
            .replace(/[^a-z0-9\-]/g, '')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }

    // Рендер блока
    function renderBlock(anchor, site, isDon, downloadUrl, slug) {

        // Убираем старый блок
        document.querySelector('.vkd-wrapper')?.remove();

        const wrapper     = document.createElement('div');
        wrapper.className = 'vkd-wrapper';

        // Определяем классы в зависимости от сайта
        const isGumroad = site === 'gumroad';
        const btnBaseClass = isGumroad
            ? 'gumroad-btn'
            : 'btn btn-lg vkd-btn';
        const containerClass = isGumroad
            ? 'vkd-btn-row'
            : 'vkd-btn-row';

        // ── Разделитель ──────────────────────────────────────
        const divider       = document.createElement('div');
        divider.className   = 'vkd-divider';
        divider.textContent = 'VK Donut';
        wrapper.appendChild(divider);

        if (isDon) {
            // ── Вид спонсора ─────────────────────────────────
            const row = document.createElement('div');
            row.className = containerClass;

            // Кнопка Открыть папку (всегда показываем)
            const folderPath = GM_getValue(`yadisk_folder_${slug}`, null);
            const folderBtnUrl = GM_getValue('yandex_folder_url', null);

            if (folderBtnUrl) {
                const linkUrl = folderPath
                    ? `https://disk.yandex.ru/client/disk${folderPath}`
                    : folderBtnUrl;

                const folderBtn = document.createElement('a');
                folderBtn.href = linkUrl;
                folderBtn.target = '_blank';
                folderBtn.rel = 'noopener noreferrer';
                folderBtn.className = `${btnBaseClass} vkd-btn-folder`;
                folderBtn.innerHTML = '<span class="vkd-btn-icon">📂</span><span>ФАЙЛЫ</span>';
                folderBtn.title = folderPath ? 'Открыть папку файла' : 'Открыть папку BLEND ARS';
                row.appendChild(folderBtn);
            }

            // Кнопка Скачать
            const dlBtn = document.createElement('a');
            dlBtn.className = `${btnBaseClass} vkd-btn-gold`;

            if (downloadUrl === 'loading') {
                dlBtn.className += ' vkd-btn-disabled not-active';
                dlBtn.innerHTML = '<span class="vkd-btn-icon">⏳</span><span>Сканируем облако...</span>';
            } else if (downloadUrl) {
                dlBtn.href        = downloadUrl;
                dlBtn.target      = '_blank';
                dlBtn.rel         = 'noopener noreferrer';
                dlBtn.innerHTML = '<span class="vkd-btn-icon">⬇️</span><span>СКАЧАТЬ</span>';
            } else {
                dlBtn.className  += ' vkd-btn-disabled not-active';
                dlBtn.innerHTML = '<span class="vkd-btn-icon">🥲</span><span>Не найден</span>';
            }
            row.appendChild(dlBtn);

            // Кнопка Чат
            const chatUrl = 'https://vk.me/join/5qTBf/9QOVzb56xnH0e87EM08Kll2qAG_JY=';
            const chatBtn = document.createElement('a');
            chatBtn.href = chatUrl;
            chatBtn.target = '_blank';
            chatBtn.rel = 'noopener noreferrer';
            chatBtn.className = `${btnBaseClass} vkd-btn-chat`;
            chatBtn.innerHTML = '<span class="vkd-btn-icon">💬</span><span>ЧАТ</span>';
            row.appendChild(chatBtn);

            wrapper.appendChild(row);

        } else {
            // ── Вид гостя ────────────────────────────────────
            const notDon     = document.createElement('div');
            notDon.className = 'vkd-not-don';
            notDon.innerHTML = `
                🍩 Этот контент доступен для спонсоров.<br>
                <small style="opacity:.75">Уже поддерживаете нас? Войдите ниже 👇</small>
            `;
            wrapper.appendChild(notDon);

            // Ряд: Стать спонсором + Чат
            const guestRow = document.createElement('div');
            guestRow.className = containerClass;

            const becomeBtn = document.createElement('a');
            becomeBtn.href = CONFIG.VK_DONUT_URL;
            becomeBtn.target = '_blank';
            becomeBtn.rel = 'noopener noreferrer';
            becomeBtn.className = `${btnBaseClass} vkd-btn-donut`;
            becomeBtn.innerHTML = '<span class="vkd-btn-icon">🍩</span><span>Стать спонсором</span>';
            guestRow.appendChild(becomeBtn);

            const chatUrl = 'https://vk.me/join/5qTBf/9QOVzb56xnH0e87EM08Kll2qAG_JY=';
            const chatBtn = document.createElement('a');
            chatBtn.href = chatUrl;
            chatBtn.target = '_blank';
            chatBtn.rel = 'noopener noreferrer';
            chatBtn.className = `${btnBaseClass} vkd-btn-chat`;
            chatBtn.innerHTML = '<span class="vkd-btn-icon">💬</span><span>Наш чат</span>';
            guestRow.appendChild(chatBtn);

            wrapper.appendChild(guestRow);

            const loginBtn       = document.createElement('button');
            loginBtn.className   = isGumroad
                ? `${btnBaseClass} vkd-btn-outline`
                : 'vkd-btn vkd-btn-outline btn btn-lg';
            loginBtn.innerHTML = '<span class="vkd-btn-icon">🔑</span><span>Уже спонсор? Войти через VK ID</span>';

            loginBtn.onclick = async () => {
                loginBtn.innerHTML = '<span class="vkd-spinner"></span>&nbsp; Проверяем...';
                loginBtn.disabled  = true;

                const auth = await getVKCode();
                if (!auth) {
                    loginBtn.textContent = '❌  Отмена. Попробуйте ещё раз';
                    loginBtn.disabled    = false;
                    return;
                }
                const realIsDon = await exchangeCodeAndCheck(auth.code, auth.device_id, auth.state);
                renderBlock(anchor, site, realIsDon, null, slug);
            };
            wrapper.appendChild(loginBtn);
        }

        insertWrapper(anchor, wrapper, SITE_CONFIG[site].insert);
    }

    // VKID OAuth 2.1 с PKCE
    async function getVKCode() {
        const { code_verifier, code_challenge } = await generatePKCE();

        // Сохраняем для последующего обмена
        GM_setValue('pkce_code_verifier', code_verifier);

        const state = crypto.randomUUID().replace(/-/g, '').slice(0, 32);
        GM_setValue('auth_state', state);

        const authUrl =
            `https://id.vk.ru/authorize?` +
            `response_type=code` +
            `&client_id=${CONFIG.VK_APP_ID}` +
            `&code_challenge=${code_challenge}` +
            `&code_challenge_method=S256` +
            `&redirect_uri=${encodeURIComponent(CONFIG.VK_CALLBACK_URL)}` +
            `&state=${state}` +
            `&scope=email`;

        const popup = window.open(authUrl, 'vkid_auth', 'width=620,height=560');

        return new Promise((resolve) => {
            const handler = (e) => {
                console.log('[VKDonut] Получено postMessage:', e.origin, e.data);

                if (e.data?.type !== 'VKID_PAYLOAD') return;

                window.removeEventListener('message', handler);
                popup?.close();

                const payload = e.data.payload;
                if (!payload || !payload.code) {
                    console.error('[VKDonut] Пустой payload:', payload);
                    return resolve(null);
                }

                resolve({
                    code: payload.code,
                    device_id: payload.device_id,
                    state: payload.state,
                });
            };

            window.addEventListener('message', handler);
            setTimeout(() => {
                window.removeEventListener('message', handler);
                resolve(null);
            }, 180_000);
        });
    }

    async function exchangeCodeAndCheck(code, device_id, state) {
        return new Promise((resolve) => {
            const code_verifier = GM_getValue('pkce_code_verifier', '');

            console.log('[VKDonut] 🔍 Отправляю на сервер: code=', code.substring(0, 20) + '...', 'device_id=', device_id.substring(0, 10) + '...');

            GM_xmlhttpRequest({
                method  : 'POST',
                url     : CONFIG.SERVER_CHECK_URL,
                headers : { 'Content-Type': 'application/json' },
                data    : JSON.stringify({
                    mode: 'code',
                    code,
                    device_id,
                    state,
                    code_verifier,
                }),
                onload  : (res) => {
                    console.log('[VKDonut] 📨 Ответ сервера:', res.status, res.responseText);
                    try {
                        const data = JSON.parse(res.responseText);
                        console.log('[VKDonut] ✅ isDon:', data.isDon);
                        GM_setValue('donut_status', data.isDon === true);
                        GM_setValue('donut_status_time', Date.now());
                        resolve(data.isDon === true);
                    } catch(e) {
                        console.error('[VKDonut] ❌ Ошибка парсинга:', e, 'raw:', res.responseText);
                        resolve(false);
                    }
                },
                onerror : (err) => {
                    console.error('[VKDonut] ❌ Ошибка запроса:', err);
                    resolve(false);
                },
            });
        });
    }

    // Инициализация
    async function init() {
        const site = detectSite();
        if (!site) return;

        const slug = getSlugFromUrl(site);
        console.log(`[VKDonut] 🌐 Сайт: ${site} | Slug: "${slug}"`);

        const anchor = await waitForAnchor(site);
        if (!anchor) {
            const cfg = SITE_CONFIG[site];
            const triedSelectors = cfg.selectors || [cfg.selector];
            console.warn(`[VKDonut] ⚠️ Ни один элемент не найден. Пробовали:`, triedSelectors);
            return;
        }
        console.log('[VKDonut] 📌 Якорь найден:', anchor);

        const cached = GM_getValue('donut_status', null);
        const time   = GM_getValue('donut_status_time', 0);
        const isDon  = cached !== null && Date.now() - time < CONFIG.CACHE_STATUS_MS ? cached : false;

        console.log(`[VKDonut] 🔑 Статус доната: isDon=${isDon} (кэш: ${cached !== null ? 'есть' : 'нет'}, возраст: ${Math.round((Date.now() - time) / 1000 / 60 / 60)}ч)`);

        const cacheKey = `yadisk_url_${slug}`;
        const timeKey  = `yadisk_time_${slug}`;
        const cachedUrl = GM_getValue(cacheKey, null);
        const cachedAt  = GM_getValue(timeKey, 0);
        const freshUrl  = cachedUrl && Date.now() - cachedAt < CONFIG.YANDEX_CACHE_MS ? cachedUrl : null;

        renderBlock(anchor, site, isDon, freshUrl || 'loading', slug);

        // Загружаем ссылку на папку Яндекс Диска (если ещё не в кэше)
        if (!GM_getValue('yandex_folder_url', null)) {
            fetchYandexFolderUrl();
        }

        if (!freshUrl && isDon) {
            console.log(`[VKDonut] 🔍 Ищем файл: "${slug}"...`);
            const downloadUrl = await getYandexDownloadUrl(slug);
            if (downloadUrl) {
                console.log(`[VKDonut] ✅ Ссылка найдена, обновляем кнопку...`);
            } else {
                console.warn(`[VKDonut] ⚠️ Ссылка не найдена для: "${slug}"`);
            }
            renderBlock(anchor, site, isDon, downloadUrl, slug);
        }
    }

    // SPA: следим за сменой URL
    let lastUrl = location.href;
    let urlChangeTimer = null;

    function onUrlChange() {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            console.log('[VKDonut] 🔄 URL изменился, перезапускаем...');
            document.querySelector('.vkd-wrapper')?.remove();

            // Очищаем предыдущий таймер
            if (urlChangeTimer) clearTimeout(urlChangeTimer);

            // Ждём пока SPA обновит DOM
            urlChangeTimer = setTimeout(() => {
                init();
            }, 1500);
        }
    }

    // Перехват pushState/replaceState
    const _pushState = history.pushState;
    const _replaceState = history.replaceState;
    history.pushState = function() { _pushState.apply(this, arguments); onUrlChange(); };
    history.replaceState = function() { _replaceState.apply(this, arguments); onUrlChange(); };

    // Popstate (кнопки назад/вперёд)
    window.addEventListener('popstate', onUrlChange);

    // Перехват кликов по ссылкам
    document.addEventListener('click', () => {
        setTimeout(onUrlChange, 300);
    }, true);

    init();

})();
