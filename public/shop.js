(function(){
"use strict";
var CATS={"air-conditioning":"Air Conditioning","batteries":"Batteries","inverters":"Inverters","pbs":"Portable Backup Systems","solar-geysers":"Solar Geysers","solar-lights-accessories":"Solar Lights & Accessories","solar-panels":"Solar Panels"};
var $=function(i){return document.getElementById(i)};
var esc=function(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})};
var money=function(n){return "R"+String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g," ")};
var qs=new URLSearchParams(location.search),all=[];
fetch("/data/products.json").then(function(r){return r.json()}).then(function(d){all=d;init()});
function opts(sel,vals,label){vals.forEach(function(v){var o=document.createElement("option");o.value=v[0];o.textContent=v[1];sel.appendChild(o)})}
function init(){
  var cats=[...new Set(all.map(function(p){return p.cat}))];
  opts($("f-cat"),cats.map(function(c){return[c,CATS[c]||c]}));
  opts($("f-brand"),[...new Set(all.map(function(p){return p.brand}).filter(Boolean))].sort().map(function(b){return[b,b]}));
  opts($("f-kw"),[...new Set(all.map(function(p){return p.kw}).filter(Boolean))].sort(function(a,b){return a-b}).map(function(k){return[k,k+" kW"]}));
  $("f-q").value=qs.get("q")||"";$("f-cat").value=qs.get("cat")||"";
  ["f-q","f-cat","f-brand","f-kw","f-price","f-sort"].forEach(function(i){$(i).addEventListener("input",render)});
  $("ap-filters").addEventListener("submit",function(e){e.preventDefault()});
  render();
}
function render(){
  var q=$("f-q").value.trim().toLowerCase(),c=$("f-cat").value,b=$("f-brand").value,k=$("f-kw").value,m=+$("f-price").value||0,s=$("f-sort").value;
  var l=all.filter(function(p){return(!q||(p.name+" "+(p.brand||"")+" "+p.category).toLowerCase().indexOf(q)>-1)&&(!c||p.cat===c)&&(!b||p.brand===b)&&(!k||String(p.kw)===k)&&(!m||p.price<=m)});
  if(s==="lo")l.sort(function(a,b){return a.price-b.price});if(s==="hi")l.sort(function(a,b){return b.price-a.price});
  $("ap-count").textContent=l.length?"Showing "+l.length+" product"+(l.length>1?"s":""):"No products match your search. Try fewer filters, or WhatsApp us and we will help.";
  $("ap-list").innerHTML=l.map(function(p){return '<li class="product"><a href="/product/'+esc(p.slug)+'" class="woocommerce-LoopProduct-link"><img src="'+esc(p.image)+'" alt="'+esc(p.name)+'" loading="lazy" width="300" height="300"><span class="ast-woo-product-category">'+esc(p.category)+'</span><h2 class="woocommerce-loop-product__title">'+esc(p.name)+'</h2><span class="price">'+(p.was?'<del class="ap-was">'+money(p.was)+'</del>':'')+'<span class="woocommerce-Price-amount amount">'+money(p.price)+'</span></span></a><a class="ap-btn ap-wa-btn" target="_blank" rel="noopener" href="https://wa.me/27718111466?text='+encodeURIComponent("Hi Afri-Powered, I would like to order: "+p.name+" ("+money(p.price)+")")+'">Order on WhatsApp</a></li>'}).join("");
}
})();
