// ==UserScript==
// @name         superhivemarket.com Downloader
// @namespace    http://tampermonkey.net/
// @version      3.5
// @description  Добавляет кнопки загрузки из Google Sheets
// @author       Axelaredz
// @homepageURL  https://github.com/axelaredz/tampermonkey
// @updateURL    https://github.com/Axelaredz/tampermonkey/raw/refs/heads/main/sd.user.js
// @downloadURL  https://github.com/Axelaredz/tampermonkey/raw/refs/heads/main/sd.user.js
// @supportURL   https://github.com/axelaredz/tampermonkey/issues
// @match        https://superhivemarket.com/products/*
// @grant        GM_xmlhttpRequest
// @connect      docs.google.com
// ==/UserScript==

(function () {
    'use strict';

    // Защита от повторного запуска
    if (window.superhiveDownloaderLoaded) return;
    window.superhiveDownloaderLoaded = true;

    const CONFIG = {
        DATA_TABLE_URL: 'https://docs.google.com/spreadsheets/d/1cTMmx-0l7ZSp09v3EOR_ryYY5NjtQP_Qu5HMzOaSyF8/gviz/tq?tqx=out:csv&sheet=Products',
        CHAT_URL: 'https://t.me/H360ru/8451',
        EDIT_TABLE_URL: 'https://docs.google.com/spreadsheets/d/1cTMmx-0l7ZSp09v3EOR_ryYY5NjtQP_Qu5HMzOaSyF8/edit'
    };

    // === Вспомогательные функции ===

    const injectStyles = () => {
        if (document.getElementById('superhive-downloader-styles')) return;
        const style = document.createElement('style');
        style.id = 'superhive-downloader-styles';
        style.textContent = `
        .download-block {
            margin-bottom: 1rem;
        }
        .download-block-title {
            margin-bottom: 10px;
            font-weight: bold;
            text-align: center;
            font-size: 1.1em;
        }
        .download-btn-group {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
        }
        .btn.download-btn {
            display: inline-block;
            padding: 8px 10px;
            color: white !important;
            text-decoration: none !important;
            text-align: center;
            border-radius: 4px;
            transition: all 0.2s ease;
            font-size: 0.9em;
            min-width: 100px;
            box-sizing: border-box;
            cursor: pointer !important;
            text-shadow: none !important;
            font-size: .9rem !important;
        }
        .btn.download-btn.download {
            background: linear-gradient(0deg, #6800f0, #ff6b00);
        }
        .btn.download-btn.add {
            background: linear-gradient(0deg, rgb(104, 0, 240), #00000080);
        }
    `;
        document.head.appendChild(style);
    };

    const getProductSlug = () => {
        const path = window.location.pathname;
        const segments = path.split('/').filter(Boolean);
        // Ожидаем: /products/some-slug
        if (segments.length === 2 && segments[0] === 'products') {
            return segments[1].toLowerCase();
        }
        // Или: /some-slug (если сайт так делает)
        if (segments.length === 1 && segments[0] !== 'products') {
            return segments[0].toLowerCase();
        }
        return null;
    };

    const parseCSV = (csv) => {
        const lines = csv.trim().split(/\r?\n/);
        const result = {};

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const fields = [];
            let insideQuotes = false;
            let current = '';

            for (let j = 0; j < line.length; j++) {
                const char = line[j];
                if (char === '"') {
                    insideQuotes = !insideQuotes;
                } else if (char === ',' && !insideQuotes) {
                    fields.push(current);
                    current = '';
                } else {
                    current += char;
                }
            }
            fields.push(current);

            if (fields.length >= 3) {
                const slug = fields[0].replace(/^"|"$/g, '').trim().toLowerCase();
                const actual = fields[1].replace(/^"|"$/g, '').trim();
                const leaked = fields[2].replace(/^"|"$/g, '').trim();

                if (slug) {
                    result[slug] = {
                        actual: actual.startsWith('http') ? actual : '',
                        leaked: leaked.startsWith('http') ? leaked : ''
                    };
                }
            }
        }
        return result;
    };

    const loadData = (callback) => {
        GM_xmlhttpRequest({
            method: 'GET',
            url: CONFIG.DATA_TABLE_URL,
            onload: (response) => {
                try {
                    callback(parseCSV(response.responseText));
                } catch (e) {
                    console.error('Ошибка парсинга CSV:', e);
                }
            },
            onerror: () => console.error('Ошибка загрузки данных из Google Sheets')
        });
    };

    const createButton = (text, url, isAddButton = false) => {
        const btn = document.createElement('a');
        btn.className = 'btn download-btn ' + (isAddButton ? 'add' : 'download');
        btn.textContent = text;
        btn.target = '_blank';
        btn.rel = 'noopener noreferrer';

        if (url) {
            btn.href = url;
        } else if (isAddButton) {
            btn.onclick = (e) => {
                e.preventDefault();
                window.open(CONFIG.EDIT_TABLE_URL, '_blank', 'noopener,noreferrer');
            };
        }

        return btn;
    };

    const createDownloadBlock = (data) => {
        const priceBox = document.querySelector('.action-wish');
        if (!priceBox || priceBox.querySelector('.download-block')) return;

        const productSlug = getProductSlug();
        if (!productSlug) return;

        const productData = data[productSlug] || {};
        const hasActual = !!productData.actual;
        const hasLeaked = !!productData.leaked;

        const block = document.createElement('div');
        block.className = 'download-block';

        const title = document.createElement('div');
        title.className = 'download-block-title';
        title.textContent = 'Скачать';
        block.appendChild(title);

        const btnGroup = document.createElement('div');
        btnGroup.className = 'download-btn-group';

        btnGroup.appendChild(createButton('🗨️ Чат', CONFIG.CHAT_URL));

        if (hasActual) {
            btnGroup.appendChild(createButton('⬇ Актуальная', productData.actual));
        } else {
            btnGroup.appendChild(createButton('✚ Добавить', null, true));
        }

        if (hasLeaked) {
            btnGroup.appendChild(createButton('⬇ Слитая', productData.leaked));
        } else {
            btnGroup.appendChild(createButton('✚ Добавить', null, true));
        }

        block.appendChild(btnGroup);
        priceBox.prepend(block);
    };

    // === Запуск ===

    injectStyles();

    loadData((data) => {
        const checkAndCreateBlock = () => {
            const priceBox = document.querySelector('.action-wish');
            if (priceBox && !priceBox.querySelector('.download-block')) {
                createDownloadBlock(data);
            }
        };

        // Запускаем сразу
        checkAndCreateBlock();

        // Наблюдаем за изменениями DOM
        const observer = new MutationObserver(checkAndCreateBlock);
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class']
        });
    });
})();
