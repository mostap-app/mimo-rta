// Read the actual WebView so the test verifies the rendered screen and saved state.
const { setTimeout: delay } = require('node:timers/promises');
const firstLaunch = process.argv[2] === 'welcome';

async function check() {
    const selector = firstLaunch ? '#helloGo' : '#diarySearch';
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
            const expression = firstLaunch ? `(() => {
                const button = document.querySelector('#helloGo');
                if (!button || !button.getBoundingClientRect().height) return false;
                button.click();
                document.querySelector('#skipProfile').click();
                return Boolean(document.querySelector('#diarySearch'));
            })()` : 'Boolean(document.querySelector("#diarySearch") && document.querySelector("#diarySearch").getBoundingClientRect().height)';
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
                console.log('Rendered ' + selector + (firstLaunch ? ' and entered diary' : ' after process restart'));
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
check().catch(error => { console.error(error); process.exitCode = 1; });
