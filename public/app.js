const WA="27718111466",IMG="https://afripowered.co.za/wp-content/uploads/";
const R=n=>"R"+n.toLocaleString("en-ZA"),q=(s,r=document)=>r.querySelector(s),get=u=>fetch(u).then(r=>r.json());
const wa=t=>`https://wa.me/${WA}?text=${encodeURIComponent(t)}`;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
function card(p){
 const m=`Hi Afri-Powered, I'd like to order: ${p.name} (${R(p.price)}).`;
 return `<article class="card"><img class="im" src="${IMG+p.image}" alt="${esc(p.name)}" width="400" height="400" loading="lazy"><div class="b">${p.was?'<span class="tag">Special</span>':""}<h3>${esc(p.name)}</h3><div><span class="price">${R(p.price)}</span>${p.was?`<span class="was">${R(p.was)}</span>`:""}</div><div class="acts"><a class="btn btn-w" href="${wa(m)}" target="_blank" rel="noopener">Order on WhatsApp</a>${p.pay_url?`<a class="btn btn-s" href="${esc(p.pay_url)}" rel="noopener">Pay now</a>`:""}</div></div></article>`}
async function slider(){
 const el=q("#promos");if(!el)return;const d=new Date().toISOString().slice(0,10);
 const L=(await get("data/promos.json")).filter(p=>(!p.start||p.start<=d)&&(!p.end||p.end>=d));
 if(!L.length){el.hidden=true;return}
 el.innerHTML=`<div class="track" tabindex="0" role="region" aria-label="Current specials and combos">${L.map(p=>`<a class="slide" href="${esc(p.link||"shop.html")}"${p.image?` style="background-image:url('${esc(p.image)}')"`:""}><h3>${esc(p.title)}</h3><p>${esc(p.text||"")}</p><span class="btn btn-s">${esc(p.cta||"View deal")}</span></a>`).join("")}</div><div class="dots">${L.map((_,i)=>`<button aria-label="Show slide ${i+1}"></button>`).join("")}</div>`;
 const t=q(".track",el),b=[...q(".dots",el).children],at=()=>Math.round(t.scrollLeft/t.clientWidth),go=i=>t.scrollTo({left:i*t.clientWidth,behavior:"smooth"});
 const mark=()=>b.forEach((x,j)=>x.setAttribute("aria-current",j==at()));
 b.forEach((x,i)=>x.onclick=()=>go(i));t.addEventListener("scroll",mark);mark();
 if(L.length>1&&!matchMedia("(prefers-reduced-motion:reduce)").matches)setInterval(()=>go((at()+1)%L.length),6000)}
async function specials(){
 const g=q("#specials");if(!g)return;const S=(await get("data/products.json")).filter(p=>p.was);
 if(!S.length)g.closest("section").hidden=true;else g.innerHTML=S.map(card).join("")}
async function shop(){
 const g=q("#list");if(!g)return;const P=await get("data/products.json"),f=q("#f");
 const u=(k,n)=>[...new Set(P.map(p=>p[k]).filter(Boolean))].sort(n?(a,b)=>a-b:undefined);
 const opt=(id,v,fm=x=>x)=>q(id).insertAdjacentHTML("beforeend",v.map(x=>`<option value="${esc(x)}">${esc(fm(x))}</option>`).join(""));
 opt("#cat",u("category"));opt("#brand",u("brand"));opt("#kw",u("kw",1),x=>x+" kW");opt("#v",u("voltage",1),x=>x+"V");
 const mx=Math.max(...P.map(p=>p.price)),pr=q("#price");pr.max=mx;pr.value=mx;
 const qs=new URLSearchParams(location.search);if(qs.get("cat"))q("#cat").value=qs.get("cat");if(qs.get("sale"))q("#sale").checked=true;
 const run=()=>{const s=q("#s").value.toLowerCase(),c=q("#cat").value,b=q("#brand").value,k=q("#kw").value,v=q("#v").value,m=+pr.value,o=q("#sale").checked;
  const L=P.filter(p=>(!s||(p.name+" "+p.brand).toLowerCase().includes(s))&&(!c||p.category===c)&&(!b||p.brand===b)&&(!k||p.kw==k)&&(!v||p.voltage==v)&&p.price<=m&&(!o||p.was));
  L.sort((a,b)=>q("#sort").value=="hi"?b.price-a.price:a.price-b.price);
  q("#pv").textContent=R(m);q("#count").textContent=L.length+(L.length==1?" product":" products");
  g.innerHTML=L.length?L.map(card).join(""):"<p>No products match. Clear a filter to see more.</p>"};
 f.addEventListener("input",run);f.addEventListener("reset",()=>setTimeout(()=>{pr.value=mx;run()}));run()}
slider();specials();shop();
