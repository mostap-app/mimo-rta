// Дневник открывается из сохранённой страницы, модели кешируются после загрузки.
const C="mimo-rta-v1";
const home=new URL("./",self.registration.scope).href;

self.addEventListener("install",event=>{
  event.waitUntil((async()=>{
    try{await (await caches.open(C)).add(home)}catch(e){}
    await self.skipWaiting();
  })());
});
self.addEventListener("activate",event=>event.waitUntil(self.clients.claim()));

self.addEventListener("fetch",event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=="GET"||url.origin!==location.origin||!url.href.startsWith(home))return;
  const appPage=request.mode==="navigate"&&(url.pathname===new URL(home).pathname||url.pathname===new URL("index.html",home).pathname);
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
      if(live.ok&&cache)saving=cache.put(appPage?home:request,live.clone()).catch(()=>{});
      return live;
    }catch(e){
      const cached=cache&&await cache.match(appPage?home:request,{ignoreSearch:appPage});
      if(cached)return cached;
      return new Response("Файл недоступен без интернета",{status:503,headers:{"Content-Type":"text/plain; charset=utf-8"}});
    }
  })();
  event.respondWith(response);
  event.waitUntil(response.then(()=>saving).catch(()=>{}));
});
