// Сеть в приоритете: всегда свежая версия, а без интернета — последняя сохранённая.
const C="mimo-rta-v1";
self.addEventListener("install",e=>self.skipWaiting());
self.addEventListener("activate",e=>e.waitUntil(self.clients.claim()));
self.addEventListener("fetch",e=>{
  const r=e.request,u=new URL(r.url);if(r.method!=="GET"||u.origin!==location.origin)return;
  // Тяжёлые файлы распознавания не меняются: берём из памяти телефона, качаем один раз.
  if(/\.wasm$|\/scan\//.test(u.pathname)){e.respondWith(caches.match(r).then(m=>m||fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(C).then(c=>c.put(r,cp))}return res})));return}
  e.respondWith(fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(C).then(c=>c.put(r,cp))}return res})
    .catch(()=>caches.match(r,{ignoreSearch:true}).then(m=>m||caches.match("./"))));
});
