/* Herramientas docentes: base común (sesión, API, lista, guardado automático, impresión). */
(function(){'use strict';var TK='aa_token',H=window.H={};
H.tok=function(){try{return localStorage.getItem(TK)||sessionStorage.getItem(TK)}catch(e){return null}};
H.esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
H.login=function(){location.replace('admin-login.html?next='+encodeURIComponent(location.pathname.split('/').pop()))};
if(!H.tok())H.login();
H.api=function(m,p,b){var h={Accept:'application/json',Authorization:'Bearer '+H.tok()};if(b!==undefined)h['Content-Type']='application/json';
 return fetch('/api'+p,{method:m,headers:h,body:b!==undefined?JSON.stringify(b):undefined}).then(function(r){
  if(r.status===401){try{localStorage.removeItem(TK);sessionStorage.removeItem(TK)}catch(e){}H.login();throw new Error('Sesión expirada')}
  return r.json().catch(function(){return null}).then(function(d){if(!r.ok)throw new Error((d&&d.error)||'Error '+r.status);return d})},function(){throw new Error('No se pudo conectar con el servidor')})};
H.toast=function(t,ok){var d=document.createElement('div');d.textContent=t;d.style.cssText='position:fixed;left:50%;transform:translateX(-50%);bottom:90px;padding:10px 18px;border-radius:12px;color:#fff;font-size:13px;z-index:99;background:'+(ok===false?'#c0392b':'#14307f');document.body.appendChild(d);setTimeout(function(){d.remove()},2600)};
H.set=function(o,p,v){var a=p.split('.');for(var i=0;i<a.length-1;i++)o=o[a[i]];o[a[a.length-1]]=v};
// Enlaza inputs con data-p="ruta.al.dato" al objeto c; llama ch(elemento) en cada cambio.
H.bind=function(box,c,ch){box.addEventListener('input',function(e){var p=e.target.dataset&&e.target.dataset.p;if(!p)return;
 var v=e.target.type==='number'?(e.target.value===''?'':+e.target.value):e.target.type==='checkbox'?e.target.checked:e.target.value;H.set(c,p,v);ch(e.target)})};
H.n=function(v){v=parseFloat(v);return isNaN(v)?0:v};
H.money=function(v){return Number(v).toLocaleString('es-DO',{minimumFractionDigits:2,maximumFractionDigits:2})};
try{document.fonts.load('22px "Material Symbols Outlined"').then(function(f){if(f.length)document.body.classList.add('fok')})}catch(e){}
// spec: {tool,title,icon,blank(),edit(box,c,ch),print(title,c),sub(c)?}
H.mount=function(sp){var cur=null,doc=null,dirty=false,timer=null,saving=false,list=[];
 document.title=sp.title+' — Aula Abierta';
 document.body.insertAdjacentHTML('afterbegin','<header class="top"><a href="herramientas.html">← Centro de Herramientas Docentes</a><h1><span class="ms">'+sp.icon+'</span> '+sp.title+'</h1></header><main><section id="L"><div class="card row" style="--c:var(--violet)"><input id="q" class="g" placeholder="Buscar…"/><button class="btn pri" id="nw"><span class="ms">add</span>Nuevo</button></div><div id="ls"></div></section><section id="E" class="hide"><div class="card" style="--c:var(--gold)"><label>Título</label><input id="ti" maxlength="200"/></div><div id="bx"></div><div class="bar"><button class="btn sec" id="bk"><span class="ms">arrow_back</span>Mis documentos</button><button class="btn pri" id="sv"><span class="ms">save</span>Guardar</button><button class="btn gold" id="pr"><span class="ms">print</span>Imprimir / PDF</button><span id="st" class="mut"></span></div></section></main><div id="S"></div>');
 var $=function(s){return document.querySelector(s)};
 function sched(){dirty=true;clearTimeout(timer);$('#st').textContent='Cambios sin guardar…';timer=setTimeout(function(){save(false)},1800)}
 function save(man){if(saving){dirty=true;return Promise.resolve()}clearTimeout(timer);saving=true;dirty=false;$('#st').textContent='Guardando…';
  var b={tool:sp.tool,title:$('#ti').value,content:doc},q=cur?H.api('PUT','/tool-docs/'+cur,b):H.api('POST','/tool-docs',b);
  return q.then(function(r){cur=r.id;$('#st').textContent='✔ Guardado';if(man)H.toast('Guardado')}).catch(function(e){dirty=true;$('#st').textContent='⚠ Sin guardar';H.toast(e.message,false)}).then(function(){saving=false;if(dirty)sched()})}
 function open(d){cur=d&&d.id||null;doc=d?d.content:sp.blank();if(!d||!Object.keys(doc).length)doc=sp.blank();$('#ti').value=d?d.title:'';var bx=document.createElement('div');$('#bx').innerHTML='';$('#bx').appendChild(bx);
  H.bind(bx,doc,sched);sp.edit(bx,doc,sched);$('#L').classList.add('hide');$('#E').classList.remove('hide');$('#st').textContent=cur?'':'Nuevo';scrollTo(0,0)}
 $('#ti').addEventListener('input',sched);
 function back(){(dirty?save(false):Promise.resolve()).then(function(){$('#E').classList.add('hide');$('#L').classList.remove('hide');load()})}
 function render(){var t=$('#q').value.toLowerCase();var l=list.filter(function(p){return!t||(p.title||'').toLowerCase().indexOf(t)>-1});
  $('#ls').innerHTML=l.length?l.map(function(p){return'<div class="card row" style="--c:var(--sky)"><div class="g"><b>'+H.esc(p.title||'Sin título')+'</b><br><span class="mut">Editado '+new Date(p.updated_at).toLocaleDateString('es-DO')+'</span></div><button class="btn sec" data-a="o" data-id="'+H.esc(p.id)+'"><span class="ms">edit</span>Abrir</button><button class="btn sec" data-a="d" data-id="'+H.esc(p.id)+'"><span class="ms">content_copy</span></button><button class="btn dng" data-a="x" data-id="'+H.esc(p.id)+'"><span class="ms">delete</span></button></div>'}).join(''):'<div class="empty"><span class="ms" style="font-size:44px;color:var(--violet)">'+sp.icon+'</span><p>'+(list.length?'Sin resultados.':'Aún no tienes documentos. ¡Crea el primero!')+'</p></div>'}
 function load(){H.api('GET','/tool-docs?tool='+sp.tool).then(function(r){list=r;render()}).catch(function(e){$('#ls').innerHTML='<div class="empty">'+H.esc(e.message)+'</div>'})}
 $('#q').oninput=render;$('#nw').onclick=function(){open(null)};$('#bk').onclick=back;$('#sv').onclick=function(){save(true)};
 $('#ls').addEventListener('click',function(e){var b=e.target.closest('[data-a]');if(!b)return;var a=b.dataset.a,id=b.dataset.id;
  if(a==='o')H.api('GET','/tool-docs/'+id).then(open).catch(function(x){H.toast(x.message,false)});
  if(a==='d')H.api('GET','/tool-docs/'+id).then(function(d){return H.api('POST','/tool-docs',{tool:sp.tool,title:'Copia de '+d.title,content:d.content})}).then(function(){H.toast('Duplicado');load()}).catch(function(x){H.toast(x.message,false)});
  if(a==='x'&&confirm('¿Eliminar este documento? No se puede deshacer.'))H.api('DELETE','/tool-docs/'+id).then(function(){H.toast('Eliminado');load()}).catch(function(x){H.toast(x.message,false)})});
 function sheet(){$('#S').innerHTML='<h1>'+H.esc($('#ti').value||sp.title)+'</h1>'+sp.print($('#ti').value,doc)}
 $('#pr').onclick=function(){sheet();window.print()};window.addEventListener('beforeprint',function(){if(doc&&!$('#E').classList.contains('hide'))sheet()});
 window.addEventListener('beforeunload',function(e){if(dirty){e.preventDefault();e.returnValue=''}});
 load();H.test={sheet:sheet,doc:function(){return doc}}};
})();
