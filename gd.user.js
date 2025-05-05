// ==UserScript==
// @name         Gumroad Product Downloader
// @namespace    http://tampermonkey.net/
// @version      1.0
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

    const createButton = (text, url, isAddButton = false, isFirst = false, isLast = false) => {
        const btn = document.createElement('a');
        btn.className = 'btn';
        btn.textContent = text;
        btn.target = '_blank';

        btn.style.cssText = `
            position: relative;
            padding: 10px 5px;
            color: white !important;
            text-decoration: none !important;
            transition: all 0.2s ease;
            ${isAddButton ? 'background: linear-gradient(0deg, rgb(104, 0, 240), #00000080);' : 'background: linear-gradient(0deg,#6800f0,#ff6b00);'}
        `;

        if (url) btn.href = url;
        if (isAddButton) btn.onclick = () => window.open(CONFIG.EDIT_TABLE_URL, '_blank');
        return btn;
    };

    const createDownloadBlock = (data) => {
        const infoBox = document.querySelector('.info');
        if (!infoBox || infoBox.querySelector('.download-block')) return;

        const productSlug = getProductSlug();
        if (!productSlug) return;

        const productData = data[productSlug] || {};
        const hasActual = !!productData.actual;
        const hasLeaked = !!productData.leaked;

        const block = document.createElement('div');
        block.className = 'download-block';

        const title = document.createElement('div');
        title.textContent = 'Скачать';
        title.style.cssText = `
            margin-bottom: 10px;
            font-weight: bold;
            text-align: center;
        `;
        block.appendChild(title);

        const btnGroup = document.createElement('div');
        btnGroup.className = 'btn-group';
        btnGroup.style.cssText = `
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            margin-bottom: .5rem;
            gap: 8px;
        `;

        btnGroup.appendChild(createButton('🗨️ Чат', CONFIG.CHAT_URL, false, true));

        if (hasActual) {
            btnGroup.appendChild(createButton('⬇ Актуальная', productData.actual));
        } else {
            btnGroup.appendChild(createButton('✚ Добавить', null, true));
        }

        if (hasLeaked) {
            btnGroup.appendChild(createButton('⬇ Слитая', productData.leaked, false, false, true));
        } else {
            btnGroup.appendChild(createButton('✚ Добавить', null, true, false, true));
        }

        block.appendChild(btnGroup);
        infoBox.prepend(block);
    };

    loadData((data) => {
        const checkAndCreateBlock = () => {
            const infoBox = document.querySelector('.info');
            if (infoBox && !infoBox.querySelector('.download-block')) {
                createDownloadBlock(data);
            }
        };

        const observer = new MutationObserver(() => {
            checkAndCreateBlock();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        setInterval(checkAndCreateBlock, 2000);

        checkAndCreateBlock();
    });
})();
