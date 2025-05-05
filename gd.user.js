// ==UserScript==
// @name         Gumroad Product Downloader
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Добавляет кнопки загрузки на страницы Gumroad
// @author       Axelaredz
// @homepageURL    https://github.com/axelaredz/tampermonkey
// @updateURL      https://github.com/Axelaredz/tampermonkey/raw/refs/heads/main/gd.user.js
// @downloadURL    https://github.com/Axelaredz/tampermonkey/raw/refs/heads/main/gd.user.js
// @supportURL     https://github.com/axelaredz/tampermonkey/issues
// @match        https://*.gumroad.com/l/*
// @grant        GM_xmlhttpRequest
// @connect      docs.google.com
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG = {
        DATA_TABLE_URL: 'https://docs.google.com/spreadsheets/d/1FOjuyVYvi-YR6dm1QjHNl9p8FAfNeS-CYLXDwIFedSk/gviz/tq?tqx=out:csv&sheet=Products',
        CHAT_URL: 'https://t.me/H360ru/8451',
        EDIT_TABLE_URL: 'https://docs.google.com/spreadsheets/d/1FOjuyVYvi-YR6dm1QjHNl9p8FAfNeS-CYLXDwIFedSk/edit'
    };

    const getProductSlug = () => {
        const path = window.location.pathname;
        const parts = path.split('/l/');
        if (parts.length < 2) return '';
        return parts[1]
            .replace(/\/$/, '')
            .toLowerCase();
    };

    const parseCSV = (csv) => {
        const result = {};
        const rows = csv.split('\n');
        const regex = /(?:,|\n|^)("(?:(?:"")*[^"]*)*"|[^",\n]*|(?:\n|$))/g;

        rows.forEach(row => {
            const cells = [];
            let match;
            while ((match = regex.exec(row)) !== null) {
                cells.push(match[1].replace(/^"|"$/g, ''));
            }

            if (cells.length >= 3) {
                const slug = cells[0].trim()
                    .replace(/\/$/, '')
                    .toLowerCase();

                const actual = cells[1].trim();
                const leaked = cells[2].trim();

                if (slug) {
                    result[slug] = {
                        actual: actual.startsWith('http') ? actual : '',
                        leaked: leaked.startsWith('http') ? leaked : ''
                    };
                }
            }
        });
        return result;
    };

    const loadData = (callback) => {
        GM_xmlhttpRequest({
            method: 'GET',
            url: CONFIG.DATA_TABLE_URL,
            onload: (response) => callback(parseCSV(response.responseText)),
            onerror: () => console.error('Ошибка загрузки данных')
        });
    };

    const createButton = (text, url, isAddButton = false) => {
        const btn = document.createElement('a');
        btn.className = 'accent button gumroad-download-button';
        btn.textContent = text;
        btn.target = '_blank';

        btn.style.cssText = `
            ${isAddButton ? 'background: linear-gradient(0deg,rgb(54 169 174),rgb(233 238 251));' : 'background: linear-gradient(0deg, rgb(54 169 174), rgb(54 169 174));'}
        `;

        if (url) btn.href = url;
        if (isAddButton) btn.onclick = () => window.open(CONFIG.EDIT_TABLE_URL, '_blank');
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

        // Создаем контейнер для всех элементов
        const container = document.createElement('div');
        container.className = 'gumroad-download-container';

        // Создаем заголовок
        const title = document.createElement('div');
        title.textContent = 'Скачать';
        title.style.cssText = `
            font-weight: bold;
            text-align: center;
            font-size: 18px;
            margin-bottom: .5rem;
        `;

        // Создаем контейнер для кнопок
        const buttonsContainer = document.createElement('div');
        buttonsContainer.style.cssText = `
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 8px;
        `;

        // Создаем кнопки
        const chatButton = createButton('🗨️ Чат', CONFIG.CHAT_URL);
        const actualButton = hasActual
            ? createButton('⬇ Актуальная', productData.actual)
            : createButton('✚ Добавить', null, true);
        const leakedButton = hasLeaked
            ? createButton('⬇ Слитая', productData.leaked)
            : createButton('✚ Добавить', null, true);

        // Добавляем элементы в контейнер
        buttonsContainer.appendChild(chatButton);
        buttonsContainer.appendChild(actualButton);
        buttonsContainer.appendChild(leakedButton);
        container.appendChild(title);
        container.appendChild(buttonsContainer);

        // Добавляем контейнер в infoBox
        infoBox.prepend(container);
    };

    loadData((data) => {
        const checkAndCreateContainer = () => {
            const infoBox = document.querySelector('.rich-text');
            if (infoBox && !infoBox.querySelector('.gumroad-download-container')) {
                createDownloadContainer(data);
            }
        };

        const observer = new MutationObserver(() => {
            checkAndCreateContainer();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        checkAndCreateContainer();
    });
})();
