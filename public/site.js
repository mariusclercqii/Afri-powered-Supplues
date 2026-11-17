(function(){
"use strict";
var $=function(s,r){return (r||document).querySelector(s)},$$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
var WA="27718111466";
/* Astra responsive switch (same breakpoint as the original theme) */
function bp(){var m=window.innerWidth<922,b=document.body;
  b.classList.toggle("ast-header-break-point",m);b.classList.toggle("ast-desktop",!m);
  b.classList.toggle("ast-mobile-header-active",m);}
bp();window.addEventListener("resize",bp);
/* mobile menu */
$$(".menu-toggle").forEach(function(b){b.addEventListener("click",function(){
  var open=b.getAttribute("aria-expanded")!=="true";
  b.setAttribute("aria-expanded",open);b.classList.toggle("toggled",open);
  document.body.classList.toggle("ast-main-header-nav-open",open);
  var nav=$("#ast-mobile-header .main-header-bar-navigation");if(nav)nav.classList.toggle("toggled",open);
  var c=$("#ast-mobile-header .ast-mobile-header-content");if(c)c.style.display=open?"block":"none";
});});
/* FAQ accordion */
$$(".elementor-accordion").forEach(function(acc){
  $$(".elementor-tab-title",acc).forEach(function(t){
    function go(){var c=t.nextElementSibling,was=t.classList.contains("elementor-active");
      $$(".elementor-tab-title",acc).forEach(function(x){x.classList.remove("elementor-active");x.setAttribute("aria-expanded","false");x.nextElementSibling.classList.remove("elementor-active");x.nextElementSibling.style.display="none";});
      if(!was){t.classList.add("elementor-active");t.setAttribute("aria-expanded","true");c.classList.add("elementor-active");c.style.display="block";}}
    t.addEventListener("click",go);t.addEventListener("keydown",function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();go();}});
  });
  $$(".elementor-tab-content",acc).forEach(function(c){if(!c.classList.contains("elementor-active"))c.style.display="none";});
});
/* Google reviews: set the size class the old plugin script used to set (1 review per view on phones, up to 5 on wide screens) */
$$(".wp-gr .grw-row").forEach(function(row){var box=row.closest(".wp-gr");
  function fit(){var w=box.offsetWidth;if(!w)return;var s=w<510?"xs":w<750?"x":w<960?"s":w<1150?"m":w<1300?"l":"xl";
    var c=row.className.replace(/\s*\bgrw-row-(xs|x|s|m|l|xl)\b/g,"")+" grw-row-"+s;if(c!==row.className)row.className=c;}
  fit();if(window.ResizeObserver)new ResizeObserver(fit).observe(box);else window.addEventListener("resize",fit);});
/* reviews slider arrows */
$$(".grw-content-inner").forEach(function(w){
  var sl=$(".rpi-slides",w),p=$(".grw-prev",w),n=$(".grw-next",w);if(!sl)return;
  var step=function(){var s=$(".rpi-slide",sl);return s?s.offsetWidth+10:300};
  if(p)p.addEventListener("click",function(){sl.scrollBy({left:-step(),behavior:"smooth"})});
  if(n)n.addEventListener("click",function(){sl.scrollBy({left:step(),behavior:"smooth"})});
});
/* scroll to top */
var st=$("#ast-scroll-top");
if(st){var f=function(){st.classList.toggle("ap-show",window.scrollY>300)};window.addEventListener("scroll",f,{passive:true});f();
  var go=function(){window.scrollTo({top:0,behavior:"smooth"})};st.addEventListener("click",go);st.addEventListener("keydown",function(e){if(e.key==="Enter")go()});}
/* cart: kept in this browser only; cart.js handles the cart and checkout pages */
var CK="ap_cart";
function cartGet(){try{var c=JSON.parse(localStorage.getItem(CK)||"[]");return Array.isArray(c)?c.filter(function(x){return x&&typeof x.slug==="string"&&x.qty>0}):[]}catch(e){return[]}}
function cartSet(c){try{localStorage.setItem(CK,JSON.stringify(c))}catch(e){}cartCount()}
function cartAdd(slug,qty){var c=cartGet(),l=c.filter(function(x){return x.slug===slug})[0];if(l)l.qty=Math.min(99,l.qty+qty);else c.push({slug:slug,qty:qty});cartSet(c)}
function cartCount(){var n=cartGet().reduce(function(a,x){return a+x.qty},0);$$(".ap-cart-count").forEach(function(e){e.textContent=n>99?"99+":n;e.hidden=!n})}
var CART_SVG='<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M7 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM5.2 4l.6 3h13.7c.7 0 1.2.7 1 1.3l-1.8 6.1c-.2.6-.7 1-1.3 1H8.3l.4 2H19v2H7.1L4 2H1V0h4.6l.6 4Z"/></svg>';
$$(".ap-searchbar").forEach(function(s){var a=document.createElement("a");a.href="/cart";a.className="ap-cart-link";a.setAttribute("aria-label","View cart");a.innerHTML=CART_SVG+'<span class="ap-cart-count" hidden>0</span>';s.appendChild(a)});
cartCount();window.addEventListener("storage",cartCount);document.addEventListener("ap:cart",cartCount);
var toastEl;
function added(name,q){if(!toastEl){toastEl=document.createElement("div");toastEl.className="ap-added";toastEl.setAttribute("role","status");document.body.appendChild(toastEl)}
  toastEl.innerHTML='<span class="ap-added-txt"></span><a href="/cart" class="ap-btn">View cart</a>';$(".ap-added-txt",toastEl).textContent="Added to cart: "+(q>1?q+" × ":"")+name;
  toastEl.classList.add("on");clearTimeout(added.t);added.t=setTimeout(function(){toastEl.classList.remove("on")},4500)}
document.addEventListener("click",function(e){
  var q=e.target.closest(".ap-qty button[data-q]");
  if(q){var i=$("input",q.parentNode);i.value=Math.max(1,Math.min(99,(parseInt(i.value,10)||1)+(+q.getAttribute("data-q"))));return}
  var b=e.target.closest("[data-add-cart]");if(!b)return;e.preventDefault();
  var box=b.closest(".ap-buy"),qi=box&&$(".ap-qty input",box),n=qi?Math.max(1,Math.min(99,parseInt(qi.value,10)||1)):1;
  cartAdd(b.getAttribute("data-add-cart"),n);added(b.getAttribute("data-name")||"item",n);
  b.classList.add("ap-ok");setTimeout(function(){b.classList.remove("ap-ok")},1200);
});
/* product page: extra photos swap into the main picture */
$$(".ap-gallery").forEach(function(g){var main=$(".woocommerce-product-gallery__image img");
  g.addEventListener("click",function(e){var b=e.target.closest(".ap-thumb");if(!b||!main)return;
    main.src=b.getAttribute("data-src");$$(".ap-thumb",g).forEach(function(x){x.classList.toggle("on",x===b)});});});
/* promo banner (home page) */
var host=$("#ap-promos");
if(host){fetch("data/promos.json").then(function(r){return r.json()}).then(function(list){
  var now=new Date().toISOString().slice(0,10);
  list=list.filter(function(p){return (!p.start||p.start<=now)&&(!p.end||p.end>=now)});
  if(!list.length){host.remove();return}
  var esc=function(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})};
  var safe=function(u){return /^(\/|https:\/\/|#|data\/|assets\/)/.test(u||"")?u:"/shop"};
  var track=document.createElement("div");track.className="ap-promos-track";
  track.innerHTML=list.map(function(p){if(p.image&&!p.title)return '<a class="ap-slide ap-img" href="'+esc(safe(p.link))+'"><img src="'+esc(safe(p.image))+'" alt="'+esc(p.alt||"Special offer")+'"></a>';return '<a class="ap-slide" href="'+esc(safe(p.link))+'">'+(p.image?'<img src="'+esc(safe(p.image))+'" alt="">':'')+'<div>'+(p.tag?'<span class="ap-tag">'+esc(p.tag)+'</span>':'')+'<strong>'+esc(p.title)+'</strong>'+(p.sub?'<span class="ap-sub">'+esc(p.sub)+'</span>':'')+'</div>'+(p.price?'<span class="ap-price">'+esc(p.price)+'</span>':'')+'<span class="ap-cta">'+esc(p.cta||"View")+'</span></a>'}).join("");
  host.appendChild(track);
  if(list.length>1){
    var dots=document.createElement("div");dots.className="ap-dots";
    list.forEach(function(_,i){var b=document.createElement("button");b.setAttribute("aria-label","Slide "+(i+1));b.onclick=function(){go(i)};dots.appendChild(b)});
    var pv=document.createElement("button"),nx=document.createElement("button");
    pv.className="ap-arrow prev";nx.className="ap-arrow next";pv.setAttribute("aria-label","Previous");nx.setAttribute("aria-label","Next");pv.innerHTML="&#8249;";nx.innerHTML="&#8250;";
    host.appendChild(pv);host.appendChild(nx);host.appendChild(dots);
    var cur=0,timer;
    function go(i){cur=(i+list.length)%list.length;track.scrollTo({left:cur*track.clientWidth,behavior:"smooth"});mark()}
    function mark(){$$("button",dots).forEach(function(b,i){b.classList.toggle("on",i===cur)})}
    pv.onclick=function(){go(cur-1)};nx.onclick=function(){go(cur+1)};
    track.addEventListener("scroll",function(){cur=Math.round(track.scrollLeft/track.clientWidth);mark()},{passive:true});
    mark();function auto(){clearInterval(timer);timer=setInterval(function(){go(cur+1)},6000)}
    auto();host.addEventListener("mouseenter",function(){clearInterval(timer)});host.addEventListener("mouseleave",auto);
  }
}).catch(function(){host.remove()});}
})();
