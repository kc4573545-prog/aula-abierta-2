/* Aula Abierta — decoración ilustrada (solo presentación; no toca lógica, formularios ni datos) */
(function(){'use strict';
var SVG='<svg class="aa-deco" viewBox="0 0 150 110" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><g stroke="#f6e3a1" stroke-width="2.4"><path d="M10 92h46M12 82h42M14 72h38v10H14z"/><path d="M76 24a14 14 0 0 1 8 25v8H68v-8a14 14 0 0 1 8-25zM72 64h12"/></g><g stroke="#7cc4f5" stroke-width="2.4"><path d="M96 98l24-24 8 8-24 24-12 4zM118 76l8 8"/><path d="M26 40l22-10 22 10-22 10zM38 46v10c6 6 14 6 20 0V46"/></g><g stroke="#d9ccff" stroke-width="2.4"><circle cx="124" cy="30" r="5"/><path d="M124 18v-4M124 46v-4M112 30h-4M140 30h-4M116 22l-3-3M132 38l3 3M132 22l3-3M116 38l-3 3"/></g></svg>';
function run(){try{document.querySelectorAll('.bg-primary-container.rounded-xl').forEach(function(el){
if(el.querySelector('.aa-deco')||el.offsetHeight<90&&el.children.length<2)return;
if(getComputedStyle(el).position==='static')el.style.position='relative';
el.style.overflow='hidden';el.insertAdjacentHTML('afterbegin',SVG);});}catch(e){}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();
})();
/* Acceso al Centro de Herramientas Docentes desde las páginas del panel (botón flotante). */
(function(){try{
var pg=(location.pathname.split('/').pop()||'').replace(/\.html$/,'');
if(['panel','gestion','editor','biblioteca','moderacion','perfil'].indexOf(pg)<0)return;
document.addEventListener('DOMContentLoaded',function(){
var a=document.createElement('a');a.href='herramientas.html';a.title='Centro de Herramientas Docentes';a.setAttribute('aria-label','Centro de Herramientas Docentes');
a.innerHTML='<span class="material-symbols-outlined" style="font-size:20px">construction</span>';
a.style.cssText='position:fixed;left:12px;bottom:176px;width:40px;height:40px;border-radius:9999px;background:#d4a62a;color:#0b1f5c;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.2);z-index:60;text-decoration:none';
document.body.appendChild(a);});}catch(e){}})();
