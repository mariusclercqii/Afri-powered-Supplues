(function(){
"use strict";
/* Cart page, checkout (quote request) and the customer's quote page. */
var CK="ap_cart",WA="27718111466";
var $=function(s,r){return(r||document).querySelector(s)},$$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
var esc=function(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})};
var money=function(n){if(n==null||isNaN(n))return"–";var v=Math.round(Number(n)*100)/100,whole=Math.floor(v),c=Math.round((v-whole)*100);
  return "R"+String(whole).replace(/\B(?=(\d{3})+(?!\d))/g," ")+(c?","+String(c).padStart(2,"0"):"")};
function cartGet(){try{var c=JSON.parse(localStorage.getItem(CK)||"[]");return Array.isArray(c)?c.filter(function(x){return x&&typeof x.slug==="string"&&x.qty>0}):[]}catch(e){return[]}}
function cartSet(c){try{localStorage.setItem(CK,JSON.stringify(c))}catch(e){}document.dispatchEvent(new CustomEvent("ap:cart"))}
function products(){return fetch("/data/products.json").then(function(r){return r.json()}).then(function(l){var m={};l.forEach(function(p){m[p.slug]=p});return m})}
function lines(P){var c=cartGet(),ok=c.filter(function(x){return P[x.slug]});if(ok.length!==c.length)cartSet(ok);return ok.map(function(x){return{p:P[x.slug],qty:x.qty}})}
function steps(active){var it=[["01","Request","Review your cart and details"],["02","Confirm","Stock, pricing and delivery"],["03","Pay","When your quote is ready"]];
  return '<ol class="ap-steps" aria-label="Checkout steps">'+it.map(function(s,i){var n=i+1;return'<li class="'+(n===active?"on":n<active?"done":"")+'"><b>'+s[0]+"</b><span><strong>"+s[1]+"</strong><small>"+s[2]+"</small></span></li>"}).join("")+"</ol>"}

/* ---------- cart page ---------- */
function cartPage(root){
  products().then(function(P){
    function draw(){
      var L=lines(P),box=$("#ap-cart-lines"),next=$("#ap-cart-next");
      if(!L.length){box.innerHTML='<li class="ap-empty"><p><strong>Your cart is empty.</strong></p><p>Browse the shop and press <em>Add to cart</em> on anything you need.</p><a class="ap-btn" href="/shop">Go to the shop</a></li>';
        $("#ap-cart-listed").textContent="–";next.classList.add("ap-disabled");next.setAttribute("aria-disabled","true");return}
      next.classList.remove("ap-disabled");next.removeAttribute("aria-disabled");
      var total=0;box.innerHTML=L.map(function(l){var p=l.p;total+=p.price*l.qty;
        return '<li class="ap-line" data-slug="'+esc(p.slug)+'"><a href="/product/'+esc(p.slug)+'" class="ap-line-img"><img src="'+esc(p.image)+'" alt="" loading="lazy"></a>'+
        '<div class="ap-line-main"><a href="/product/'+esc(p.slug)+'" class="ap-line-name">'+esc(p.name)+'</a><span class="ap-small">'+esc(p.category)+(p.brand?" · "+esc(p.brand):"")+"</span>"+
        (p.stock==="out"?'<span class="ap-out-tag">Out of stock: lead time confirmed in quote</span>':"")+
        '<div class="ap-line-ctl"><div class="ap-qty"><button type="button" data-d="-1" aria-label="One less">−</button><input type="number" min="1" max="99" value="'+l.qty+'" aria-label="Quantity"><button type="button" data-d="1" aria-label="One more">+</button></div>'+
        '<button type="button" class="ap-link ap-remove">Remove</button></div></div>'+
        '<div class="ap-line-price"><span class="ap-small">Listed</span><strong>'+money(p.price*l.qty)+"</strong>"+(l.qty>1?'<span class="ap-small">'+money(p.price)+" each</span>":"")+"</div></li>"}).join("");
      $("#ap-cart-listed").textContent=money(total);
    }
    function setQty(slug,q){var c=cartGet();c.forEach(function(x){if(x.slug===slug)x.qty=Math.max(1,Math.min(99,q))});cartSet(c);draw()}
    $("#ap-cart-lines").addEventListener("click",function(e){var li=e.target.closest(".ap-line");if(!li)return;var slug=li.getAttribute("data-slug");
      var d=e.target.closest("[data-d]");if(d){var i=$("input",li);setQty(slug,(parseInt(i.value,10)||1)+(+d.getAttribute("data-d")));return}
      if(e.target.closest(".ap-remove")){cartSet(cartGet().filter(function(x){return x.slug!==slug}));draw()}});
    $("#ap-cart-lines").addEventListener("change",function(e){var li=e.target.closest(".ap-line");if(li&&e.target.matches("input"))setQty(li.getAttribute("data-slug"),parseInt(e.target.value,10)||1)});
    $("#ap-cart-next").addEventListener("click",function(e){if(this.classList.contains("ap-disabled"))e.preventDefault()});
    draw();
  }).catch(function(){$("#ap-cart-lines").innerHTML='<li class="ap-empty">Could not load products. Please refresh the page.</li>'});
}

/* ---------- checkout ---------- */
function checkout(root){
  var form=$("#ap-co-form"),addr=$("#ap-addr"),err=$("#ap-co-err"),btn=$("#ap-co-send");
  function method(){var r=$('input[name="method"]:checked',form);return r?r.value:"delivery"}
  function toggle(){var d=method()==="delivery";addr.hidden=!d;$(".ap-note-box",form).hidden=!d;
    $$("input,select",addr).forEach(function(i){if(i.id!=="unit")i.required=d})}
  $$('input[name="method"]',form).forEach(function(r){r.addEventListener("change",toggle)});toggle();
  var P={};
  products().then(function(m){P=m;var L=lines(P);
    if(!L.length){$(".ap-co-grid",root).innerHTML='<div class="ap-card ap-empty"><p><strong>Your cart is empty.</strong></p><p>Add products to your cart before requesting a quote.</p><a class="ap-btn" href="/shop">Go to the shop</a></div>';return}
    var n=L.reduce(function(a,l){return a+l.qty},0);
    $("#ap-co-count").textContent=n+" item"+(n===1?"":"s")+" to review";
    $("#ap-co-items").innerHTML=L.map(function(l){return'<li><img src="'+esc(l.p.image)+'" alt="" loading="lazy"><div><strong>'+esc(l.p.name)+'</strong><span class="ap-small">'+esc(l.p.brand||l.p.category)+" · Qty "+l.qty+'</span><span class="ap-small ap-mono">Listed: '+money(l.p.price*l.qty)+"</span></div></li>"}).join("");
  });
  function bad(id,msg){var el=$("#"+id);if(el){el.classList.add("ap-bad");el.setAttribute("aria-invalid","true")}return msg}
  form.addEventListener("input",function(e){e.target.classList.remove("ap-bad");e.target.removeAttribute("aria-invalid")});
  form.addEventListener("submit",function(e){
    e.preventDefault();err.textContent="";$$(".ap-bad",form).forEach(function(x){x.classList.remove("ap-bad")});
    var v=function(id){var el=$("#"+id);return el?el.value.trim():""},d=method()==="delivery",msgs=[];
    if(v("name").length<2)msgs.push(bad("name","your full name"));
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v("email")))msgs.push(bad("email","a valid email address"));
    if(v("phone").replace(/\D/g,"").length<9)msgs.push(bad("phone","a phone or WhatsApp number"));
    if(d){if(!v("street"))msgs.push(bad("street","your street address"));if(!v("suburb"))msgs.push(bad("suburb","your suburb"));
      if(!v("city"))msgs.push(bad("city","your city or town"));if(!v("province"))msgs.push(bad("province","your province"));
      if(!/^\d{4}$/.test(v("postal")))msgs.push(bad("postal","a four-digit postal code"))}
    if(!$("#consent").checked)msgs.push(bad("consent","a tick in the confirmation box"));
    var items=cartGet().filter(function(x){return P[x.slug]});
    if(!items.length)msgs.push("products in your cart");
    if(msgs.length){err.textContent="Please add "+msgs.join(", ")+".";var f=$(".ap-bad",form);if(f)f.focus();return}
    btn.disabled=true;btn.textContent="Sending…";
    var body={name:v("name"),email:v("email"),phone:v("phone"),method:method(),street:v("street"),unit:v("unit"),suburb:v("suburb"),city:v("city"),
      province:v("province"),postal:v("postal"),note:v("note"),consent:true,website:v("website"),items:items};
    fetch("/api/quote",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})
      .then(function(r){return r.json().catch(function(){return{}}).then(function(d){if(!r.ok)throw new Error(d.error||"Something went wrong. Please try again.");return d})})
      .then(function(d){cartSet([]);done(d,body)})
      .catch(function(x){err.textContent=x.message;btn.disabled=false;btn.textContent="Request quote →"});
  });
  function done(d,body){
    var link="/quote?ref="+encodeURIComponent(d.ref)+"&t="+encodeURIComponent(d.token);
    try{var saved=JSON.parse(localStorage.getItem("ap_quotes")||"[]");saved.unshift({ref:d.ref,link:link,at:Date.now()});localStorage.setItem("ap_quotes",JSON.stringify(saved.slice(0,10)))}catch(e){}
    var wa="Hi Afri-Powered, I've just sent quote request "+d.ref+" from your website ("+body.name+").";
    $(".ap-co-grid",root).hidden=true;$(".ap-steps",root).outerHTML=steps(2);
    var box=$("#ap-co-done");box.hidden=false;
    box.innerHTML='<div class="ap-card ap-done"><p class="ap-kicker">Quote request sent</p><h2>Thank you, '+esc(body.name.split(" ")[0])+'!</h2>'+
      '<p>Your reference is <strong class="ap-ref">'+esc(d.ref)+'</strong>. Keep it handy.</p>'+
      '<ol class="ap-next"><li>We check stock and book delivery for your order.</li><li>We send your final quote on WhatsApp'+(body.email?" or email":"")+'.</li><li>You pay once you\'re happy with the quote.</li></ol>'+
      '<div class="ap-done-btns"><a class="ap-btn ap-btn-main" href="'+link+'">View your quote</a>'+
      '<a class="ap-btn ap-wa-btn" target="_blank" rel="noopener" href="https://wa.me/'+WA+"?text="+encodeURIComponent(wa)+'">Let us know on WhatsApp</a></div>'+
      '<p class="ap-small">Save the "View your quote" link. It shows your final quote and payment button once it\'s ready.</p></div>';
    window.scrollTo({top:0,behavior:"smooth"});
  }
}

/* ---------- customer quote page ---------- */
function quotePage(root){
  var q=new URLSearchParams(location.search),ref=q.get("ref")||"",t=q.get("t")||"";
  if(!ref||!t){root.innerHTML='<div class="ap-card ap-empty"><h1>Quote not found</h1><p>Please use the link we sent you.</p><a class="ap-btn" href="/shop">Go to the shop</a></div>';return}
  fetch("/api/quote/"+encodeURIComponent(ref)+"?t="+encodeURIComponent(t),{cache:"no-store"})
    .then(function(r){return r.json().then(function(d){if(!r.ok)throw new Error(d.error||"Quote not found.");return d})})
    .then(function(d){
      var st=d.status,quoted=st==="quoted"||st==="paid"||st==="done";
      var head={new:["We're preparing your quote","We're confirming stock, final pricing and delivery. We'll send your quote on WhatsApp soon."],
        quoted:["Your quote is ready","Check the details below. Pay when you're happy, or WhatsApp us with any questions."],
        paid:["Payment received, thank you!","We'll be in touch about delivery or collection."],
        done:["Order complete","Thank you for shopping with Afri-Powered Supplies."],
        cancelled:["This quote was cancelled","WhatsApp us if you'd still like to order."]}[st]||["Your quote",""];
      var rows=d.items.map(function(i){var unit=quoted&&i.final!=null?i.final:i.listed;
        return'<tr><td class="ap-q-img"><img src="'+esc(i.image)+'" alt=""></td><td><strong>'+esc(i.name)+'</strong><span class="ap-small">Qty '+i.qty+" × "+money(unit)+"</span></td><td class=\"ap-amt\">"+money(unit*i.qty)+"</td></tr>"}).join("");
      var sub=d.items.reduce(function(a,i){return a+(quoted&&i.final!=null?i.final:i.listed)*i.qty},0);
      var totals=quoted
        ?'<tr><td></td><td>Subtotal</td><td class="ap-amt">'+money(sub)+'</td></tr><tr><td></td><td>'+(d.method==="collect"?"Collection":"Delivery")+'</td><td class="ap-amt">'+(d.delivery?money(d.delivery):"Free")+'</td></tr><tr class="ap-q-total"><td></td><td>Total</td><td class="ap-amt">'+money(d.total)+"</td></tr>"
        :'<tr class="ap-q-total"><td></td><td>Final total</td><td class="ap-amt ap-tbc">To be confirmed</td></tr>';
      var wa="Hi Afri-Powered, about my quote "+d.ref+": ";
      var pay=st==="quoted"?(d.payLink?'<a class="ap-btn ap-btn-main" href="'+esc(d.payLink)+'" target="_blank" rel="noopener">Pay now '+money(d.total)+" →</a>":'<p class="ap-small">We\'ll send you payment details on WhatsApp.</p>'):"";
      root.innerHTML='<header class="ap-co-head"><h1>Quote '+esc(d.ref)+"</h1><p>"+esc(head[1])+"</p>"+(d.validUntil&&st==="quoted"?'<p class="ap-co-tag">Valid until '+esc(d.validUntil)+"</p>":"")+"</header>"+
        steps(st==="new"?2:st==="quoted"?3:4)+
        '<div class="ap-co-grid"><div class="ap-card"><p class="ap-kicker">'+esc(head[0])+"</p>"+(d.message?'<div class="ap-q-msg">'+esc(d.message).replace(/\n/g,"<br>")+"</div>":"")+
        '<table class="ap-q-table"><tbody>'+rows+totals+"</tbody></table></div>"+
        '<aside class="ap-co-side"><div class="ap-card"><p class="ap-kicker">Next step</p><h2>'+(st==="quoted"?"Pay for your order":st==="new"?"Sit tight":"Questions?")+"</h2>"+pay+
        '<a class="ap-btn-line" target="_blank" rel="noopener" href="https://wa.me/'+WA+"?text="+encodeURIComponent(wa)+'"><span class="ap-wa-ico" aria-hidden="true"></span>WhatsApp us about this quote ↗</a></div></aside></div>';
    })
    .catch(function(e){root.innerHTML='<div class="ap-card ap-empty"><h1>Quote not found</h1><p>'+esc(e.message)+'</p><a class="ap-btn" href="/shop">Go to the shop</a></div>'});
}

var r;
if((r=$("#ap-cart-page")))cartPage(r);
if((r=$("#ap-checkout")))checkout(r);
if((r=$("#ap-quote")))quotePage(r);
})();
