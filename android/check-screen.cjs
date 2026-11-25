// Read the actual WebView so the test verifies the rendered screen and saved state.
const { setTimeout: delay } = require('node:timers/promises');
const mode = process.argv[2];

async function check(selector, { next = null, fields = {}, text = null, value = null, label = null } = {}) {
    let last = '';
    for (let attempt = 0; attempt < 50; attempt++) {
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
                if (${JSON.stringify(mode)} === 'rollover-prepare') {
                    if (window.testClockSet) return true;
                    if (typeof window.mimoNativeResume !== 'function') return 'Waiting for the resume callback';
                    const resume = window.mimoNativeResume;
                    window.mimoNativeResume = () => { window.testResumed = true; resume(); };
                    const OriginalDate = Date;
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate()+1);
                    tomorrow.setHours(7, 47, 0, 0);
                    window.Date = class extends OriginalDate {
                        constructor(...args) { super(...(args.length ? args : [tomorrow.getTime()])); }
                        static now() { return tomorrow.getTime(); }
                    };
                    window.testClockSet = true;
                    return true;
                }
                if (${JSON.stringify(mode)} === 'rollover-resume' && !window.testResumed) return 'Waiting for Android onResume';
                const visible = element => element && element.getBoundingClientRect().height && getComputedStyle(element).visibility === "visible";
                const next = ${JSON.stringify(next)};
                if (next && visible(document.querySelector(next))) return true;
                const button = document.querySelector(${JSON.stringify(selector)});
                const label = ${JSON.stringify(label)};
                if (label && button) {
                    const tag = button.id;
                    if (window.lastTestLabel === tag) return true;
                    const image = document.createElement("canvas");
                    image.width = 3000;
                    image.height = 4000;
                    const ctx = image.getContext("2d");
                    ctx.fillStyle = "white";
                    ctx.fillRect(0, 0, image.width, image.height);
                    ctx.translate(0, 1050);
                    ctx.scale(3, 3);
                    ctx.fillStyle = "black";
                    label.forEach(([line, font], i) => {
                        ctx.font = font + "px sans-serif";
                        ctx.fillText(line, 50, 105 + 85 * i);
                    });
                    const bytes = Uint8Array.from(atob(image.toDataURL("image/jpeg", 0.84).split(",")[1]), c => c.charCodeAt(0));
                    const transfer = new DataTransfer();
                    transfer.items.add(new File([bytes], tag + ".jpg", {type:"image/jpeg"}));
                    window.lastTestLabel = tag;
                    button.files = transfer.files;
                    button.dispatchEvent(new Event("change", {bubbles:true}));
                    return true;
                }
                if (visible(button)) {
                    if (${JSON.stringify(text)} !== null && !button.textContent.includes(${JSON.stringify(text)})) return button.textContent;
                    if (${JSON.stringify(value)} !== null && (!document.querySelector("#stopScan")?.hidden || button.value !== ${JSON.stringify(value)})) return button.value;
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
    if (mode === 'rollover-prepare') {
        await check('test clock');
        return;
    }
    if (mode === 'rollover-resume') {
        await check('.daynav h1', {text:'Сегодня'});
        await check('.day-summary-total strong', {text:'0'});
        await check('.day-summary-note', {text:'Пока нет записей'});
        await check('[data-day="-1"]', {next:'[data-edit="0"]'});
        await check('.daynav h1', {text:'Вчера'});
        await check('.day-summary-total strong', {text:'777'});
        return;
    }
    if (mode === 'welcome') {
        await check('#helloGo', {next:'#saveProfile'});
        await check('#saveProfile', {next:'.plan .note', fields:{'#w':'65', '#goal':'2', '#tw':'70'}});
        await check('.plan .note', {text:'темпу набора веса — 0,35 кг в неделю. До цели примерно 14 недель.'});
        await check('#view > button.cta[data-go="diary"]', {next:'#diarySearch'});
        await check('#scanIn', {label:[['СМЕТАНА',80], ['15%',64], ['300 г',48]]});
        await check('#fn', {value:'Сметана 15%'});
        await check('#k100', {value:''});
        await check('#scanMore', {label:[['Пищевая ценность на 100 г',52], ['Энергетическая ценность 160 ккал',48], ['Масса нетто 300 г',56]]});
        await check('#k100', {value:'160'});
        await check('#fn', {value:'Сметана 15%'});
        await check('#grams', {value:''});
        await check('#addScan', {next:'#diarySearch', fields:{'#grams':'50'}});
        await check('.day-summary-total strong', {text:'80'});
        await check('#scanIn', {label:[['КОТЛЕТА',70], ['Пищевая ценность 100 г продукта',42], ['Энергетическая ценность 956,5 кДж / 228 ккал',37], ['В одной порции (230 г) содержится 524 ккал',37], ['Масса нетто 230 г',50]]});
        await check('#kWhole', {value:'524'});
        await check('#scanWholeLabel', {text:'Ккал за всё блюдо'});
        await check('[data-scan-basis="weight"]', {next:'#k100'});
        await check('#k100', {value:'228'});
        await check('[data-scan-basis="whole"]', {next:'#kWhole'});
        await check('#addScan', {next:'#diarySearch'});
        await check('.day-summary-total strong', {text:'604'});
        await check('#diarySearch', {next:'[data-pick="custom"]'});
        await check('[data-pick="custom"]', {next:'#addCustom'});
        await check('#addCustom', {next:'[data-edit="2"]', fields:{'#cn':'Тестовое яблоко', '#ck':'173'}});
    }
    await check('#diarySearch');
    await check('.day-summary-total strong', {text:'777'});
    await check('[data-edit="0"]', {text:'Сметана 15%'});
    await check('[data-edit="1"]', {text:'Котлета'});
    await check('[data-edit="2"]', {text:'Тестовое яблоко'});
}
run().catch(error => { console.error(error); process.exitCode = 1; });
