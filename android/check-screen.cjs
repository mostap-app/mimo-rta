// Read the actual WebView so the test verifies the rendered screen and saved state.
const { setTimeout: delay } = require('node:timers/promises');
const firstLaunch = process.argv[2] === 'welcome';

async function check(selector, { next = null, fields = {}, text = null } = {}) {
    let last = '';
    for (let attempt = 0; attempt < 30; attempt++) {
        let socket;
        try {
            const response = await fetch('http://127.0.0.1:9222/json/list');
            const pages = await response.json();
            const page = pages.find(item => item.url.includes('/assets/index.html'));
            if (!page) throw new Error('No app page');
            socket = new WebSocket(page.webSocketDebuggerUrl);
            await new Promise((resolve, reject) => {
                socket.onopen = resolve;
                socket.onerror = reject;
            });
            const expression = `(() => {
                const visible = element => element && element.getBoundingClientRect().height && getComputedStyle(element).visibility === "visible";
                const next = ${JSON.stringify(next)};
                if (next && visible(document.querySelector(next))) return true;
                const button = document.querySelector(${JSON.stringify(selector)});
                if (visible(button)) {
                    if (${JSON.stringify(text)} !== null && !button.textContent.includes(${JSON.stringify(text)})) return button.textContent;
                    for (const [key, value] of Object.entries(${JSON.stringify(fields)})) {
                        const field = document.querySelector(key);
                        field.value = value;
                        field.dispatchEvent(new Event("input", {bubbles:true}));
                    }
                    if (!next) return true;
                    button.click();
                    return !!visible(document.querySelector(next));
                }
                return {
                    title: document.title, ready: document.readyState, body: document.body && document.body.className,
                    screen: document.querySelector("h1") && document.querySelector("h1").textContent,
                    buttons: Array.from(document.querySelectorAll("#view button"), b => b.id).slice(0,12),
                    content: document.body && document.body.innerText.slice(0,200),
                    viewport: [innerWidth, innerHeight], rect: button && button.getBoundingClientRect().toJSON()
                };
            })()`;
            const result = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('WebView response timeout')), 2500);
                socket.onmessage = event => {
                    const message = JSON.parse(event.data);
                    if (message.id !== 1) return;
                    clearTimeout(timeout);
                    resolve(message);
                };
                socket.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }));
            });
            if (result.result?.result?.value === true) {
                console.log('Rendered ' + selector);
                return;
            }
            last = JSON.stringify(result);
        } catch (error) {
            last = String(error);
        } finally {
            if (socket) socket.close();
        }
        await delay(500);
    }
    throw new Error('Screen check failed: ' + selector + ' ' + last);
}
async function run() {
    if (firstLaunch) {
        await check('#helloGo', {next:'#saveProfile'});
        await check('#saveProfile', {next:'.plan .note', fields:{'#w':'65', '#goal':'2', '#tw':'70'}});
        await check('.plan .note', {text:'темпу набора веса — 0,35 кг в неделю. До цели примерно 14 недель.'});
        await check('#view > button.cta[data-go="diary"]', {next:'#diarySearch'});
        await check('#diarySearch', {next:'[data-pick="custom"]'});
        await check('[data-pick="custom"]', {next:'#addCustom'});
        await check('#addCustom', {next:'[data-edit="0"]', fields:{'#cn':'Тестовое яблоко', '#ck':'173'}});
    }
    await check('#diarySearch');
    await check('.day-summary-total strong', {text:'173'});
    await check('[data-edit="0"]', {text:'Тестовое яблоко'});
}
run().catch(error => { console.error(error); process.exitCode = 1; });
