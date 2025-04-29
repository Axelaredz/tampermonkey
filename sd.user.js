// ==UserScript==
// @name         superhivemarket.com Downloader
// @namespace    http://tampermonkey.net/
// @version      3.2
// @description  Добавляет кнопки загрузки из Google Sheets
// @author       Axelaredz
// @homepageURL    https://github.com/axelaredz/tampermonkey
// @updateURL      https://github.com/Axelaredz/tampermonkey/raw/refs/heads/main/sd.user.js
// @downloadURL    https://github.com/Axelaredz/tampermonkey/raw/refs/heads/main/sd.user.js
// @supportURL     https://github.com/axelaredz/tampermonkey/issues
// @match        https://superhivemarket.com/products/*
// @grant        GM_xmlhttpRequest
// @connect      docs.google.com
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG = {
        DATA_TABLE_URL: 'https://docs.google.com/spreadsheets/d/1cTMmx-0l7ZSp09v3EOR_ryYY5NjtQP_Qu5HMzOaSyF8/gviz/tq?tqx=out:csv&sheet=Products',
        CHAT_URL: 'https://t.me/H360ru/8451',
        EDIT_TABLE_URL: 'https://docs.google.com/spreadsheets/d/1cTMmx-0l7ZSp09v3EOR_ryYY5NjtQP_Qu5HMzOaSyF8/edit'
    };

    const getProductSlug = () => {
        return window.location.pathname
            .split('/')
            .filter(segment => segment)
            .pop()
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
        const priceBox = document.querySelector('.action-wish');
        if (!priceBox || priceBox.querySelector('.btn-group')) return;

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
            margin-bottom: .5rem;
        `;

        // Кнопка чата
        btnGroup.appendChild(createButton('🗨️ Чат', CONFIG.CHAT_URL, false, true));

        // Актуальная версия
        if (hasActual) {
            btnGroup.appendChild(createButton('⬇ Актуальная', productData.actual));
        } else {
            btnGroup.appendChild(createButton('✚ Добавить', null, true));
        }

        // Слитая версия
        if (hasLeaked) {
            btnGroup.appendChild(createButton('⬇ Слитая', productData.leaked, false, false, true));
        } else {
            btnGroup.appendChild(createButton('✚ Добавить', null, true, false, true));
        }

        block.appendChild(btnGroup);
        priceBox.prepend(block);
    };

    // Запуск скрипта
    loadData((data) => {
        const checkExist = setInterval(() => {
            if (document.querySelector('.action-wish')) {
                clearInterval(checkExist);
                createDownloadBlock(data);
            }
        }, 1000);
    });
})();
