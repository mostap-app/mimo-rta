// Дневник открывается из сохранённой страницы, модели кешируются после загрузки.
const C="mimo-rta-v1";
const home=new URL("./",self.registration.scope).href;

self.addEventListener("install",event=>{
  event.waitUntil((async()=>{
    try{await (await caches.open(C)).add(new Request(home,{cache:"reload"}))}catch(e){}
    await self.skipWaiting();
  })());
});
self.addEventListener("activate",event=>event.waitUntil(self.clients.claim()));

self.addEventListener("fetch",event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=="GET"||url.origin!==location.origin||!url.href.startsWith(home))return;
  const appPage=request.mode==="navigate"&&(url.pathname===new URL(home).pathname||url.pathname===new URL("index.html",home).pathname);
  if(appPage){
    const cache=caches.open(C).catch(()=>null);
    const update=(async()=>{
      const live=await fetch(request,{cache:"no-cache"});
      const store=await cache;
      if(live.ok&&store)await store.put(home,live.clone()).catch(()=>{});
      return live;
    })().catch(()=>new Response("Файл недоступен без интернета",{status:503,headers:{"Content-Type":"text/plain; charset=utf-8"}}));
    event.respondWith(cache.then(async store=>(await store?.match(home))||update));
    event.waitUntil(update.then(()=>{}));
    return;
  }
  const model=/\.wasm$|\/scan\//.test(url.pathname);
  let saving;

  const response=(async()=>{
    const cache=await caches.open(C).catch(()=>null);
    if(model&&cache){
      const cached=await cache.match(request);
      if(cached)return cached;
    }
    try{
      const live=await fetch(request);
      if(live.ok&&cache)saving=cache.put(request,live.clone()).catch(()=>{});
      return live;
    }catch(e){
      const cached=cache&&await cache.match(request);
      if(cached)return cached;
      return new Response("Файл недоступен без интернета",{status:503,headers:{"Content-Type":"text/plain; charset=utf-8"}});
    }
  })();
  event.respondWith(response);
  event.waitUntil(response.then(()=>saving).catch(()=>{}));
});
