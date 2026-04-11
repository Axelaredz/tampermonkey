// ==UserScript==
// @name         VK Donut — Спонсорские кнопки (Superhive & Gumroad)
// @namespace    https://blendars.ru
// @version      8.0
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
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // ═══════════════════════════════════════════════
    //  ⚙️  КОНФИГ
    // ═══════════════════════════════════════════════
    const CONFIG = {
        VK_APP_ID           : '54454085',
        SERVER_CHECK_URL    : 'https://blendars.ru/api/check-don',
        VK_CALLBACK_URL     : 'https://blendars.ru/api/vk-callback.html',
        VK_DONUT_URL        : 'https://vk.com/donut/H360ru',
        YANDEX_DOWNLOAD_URL : 'https://blendars.ru/api/yandex-download',
        CACHE_STATUS_MS     :  5 * 60 * 1000,
        YANDEX_CACHE_MS     : 30 * 60 * 1000,
    };

    // ═══════════════════════════════════════════════
    //  📍  Настройки якорей для каждого сайта
    // ═══════════════════════════════════════════════
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

    // ═══════════════════════════════════════════════
    //  🔐  PKCE генератор (RFC-7636)
    // ═══════════════════════════════════════════════
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

    // ═══════════════════════════════════════════════
    //  🎨  СТИЛИ
    // ═══════════════════════════════════════════════
    GM_addStyle(`
        .vkd-wrapper {
            margin: 16px 8px;
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
            display:inline-flex; align-items:center; justify-content:center;
            gap:8px; padding:11px 20px; border:none; border-radius:10px;
            font-size:14px; font-weight:600; cursor:pointer;
            text-decoration:none !important;
            transition:opacity 0.2s, transform 0.15s, box-shadow 0.2s;
            width:100%; box-sizing:border-box; line-height:1;
        }
        .vkd-btn + .vkd-btn { margin-top:8px; }
        .vkd-btn:hover  { opacity:.90; transform:translateY(-1px); box-shadow:0 4px 14px rgba(0,0,0,.15); }
        .vkd-btn:active { opacity:1; transform:translateY(0); box-shadow:none; }

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
        }
        .vkd-btn-outline:hover { background: #f0f5ff; }
        .vkd-btn-disabled {
            background: #e0e0e0 !important; color:#999 !important;
            cursor:not-allowed !important; pointer-events:none; opacity:.6;
        }
        .vkd-not-don {
            background: linear-gradient(135deg,#fff8f0,#fff3e3);
            border:1px solid #f5c87a; border-radius:10px;
            padding:12px 14px; font-size:13px; color:#7a4f00; line-height:1.5;
            margin-bottom:8px;
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
    `);

    // ═══════════════════════════════════════════════
    //  🌐  Определение сайта
    // ═══════════════════════════════════════════════
    function detectSite() {
        const host = window.location.hostname;
        if (host.includes('superhivemarket.com')) return 'superhive';
        if (host.includes('gumroad.com'))         return 'gumroad';
        if (host.includes('blendars.ru'))         return 'blendars';
        return null;
    }

    // ═══════════════════════════════════════════════
    //  🔗  Slug из URL
    // ═══════════════════════════════════════════════
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

    // ═══════════════════════════════════════════════
    //  ⏳  Ожидание якорного элемента (SPA)
    // ═══════════════════════════════════════════════
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

    // ═══════════════════════════════════════════════
    //  📌  Вставка блока в DOM
    // ═══════════════════════════════════════════════
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

    // ═══════════════════════════════════════════════
    //  ☁️  Яндекс Диск — получение ссылки
    // ═══════════════════════════════════════════════
    function getYandexDownloadUrl(slug) {
        return new Promise((resolve) => {
            if (!slug) return resolve(null);

            // Кэш
            const cacheKey  = `yadisk_url_${slug}`;
            const timeKey   = `yadisk_time_${slug}`;
            const cachedUrl = GM_getValue(cacheKey, null);
            const cachedAt  = GM_getValue(timeKey, 0);

            if (cachedUrl && Date.now() - cachedAt < CONFIG.YANDEX_CACHE_MS) {
                console.log(`[VKDonut] ☁️ Кэш: "${slug}" → ${cachedUrl}`);
                return resolve(cachedUrl);
            }

            console.log(`[VKDonut] ☁️ Ищем на Яндекс Диске: "${slug}"`);

            GM_xmlhttpRequest({
                method : 'GET',
                url    : `${CONFIG.YANDEX_DOWNLOAD_URL}?slug=${encodeURIComponent(slug)}`,
                onload : (res) => {
                    try {
                        const data = JSON.parse(res.responseText);
                        const url  = data.url ?? null;
                        if (url) {
                            GM_setValue(cacheKey, url);
                            GM_setValue(timeKey, Date.now());
                            console.log(`[VKDonut] ✅ Найдено: "${slug}" → ${url}`);
                        } else {
                            console.warn(`[VKDonut] ⚠️ Файл не найден: "${slug}"`);
                            console.warn('[VKDonut] Ответ сервера:', res.responseText);
                        }
                        resolve(url);
                    } catch(e) {
                        console.error('[VKDonut] Ошибка парсинга:', e);
                        resolve(null);
                    }
                },
                onerror : () => {
                    console.error('[VKDonut] ❌ Ошибка запроса к серверу');
                    resolve(null);
                },
            });
        });
    }

    // ═══════════════════════════════════════════════
    //  🏗️  Рендер блока
    // ═══════════════════════════════════════════════
    function renderBlock(anchor, site, isDon, downloadUrl) {

        // Убираем старый блок
        document.querySelector('.vkd-wrapper')?.remove();

        const wrapper     = document.createElement('div');
        wrapper.className = 'vkd-wrapper';

        // ── Разделитель ──────────────────────────────────────
        const divider       = document.createElement('div');
        divider.className   = 'vkd-divider';
        divider.textContent = 'VK Donut';
        wrapper.appendChild(divider);

        if (isDon) {
            // ── Вид спонсора ─────────────────────────────────
            const btn     = document.createElement('a');
            btn.className = 'btn btn-primary vkd-btn vkd-btn-gold';

            if (downloadUrl) {
                btn.href        = downloadUrl;
                btn.target      = '_blank';
                btn.rel         = 'noopener noreferrer';
                btn.textContent = '⬇️  Скачать';
            } else {
                btn.className  += ' vkd-btn-disabled';
                btn.textContent = '⏳  Файл ещё не добавлен';
            }

            wrapper.appendChild(btn);

        } else {
            // ── Вид гостя ────────────────────────────────────
            const notDon     = document.createElement('div');
            notDon.className = 'vkd-not-don';
            notDon.innerHTML = `
                🍩 Этот контент доступен для спонсоров.<br>
                <small style="opacity:.75">Уже поддерживаете нас? Войдите ниже 👇</small>
            `;
            wrapper.appendChild(notDon);

            const becomeBtn           = document.createElement('a');
            becomeBtn.href            = CONFIG.VK_DONUT_URL;
            becomeBtn.target          = '_blank';
            becomeBtn.rel             = 'noopener noreferrer';
            becomeBtn.className       = 'btn btn-primary vkd-btn vkd-btn-donut';
            becomeBtn.style.marginBottom = '6px';
            becomeBtn.textContent     = '🍩  Стать спонсором BLEND ARS';
            wrapper.appendChild(becomeBtn);

            const loginBtn       = document.createElement('button');
            loginBtn.className   = 'vkd-btn vkd-btn-outline';
            loginBtn.textContent = '🔑  Уже спонсор? Войти через VK ID';

            loginBtn.onclick = async () => {
                loginBtn.innerHTML = '<span class="vkd-spinner"></span>&nbsp; Проверяем...';
                loginBtn.disabled  = true;

                if (CONFIG.TEST_MODE) {
                    await new Promise(r => setTimeout(r, 900));
                    GM_setValue('test_is_don', true);
                    renderBlock(anchor, site, true, downloadUrl);
                    return;
                }

                const auth = await getVKCode();
                if (!auth) {
                    loginBtn.textContent = '❌  Отмена. Попробуйте ещё раз';
                    loginBtn.disabled    = false;
                    return;
                }
                const realIsDon = await exchangeCodeAndCheck(auth.code, auth.device_id, auth.state);
                renderBlock(anchor, site, realIsDon, downloadUrl);
            };
            wrapper.appendChild(loginBtn);
        }

        insertWrapper(anchor, wrapper, SITE_CONFIG[site].insert);
    }

    // ═══════════════════════════════════════════════
    //  🔐  VKID OAuth 2.1 с PKCE
    // ═══════════════════════════════════════════════
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

    // ═══════════════════════════════════════════════
    //  🚀  Инициализация
    // ═══════════════════════════════════════════════
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

        const [isDon, downloadUrl] = await Promise.all([
            Promise.resolve(
                CONFIG.TEST_MODE
                    ? GM_getValue('test_is_don', false)
                    : (() => {
                        const cached = GM_getValue('donut_status', null);
                        const time   = GM_getValue('donut_status_time', 0);
                        return cached !== null && Date.now() - time < CONFIG.CACHE_STATUS_MS
                            ? cached : false;
                    })()
            ),
            getYandexDownloadUrl(slug),
        ]);

        renderBlock(anchor, site, isDon, downloadUrl);
    }

    // SPA: следим за сменой URL
    let lastUrl = location.href;
    new MutationObserver(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            console.log('[VKDonut] 🔄 URL изменился, перезапускаем...');
            setTimeout(init, 800);
        }
    }).observe(document, { subtree: true, childList: true });

    init();

})();
