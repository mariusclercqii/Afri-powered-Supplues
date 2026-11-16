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
/* promo banner (home page) */
var host=$("#ap-promos");
if(host){fetch("data/promos.json").then(function(r){return r.json()}).then(function(list){
  var now=new Date().toISOString().slice(0,10);
  list=list.filter(function(p){return (!p.start||p.start<=now)&&(!p.end||p.end>=now)});
  if(!list.length){host.remove();return}
  var esc=function(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})};
  var safe=function(u){return /^(\/|https:\/\/|#|data\/|assets\/)/.test(u||"")?u:"/shop"};
  var track=document.createElement("div");track.className="ap-promos-track";
  track.innerHTML=list.map(function(p){return '<a class="ap-slide" href="'+esc(safe(p.link))+'">'+(p.image?'<img src="'+esc(safe(p.image))+'" alt="">':'')+'<div>'+(p.tag?'<span class="ap-tag">'+esc(p.tag)+'</span>':'')+'<strong>'+esc(p.title)+'</strong>'+(p.sub?'<span class="ap-sub">'+esc(p.sub)+'</span>':'')+'</div>'+(p.price?'<span class="ap-price">'+esc(p.price)+'</span>':'')+'<span class="ap-cta">'+esc(p.cta||"View")+'</span></a>'}).join("");
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
