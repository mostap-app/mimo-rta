// Read the actual WebView so the test verifies the rendered screen and saved state.
const { setTimeout: delay } = require('node:timers/promises');
const firstLaunch = process.argv[2] === 'welcome';

async function check(selector, click = false) {
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
                const button = document.querySelector(${JSON.stringify(selector)});
                if (button && button.getBoundingClientRect().height && getComputedStyle(button).visibility === "visible") {
                    if (${click}) button.click();
                    return true;
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
        await check('#helloGo', true);
        await check('#skipProfile', true);
    }
    await check('#diarySearch');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
