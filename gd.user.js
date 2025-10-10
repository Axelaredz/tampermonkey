// ==UserScript==
// @name         Gumroad Product Downloader
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Добавляет кнопки загрузки на страницы Gumroad
// @author       Axelaredz
// @homepageURL  https://github.com/axelaredz/tampermonkey
// @updateURL    https://github.com/Axelaredz/tampermonkey/raw/refs/heads/main/gd.user.js
// @downloadURL  https://github.com/Axelaredz/tampermonkey/raw/refs/heads/main/gd.user.js
// @supportURL   https://github.com/axelaredz/tampermonkey/issues
// @match        https://*.gumroad.com/l/*
// @grant        GM_xmlhttpRequest
// @connect      docs.google.com
// ==/UserScript==

(function () {
    'use strict';

    // Защита от повторного запуска (например, при SPA-навигации)
    if (window.gumroadDownloaderLoaded) return;
    window.gumroadDownloaderLoaded = true;

    const CONFIG = {
        DATA_TABLE_URL: 'https://docs.google.com/spreadsheets/d/1FOjuyVYvi-YR6dm1QjHNl9p8FAfNeS-CYLXDwIFedSk/gviz/tq?tqx=out:csv&sheet=Products',
        CHAT_URL: 'https://t.me/H360ru/8451',
        EDIT_TABLE_URL: 'https://docs.google.com/spreadsheets/d/1FOjuyVYvi-YR6dm1QjHNl9p8FAfNeS-CYLXDwIFedSk/edit'
    };

    // === Вспомогательные функции ===

    const injectStyles = () => {
        if (document.getElementById('gumroad-downloader-styles')) return;
        const style = document.createElement('style');
        style.id = 'gumroad-downloader-styles';
        style.textContent = `
            .gumroad-download-container {
                margin: 1.5rem 0;
                padding: 1rem;
                border-radius: 8px;
                background: #f9f9f9;
            }
            .gumroad-download-title {
                font-weight: bold;
                text-align: center;
                font-size: 18px;
                margin-bottom: 0.5rem;
                color: #333;
            }
            .gumroad-download-buttons {
                display: flex;
                flex-wrap: wrap;
                justify-content: center;
                gap: 8px;
            }
            /* Используем .button для совместимости с Gumroad */
            .button.gumroad-download-btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 8px 16px !important;
                min-width: 120px;
                color: white !important;
                text-decoration: none !important;
                border: none !important;
                border-radius: 6px !important;
                font-size: 14px !important;
                font-weight: 600 !important;
                cursor: pointer !important;
                transition: opacity 0.2s ease !important;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important;
            }
            .button.gumroad-download-btn:hover {
                opacity: 0.9 !important;
            }
            .button.gumroad-download-btn.download {
                background: linear-gradient(0deg, rgb(54, 169, 174), rgb(54, 169, 174)) !important;
            }
            .button.gumroad-download-btn.add {
                background: linear-gradient(0deg, rgb(54, 169, 174), rgb(233, 238, 251)) !important;
                color: #000 !important;
            }
        `;
        document.head.appendChild(style);
    };

    const getProductSlug = () => {
        const path = window.location.pathname;
        const match = path.match(/^\/l\/([^\/]+)/);
        return match ? match[1].toLowerCase() : null;
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
                    console.error('Ошибка парсинга CSV в Gumroad Downloader:', e);
                }
            },
            onerror: () => console.error('Не удалось загрузить данные из Google Sheets')
        });
    };

    const createButton = (text, url, isAddButton = false) => {
        const btn = document.createElement('a');
        // Используем .button — это нативный класс Gumroad, чтобы стили применялись корректно
        btn.className = 'button gumroad-download-btn ' + (isAddButton ? 'add' : 'download');
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

    const createDownloadContainer = (data) => {
        const infoBox = document.querySelector('.rich-text');
        if (!infoBox || infoBox.querySelector('.gumroad-download-container')) return;

        const productSlug = getProductSlug();
        if (!productSlug) return;

        const productData = data[productSlug] || {};
        const hasActual = !!productData.actual;
        const hasLeaked = !!productData.leaked;

        const container = document.createElement('div');
        container.className = 'gumroad-download-container';

        const title = document.createElement('div');
        title.className = 'gumroad-download-title';
        title.textContent = 'Скачать';
        container.appendChild(title);

        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'gumroad-download-buttons';

        buttonsContainer.appendChild(createButton('🗨️ Чат', CONFIG.CHAT_URL));
        buttonsContainer.appendChild(
            hasActual
                ? createButton('⬇ Актуальная', productData.actual)
                : createButton('✚ Добавить', null, true)
        );
        buttonsContainer.appendChild(
            hasLeaked
                ? createButton('⬇ Слитая', productData.leaked)
                : createButton('✚ Добавить', null, true)
        );

        container.appendChild(buttonsContainer);
        infoBox.prepend(container);
    };

    // === Запуск ===

    injectStyles();

    loadData((data) => {
        const checkAndCreate = () => {
            const infoBox = document.querySelector('.rich-text');
            if (infoBox && !infoBox.querySelector('.gumroad-download-container')) {
                createDownloadContainer(data);
            }
        };

        checkAndCreate();

        const observer = new MutationObserver(checkAndCreate);
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class']
        });
    });
})();
