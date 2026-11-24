/*LOGIC*/
const ACC_TYPES={savings:'Cuenta de ahorros',checking:'Cuenta corriente',debit:'Tarjeta débito',credit:'Tarjeta de crédito',nequi:'Nequi',daviplata:'Daviplata',cash:'Efectivo',wallet:'Otra billetera digital',other:'Otra entidad financiera'};
const METHOD_BY_TYPE={savings:'Cuenta bancaria',checking:'Cuenta bancaria',debit:'Tarjeta débito',credit:'Tarjeta de crédito',nequi:'Nequi',daviplata:'Daviplata',cash:'Efectivo',wallet:'Billetera digital',other:'Otro'};
const METHODS=['Efectivo','Tarjeta débito','Tarjeta de crédito','Cuenta bancaria','Nequi','Daviplata','Billetera digital','Otro'];
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
function ymd(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function pd(s){const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)}
function range(p,off,now=new Date()){
  let s,e;const n=now;
  if(p==='day'){s=new Date(n.getFullYear(),n.getMonth(),n.getDate()+off);e=s}
  else if(p==='week'){const dow=(n.getDay()+6)%7;s=new Date(n.getFullYear(),n.getMonth(),n.getDate()-dow+7*off);e=new Date(s.getFullYear(),s.getMonth(),s.getDate()+6)}
  else{const len={month:1,quarter:3,semester:6,year:12}[p];let base=p==='month'?n.getMonth():p==='quarter'?Math.floor(n.getMonth()/3)*3:p==='semester'?Math.floor(n.getMonth()/6)*6:0;
    s=new Date(n.getFullYear(),base+len*off,1);e=new Date(s.getFullYear(),s.getMonth()+len,0)}
  return [ymd(s),ymd(e)]}
const num=s=>parseInt(String(s==null?'':s).replace(/\D/g,''),10)||0;
function effId(DB,id){const a=DB.accounts.find(x=>x.id===id);return a&&a.type==='debit'&&a.linkedId&&DB.accounts.some(x=>x.id===a.linkedId)?a.linkedId:id}
const isLinkedDebit=(DB,a)=>a.type==='debit'&&effId(DB,a.id)!==a.id;
function balances(DB,upTo){
  const m={};DB.accounts.forEach(a=>m[a.id]=a.type==='credit'?-(a.initial||0):(a.initial||0));
  for(const t of DB.tx){
    if(upTo&&t.date>upTo)continue;
    const f=effId(DB,t.accountId),g=t.toAccountId?effId(DB,t.toAccountId):null;
    if(t.type==='gasto'){if(f in m)m[f]-=t.amount}
    else if(t.type==='ingreso'){if(f in m)m[f]+=t.amount}
    else if(t.type==='transferencia'){if(f in m)m[f]-=t.amount;if(g&&g in m)m[g]+=t.amount}
  }
  DB.accounts.forEach(a=>{if(isLinkedDebit(DB,a))m[a.id]=m[a.linkedId]});
  return m}
const dPaid=d=>(d.payments||[]).reduce((s,p)=>s+p.amount,0)+(d.prepaid||0);
const dPending=d=>Math.max(0,d.initial-dPaid(d));
function dStatus(d,today){const p=dPending(d);if(p===0)return d.kind==='debo'?'PAGADA':'COBRADO';return d.due&&d.due<today?'VENCIDA':'ACTIVA'}
function tot(DB,type,s,e,fn){let r=0;for(const t of DB.tx){if(t.type===type&&t.date>=s&&t.date<=e&&(!fn||fn(t)))r+=t.amount}return r}
const KW_G={'Alimentación':'almuerzo|cena|desayuno|comida|restaurante|domicilio|cafe|pizza|hamburguesa|empanada','Mercado':'mercado|supermercado|exito|jumbo|olimpica|tienda|plaza','Transporte':'gasolina|taxi|uber|bus|metro|transmilenio|peaje|parqueadero|didi|combustible|sitp|pasaje','Vivienda':'arriendo|alquiler|administracion','Servicios públicos':'luz|agua|gas natural|internet|energia|acueducto|plan de datos|recarga','Salud':'medico|droguer|medicina|farmacia|odontolog|eps|examen|cita medica','Educación':'colegio|universidad|matricula|curso|libro|pension','Entretenimiento':'cine|concierto|fiesta|bar|juego|salida|trago|cerveza','Ropa y calzado':'zapato|ropa|camisa|pantalon|tenis|vestido|chaqueta','Tecnología':'computador|portatil|audifonos|tecnologia|cargador|teclado','Suscripciones':'netflix|spotify|suscripcion|disney|prime|youtube|icloud','Deudas':'deuda|prestamo|abono|cuota','Ahorros':'ahorro|ahorre','Inversiones':'inversion|cdt|acciones'};
const KW_I={'Salario':'salario|nomina|sueldo','Bonificaciones':'bonificacion|prima|bono','Horas extras':'horas extra|hora extra','Comisiones':'comision','Negocios':'negocio|venta|vendi','Préstamos recibidos':'prestamo'};
function parseText(text,DB,now=new Date()){
  const raw=String(text||'').trim();const low=norm(raw);
  const work=low.replace(/terminad[ao]s? en \d{4}/g,' ').replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g,' ');
  let amount=0;const m=work.match(/(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)\s*(millones|millon|mil|k)?(?![a-z0-9])/);
  if(m){const mult=m[2]?(/mill/.test(m[2])?1e6:1e3):1;let v;
    if(/^\d{1,3}([.,]\d{3})+$/.test(m[1])&&!m[2])v=parseInt(m[1].replace(/[.,]/g,''),10);else v=parseFloat(m[1].replace(',','.'))*mult;amount=Math.round(v)}
  let date=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  if(/anteayer|antier/.test(low))date.setDate(date.getDate()-2);else if(/\bayer\b/.test(low))date.setDate(date.getDate()-1);
  else{const dm=low.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);if(dm){let y=dm[3]?+dm[3]:now.getFullYear();if(y<100)y+=2000;const c=new Date(y,+dm[2]-1,+dm[1]);if(!isNaN(c))date=c}}
  const type=/\b(recibi|recibido|ingreso|ingrese|me pagaron|me consignaron|salario|nomina|me depositaron|cobre)\b/.test(low)?'ingreso':'gasto';
  let best=null,bs=0;
  for(const a of DB.accounts.filter(x=>x.active!==false)){let sc=0;
    if(a.name&&low.includes(norm(a.name)))sc+=3;if(a.bank&&low.includes(norm(a.bank)))sc+=2;
    if(a.last4&&low.includes(a.last4))sc+=3;
    if(/debito/.test(low)&&a.type==='debit')sc+=2;if(/credito/.test(low)&&a.type==='credit')sc+=2;
    if(/nequi/.test(low)&&a.type==='nequi')sc+=3;if(/daviplata/.test(low)&&a.type==='daviplata')sc+=3;if(/efectivo/.test(low)&&a.type==='cash')sc+=3;
    if(sc>bs){bs=sc;best=a}}
  const cats=DB.categories.filter(c=>c.type===type),map=type==='gasto'?KW_G:KW_I;let cat=null;
  for(const [n,k] of Object.entries(map)){if(new RegExp('\\b('+k+')').test(low)){cat=cats.find(c=>c.name===n);if(cat)break}}
  if(!cat)cat=cats.find(c=>low.includes(norm(c.name)))||cats.find(c=>c.name===(type==='gasto'?'Otros':'Otros ingresos'));
  const desc=raw.charAt(0).toUpperCase()+raw.slice(1,80);
  return {type,amount,date:ymd(date),desc,accountId:best?best.id:'',categoryId:cat?cat.id:'',method:best?METHOD_BY_TYPE[best.type]:''}}
function validateBackup(d){
  const er=[];const A=x=>Array.isArray(x);
  if(!d||typeof d!=='object')return {errors:['El archivo no contiene datos válidos.']};
  for(const k of ['accounts','categories','tx','debts'])if(!A(d[k]))er.push('Falta la lista "'+k+'".');
  if(er.length)return {errors:er};
  const ids=new Set(d.accounts.map(a=>a&&a.id));
  d.accounts.forEach((a,i)=>{if(!a||typeof a.id!=='string'||!a.name||!ACC_TYPES[a.type]||typeof a.initial!=='number')er.push('Cuenta '+(i+1)+' inválida.')});
  d.categories.forEach((c,i)=>{if(!c||typeof c.id!=='string'||!c.name||!['gasto','ingreso'].includes(c.type))er.push('Categoría '+(i+1)+' inválida.')});
  d.tx.forEach((t,i)=>{if(!t||typeof t.id!=='string'||!['gasto','ingreso','transferencia'].includes(t.type)||!/^\d{4}-\d{2}-\d{2}$/.test(t.date||'')||!(t.amount>0)||!isFinite(t.amount))er.push('Movimiento '+(i+1)+' inválido.');
    else if(!ids.has(t.accountId)||(t.type==='transferencia'&&!ids.has(t.toAccountId)))er.push('Movimiento '+(i+1)+' usa una cuenta inexistente.')});
  d.debts.forEach((x,i)=>{if(!x||typeof x.id!=='string'||!['debo','medeben'].includes(x.kind)||!(x.initial>=0)||!Array.isArray(x.payments||[]))er.push('Deuda '+(i+1)+' inválida.')});
  return {errors:er.slice(0,10),total:er.length}}
const sig=t=>[t.type,t.date,t.amount,norm(t.desc),t.accountId,t.toAccountId||''].join('|');
function mergeBackup(DB,B){
  const r={accounts:0,categories:0,tx:0,debts:0,recurring:0,dupTx:0};
  const have=(list,id)=>list.some(x=>x.id===id);
  for(const a of B.accounts)if(!have(DB.accounts,a.id)){DB.accounts.push(a);r.accounts++}
  for(const c of B.categories)if(!have(DB.categories,c.id)&&!DB.categories.some(x=>x.type===c.type&&norm(x.name)===norm(c.name))){DB.categories.push(c);r.categories++}
  const sigs=new Set(DB.tx.map(sig));
  for(const t of B.tx){if(have(DB.tx,t.id)||sigs.has(sig(t))){r.dupTx++;continue}
    if(!DB.categories.some(c=>c.id===t.categoryId)&&t.type!=='transferencia'){const same=B.categories.find(c=>c.id===t.categoryId);const eq=same&&DB.categories.find(c=>c.type===same.type&&norm(c.name)===norm(same.name));t.categoryId=eq?eq.id:''}
    DB.tx.push(t);sigs.add(sig(t));r.tx++}
  for(const d of B.debts)if(!have(DB.debts,d.id)){DB.debts.push(d);r.debts++}
  for(const x of (B.recurring||[]))if(!have(DB.recurring,x.id)){DB.recurring.push(x);r.recurring++}
  return r}
function nextDue(day,now=new Date()){if(!day)return null;const y=now.getFullYear(),m=now.getMonth();const last=mo=>new Date(y,mo+1,0).getDate();
  let d=new Date(y,m,Math.min(day,last(m)));if(ymd(d)<ymd(now))d=new Date(y,m+1,Math.min(day,new Date(y,m+2,0).getDate()));return ymd(d)}
/*ENDLOGIC*/

/* ========= Estado, almacenamiento y cifrado ========= */
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2));
const today=()=>ymd(new Date());
const enc=new TextEncoder(),dec=new TextDecoder();
let DB=null,KEY=null,SALT=null,KIND='pin4',UI={period:'month',off:0,f:{q:'',type:'',cat:'',acc:'',from:'',to:''},debtOpen:null},lockT=null;
const catDefs=()=>{const g=[['Alimentación','🍽️','#f97316'],['Mercado','🛒','#84cc16'],['Transporte','🚌','#3b82f6'],['Vivienda','🏠','#8b5cf6'],['Servicios públicos','💡','#eab308'],['Salud','💊','#ef4444'],['Educación','🎓','#06b6d4'],['Entretenimiento','🎬','#ec4899'],['Ropa y calzado','👟','#a855f7'],['Tecnología','💻','#64748b'],['Suscripciones','📺','#14b8a6'],['Deudas','🧾','#b91c1c'],['Tarjetas de crédito','💳','#0ea5e9'],['Ahorros','🐷','#22c55e'],['Inversiones','📈','#16a34a'],['Otros','📦','#94a3b8']];
  const i=[['Salario','💼','#059669'],['Bonificaciones','🎁','#10b981'],['Horas extras','⏱️','#34d399'],['Comisiones','🤝','#0d9488'],['Ingresos adicionales','➕','#2dd4bf'],['Negocios','🏪','#65a30d'],['Préstamos recibidos','🏦','#0891b2'],['Otros ingresos','📦','#94a3b8']];
  const sys=['Otros','Otros ingresos','Deudas'];
  return g.map(x=>({id:uid(),type:'gasto',name:x[0],icon:x[1],color:x[2],subs:[],sys:sys.includes(x[0])})).concat(i.map(x=>({id:uid(),type:'ingreso',name:x[0],icon:x[1],color:x[2],subs:[],sys:sys.includes(x[0])})))};
const defaultDB=()=>({v:1,settings:{appName:'Mis gastos',theme:'light',color:'#0f766e',lockMin:5,currency:'COP',dateFmt:'dd/mm/yyyy',logo:null,lastBackup:null,backupDays:14,debtCats:['Préstamos personales','Tarjetas de crédito','Bancos','Compras financiadas','Familiares','Otros']},accounts:[],categories:catDefs(),tx:[],debts:[],recurring:[],audit:[]});
const S=()=>DB?DB.settings:{currency:'COP',dateFmt:'dd/mm/yyyy'};
const fmt=n=>new Intl.NumberFormat('es-CO',{style:'currency',currency:S().currency||'COP',maximumFractionDigits:0}).format(Math.round(n||0));
const compact=n=>new Intl.NumberFormat('es-CO',{notation:'compact',maximumFractionDigits:1}).format(n||0);
const MES=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
function fd(s){if(!s)return '—';const [y,m,d]=s.split('-');const f=S().dateFmt;return f==='mm/dd/yyyy'?`${m}/${d}/${y}`:f==='yyyy-mm-dd'?s:f==='d MMM yyyy'?`${+d} ${MES[m-1]} ${y}`:`${d}/${m}/${y}`}

const IDB={open(){return new Promise((res,rej)=>{const r=indexedDB.open('misgastos',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})},
  async get(k){const d=await this.open();return new Promise((res,rej)=>{const q=d.transaction('kv').objectStore('kv').get(k);q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)})},
  async set(k,v){const d=await this.open();return new Promise((res,rej)=>{const q=d.transaction('kv','readwrite').objectStore('kv').put(v,k);q.onsuccess=()=>res();q.onerror=()=>rej(q.error)})},
  async del(k){const d=await this.open();return new Promise((res,rej)=>{const q=d.transaction('kv','readwrite').objectStore('kv').delete(k);q.onsuccess=()=>res();q.onerror=()=>rej(q.error)})}};
async function deriveKey(secret,salt){const base=await crypto.subtle.importKey('raw',enc.encode(secret),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:250000,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}
const toB64=buf=>{let s='';const u=new Uint8Array(buf);for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));return btoa(s)};
const fromB64=b=>Uint8Array.from(atob(b),c=>c.charCodeAt(0));
let saveChain=Promise.resolve();
function save(){saveChain=saveChain.then(async()=>{if(!DB||!KEY)return;const iv=crypto.getRandomValues(new Uint8Array(12));const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},KEY,enc.encode(JSON.stringify(DB)));await IDB.set('vault',{salt:SALT,iv,ct,kind:KIND})}).catch(e=>toast('No se pudo guardar: '+e.message,true));return saveChain}
function log(action,entity,summary){DB.audit.unshift({ts:new Date().toISOString(),action,entity,summary});if(DB.audit.length>500)DB.audit.length=500}
async function commit(){await save();render()}
function toast(msg,bad){const t=document.createElement('div');t.style.cssText='position:fixed;bottom:18px;left:50%;transform:translateX(-50%);padding:.6rem 1rem;border-radius:10px;color:#fff;z-index:99;background:'+(bad?'#dc2626':'#0f172a');t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),3500)}

/* ========= Apariencia ========= */
function applyUI(){const u=(()=>{try{return JSON.parse(localStorage.getItem('mg_ui')||'{}')}catch(e){return{}}})();
  const s=DB?DB.settings:u;if(DB)try{localStorage.setItem('mg_ui',JSON.stringify({appName:s.appName,theme:s.theme,color:s.color,logo:s.logo}))}catch(e){}
  document.documentElement.dataset.theme=s.theme||'light';document.documentElement.style.setProperty('--primary',s.color||'#0f766e');document.title=s.appName||'Mis gastos'}
const uiPrefs=()=>{try{return JSON.parse(localStorage.getItem('mg_ui')||'{}')}catch(e){return{}}};
const DEFAULT_LOGO="logo.png";
function brandHtml(s){return `<div class="brand welcome">${s.logo?`<img src="${s.logo}" alt="Logo">`:`<img class="dl" src="${DEFAULT_LOGO}" alt="Logo">`}<span>${esc(s.appName||'Mis gastos')}</span></div>`}
async function imgToDataUrl(file,max,q){return new Promise((res,rej)=>{const r=new FileReader();r.onerror=()=>rej(new Error('No se pudo leer la imagen'));r.onload=()=>{const im=new Image();im.onerror=()=>rej(new Error('Imagen no válida'));im.onload=()=>{const k=Math.min(1,max/Math.max(im.width,im.height));const c=document.createElement('canvas');c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);c.getContext('2d').drawImage(im,0,0,c.width,c.height);res(c.toDataURL('image/jpeg',q))};im.src=r.result};r.readAsDataURL(file)})}

/* ========= Acceso: configuración, desbloqueo, bloqueo ========= */
async function boot(){applyUI();let v;try{v=await IDB.get('vault')}catch(e){$('#app').innerHTML='<div class="lock"><div class="card"><h3>Almacenamiento no disponible</h3><p class="muted">Este navegador no permite guardar datos (modo privado o bloqueado). Ábrelo en una ventana normal.</p></div></div>';return}
  if(!v)lockScreen('setup');else{KIND=v.kind||'pin4';lockScreen('locked')}}
function secretField(kind){return kind==='pass'?`<input name="s" type="password" autocomplete="off" placeholder="Contraseña" minlength="6" required>`:`<input name="s" type="password" inputmode="numeric" autocomplete="off" maxlength="${kind==='pin6'?6:4}" placeholder="${'•'.repeat(kind==='pin6'?6:4)}" required>`}
function lockScreen(mode){const u=uiPrefs();DB=null;KEY=null;clearTimeout(lockT);document.removeEventListener('mousemove',resetLock);
  if(mode==='setup'){$('#app').innerHTML=`<div class="lock"><form class="card" id="setup">${brandHtml(u)}<h3>Crea tu acceso</h3><p class="muted small">Tus datos se guardan cifrados solo en este dispositivo. Si olvidas el acceso no hay forma de recuperarlos: usa copias de seguridad.</p>
    <div class="seg"><label><input type="radio" name="k" value="pin4" checked><span>PIN 4</span></label><label><input type="radio" name="k" value="pin6"><span>PIN 6</span></label><label><input type="radio" name="k" value="pass"><span>Clave</span></label></div>
    <div id="sf">${secretField('pin4')}</div><br><input name="c" type="password" autocomplete="off" placeholder="Repite el acceso" required><div class="err" hidden></div><br><button class="btn" style="width:100%">Crear y entrar</button>
    <p class="muted small">Recomendado: PIN de 6 dígitos o clave. Un PIN de 4 dígitos es práctico, pero más fácil de adivinar si alguien copia el archivo de datos.</p></form></div>`;
    const f=$('#setup');f.onchange=e=>{if(e.target.name==='k'){$('#sf').innerHTML=secretField(e.target.value);f.c.maxLength=e.target.value==='pin4'?4:e.target.value==='pin6'?6:64;f.c.inputMode=e.target.value==='pass'?'text':'numeric'}};
    f.onsubmit=async e=>{e.preventDefault();const k=f.k.value,s=f.s.value,box=f.querySelector('.err');const bad=m=>{box.textContent=m;box.hidden=false};
      if(k==='pin4'&&!/^\d{4}$/.test(s))return bad('El PIN debe tener 4 dígitos.');if(k==='pin6'&&!/^\d{6}$/.test(s))return bad('El PIN debe tener 6 dígitos.');if(k==='pass'&&s.length<6)return bad('La clave debe tener al menos 6 caracteres.');
      if(s!==f.c.value)return bad('Los dos valores no coinciden.');
      SALT=crypto.getRandomValues(new Uint8Array(16));KEY=await deriveKey(s,SALT);KIND=k;DB=defaultDB();await save();enter()};return}
  $('#app').innerHTML=`<div class="lock"><form class="card" id="lk">${brandHtml(u)}<p class="muted">Ingresa tu ${KIND==='pass'?'clave':'PIN'}</p>${secretField(KIND)}<div class="err" hidden></div><br><button class="btn" style="width:100%">Entrar</button><p><a href="#" data-act="forgot" class="muted small">Olvidé mi acceso</a></p></form></div>`;
  const f=$('#lk');f.s.focus();const go=async()=>{const box=f.querySelector('.err');const fl=JSON.parse(localStorage.getItem('mg_fail')||'{"n":0,"until":0}');
    if(Date.now()<fl.until){box.textContent='Demasiados intentos. Espera '+Math.ceil((fl.until-Date.now())/1000)+' s.';box.hidden=false;return}
    const ok=await tryUnlock(f.s.value);if(ok){localStorage.removeItem('mg_fail');enter()}else{fl.n++;if(fl.n>=5)fl.until=Date.now()+30000*Math.pow(2,fl.n-5);localStorage.setItem('mg_fail',JSON.stringify(fl));box.textContent='Acceso incorrecto.';box.hidden=false;f.s.value=''}};
  f.onsubmit=e=>{e.preventDefault();go()};if(KIND!=='pass')f.s.oninput=()=>{if(f.s.value.length===(KIND==='pin6'?6:4))go()}}
async function tryUnlock(secret){try{const v=await IDB.get('vault');const k=await deriveKey(secret,v.salt);const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:v.iv},k,v.ct);DB=JSON.parse(dec.decode(pt));KEY=k;SALT=v.salt;KIND=v.kind||'pin4';return true}catch(e){return false}}
function normalizeDB(){const d=defaultDB();for(const k of Object.keys(d))if(DB[k]==null)DB[k]=d[k];DB.settings=Object.assign(d.settings,DB.settings)}
async function enter(){normalizeDB();applyUI();applyRecurring();await save();resetLock();if(!window._lk){window._lk=1;['mousemove','keydown','touchstart','click'].forEach(ev=>document.addEventListener(ev,resetLock,{passive:true}))}if(!location.hash)location.hash='#/inicio';render()}
function resetLock(){clearTimeout(lockT);if(!DB)return;const m=DB.settings.lockMin;if(m>0)lockT=setTimeout(()=>lockNow(),m*60000)}
function lockNow(){document.querySelectorAll('.ov').forEach(o=>o.remove());lockScreen('locked')}

/* ========= Ingresos recurrentes ========= */
function applyRecurring(){let n=0;const now=new Date(),td=ymd(now);
  for(const r of DB.recurring){if(!r.active)continue;let d=pd(r.start);d=new Date(d.getFullYear(),d.getMonth(),1);
    while(ymd(d)<=td){const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();const dt=new Date(d.getFullYear(),d.getMonth(),Math.min(r.day,last)),ds=ymd(dt);
      const key=r.id+'-'+ds.slice(0,7);
      if(ds<=td&&ds>=r.start&&!DB.tx.some(t=>t.recKey===key)&&DB.accounts.some(a=>a.id===r.accountId)){DB.tx.push({id:uid(),type:'ingreso',date:ds,amount:r.amount,desc:r.desc,categoryId:r.categoryId,sub:'',accountId:r.accountId,method:'',notes:'Ingreso recurrente',recKey:key,createdAt:Date.now()});n++}
      d=new Date(d.getFullYear(),d.getMonth()+1,1)}}
  if(n)log('crear','ingreso recurrente',n+' ingreso(s) recurrente(s) generado(s)')}

/* ========= Helpers de UI ========= */
const catOf=id=>DB.categories.find(c=>c.id===id);
const accOf=id=>DB.accounts.find(a=>a.id===id);
const label=a=>a?`${a.name}${a.bank&&a.bank!==a.name?' · '+a.bank:''}${a.last4?' ···'+a.last4:''}`:'—';
const opts=(arr,sel,blank)=>(blank!=null?`<option value="">${esc(blank)}</option>`:'')+arr.map(([v,t])=>`<option value="${esc(v)}" ${v===sel?'selected':''}>${esc(t)}</option>`).join('');
function acctOpts(sel,keepId,blank){const l=DB.accounts.filter(a=>a.active!==false||a.id===keepId||a.id===sel).map(a=>[a.id,label(a)+(a.type==='credit'?' (crédito)':'')]);return opts(l,sel,blank)}
function modal(title,body,onSave,o={}){const ov=document.createElement('div');ov.className='ov';
  ov.innerHTML=`<form class="modal ${o.wide?'wide':''}" novalidate><h3>${esc(title)}</h3><div class="mb">${body}</div><div class="err" hidden></div><div class="mf"><button type="button" class="btn ghost" data-x>${o.noSave?'Cerrar':'Cancelar'}</button>${o.noSave?'':`<button class="btn">${o.save||'Guardar'}</button>`}</div></form>`;
  document.body.appendChild(ov);const f=ov.firstChild,close=()=>ov.remove(),box=f.querySelector('.err');
  f.querySelector('[data-x]').onclick=close;
  f.onsubmit=async e=>{e.preventDefault();box.hidden=true;try{const r=await onSave(new FormData(f),f);if(typeof r==='string'){box.textContent=r;box.hidden=false}else if(r!==false)close()}catch(x){box.textContent=x.message;box.hidden=false}};
  return {el:f,close}}
const ACT={},CHG={};
document.addEventListener('click',e=>{const el=e.target.closest('[data-act]');if(!el)return;const f=ACT[el.dataset.act];if(f){e.preventDefault();f(el.dataset.id,el)}});
document.addEventListener('change',e=>{const el=e.target.closest('[data-chg]');if(el&&CHG[el.dataset.chg])CHG[el.dataset.chg](el,e)});
document.addEventListener('input',e=>{const t=e.target;if(t.matches&&t.matches('[data-money]')){const d=t.value.replace(/\D/g,'');t.value=d?new Intl.NumberFormat('es-CO').format(+d):''}
  if(t.matches&&t.matches('[data-flt]')){UI.f[t.dataset.flt]=t.value;const b=$('#txbody');if(b)b.innerHTML=txRows()}});
const money=v=>v?new Intl.NumberFormat('es-CO').format(v):'';

/* ========= Charts ========= */
const PAL=['#0f766e','#f97316','#3b82f6','#a855f7','#eab308','#ef4444','#06b6d4','#ec4899','#84cc16','#64748b'];
function group(items,max=7){items=items.filter(i=>i.value>0).sort((a,b)=>b.value-a.value);if(items.length>max){const rest=items.slice(max-1).reduce((s,i)=>s+i.value,0);items=items.slice(0,max-1).concat([{label:'Otras',value:rest,color:'#94a3b8'}])}return items}
function donut(items){items=group(items);const total=items.reduce((s,i)=>s+i.value,0);if(!total)return '<p class="muted">Sin datos en este periodo.</p>';let off=25;
  const segs=items.map(i=>{const p=i.value/total*100;const s=`<circle r="15.9155" cx="21" cy="21" fill="none" stroke="${i.color}" stroke-width="6" stroke-dasharray="${p} ${100-p}" stroke-dashoffset="${off}"><title>${esc(i.label)}: ${fmt(i.value)} (${p.toFixed(1)}%)</title></circle>`;off-=p;return s}).join('');
  return `<div class="donut"><svg viewBox="0 0 42 42">${segs}<text x="21" y="22.5" text-anchor="middle" class="dt">${compact(total)}</text></svg><ul class="legend">${items.map(i=>`<li><span class="dot" style="background:${i.color}"></span>${esc(i.label)}<b>${(i.value/total*100).toFixed(0)}%</b></li>`).join('')}</ul></div>`}
function hbars(items,max=8){items=items.filter(i=>i.value>0).sort((a,b)=>b.value-a.value).slice(0,max);if(!items.length)return '<p class="muted">Sin datos en este periodo.</p>';const m=items[0].value;
  return items.map(i=>`<div class="hb"><span>${esc(i.label)}</span><div class="bar"><i style="width:${i.value/m*100}%;background:${i.color||'var(--primary)'}"></i></div><b>${fmt(i.value)}</b></div>`).join('')}
function gbars(ms){const mx=Math.max(1,...ms.flatMap(m=>[m.a,m.b])),W=600,H=190,bw=W/ms.length;
  return `<svg class="ch" viewBox="0 0 ${W} ${H+20}">${ms.map((m,i)=>{const x=i*bw+bw*.12,w=bw*.34,ha=m.a/mx*H,hb=m.b/mx*H;
    return `<rect x="${x}" y="${H-ha}" width="${w}" height="${ha}" rx="3" fill="#059669"><title>${m.label} · Ingresos ${fmt(m.a)}</title></rect><rect x="${x+w+2}" y="${H-hb}" width="${w}" height="${hb}" rx="3" fill="#dc2626"><title>${m.label} · Gastos ${fmt(m.b)}</title></rect><text x="${i*bw+bw/2}" y="${H+13}" text-anchor="middle">${m.label}</text>`}).join('')}</svg><div class="small muted"><span class="pos">■</span> Ingresos &nbsp; <span class="neg">■</span> Gastos</div>`}
function line(ps){if(!ps.length)return '';const W=600,H=170,vs=ps.map(p=>p.v),mn=Math.min(0,...vs),mx=Math.max(1,...vs),sx=i=>20+i*(W-40)/Math.max(1,ps.length-1),sy=v=>H-(v-mn)/(mx-mn||1)*(H-10)-2;
  const pts=ps.map((p,i)=>`${sx(i)},${sy(p.v)}`).join(' ');
  return `<svg class="ch" viewBox="0 0 ${W} ${H+20}"><line x1="20" x2="${W-20}" y1="${sy(0)}" y2="${sy(0)}" stroke="var(--border)"/><polygon points="${sx(0)},${sy(0)} ${pts} ${sx(ps.length-1)},${sy(0)}" fill="var(--primary)" opacity=".12"/><polyline points="${pts}" fill="none" stroke="var(--primary)" stroke-width="2.5"/>${ps.map((p,i)=>`<circle cx="${sx(i)}" cy="${sy(p.v)}" r="3.5" fill="var(--primary)"><title>${p.label}: ${fmt(p.v)}</title></circle><text x="${sx(i)}" y="${H+14}" text-anchor="middle">${p.label}</text>`).join('')}</svg>`}

/* ========= Shell y navegación ========= */
const NAV=[['inicio','🏠','Inicio'],['movimientos','🧾','Movimientos'],['registrar','➕','Registrar'],['ingresos','💰','Ingresos'],['cuentas','💳','Cuentas y tarjetas'],['categorias','🏷️','Categorías'],['deudas','📉','Deudas'],['cobrar','📈','Dinero por cobrar'],['copias','🗄️','Copias de seguridad'],['config','⚙️','Configuración']];
const PAGES={};
function render(){if(!DB)return;const r=(location.hash.replace(/^#\/?/,'')||'inicio').split('?')[0];const key=PAGES[r]?r:'inicio';let html;
  try{html=PAGES[key]()}catch(e){html=`<div class="card"><h3>Ocurrió un error</h3><p class="muted">${esc(e.message)}</p></div>`;console.error(e)}
  const sc=window.scrollY;
  $('#app').innerHTML=`<div class="layout"><nav class="side" id="side">${brandHtml(DB.settings)}${NAV.map(n=>`<a href="#/${n[0]}" class="${n[0]===key?'on':''}">${n[1]} ${n[2]}</a>`).join('')}<hr style="border:0;border-top:1px solid var(--border);margin:.8rem 0"><a href="#" data-act="lock">🔒 Bloquear</a><p class="muted small" style="padding:0 .7rem">Próximas fases: simulador de crédito, salud financiera, asistente IA, OCR/voz y reportes PDF.</p></nav>
  <main class="main"><div class="top"><button class="btn ghost" data-act="nav">☰</button><b>${esc(DB.settings.appName)}</b></div>${html}</main></div>`;window.scrollTo(0,sc)}
window.addEventListener('hashchange',()=>{if(DB)render()});
ACT.nav=()=>$('#side').classList.toggle('open');
ACT.lock=()=>lockNow();
ACT.forgot=async()=>{if(!confirm('Tus datos están cifrados con tu acceso y no pueden recuperarse sin él.\n\nSi continúas se borrarán TODOS los datos de este dispositivo y podrás crear un acceso nuevo; después puedes restaurar una copia de seguridad en Copias de seguridad.\n\n¿Borrar y empezar de nuevo?'))return;await IDB.del('vault');lockScreen('setup')};
const head=(t,extra='')=>`<div class="row between" style="margin-bottom:.8rem"><h2>${t}</h2><div class="row">${extra}</div></div>`;

/* ========= Inicio ========= */
const PERIODS=[['day','Día'],['week','Semana'],['month','Mes'],['quarter','Trimestre'],['semester','Semestre'],['year','Año']];
ACT.per=id=>{UI.period=id;UI.off=0;render()};ACT.perOff=id=>{UI.off+=+id;render()};
function netWorthPoints(){const out=[];const n=new Date();for(let i=11;i>=0;i--){const e=new Date(n.getFullYear(),n.getMonth()-i+1,0);const end=i===0?today():ymd(e);const B=balances(DB,end);let v=0;DB.accounts.forEach(a=>{if(a.active!==false&&!isLinkedDebit(DB,a))v+=B[a.id]});out.push({label:MES[e.getMonth()],v})}return out}
PAGES.inicio=()=>{
  const [s,e]=range(UI.period,UI.off),[ps,pe]=range(UI.period,UI.off-1),B=balances(DB),td=today();
  const act=DB.accounts.filter(a=>a.active!==false&&!isLinkedDebit(DB,a));
  const liquid=act.filter(a=>a.type!=='credit').reduce((x,a)=>x+B[a.id],0),used=act.filter(a=>a.type==='credit').reduce((x,a)=>x-B[a.id],0);
  const savings=act.filter(a=>a.type==='savings').reduce((x,a)=>x+B[a.id],0);
  const inc=tot(DB,'ingreso',s,e),exp=tot(DB,'gasto',s,e),pexp=tot(DB,'gasto',ps,pe);
  const owe=DB.debts.filter(d=>d.kind==='debo').reduce((x,d)=>x+dPending(d),0),due=DB.debts.filter(d=>d.kind==='medeben').reduce((x,d)=>x+dPending(d),0);
  const lim=ymd(new Date(Date.now()+30*864e5));const pend=DB.debts.filter(d=>d.kind==='debo'&&dPending(d)>0&&d.due&&d.due<=lim).reduce((x,d)=>x+dPending(d),0);
  const cmp=pexp>0?((exp-pexp)/pexp*100):null;
  const alerts=[];
  const bd=DB.settings.backupDays;if(bd>0){const last=DB.settings.lastBackup;const days=last?Math.floor((Date.now()-new Date(last))/864e5):null;if(days===null||days>=bd)alerts.push(`<div class="alert">🗄️ ${days===null?'Aún no has hecho una copia de seguridad.':'Tu última copia fue hace '+days+' días.'} <a href="#/copias">Hacer copia ahora</a></div>`)}
  DB.debts.filter(d=>d.kind==='debo'&&dPending(d)>0&&d.due&&d.due<td).forEach(d=>alerts.push(`<div class="alert bad">⚠️ Deuda vencida: ${esc(d.party)} · ${fmt(dPending(d))} (venció ${fd(d.due)})</div>`));
  act.filter(a=>a.type==='credit'&&B[a.id]<0&&a.dueDay).forEach(a=>{const nd=nextDue(a.dueDay),dd=Math.round((pd(nd)-pd(td))/864e5);if(dd<=7)alerts.push(`<div class="alert">💳 ${esc(label(a))}: pago límite ${dd===0?'hoy':'en '+dd+' día(s)'} · saldo utilizado ${fmt(-B[a.id])}</div>`)});
  const catSum=type=>{const m={};DB.tx.forEach(t=>{if(t.type===type&&t.date>=s&&t.date<=e)m[t.categoryId||'_']=(m[t.categoryId||'_']||0)+t.amount});return Object.entries(m).map(([id,v])=>{const c=catOf(id);return {label:c?c.name:'Sin categoría',value:v,color:c?c.color:'#94a3b8'}})};
  const byMethod={};DB.tx.forEach(t=>{if(t.type==='gasto'&&t.date>=s&&t.date<=e){const k=t.method||'Sin especificar';byMethod[k]=(byMethod[k]||0)+t.amount}});
  const ms=[];const n=new Date();for(let i=5;i>=0;i--){const a=new Date(n.getFullYear(),n.getMonth()-i,1),b=ymd(new Date(a.getFullYear(),a.getMonth()+1,0)),st=ymd(a);ms.push({label:MES[a.getMonth()],a:tot(DB,'ingreso',st,b),b:tot(DB,'gasto',st,b)})}
  const dist=act.filter(a=>a.type!=='credit'&&B[a.id]>0).map((a,i)=>({label:a.name,value:B[a.id],color:a.color||PAL[i%PAL.length]}));
  const kpi=(l,v,sub,cls='')=>`<div class="card kpi"><div class="l">${l}</div><div class="v ${cls}">${v}</div><div class="s">${sub||'&nbsp;'}</div></div>`;
  const empty=!DB.accounts.length?`<div class="card"><h3>Empieza aquí</h3><p class="muted">Crea tu primera cuenta, billetera o tarjeta para registrar movimientos. También puedes cargar datos de demostración (quedan marcados y se pueden eliminar).</p><div class="row"><button class="btn" data-act="newacc">Crear cuenta</button><button class="btn ghost" data-act="loadDemo">Cargar datos de demostración</button></div></div>`:'';
  return `${head('Inicio',`<button class="btn sm" data-act="newtx" data-id="gasto">+ Gasto</button><button class="btn sm ghost" data-act="newtx" data-id="ingreso">+ Ingreso</button>`)}
  ${alerts.join('')}${empty}
  <div class="row" style="margin-bottom:.8rem">${PERIODS.map(p=>`<button class="pbtn ${UI.period===p[0]?'on':''}" data-act="per" data-id="${p[0]}">${p[1]}</button>`).join('')}<span class="grow"></span><button class="btn ghost sm" data-act="perOff" data-id="-1">◀</button><b class="small">${fd(s)}${s!==e?' – '+fd(e):''}</b><button class="btn ghost sm" data-act="perOff" data-id="1" ${UI.off>=0?'disabled':''}>▶</button></div>
  <div class="grid g4">
  ${kpi('Saldo total disponible',fmt(liquid),'Cuentas, efectivo y billeteras','')}
  ${kpi('Ingresos del periodo',fmt(inc),'','pos')}${kpi('Gastos del periodo',fmt(exp),cmp===null?'Sin periodo anterior para comparar':`${cmp>=0?'▲':'▼'} ${Math.abs(cmp).toFixed(0)}% vs. periodo anterior (${fmt(pexp)})`,'neg')}
  ${kpi('Balance',fmt(inc-exp),inc?`Gastas el ${(exp/inc*100).toFixed(0)}% de tus ingresos`:'Sin ingresos en el periodo',inc-exp>=0?'pos':'neg')}
  ${kpi('Deudas pendientes',fmt(owe+used),`Deudas ${fmt(owe)} · Tarjetas ${fmt(used)}`,'neg')}${kpi('Dinero que me deben',fmt(due),'')}
  ${kpi('Total de ahorros',fmt(savings),'Cuentas de ahorro')}${kpi('Pendiente de pago',fmt(pend),'Deudas que vencen en 30 días o ya vencidas')}</div>
  <div class="grid g2"><div class="card"><h3>Gastos por categoría</h3>${donut(catSum('gasto'))}</div><div class="card"><h3>Ingresos por categoría</h3>${hbars(catSum('ingreso').map(i=>({...i,color:'#059669'})))}</div>
  <div class="card"><h3>Gastos por medio de pago</h3>${hbars(Object.entries(byMethod).map(([k,v],i)=>({label:k,value:v,color:PAL[i%PAL.length]})))}</div>
  <div class="card"><h3>Categorías con más gasto</h3>${hbars(catSum('gasto'),6)}</div>
  <div class="card"><h3>Ingresos y gastos, últimos 6 meses</h3>${gbars(ms)}</div>
  <div class="card"><h3>Evolución de mi patrimonio</h3><p class="muted small" style="margin-top:-.3rem">Suma de cuentas menos tarjetas, al final de cada mes</p>${line(netWorthPoints())}</div>
  <div class="card"><h3>Distribución del dinero</h3>${donut(dist)}${used?`<p class="small muted">Tarjetas de crédito (saldo utilizado): ${fmt(used)}</p>`:''}</div></div>`}

/* ========= Movimientos ========= */
function filtered(){const f=UI.f,q=norm(f.q);return DB.tx.filter(t=>{if(f.type&&t.type!==f.type)return false;if(f.cat&&t.categoryId!==f.cat)return false;if(f.acc&&t.accountId!==f.acc&&t.toAccountId!==f.acc)return false;if(f.from&&t.date<f.from)return false;if(f.to&&t.date>f.to)return false;
  if(q){const c=catOf(t.categoryId);const hay=norm([t.desc,t.notes,c&&c.name,t.sub,label(accOf(t.accountId)),t.method,t.amount].join(' '));if(!hay.includes(q))return false}return true}).sort((a,b)=>b.date.localeCompare(a.date)||(b.createdAt||0)-(a.createdAt||0))}
function txRows(){const l=filtered();if(!l.length)return '<tr><td colspan="6" class="muted">No hay movimientos con estos filtros.</td></tr>';
  const shown=l.slice(0,300);return shown.map(t=>{const c=catOf(t.categoryId),a=accOf(t.accountId),b=accOf(t.toAccountId);const sign=t.type==='ingreso'?'+':t.type==='gasto'?'−':'⇄';
    return `<tr><td>${fd(t.date)}</td><td>${esc(t.desc)}${t.demo?' <span class="badge b-demo">DEMO</span>':''}${t.photo?' 📎':''}${t.debtId?' <span class="chip">Deuda</span>':''}</td><td>${t.type==='transferencia'?'<span class="chip">Transferencia</span>':c?`<span class="chip">${c.icon} ${esc(c.name)}${t.sub?' › '+esc(t.sub):''}</span>`:'—'}</td><td class="small">${esc(label(a))}${b?' → '+esc(label(b)):''}</td><td class="right ${t.type==='ingreso'?'pos':t.type==='gasto'?'neg':''}"><b>${sign} ${fmt(t.amount)}</b></td><td class="right"><button class="btn ghost sm" data-act="edittx" data-id="${t.id}" title="Editar">✏️</button> <button class="btn ghost sm" data-act="deltx" data-id="${t.id}" title="Eliminar">🗑️</button></td></tr>`}).join('')+(l.length>300?`<tr><td colspan="6" class="muted">Mostrando 300 de ${l.length}. Usa filtros para acotar.</td></tr>`:'')}
PAGES.movimientos=()=>{const f=UI.f;return `${head('Movimientos',`<button class="btn sm" data-act="newtx" data-id="gasto">+ Gasto</button><button class="btn sm ghost" data-act="newtx" data-id="ingreso">+ Ingreso</button><button class="btn sm ghost" data-act="newtx" data-id="transferencia">⇄ Transferencia</button>`)}
  <div class="card"><div class="f2" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))"><label>Buscar<input data-flt="q" value="${esc(f.q)}" placeholder="Descripción, categoría, valor…"></label>
  <label>Tipo<select data-flt="type">${opts([['gasto','Gastos'],['ingreso','Ingresos'],['transferencia','Transferencias']],f.type,'Todos')}</select></label>
  <label>Categoría<select data-flt="cat">${opts(DB.categories.map(c=>[c.id,c.icon+' '+c.name+(c.type==='ingreso'?' (ingreso)':'')]),f.cat,'Todas')}</select></label>
  <label>Cuenta<select data-flt="acc">${acctOpts(f.acc,null,'Todas')}</select></label>
  <label>Desde<input type="date" data-flt="from" value="${f.from}"></label><label>Hasta<input type="date" data-flt="to" value="${f.to}"></label></div>
  <button class="btn ghost sm" data-act="clearflt">Limpiar filtros</button></div>
  <div class="card tw"><table><thead><tr><th>Fecha</th><th>Descripción</th><th>Categoría</th><th>Cuenta</th><th class="right">Valor</th><th></th></tr></thead><tbody id="txbody">${txRows()}</tbody></table></div>`};
ACT.clearflt=()=>{UI.f={q:'',type:'',cat:'',acc:'',from:'',to:''};render()};
ACT.newtx=id=>txForm(null,{type:id||'gasto'});
ACT.edittx=id=>{const t=DB.tx.find(x=>x.id===id);if(t.debtId){toast('Este movimiento pertenece a un abono. Edítalo desde Deudas o Dinero por cobrar.',true);return}txForm(t)};
ACT.deltx=async id=>{const t=DB.tx.find(x=>x.id===id);if(t.debtId){toast('Este movimiento pertenece a un abono. Elimínalo desde Deudas o Dinero por cobrar.',true);return}
  if(!confirm(`¿Eliminar "${t.desc}" por ${fmt(t.amount)}? El saldo de la cuenta se recalcula.`))return;DB.tx=DB.tx.filter(x=>x.id!==id);log('eliminar','movimiento',`${t.desc} · ${fmt(t.amount)} · ${fd(t.date)}`);await commit()};

function txForm(t,preset={}){
  const p=t||preset,isNew=!t;let type=p.type||'gasto';
  const catList=ty=>DB.categories.filter(c=>c.type===ty).map(c=>[c.id,c.icon+' '+c.name]);
  const body=`<div class="seg">${[['gasto','Gasto'],['ingreso','Ingreso'],['transferencia','Transferencia']].map(x=>`<label><input type="radio" name="type" value="${x[0]}" ${x[0]===type?'checked':''}><span>${x[1]}</span></label>`).join('')}</div>
  <label>Descripción<input name="desc" value="${esc(p.desc||'')}" maxlength="120" required></label>
  <div class="f2"><label>Valor<input name="amount" data-money inputmode="numeric" value="${money(p.amount)}" required></label><label>Fecha<input type="date" name="date" value="${p.date||today()}" required></label></div>
  <div class="f2" id="catrow"><label>Categoría<select name="categoryId">${opts(catList(type==='ingreso'?'ingreso':'gasto'),p.categoryId)}</select></label><label>Subcategoría<select name="sub"></select></label></div>
  <div class="f2"><label><span id="fromlbl">Cuenta o tarjeta</span><select name="accountId">${acctOpts(p.accountId,p.accountId)}</select></label>
  <label id="tolbl" hidden>Cuenta destino<select name="toAccountId">${acctOpts(p.toAccountId,p.toAccountId)}</select></label>
  <label id="mlbl">Medio de pago<select name="method">${opts(METHODS.map(m=>[m,m]),p.method||'')}</select></label></div>
  <label>Observaciones<textarea name="notes" rows="2">${esc(p.notes||'')}</textarea></label>
  <label>Foto o comprobante<input type="file" name="photo" accept="image/*"></label><div id="pv">${p.photo?`<img class="photo" src="${p.photo}"><br><label style="margin:0"><input type="checkbox" name="rmphoto"> Quitar foto</label>`:''}</div>`;
  const m=modal(isNew?'Nuevo movimiento':'Editar movimiento',body,async(fd2,f)=>{
    const ty=fd2.get('type'),amount=num(fd2.get('amount')),date=fd2.get('date'),desc=fd2.get('desc').trim(),accountId=fd2.get('accountId'),to=fd2.get('toAccountId');
    if(!desc)return 'Escribe una descripción.';if(!amount)return 'Ingresa un valor mayor a cero.';if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return 'La fecha no es válida.';if(!accountId)return 'Selecciona una cuenta o tarjeta.';
    if(ty==='transferencia'){if(!to)return 'Selecciona la cuenta de destino.';if(effId(DB,to)===effId(DB,accountId))return 'El origen y el destino deben ser distintos.'}
    const catId=ty==='transferencia'?'':fd2.get('categoryId');if(ty!=='transferencia'&&!catId)return 'Selecciona una categoría.';
    const nt={id:t?t.id:uid(),type:ty,date,amount,desc,categoryId:catId,sub:ty==='transferencia'?'':fd2.get('sub')||'',accountId,toAccountId:ty==='transferencia'?to:'',method:ty==='transferencia'?'Transferencia':fd2.get('method'),notes:fd2.get('notes').trim(),photo:t?t.photo:null,createdAt:t?t.createdAt:Date.now(),demo:t?t.demo:false};
    if(t&&t.recKey)nt.recKey=t.recKey;
    const file=f.photo.files[0];if(file){if(!file.type.startsWith('image/'))return 'El adjunto debe ser una imagen.';nt.photo=await imgToDataUrl(file,1000,.6)}else if(f.rmphoto&&f.rmphoto.checked)nt.photo=null;
    if(isNew){if(DB.tx.some(x=>sig(x)===sig(nt))&&!confirm('Ya existe un movimiento igual (misma fecha, valor, descripción y cuenta). ¿Registrarlo de todas formas?'))return false;
      const B=balances(DB),eff=effId(DB,accountId),a=accOf(eff);
      if(ty!=='ingreso'&&a){if(a.type==='credit'){const used=-B[eff];if(a.limit&&used+amount>a.limit&&!confirm(`Esta operación supera el cupo de la tarjeta (${fmt(a.limit)}). ¿Continuar?`))return false}else if(B[eff]-amount<0&&!confirm(`El saldo de ${label(a)} (${fmt(B[eff])}) no alcanza para este valor. ¿Continuar de todas formas?`))return false}}
    if(isNew)DB.tx.push(nt);else{const ch=[];['amount','date','desc','categoryId','accountId','type'].forEach(k=>{if(t[k]!==nt[k])ch.push(k==='amount'?`valor ${fmt(t.amount)}→${fmt(nt.amount)}`:k==='date'?`fecha ${fd(t.date)}→${fd(nt.date)}`:k==='desc'?`descripción "${t.desc}"→"${nt.desc}"`:k==='categoryId'?'categoría':k==='accountId'?'cuenta':'tipo')});Object.assign(t,nt);log('editar','movimiento',`${nt.desc}: ${ch.join(', ')||'otros datos'}`)}
    if(isNew)log('crear','movimiento',`${ty} · ${desc} · ${fmt(amount)}`);await commit()});
  const f=m.el;
  const subs=()=>{const c=catOf(f.categoryId.value);f.sub.innerHTML=opts((c?c.subs:[]).map(s=>[s,s]),p.sub||'','—')};
  const sync=()=>{const ty=f.type.value;$('#tolbl',f).hidden=ty!=='transferencia';$('#catrow',f).hidden=ty==='transferencia';$('#mlbl',f).hidden=ty==='transferencia';$('#fromlbl',f).textContent=ty==='transferencia'?'Cuenta origen':ty==='ingreso'?'Cuenta de destino':'Cuenta o tarjeta'};
  f.onchange=e=>{const n=e.target.name;if(n==='type'){const ty=e.target.value;f.categoryId.innerHTML=opts(catList(ty==='ingreso'?'ingreso':'gasto'),'');subs();sync()}else if(n==='categoryId'){p.sub='';subs()}else if(n==='accountId'){const a=accOf(f.accountId.value);if(a)f.elements.method.value=METHOD_BY_TYPE[a.type]||'Otro'}};
  subs();sync();if(isNew&&p.accountId&&!p.method){const a=accOf(p.accountId);if(a)f.elements.method.value=METHOD_BY_TYPE[a.type]||''}}

/* ========= Registrar ========= */
PAGES.registrar=()=>`${head('Registrar movimiento')}
  <div class="card"><h3>Escribe el movimiento</h3><p class="muted small">Ejemplos: "Gasté 25.000 en gasolina", "Pagué 120.000 de mercado con Nequi", "Hoy recibí 1.850.000 de salario". La app lo interpreta con reglas sencillas y te muestra el formulario para que lo confirmes. (La interpretación con IA llega en la siguiente fase.)</p>
  <textarea id="qtext" rows="2" placeholder="Gasté 35.000 en almuerzo con tarjeta débito Bancolombia"></textarea><br><br><button class="btn" data-act="parse">Interpretar y revisar</button></div>
  <div class="card"><h3>Formulario completo</h3><p class="muted small">Incluye categoría, subcategoría, cuenta, medio de pago, observaciones y foto de la factura o comprobante.</p><div class="row"><button class="btn" data-act="newtx" data-id="gasto">Nuevo gasto</button><button class="btn ghost" data-act="newtx" data-id="ingreso">Nuevo ingreso</button><button class="btn ghost" data-act="newtx" data-id="transferencia">Transferencia entre cuentas</button></div>
  <p class="muted small">Para pagar una tarjeta de crédito usa una transferencia desde tu cuenta hacia la tarjeta (también hay un botón en Cuentas y tarjetas).</p></div>`;
ACT.parse=()=>{const v=$('#qtext').value;if(!v.trim()){toast('Escribe algo primero.',true);return}if(!DB.accounts.length){toast('Primero crea una cuenta.',true);return}const r=parseText(v,DB);if(!r.amount)toast('No encontré un valor; complétalo en el formulario.',true);txForm(null,r)};

/* ========= Ingresos ========= */
PAGES.ingresos=()=>{const n=new Date(),ms=[];for(let i=11;i>=0;i--){const a=new Date(n.getFullYear(),n.getMonth()-i,1);ms.push({label:MES[a.getMonth()],v:tot(DB,'ingreso',ymd(a),ymd(new Date(a.getFullYear(),a.getMonth()+1,0)))})}
  const [ms0,me0]=range('month',0),[ys,ye]=range('year',0),m=tot(DB,'ingreso',ms0,me0),y=tot(DB,'ingreso',ys,ye);
  const byCat={};DB.tx.filter(t=>t.type==='ingreso'&&t.date>=ys&&t.date<=ye).forEach(t=>{byCat[t.categoryId]=(byCat[t.categoryId]||0)+t.amount});
  const last=DB.tx.filter(t=>t.type==='ingreso').sort((a,b)=>b.date.localeCompare(a.date)).slice(0,10);
  return `${head('Ingresos',`<button class="btn sm" data-act="newtx" data-id="ingreso">+ Registrar ingreso</button>`)}
  <div class="grid g4"><div class="card kpi"><div class="l">Este mes</div><div class="v pos">${fmt(m)}</div></div><div class="card kpi"><div class="l">Este año</div><div class="v pos">${fmt(y)}</div></div><div class="card kpi"><div class="l">Promedio mensual (12 meses)</div><div class="v">${fmt(ms.reduce((s,x)=>s+x.v,0)/12)}</div></div></div>
  <div class="grid g2"><div class="card"><h3>Por mes</h3>${gbars(ms.map(x=>({label:x.label,a:x.v,b:0})))}</div><div class="card"><h3>Por categoría (año)</h3>${hbars(Object.entries(byCat).map(([id,v])=>({label:catOf(id)?catOf(id).name:'Sin categoría',value:v,color:'#059669'})))}</div></div>
  <div class="card"><div class="row between"><h3>Ingresos recurrentes</h3><button class="btn sm" data-act="newrec">+ Agregar</button></div>
  ${DB.recurring.length?`<div class="tw"><table><thead><tr><th>Descripción</th><th>Valor</th><th>Día</th><th>Cuenta</th><th>Estado</th><th></th></tr></thead><tbody>${DB.recurring.map(r=>`<tr><td>${esc(r.desc)}</td><td>${fmt(r.amount)}</td><td>${r.day}</td><td class="small">${esc(label(accOf(r.accountId)))}</td><td>${r.active?'<span class="badge b-ok">Activo</span>':'<span class="badge b-warn">Pausado</span>'}</td><td class="right"><button class="btn ghost sm" data-act="editrec" data-id="${r.id}">✏️</button> <button class="btn ghost sm" data-act="delrec" data-id="${r.id}">🗑️</button></td></tr>`).join('')}</tbody></table></div><p class="muted small">Se registran solos cada mes en la fecha indicada, al abrir la app. Nunca se duplican.</p>`:'<p class="muted">Configura tu salario u otros ingresos fijos para que se registren automáticamente.</p>'}</div>
  <div class="card"><h3>Últimos ingresos</h3><div class="tw"><table><tbody>${last.map(t=>`<tr><td>${fd(t.date)}</td><td>${esc(t.desc)}</td><td class="small">${esc((catOf(t.categoryId)||{}).name||'')}</td><td class="right pos"><b>${fmt(t.amount)}</b></td></tr>`).join('')||'<tr><td class="muted">Aún no hay ingresos.</td></tr>'}</tbody></table></div></div>`};
function recForm(r){if(!DB.accounts.length){toast('Primero crea una cuenta.',true);return}
  modal(r?'Editar ingreso recurrente':'Nuevo ingreso recurrente',`<label>Descripción<input name="desc" value="${esc(r?r.desc:'Salario')}" required></label><div class="f2"><label>Valor<input name="amount" data-money value="${money(r&&r.amount)}" required></label><label>Día del mes<input name="day" type="number" min="1" max="31" value="${r?r.day:30}" required></label></div>
  <div class="f2"><label>Categoría<select name="categoryId">${opts(DB.categories.filter(c=>c.type==='ingreso').map(c=>[c.id,c.icon+' '+c.name]),r&&r.categoryId)}</select></label><label>Cuenta de destino<select name="accountId">${acctOpts(r&&r.accountId)}</select></label></div>
  <label>Empieza en<input type="date" name="start" value="${r?r.start:today()}" required></label><label style="color:var(--text)"><input type="checkbox" name="active" ${!r||r.active?'checked':''}> Activo</label>`,async f=>{
    const o={desc:f.get('desc').trim(),amount:num(f.get('amount')),day:Math.max(1,Math.min(31,+f.get('day')||0)),categoryId:f.get('categoryId'),accountId:f.get('accountId'),start:f.get('start'),active:!!f.get('active')};
    if(!o.desc||!o.amount||!o.day||!o.accountId||!o.start)return 'Completa todos los campos.';if(r)Object.assign(r,o);else DB.recurring.push({id:uid(),...o});log(r?'editar':'crear','ingreso recurrente',o.desc);applyRecurring();await commit()})}
ACT.newrec=()=>recForm();ACT.editrec=id=>recForm(DB.recurring.find(r=>r.id===id));
ACT.delrec=async id=>{const r=DB.recurring.find(x=>x.id===id);if(!confirm(`¿Eliminar "${r.desc}"? Los ingresos ya registrados se conservan.`))return;DB.recurring=DB.recurring.filter(x=>x.id!==id);log('eliminar','ingreso recurrente',r.desc);await commit()};

/* ========= Cuentas y tarjetas ========= */
PAGES.cuentas=()=>{const B=balances(DB);const mk=a=>{const bal=B[a.id],cr=a.type==='credit',linked=isLinkedDebit(DB,a);
  return `<div class="card acc" style="border-left-color:${a.color||'var(--primary)'}"><div class="row between"><div><b>${a.icon||''} ${esc(a.name)}</b> ${a.demo?'<span class="badge b-demo">DEMO</span>':''}${a.active===false?' <span class="badge b-warn">Inactiva</span>':''}<div class="small muted">${ACC_TYPES[a.type]}${a.bank?' · '+esc(a.bank):''}${a.last4?' · terminada en '+a.last4:''}</div></div></div>
  ${cr?`<div class="v" style="font-size:1.3rem;font-weight:700;margin:.4rem 0">${fmt(-bal)} <span class="small muted">utilizado</span></div>${a.limit?`<div class="prog"><i style="width:${Math.min(100,Math.max(0,-bal/a.limit*100))}%;background:${-bal/a.limit>.8?'var(--red)':'var(--primary)'}"></i></div><div class="small muted">Cupo ${fmt(a.limit)} · Disponible ${fmt(a.limit+bal)}</div>`:''}
  <div class="small muted">${a.cutDay?'Corte día '+a.cutDay:''}${a.cutDay&&a.dueDay?' · ':''}${a.dueDay?'Pago límite día '+a.dueDay+' (próximo: '+fd(nextDue(a.dueDay))+')':''}</div>`
  :`<div class="v ${bal<0?'neg':''}" style="font-size:1.3rem;font-weight:700;margin:.4rem 0">${fmt(bal)}</div>${linked?`<div class="small muted">Descuenta de: ${esc(label(accOf(a.linkedId)))}</div>`:''}`}
  <div class="row" style="margin-top:.6rem">${cr&&bal<0?`<button class="btn sm" data-act="paycard" data-id="${a.id}">Pagar tarjeta</button>`:''}<button class="btn ghost sm" data-act="editacc" data-id="${a.id}">Editar</button><button class="btn ghost sm" data-act="adjacc" data-id="${a.id}">Ajustar saldo</button><button class="btn ghost sm" data-act="delacc" data-id="${a.id}">Eliminar</button></div></div>`};
  const real=DB.accounts.filter(a=>a.type!=='credit'),cards=DB.accounts.filter(a=>a.type==='credit');
  return `${head('Cuentas y tarjetas',`<button class="btn sm" data-act="newacc">+ Nueva</button>`)}<p class="muted small">Nunca guardes números completos de tarjeta, CVV ni claves: aquí solo se usan los últimos 4 dígitos.</p>
  ${DB.accounts.length?'':'<div class="card muted">Aún no tienes cuentas. Crea una para empezar.</div>'}
  ${real.length?`<h3>Cuentas, efectivo y billeteras</h3><div class="grid g2">${real.map(mk).join('')}</div>`:''}${cards.length?`<h3>Tarjetas de crédito</h3><div class="grid g2">${cards.map(mk).join('')}</div>`:''}`};
ACT.newacc=()=>accForm();ACT.editacc=id=>accForm(accOf(id));
function accForm(a){const cr=a&&a.type==='credit';
  const m=modal(a?'Editar cuenta o tarjeta':'Nueva cuenta o tarjeta',`<label>Nombre personalizado<input name="name" value="${esc(a?a.name:'')}" required maxlength="40"></label>
  <div class="f2"><label>Tipo<select name="type">${opts(Object.entries(ACC_TYPES),a?a.type:'savings')}</select></label><label>Banco o entidad<input name="bank" value="${esc(a?a.bank:'')}" maxlength="40"></label></div>
  <div class="f2"><label id="l4">Últimos 4 dígitos<input name="last4" value="${esc(a?a.last4:'')}" maxlength="4" inputmode="numeric" placeholder="1234"></label><label><span id="inilbl">Saldo inicial</span><input name="initial" data-money value="${money(a&&a.initial)}"></label></div>
  <div class="f2"><label>Fecha de apertura<input type="date" name="openDate" value="${a?a.openDate||'':today()}"></label><label id="linkrow">Cuenta de la que descuenta<select name="linkedId">${opts(DB.accounts.filter(x=>x.type!=='credit'&&x.type!=='debit'&&(!a||x.id!==a.id)).map(x=>[x.id,label(x)]),a&&a.linkedId,'Ninguna (saldo propio)')}</select></label></div>
  <div class="f2" id="crrow"><label>Límite de crédito<input name="limit" data-money value="${money(a&&a.limit)}"></label><label>Día de corte<input name="cutDay" type="number" min="1" max="31" value="${a&&a.cutDay||''}"></label><label>Día límite de pago<input name="dueDay" type="number" min="1" max="31" value="${a&&a.dueDay||''}"></label></div>
  <div class="f2"><label>Color<input type="color" name="color" value="${a&&a.color||'#0f766e'}"></label><label>Icono (emoji)<input name="icon" value="${esc(a?a.icon||'':'')}" maxlength="4" placeholder="🏦"></label></div>
  <label style="color:var(--text)"><input type="checkbox" name="active" ${!a||a.active!==false?'checked':''}> Activa</label>`,async f=>{
    const name=f.get('name').trim(),type=f.get('type'),last4=(f.get('last4')||'').trim();if(!name)return 'Escribe un nombre.';
    if(last4&&!/^\d{4}$/.test(last4))return 'Escribe solo los últimos 4 dígitos. Por seguridad no se guardan números completos.';
    const o={name,type,bank:f.get('bank').trim(),last4,initial:num(f.get('initial')),openDate:f.get('openDate'),linkedId:type==='debit'?f.get('linkedId'):'',limit:type==='credit'?num(f.get('limit')):0,cutDay:type==='credit'?+f.get('cutDay')||0:0,dueDay:type==='credit'?+f.get('dueDay')||0:0,color:f.get('color'),icon:f.get('icon').trim(),active:!!f.get('active')};
    if(['cutDay','dueDay'].some(k=>o[k]<0||o[k]>31))return 'Los días deben estar entre 1 y 31.';
    if(a){if(a.type!==type&&DB.tx.some(t=>t.accountId===a.id||t.toAccountId===a.id)&&(a.type==='credit'||type==='credit'))return 'No puedes cambiar de/hacia tarjeta de crédito una cuenta con movimientos.';Object.assign(a,o);log('editar','cuenta',name)}else{DB.accounts.push({id:uid(),...o});log('crear','cuenta',name)}await commit()});
  const f=m.el,sync=()=>{const t=f.type.value;$('#crrow',f).hidden=t!=='credit';$('#linkrow',f).hidden=t!=='debit';$('#inilbl',f).textContent=t==='credit'?'Saldo utilizado inicial (lo que ya debes)':'Saldo inicial';$('#l4',f).hidden=!['debit','credit','savings','checking'].includes(t)};f.type.onchange=sync;sync()}
ACT.adjacc=async id=>{const a=accOf(id),B=balances(DB),cur=a.type==='credit'?-B[id]:B[id];const v=prompt(`${a.type==='credit'?'Saldo utilizado real':'Saldo real'} de "${a.name}" (hoy la app calcula ${fmt(cur)}).\nSe ajustará el saldo inicial para que coincida, sin crear ingresos ni gastos.`,String(Math.round(cur)));if(v===null)return;const t=num(v);
  if(isLinkedDebit(DB,a)){toast('Esta tarjeta descuenta de otra cuenta: ajusta esa cuenta.',true);return}
  const ni=a.initial+(t-cur);if(ni<0){toast('Ese saldo es menor a lo que permiten tus movimientos registrados. Revisa los movimientos.',true);return}a.initial=ni;log('ajustar','cuenta',`${a.name}: ${fmt(cur)}→${fmt(t)}`);await commit()};
ACT.delacc=async id=>{const a=accOf(id);if(DB.tx.some(t=>t.accountId===id||t.toAccountId===id)||DB.accounts.some(x=>x.linkedId===id)){toast('Tiene movimientos o tarjetas asociadas. Desactívala en Editar para conservar el historial.',true);return}if(!confirm(`¿Eliminar "${a.name}"?`))return;DB.accounts=DB.accounts.filter(x=>x.id!==id);log('eliminar','cuenta',a.name);await commit()};
ACT.paycard=id=>{const B=balances(DB);const src=DB.accounts.find(a=>a.type!=='credit'&&a.active!==false&&!isLinkedDebit(DB,a));txForm(null,{type:'transferencia',toAccountId:id,accountId:src?src.id:'',amount:Math.round(-B[id]),desc:'Pago de tarjeta '+accOf(id).name})};

/* ========= Categorías ========= */
PAGES.categorias=()=>{const [s,e]=range('month',0);const sp=c=>tot(DB,c.type,s,e,t=>t.categoryId===c.id),all=c=>tot(DB,c.type,'0000-01-01','9999-12-31',t=>t.categoryId===c.id);
  const list=ty=>DB.categories.filter(c=>c.type===ty).map(c=>`<tr><td><span class="dot" style="background:${c.color};display:inline-block"></span> ${c.icon} <b>${esc(c.name)}</b>${c.subs.length?`<div class="small muted">${c.subs.map(esc).join(' · ')}</div>`:''}</td><td class="right">${fmt(sp(c))}</td><td class="right">${fmt(all(c))}</td><td class="right"><button class="btn ghost sm" data-act="editcat" data-id="${c.id}">✏️</button> ${c.sys?'':`<button class="btn ghost sm" data-act="delcat" data-id="${c.id}">🗑️</button>`}</td></tr>`).join('');
  return `${head('Categorías',`<button class="btn sm" data-act="newcat" data-id="gasto">+ Gasto</button><button class="btn sm ghost" data-act="newcat" data-id="ingreso">+ Ingreso</button>`)}
  ${[['gasto','Categorías de gasto'],['ingreso','Categorías de ingreso']].map(x=>`<div class="card tw"><h3>${x[1]}</h3><table><thead><tr><th>Categoría</th><th class="right">Este mes</th><th class="right">Total histórico</th><th></th></tr></thead><tbody>${list(x[0])}</tbody></table></div>`).join('')}`};
ACT.newcat=id=>catForm(null,id);ACT.editcat=id=>catForm(catOf(id));
function catForm(c,type){modal(c?'Editar categoría':'Nueva categoría',`<label>Nombre<input name="name" value="${esc(c?c.name:'')}" required maxlength="40"></label><div class="f2"><label>Color<input type="color" name="color" value="${c?c.color:'#0f766e'}"></label><label>Icono (emoji)<input name="icon" value="${esc(c?c.icon:'🏷️')}" maxlength="4"></label></div><label>Subcategorías (separadas por coma)<input name="subs" value="${esc(c?c.subs.join(', '):'')}"></label>`,async f=>{
    const name=f.get('name').trim();if(!name)return 'Escribe un nombre.';const ty=c?c.type:type;if(DB.categories.some(x=>x.type===ty&&norm(x.name)===norm(name)&&x!==c))return 'Ya existe una categoría con ese nombre.';
    const subs=[...new Set(f.get('subs').split(',').map(x=>x.trim()).filter(Boolean))];if(c){if(c.sys&&name!==c.name)return 'Esta categoría del sistema no se puede renombrar.';Object.assign(c,{name,color:f.get('color'),icon:f.get('icon')||'🏷️',subs});log('editar','categoría',name)}else{DB.categories.push({id:uid(),type:ty,name,color:f.get('color'),icon:f.get('icon')||'🏷️',subs});log('crear','categoría',name)}await commit()})}
ACT.delcat=async id=>{const c=catOf(id),used=DB.tx.filter(t=>t.categoryId===id).length;const fb=DB.categories.find(x=>x.type===c.type&&x.sys&&x.name.startsWith('Otros'));
  if(!confirm(used?`"${c.name}" tiene ${used} movimiento(s). Se moverán a "${fb.name}". ¿Continuar?`:`¿Eliminar "${c.name}"?`))return;DB.tx.forEach(t=>{if(t.categoryId===id){t.categoryId=fb.id;t.sub=''}});DB.categories=DB.categories.filter(x=>x.id!==id);log('eliminar','categoría',c.name);await commit()};

/* ========= Deudas y por cobrar ========= */
const debtPage=kind=>{const debo=kind==='debo',td=today();const ds=DB.debts.filter(d=>d.kind===kind);const pend=ds.reduce((s,d)=>s+dPending(d),0);
  const byCat={},byParty={};ds.forEach(d=>{const p=dPending(d);if(p>0){byCat[d.category||'Otros']=(byCat[d.category||'Otros']||0)+p;byParty[d.party]=(byParty[d.party]||0)+p}});
  const B=balances(DB),cards=debo?DB.accounts.filter(a=>a.type==='credit'&&a.active!==false&&B[a.id]<0):[];
  const card=d=>{const p=dPending(d),st=dStatus(d,td),paid=dPaid(d),cls=st==='VENCIDA'?'b-bad':p===0?'b-ok':'b-warn';
    return `<div class="card"><div class="row between"><div><b>${esc(d.party)}</b> ${d.demo?'<span class="badge b-demo">DEMO</span>':''} <span class="badge ${cls}">${st}</span><div class="small muted">${esc(d.entity||'')}${d.entity?' · ':''}${esc(d.category||'')}${d.due?' · límite '+fd(d.due):''}</div></div><div class="right"><div style="font-weight:700;font-size:1.2rem">${fmt(p)}</div><div class="small muted">de ${fmt(d.initial)}</div></div></div>
    <div class="prog"><i style="width:${d.initial?paid/d.initial*100:100}%"></i></div>
    <div class="small muted">${d.rate?'Interés '+d.rate+'% mensual · ':''}${d.installments?d.installments+' cuotas'+(d.installmentValue?' de '+fmt(d.installmentValue):'')+' · ':''}Pagado ${fmt(paid)}${d.desc?' · '+esc(d.desc):''}</div>
    <div class="row" style="margin-top:.5rem">${p>0?`<button class="btn sm" data-act="dpay" data-id="${d.id}">${debo?'Abonar':'Registrar abono'}</button><button class="btn ghost sm" data-act="dpayall" data-id="${d.id}">${debo?'Pagar todo':'Cobrar todo'}</button>`:''}<button class="btn ghost sm" data-act="dhist" data-id="${d.id}">Historial (${(d.payments||[]).length})</button><button class="btn ghost sm" data-act="dedit" data-id="${d.id}">Editar</button><button class="btn ghost sm" data-act="ddel" data-id="${d.id}">Eliminar</button></div></div>`};
  const open=ds.filter(d=>dPending(d)>0).sort((a,b)=>(a.due||'9').localeCompare(b.due||'9')),closed=ds.filter(d=>dPending(d)===0);
  return `${head(debo?'Deudas':'Dinero por cobrar',`<button class="btn sm" data-act="dnew" data-id="${kind}">+ ${debo?'Nueva deuda':'Nuevo préstamo'}</button><button class="btn sm ghost" data-act="dcats">Categorías</button>`)}
  <div class="grid g4"><div class="card kpi"><div class="l">${debo?'Total que debo':'Total que me deben'}</div><div class="v ${debo?'neg':'pos'}">${fmt(pend)}</div></div>${debo?`<div class="card kpi"><div class="l">Tarjetas de crédito (utilizado)</div><div class="v neg">${fmt(cards.reduce((s,a)=>s-B[a.id],0))}</div><div class="s"><a href="#/cuentas">Ver tarjetas</a></div></div>`:''}</div>
  <div class="grid g2"><div class="card"><h3>Por categoría</h3>${hbars(Object.entries(byCat).map(([k,v],i)=>({label:k,value:v,color:PAL[i%PAL.length]})))}</div><div class="card"><h3>${debo?'Cuánto debo a cada persona o entidad':'Cuánto me debe cada persona'}</h3>${hbars(Object.entries(byParty).map(([k,v])=>({label:k,value:v,color:debo?'#dc2626':'#059669'})))}</div></div>
  ${open.map(card).join('')||`<div class="card muted">${debo?'No tienes deudas pendientes registradas.':'Nadie te debe dinero registrado.'}</div>`}
  ${closed.length?`<h3>${debo?'Pagadas':'Cobradas'}</h3>${closed.map(card).join('')}`:''}`};
PAGES.deudas=()=>debtPage('debo');PAGES.cobrar=()=>debtPage('medeben');
ACT.dnew=id=>debtForm(null,id);ACT.dedit=id=>debtForm(DB.debts.find(d=>d.id===id));
function debtForm(d,kind){const k=d?d.kind:kind,debo=k==='debo';modal(d?'Editar':(debo?'Nueva deuda':'Nuevo préstamo por cobrar'),`<div class="f2"><label>${debo?'Acreedor':'Persona que me debe'}<input name="party" value="${esc(d?d.party:'')}" required maxlength="60"></label><label>Entidad financiera o persona<input name="entity" value="${esc(d?d.entity:'')}" maxlength="60"></label></div>
  <div class="f2"><label>Valor ${debo?'inicial':'prestado'}<input name="initial" data-money value="${money(d&&d.initial)}" required></label><label>Saldo pendiente actual (si ya pagaron parte)<input name="pending" data-money value="${d?money(dPending(d)):''}" placeholder="Igual al valor"></label></div>
  <div class="f2"><label>Fecha ${debo?'de creación':'del préstamo'}<input type="date" name="created" value="${d?d.created:today()}"></label><label>Fecha ${debo?'límite de pago':'acordada de devolución'}<input type="date" name="due" value="${d&&d.due||''}"></label></div>
  <div class="f2"><label>Categoría<select name="category">${opts(DB.settings.debtCats.map(c=>[c,c]),d&&d.category)}</select></label><label>Tasa de interés mensual (%)<input name="rate" type="number" step="0.01" min="0" value="${d&&d.rate||''}"></label></div>
  <div class="f2"><label>Número de cuotas<input name="installments" type="number" min="0" value="${d&&d.installments||''}"></label><label>Valor de cada cuota<input name="installmentValue" data-money value="${money(d&&d.installmentValue)}"></label></div><label>Descripción<textarea name="desc" rows="2">${esc(d?d.desc||'':'')}</textarea></label>`,async f=>{
    const initial=num(f.get('initial')),party=f.get('party').trim();if(!party)return 'Escribe el nombre.';if(!initial)return 'Ingresa el valor.';const pend=f.get('pending')?num(f.get('pending')):initial;if(pend>initial)return 'El saldo pendiente no puede superar el valor inicial.';
    const paidPay=d?(d.payments||[]).reduce((s,p)=>s+p.amount,0):0;const prepaid=initial-pend-paidPay;if(prepaid<0)return 'El saldo pendiente es menor a lo ya abonado ('+fmt(paidPay)+').';
    const o={party,entity:f.get('entity').trim(),initial,prepaid,created:f.get('created'),due:f.get('due'),category:f.get('category'),rate:+f.get('rate')||0,installments:+f.get('installments')||0,installmentValue:num(f.get('installmentValue')),desc:f.get('desc').trim()};
    if(d)Object.assign(d,o);else DB.debts.push({id:uid(),kind:k,payments:[],...o});log(d?'editar':'crear',debo?'deuda':'por cobrar',`${party} · ${fmt(initial)}`);await commit()})}
ACT.ddel=async id=>{const d=DB.debts.find(x=>x.id===id);const n=(d.payments||[]).length;if(!confirm(`¿Eliminar "${d.party}"?${n?` Se eliminarán también ${n} abono(s) y sus movimientos en cuentas.`:''}`))return;DB.tx=DB.tx.filter(t=>t.debtId!==id);DB.debts=DB.debts.filter(x=>x.id!==id);log('eliminar','deuda',d.party);await commit()};
ACT.dpay=id=>payForm(id,false);ACT.dpayall=id=>payForm(id,true);
function payForm(id,all){const d=DB.debts.find(x=>x.id===id),debo=d.kind==='debo',p=dPending(d);
  modal(debo?'Registrar pago':'Registrar cobro',`<p>${esc(d.party)} · pendiente <b>${fmt(p)}</b></p><div class="f2"><label>Valor<input name="amount" data-money value="${money(p)}" ${all?'readonly':''} required></label><label>Fecha<input type="date" name="date" value="${today()}" required></label></div>
  <label>${debo?'Pagar desde':'Recibir en'}<select name="accountId">${acctOpts('',null,'No afectar ninguna cuenta')}</select></label><label>Nota<input name="note" maxlength="100"></label>`,async f=>{
    const amount=num(f.get('amount')),acc=f.get('accountId');if(!amount)return 'Ingresa un valor.';if(amount>p)return 'El valor supera el saldo pendiente ('+fmt(p)+').';
    if(debo&&acc){const B=balances(DB),e=effId(DB,acc),a=accOf(e);if(a&&a.type!=='credit'&&B[e]<amount&&!confirm('La cuenta no tiene saldo suficiente. ¿Continuar?'))return false}
    const pid=uid();d.payments.push({id:pid,date:f.get('date'),amount,accountId:acc,note:f.get('note').trim()});
    if(acc){const cat=DB.categories.find(c=>c.type===(debo?'gasto':'ingreso')&&c.name===(debo?'Deudas':'Otros ingresos'));DB.tx.push({id:uid(),type:debo?'gasto':'ingreso',date:f.get('date'),amount,desc:(debo?'Abono a ':'Cobro a ')+d.party,categoryId:cat?cat.id:'',sub:'',accountId:acc,method:METHOD_BY_TYPE[(accOf(acc)||{}).type]||'',notes:f.get('note').trim(),debtId:d.id,payId:pid,createdAt:Date.now(),demo:d.demo})}
    log('pago',debo?'deuda':'por cobrar',`${d.party} · ${fmt(amount)}${dPending(d)===0?' · '+(debo?'PAGADA':'COBRADO'):''}`);await commit()})}
ACT.dhist=id=>{const d=DB.debts.find(x=>x.id===id);const draw=()=>`<p>Pagado ${fmt(dPaid(d))} · Pendiente ${fmt(dPending(d))}</p>${d.prepaid?`<p class="small muted">Abonos previos al registro: ${fmt(d.prepaid)}</p>`:''}<table>${(d.payments||[]).slice().sort((a,b)=>b.date.localeCompare(a.date)).map(p=>`<tr><td>${fd(p.date)}</td><td>${fmt(p.amount)}</td><td class="small">${esc(p.accountId?label(accOf(p.accountId)):'Sin cuenta')}${p.note?' · '+esc(p.note):''}</td><td class="right"><button type="button" class="btn ghost sm" data-act="dpdel" data-id="${d.id}|${p.id}">🗑️</button></td></tr>`).join('')||'<tr><td class="muted">Sin abonos todavía.</td></tr>'}</table>`;
  modal('Historial · '+d.party,draw(),null,{noSave:true})};
ACT.dpdel=async v=>{const [did,pid]=v.split('|'),d=DB.debts.find(x=>x.id===did),p=d.payments.find(x=>x.id===pid);if(!confirm(`¿Eliminar el abono de ${fmt(p.amount)}? También se elimina su movimiento en la cuenta.`))return;d.payments=d.payments.filter(x=>x.id!==pid);DB.tx=DB.tx.filter(t=>t.payId!==pid);log('eliminar','abono',`${d.party} · ${fmt(p.amount)}`);document.querySelectorAll('.ov').forEach(o=>o.remove());await commit()};
ACT.dcats=()=>{const v=prompt('Categorías de deuda (separadas por coma):',DB.settings.debtCats.join(', '));if(v===null)return;const l=[...new Set(v.split(',').map(x=>x.trim()).filter(Boolean))];if(!l.length)return;DB.settings.debtCats=l;DB.debts.forEach(d=>{if(!l.includes(d.category)&&d.category)l.push(d.category)});log('editar','categorías de deuda',l.join(', '));commit()};

/* ========= Copias de seguridad ========= */
function dl(name,blob){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},800)}
async function makeBackup(pass){const payload={app:'mis-gastos',version:1,exportedAt:new Date().toISOString(),data:DB};
  if(!pass)return new Blob([JSON.stringify(payload)],{type:'application/json'});
  const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),k=await deriveKey(pass,salt),ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},k,enc.encode(JSON.stringify(payload)));
  return new Blob([JSON.stringify({app:'mis-gastos',version:1,encrypted:true,salt:toB64(salt),iv:toB64(iv),ct:toB64(ct)})],{type:'application/json'})}
PAGES.copias=()=>{const l=DB.settings.lastBackup;return `${head('Copias de seguridad')}
  <div class="card"><h3>Crear copia</h3><p class="muted small">Incluye movimientos, cuentas, tarjetas, categorías, deudas, ingresos recurrentes, configuración y fotos adjuntas. Última copia: <b>${l?new Date(l).toLocaleString('es-CO'):'nunca'}</b></p>
  <label>Clave para proteger la copia (opcional, recomendado)<input id="bkpass" type="password" autocomplete="new-password" placeholder="Si la olvidas, la copia no se puede abrir"></label><button class="btn" data-act="backup">Descargar copia</button></div>
  <div class="card"><h3>Restaurar o importar</h3><p class="muted small">Antes de aplicar nada se valida el archivo y se muestra un resumen. Al combinar se omiten los duplicados; al reemplazar se descarga primero una copia de lo actual.</p><input type="file" accept=".json,application/json" data-chg="restore"></div>
  <div class="card"><h3>Exportar a Excel / CSV</h3><div class="f2"><label>Desde<input type="date" id="cf"></label><label>Hasta<input type="date" id="ct" value="${today()}"></label></div><button class="btn ghost" data-act="csv">Descargar movimientos (CSV)</button></div>
  <div class="card"><h3>Recordatorio</h3><label>Avisarme en Inicio cuando pasen (días, 0 = nunca)<input type="number" min="0" max="365" value="${DB.settings.backupDays}" data-chg="bkdays"></label></div>`};
CHG.bkdays=async el=>{DB.settings.backupDays=Math.max(0,+el.value||0);await save();toast('Recordatorio guardado')};
ACT.backup=async()=>{const p=$('#bkpass').value;if(p&&p.length<6){toast('La clave debe tener al menos 6 caracteres.',true);return}const b=await makeBackup(p);dl(`mis-gastos-${today()}${p?'-protegida':''}.json`,b);DB.settings.lastBackup=new Date().toISOString();log('copia','copia de seguridad',p?'protegida':'sin clave');await commit()};
ACT.csv=()=>{const f=$('#cf').value||'0000-01-01',t=$('#ct').value||'9999-12-31';const q=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';
  const rows=DB.tx.filter(x=>x.date>=f&&x.date<=t).sort((a,b)=>a.date.localeCompare(b.date)).map(x=>[x.date,x.type,x.desc,(catOf(x.categoryId)||{}).name||'',x.sub||'',x.amount,label(accOf(x.accountId)),x.toAccountId?label(accOf(x.toAccountId)):'',x.method||'',x.notes||''].map(q).join(';'));
  dl(`movimientos-${today()}.csv`,new Blob(['\ufeff'+['Fecha;Tipo;Descripción;Categoría;Subcategoría;Valor;Cuenta;Cuenta destino;Medio de pago;Observaciones'].concat(rows).join('\r\n')],{type:'text/csv;charset=utf-8'}))};
CHG.restore=async el=>{const file=el.files[0];if(!file)return;el.value='';
  try{let j=JSON.parse(await file.text());if(j&&j.encrypted){const p=prompt('Esta copia está protegida. Ingresa su clave:');if(!p)return;try{const k=await deriveKey(p,fromB64(j.salt));j=JSON.parse(dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:fromB64(j.iv)},k,fromB64(j.ct))))}catch(e){toast('Clave incorrecta o archivo dañado.',true);return}}
    const data=j&&j.data?j.data:j;const v=validateBackup(data);if(v.errors.length){alert('El archivo no es válido y no se importó nada:\n\n• '+v.errors.join('\n• ')+(v.total>10?`\n… y ${v.total-10} más`:''));return}
    const dupT=data.tx.filter(t=>DB.tx.some(x=>x.id===t.id||sig(x)===sig(t))).length;
    modal('Restaurar copia',`<p>El archivo es válido y contiene <b>${data.tx.length}</b> movimientos, <b>${data.accounts.length}</b> cuentas, <b>${data.categories.length}</b> categorías y <b>${data.debts.length}</b> deudas.${j.exportedAt?` Fecha de la copia: ${new Date(j.exportedAt).toLocaleString('es-CO')}.`:''}</p>
    <label style="color:var(--text)"><input type="radio" name="mode" value="merge" checked> <b>Combinar</b> con lo que ya tengo (se omiten ${dupT} movimiento(s) repetidos)</label><label style="color:var(--text)"><input type="radio" name="mode" value="replace"> <b>Reemplazar</b> todo (primero se descarga una copia de lo actual)</label>`,async f=>{
      if(f.get('mode')==='replace'){if(!confirm('Se reemplazarán TODOS tus datos actuales por los de la copia. ¿Continuar?'))return false;dl(`mis-gastos-antes-de-restaurar-${today()}.json`,await makeBackup(''));const keep=DB.audit;DB=data;normalizeDB();DB.audit=keep;log('restaurar','copia','reemplazo completo')}
      else{const r=mergeBackup(DB,data);log('restaurar','copia',`combinar: +${r.tx} mov., +${r.accounts} cuentas, +${r.debts} deudas, ${r.dupTx} repetidos omitidos`);toast(`Agregados ${r.tx} movimientos, ${r.accounts} cuentas, ${r.debts} deudas (${r.dupTx} repetidos omitidos).`)}
      applyUI();await commit()},{save:'Aplicar'})}catch(e){toast('No se pudo leer el archivo: '+e.message,true)}};

/* ========= Configuración ========= */
PAGES.config=()=>{const s=DB.settings,demo=DB.tx.some(t=>t.demo)||DB.accounts.some(a=>a.demo)||DB.debts.some(d=>d.demo);
  return `${head('Configuración')}
  <div class="card"><h3>Apariencia</h3><div class="f2"><label>Nombre de la aplicación<input value="${esc(s.appName)}" data-chg="appName" maxlength="30"></label><label>Color principal<input type="color" value="${s.color}" data-chg="color"></label>
  <label>Tema<select data-chg="theme">${opts([['light','Claro'],['dark','Oscuro']],s.theme)}</select></label><label>Moneda<select data-chg="currency">${opts([['COP','Peso colombiano (COP)'],['USD','Dólar (USD)'],['EUR','Euro (EUR)']],s.currency)}</select></label>
  <label>Formato de fecha<select data-chg="dateFmt">${opts([['dd/mm/yyyy','31/12/2026'],['mm/dd/yyyy','12/31/2026'],['yyyy-mm-dd','2026-12-31'],['d MMM yyyy','31 dic 2026']],s.dateFmt)}</select></label><label>Logotipo (por defecto: tu monograma)<input type="file" accept="image/*" data-chg="logo"></label></div>${s.logo?'<button class="btn ghost sm" data-act="rmlogo">Volver al logotipo original</button>':''}</div>
  <div class="card"><h3>Seguridad</h3><label>Bloquear automáticamente tras<select data-chg="lockMin">${opts([['1','1 minuto'],['2','2 minutos'],['5','5 minutos'],['10','10 minutos'],['15','15 minutos'],['30','30 minutos'],['0','Nunca']],String(s.lockMin))}</select></label>
  <div class="row"><button class="btn" data-act="lock">Cerrar sesión / bloquear</button><button class="btn ghost" data-act="chpin">Cambiar PIN o clave</button></div><p class="muted small">Los datos se cifran con AES-256 usando tu acceso y se guardan solo en este navegador. Tras 5 intentos fallidos se aplican esperas.</p></div>
  <div class="card"><h3>Datos de demostración</h3><p class="muted small">Sirven para conocer la app. Quedan marcados como DEMO y se pueden eliminar sin tocar tus datos reales.</p><div class="row">${demo?`<button class="btn ghost" data-act="delDemo">Eliminar datos de demostración</button>`:`<button class="btn ghost" data-act="loadDemo">Cargar datos de demostración</button>`}<button class="btn danger" data-act="wipe">Borrar todos mis datos</button></div></div>
  <div class="card"><h3>Historial de modificaciones</h3><div class="tw"><table><tbody>${DB.audit.slice(0,100).map(a=>`<tr><td class="small muted" style="white-space:nowrap">${new Date(a.ts).toLocaleString('es-CO')}</td><td><span class="chip">${esc(a.action)} · ${esc(a.entity)}</span></td><td class="small">${esc(a.summary)}</td></tr>`).join('')||'<tr><td class="muted">Sin cambios registrados.</td></tr>'}</tbody></table></div></div>`};
CHG.appName=async el=>{DB.settings.appName=el.value.trim()||'Mis gastos';applyUI();await commit()};CHG.color=async el=>{DB.settings.color=el.value;applyUI();await commit()};
CHG.theme=async el=>{DB.settings.theme=el.value;applyUI();await commit()};CHG.currency=async el=>{DB.settings.currency=el.value;await commit()};CHG.dateFmt=async el=>{DB.settings.dateFmt=el.value;await commit()};
CHG.lockMin=async el=>{DB.settings.lockMin=+el.value;resetLock();await commit()};
CHG.logo=async el=>{const f=el.files[0];if(!f)return;try{const c=document.createElement('canvas');DB.settings.logo=await imgToDataUrl(f,160,.85);applyUI();await commit()}catch(e){toast(e.message,true)}};
ACT.rmlogo=async()=>{DB.settings.logo=null;applyUI();await commit()};
ACT.chpin=()=>{modal('Cambiar acceso',`<label>Acceso actual<input name="cur" type="password" autocomplete="off" required></label><div class="seg"><label><input type="radio" name="k" value="pin4" checked><span>PIN 4</span></label><label><input type="radio" name="k" value="pin6"><span>PIN 6</span></label><label><input type="radio" name="k" value="pass"><span>Clave</span></label></div><label>Nuevo acceso<input name="s" type="password" autocomplete="off" required></label><label>Repite el nuevo acceso<input name="c" type="password" autocomplete="off" required></label>`,async f=>{
  const v=await IDB.get('vault');try{const k=await deriveKey(f.get('cur'),v.salt);await crypto.subtle.decrypt({name:'AES-GCM',iv:v.iv},k,v.ct)}catch(e){return 'El acceso actual no es correcto.'}
  const k=f.get('k'),s=f.get('s');if(k==='pin4'&&!/^\d{4}$/.test(s))return 'El PIN debe tener 4 dígitos.';if(k==='pin6'&&!/^\d{6}$/.test(s))return 'El PIN debe tener 6 dígitos.';if(k==='pass'&&s.length<6)return 'La clave debe tener al menos 6 caracteres.';if(s!==f.get('c'))return 'Los valores nuevos no coinciden.';
  SALT=crypto.getRandomValues(new Uint8Array(16));KEY=await deriveKey(s,SALT);KIND=k;log('editar','seguridad','Se cambió el acceso');await commit();toast('Acceso actualizado')})};
ACT.wipe=async()=>{if(!confirm('Esto borra TODOS tus datos de este dispositivo y no se puede deshacer. ¿Tienes una copia de seguridad?'))return;if(prompt('Escribe BORRAR para confirmar')!=='BORRAR')return;await IDB.del('vault');localStorage.removeItem('mg_ui');DB=null;boot()};
ACT.delDemo=async()=>{const hasReal=a=>DB.tx.some(t=>!t.demo&&(t.accountId===a.id||t.toAccountId===a.id));
  if(!confirm('Se eliminarán los movimientos, cuentas y deudas de demostración. Tus datos reales no se tocan.'))return;
  DB.tx=DB.tx.filter(t=>!t.demo);DB.debts=DB.debts.filter(d=>!d.demo);DB.recurring=DB.recurring.filter(r=>!r.demo);
  let kept=0;DB.accounts=DB.accounts.filter(a=>{if(!a.demo)return true;if(hasReal(a)){a.demo=false;kept++;return true}return false});log('eliminar','demo','Datos de demostración eliminados');await commit();if(kept)toast(kept+' cuenta(s) se conservaron porque tienen movimientos reales.')};
ACT.loadDemo=async()=>{let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
  const mk=o=>{const a={id:uid(),active:true,demo:true,openDate:today(),...o};DB.accounts.push(a);return a};
  const ah=mk({name:'Ahorros demo',bank:'Bancolombia',type:'savings',last4:'1234',initial:2500000,color:'#0f766e',icon:'🏦'}),nq=mk({name:'Nequi demo',bank:'Nequi',type:'nequi',initial:600000,color:'#a855f7',icon:'📱'}),ef=mk({name:'Efectivo demo',type:'cash',initial:500000,color:'#16a34a',icon:'💵'}),tc=mk({name:'Crédito demo',bank:'Bancolombia',type:'credit',last4:'9876',initial:400000,limit:3000000,cutDay:15,dueDay:30,color:'#0ea5e9',icon:'💳'});
  const C=n=>DB.categories.find(c=>c.type==='gasto'&&c.name===n),I=n=>DB.categories.find(c=>c.type==='ingreso'&&c.name===n);
  const items=[['Almuerzo',C('Alimentación'),35000,nq],['Mercado semanal',C('Mercado'),180000,ah],['Gasolina',C('Transporte'),60000,ef],['Arriendo',C('Vivienda'),900000,ah],['Internet',C('Servicios públicos'),85000,ah],['Droguería',C('Salud'),42000,nq],['Cine',C('Entretenimiento'),48000,tc],['Zapatos',C('Ropa y calzado'),180000,tc],['Netflix',C('Suscripciones'),38000,tc],['Cena',C('Alimentación'),64000,tc],['Taxi',C('Transporte'),22000,nq],['Mercado',C('Mercado'),150000,ah]];
  const n=new Date();for(let m=2;m>=0;m--){const base=new Date(n.getFullYear(),n.getMonth()-m,1);const maxD=m===0?n.getDate():28;
    const add=(type,date,amount,desc,cat,acc)=>DB.tx.push({id:uid(),type,date,amount,desc,categoryId:cat?cat.id:'',sub:'',accountId:acc.id,method:METHOD_BY_TYPE[acc.type],notes:'',createdAt:Date.now(),demo:true});
    add('ingreso',ymd(new Date(base.getFullYear(),base.getMonth(),1)),1850000,'Salario',I('Salario'),ah);
    items.forEach(it=>{const d=1+Math.floor(rnd()*(maxD));add('gasto',ymd(new Date(base.getFullYear(),base.getMonth(),Math.min(d,maxD))),Math.round(it[2]*(0.8+rnd()*.5)/1000)*1000,it[0],it[1],it[3])})}
  const first=ymd(new Date(n.getFullYear(),n.getMonth()-1,5));DB.tx.push({id:uid(),type:'transferencia',date:first,amount:200000,desc:'Pago tarjeta demo',categoryId:'',sub:'',accountId:ah.id,toAccountId:tc.id,method:'Transferencia',notes:'',createdAt:Date.now(),demo:true});
  DB.debts.push({id:uid(),kind:'debo',party:'Préstamo demo',entity:'Banco demo',initial:1200000,prepaid:200000,payments:[],created:today(),due:ymd(new Date(n.getFullYear(),n.getMonth()+1,10)),category:'Bancos',rate:1.8,installments:12,installmentValue:100000,desc:'Dato de demostración',demo:true});
  DB.debts.push({id:uid(),kind:'medeben',party:'Amigo demo',entity:'',initial:300000,prepaid:0,payments:[],created:today(),due:ymd(new Date(n.getFullYear(),n.getMonth(),n.getDate()+15)),category:'Familiares',rate:0,installments:0,installmentValue:0,desc:'Dato de demostración',demo:true});
  log('crear','demo','Datos de demostración cargados');location.hash='#/inicio';await commit()};

boot();
