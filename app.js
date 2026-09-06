// ============================================================
// Painel do AGAR — aplicacao (front-end)
// Persistencia: Supabase (Postgres + Auth). Sem framework.
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ---------- configuracao / conexao ----------
const CFG = window.AGAR_CONFIG || {};
const CONFIG_OK = CFG.SUPABASE_URL
  && CFG.SUPABASE_ANON_KEY
  && !CFG.SUPABASE_URL.includes('COLE_AQUI')
  && !CFG.SUPABASE_ANON_KEY.includes('COLE_AQUI');

let sb = null;
if (CONFIG_OK) sb = createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);

// Constantes de dominio
const PROFS = ['Assistente Social','Enfermeiro(a)','Fisioterapeuta','Médico(a)','Nutricionista','Psicólogo(a)','Recepção'];
const TIPO_DE = { com:'comorbidade', qx:'queixa', rec:'reclamacao' };
const KEY_DE  = { comorbidade:'com', queixa:'qx', reclamacao:'rec' };

// Cache em memoria (espelho do banco), no mesmo formato que o resto do app usa.
let db = { cfg:{ com:[], qx:[], rec:[] }, regs:[], faltas:[] };

// ---------- helpers de UI ----------
const $ = id => document.getElementById(id);
function show(el){ el && el.classList.remove('hidden'); }
function hide(el){ el && el.classList.add('hidden'); }
function flash(el, ms=2200){ if(!el)return; el.style.display='block'; setTimeout(()=>el.style.display='none', ms); }
function showErr(el, msg){ if(!el)return; el.textContent=msg; el.style.display='block'; setTimeout(()=>el.style.display='none', 5000); }
function esc(s){ return String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
function enc(s){ return encodeURIComponent(s); }
function dec(s){ return decodeURIComponent(s); }
function today(){ return new Date().toISOString().slice(0,10); }
function fmt(d){ if(!d)return''; const[a,m,x]=d.split('-'); return `${x}/${m}/${a}`; }
function fmtMes(k){ const[a,m]=k.split('-'); return ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][+m-1]+'/'+a.slice(2); }

// ============================================================
// BOOT
// ============================================================
(async function boot(){
  if (!CONFIG_OK){
    hide($('app-loading'));
    show($('login'));
    showErr($('lg-err'), 'Configuração ausente: copie config.example.js para config.js e preencha a URL e a chave do Supabase.');
    $('lg-btn').disabled = true;
    return;
  }
  wireStaticEvents();
  const { data:{ session } } = await sb.auth.getSession();
  if (session) await entrarNoApp();
  else { hide($('app-loading')); show($('login')); }

  sb.auth.onAuthStateChange((_e, sess)=>{
    if (!sess){ hide($('app')); show($('login')); }
  });
})();

// ---------- login ----------
function wireLogin(){
  $('login-form').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const email = $('lg-email').value.trim();
    const senha = $('lg-senha').value;
    $('lg-btn').disabled = true; $('lg-btn').textContent = 'Entrando…';
    const { error } = await sb.auth.signInWithPassword({ email, password: senha });
    $('lg-btn').disabled = false; $('lg-btn').textContent = 'Entrar';
    if (error){
      showErr($('lg-err'), error.message === 'Invalid login credentials'
        ? 'E-mail ou senha incorretos.' : ('Não foi possível entrar: '+error.message));
      return;
    }
    await entrarNoApp();
  });
}

async function entrarNoApp(){
  show($('app-loading'));
  hide($('login'));
  try{
    await loadAll();
  }catch(err){
    hide($('app-loading'));
    show($('login'));
    showErr($('lg-err'), 'Erro ao carregar os dados: '+(err.message||err)+'. Confira se o schema.sql foi executado.');
    return;
  }
  hide($('app-loading'));
  show($('app'));
  initRegistro();
  initDash();
}

// ============================================================
// CAMADA DE DADOS (Supabase)
// ============================================================
async function loadAll(){
  const [cfgRes, regRes, falRes] = await Promise.all([
    sb.from('agar_config').select('*').order('nome'),
    sb.from('agar_registros').select('*').order('data', { ascending:false }),
    sb.from('agar_faltas').select('*').order('data', { ascending:false })
  ]);
  if (cfgRes.error) throw cfgRes.error;
  if (regRes.error) throw regRes.error;
  if (falRes.error) throw falRes.error;

  db = { cfg:{ com:[], qx:[], rec:[] }, regs:[], faltas:[] };
  cfgRes.data.forEach(r=>{
    const k = KEY_DE[r.tipo]; if(!k) return;
    db.cfg[k].push({ id:r.id, nome:r.nome, def:r.definicao });
  });
  db.regs = regRes.data.map(r=>({
    id:r.id, prof:r.profissional, data:r.data,
    com:r.comorbidades||[], qx:r.queixas||[], rec:r.reclamacoes||[]
  }));
  db.faltas = falRes.data.map(f=>({
    id:f.id, data:f.data, turno:f.turno, agen:f.agendados||0, qtd:f.faltas||0
  }));
}

// ============================================================
// NAVEGACAO
// ============================================================
function wireNav(){
  const gearBtn = $('btn-cfg');
  document.querySelectorAll('nav button').forEach(b=> b.onclick = ()=>{
    document.querySelectorAll('nav button').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    if (gearBtn) gearBtn.classList.remove('active');
    document.querySelectorAll('#app main > section').forEach(s=>s.classList.add('hidden'));
    $('tab-'+b.dataset.tab).classList.remove('hidden');
    if (b.dataset.tab==='dashboard') renderDash();
    if (b.dataset.tab==='faltometro') renderFaltaTab();
  });
  if (gearBtn) gearBtn.onclick = ()=>{
    document.querySelectorAll('nav button').forEach(x=>x.classList.remove('active'));
    gearBtn.classList.add('active');
    document.querySelectorAll('#app main > section').forEach(s=>s.classList.add('hidden'));
    $('tab-config').classList.remove('hidden');
    renderCfg();
  };
}

// ============================================================
// PICKERS (busca + icone de definicao)
// ============================================================
// ---- tooltip/card de informacao (ⓘ) ----
const _tip = (()=>{ const t=document.createElement('div'); t.className='tipbox hidden'; document.body.appendChild(t); return t; })();
function showTip(el, nome, def){
  _tip.innerHTML = '<b>'+esc(nome)+'</b>'+esc(def||'(sem definição)');
  _tip.classList.remove('hidden');
  const r = el.getBoundingClientRect();
  let left = r.left + r.width/2 - _tip.offsetWidth/2;
  left = Math.max(8, Math.min(left, window.innerWidth - _tip.offsetWidth - 8));
  let top = r.top - _tip.offsetHeight - 8;
  if (top < 8) top = r.bottom + 8;
  _tip.style.left = left+'px'; _tip.style.top = top+'px';
}
function hideTip(){ _tip.classList.add('hidden'); }
const _canHover = !!(window.matchMedia && window.matchMedia('(hover:hover)').matches);
document.addEventListener('click', e=>{ if(!e.target.closest('.info')) hideTip(); }, true);
document.addEventListener('scroll', hideTip, true);
// fechar dropdown de qualquer picker ao clicar fora dele
document.addEventListener('click', e=>{
  document.querySelectorAll('.picker .drop').forEach(d=>{
    const box = d.closest('.picker');
    if(box && !box.contains(e.target)) d.classList.add('hidden');
  });
});

function makePicker(elId, type){
  const el = $(elId); const selected = [];
  el.innerHTML = '<input placeholder="Buscar e selecionar..."><div class="chips"></div><div class="drop hidden"></div>';
  const inp = el.querySelector('input'), chips = el.querySelector('.chips'), drop = el.querySelector('.drop');
  // manter o input focado (dropdown aberto) ao tocar em opcao/ⓘ, senao o blur fecha a lista
  drop.addEventListener('mousedown', e=>{ e.preventDefault(); });
  function items(){ return db.cfg[type].slice().sort((a,b)=>a.nome.localeCompare(b.nome)); }
  function renderDrop(){
    const t = inp.value.trim().toLowerCase();
    const list = items().filter(it=>!selected.includes(it.nome) && (t==='' || it.nome.toLowerCase().includes(t) || (it.def||'').toLowerCase().includes(t)));
    drop.innerHTML = list.map(it=>`<div class="opt" data-n="${enc(it.nome)}"><span class="nm">${esc(it.nome)}</span><span class="info" data-n="${enc(it.nome)}" data-d="${enc(it.def||'')}">i</span></div>`).join('') || '<div class="opt muted">nenhum resultado</div>';
    drop.classList.remove('hidden');
    drop.querySelectorAll('.info').forEach(inf=>{
      const nome=dec(inf.dataset.n), def=dec(inf.dataset.d);
      if(_canHover){ inf.onmouseenter = ()=> showTip(inf, nome, def); inf.onmouseleave = hideTip; }
      inf.onclick = e=>{ e.stopPropagation(); showTip(inf, nome, def); };
    });
    drop.querySelectorAll('.opt[data-n]').forEach(o=> o.onclick = e=>{
      if (e.target.closest('.info')) return;
      selected.push(dec(o.dataset.n)); inp.value=''; hideTip(); renderChips(); renderDrop();
    });
  }
  function renderChips(){
    chips.innerHTML = selected.map(n=>`<span class="chip">${esc(n)} <b data-r="${enc(n)}">×</b></span>`).join('');
    chips.querySelectorAll('b').forEach(b=> b.onclick = ()=>{ selected.splice(selected.indexOf(dec(b.dataset.r)),1); renderChips(); renderDrop(); });
  }
  inp.onfocus = renderDrop; inp.oninput = renderDrop;
  inp.onblur = ()=> setTimeout(()=>drop.classList.add('hidden'), 200);
  return {
    get: ()=>selected.slice(),
    reset: ()=>{ selected.length=0; inp.value=''; renderChips(); drop.classList.add('hidden'); },
    add: n=>{ if(!selected.includes(n)){ selected.push(n); renderChips(); } }
  };
}

// ============================================================
// REGISTRO
// ============================================================
let pickCom, pickQx;
function initRegistro(){
  const sp = $('r-prof'); sp.innerHTML = PROFS.map(p=>`<option>${p}</option>`).join('');
  $('r-data').value = today();
  pickCom = makePicker('pick-com','com'); pickQx = makePicker('pick-qx','qx');
  renderRecBox(); renderAtalhos(); updateCount(); renderRegList();
}
function resumoReg(r){
  const parts=[];
  if(r.com&&r.com.length) parts.push(r.com.join(', '));
  if(r.qx&&r.qx.length) parts.push(r.qx.join(', '));
  if(r.rec&&r.rec.length) parts.push(r.rec.map(x=>typeof x==='object'?x.nome:x).join(', '));
  return parts.join(' · ')||'(sem itens)';
}
function renderRegList(){
  const l=$('reg-list'); if(!l) return;
  const regs=db.regs.slice().sort((a,b)=>b.data.localeCompare(a.data)).slice(0,15);
  if(!regs.length){ l.innerHTML='<div class="it"><div class="t"><div>Nenhum atendimento registrado ainda.</div></div></div>'; return; }
  l.innerHTML=regs.map(r=>`<div class="it"><div class="t"><b>${esc(r.prof)} · ${fmt(r.data)}</b><div>${esc(resumoReg(r))}</div></div><span class="x" data-id="${r.id}" title="Apagar">×</span></div>`).join('');
  l.querySelectorAll('.x').forEach(x=> x.onclick = async ()=>{
    const id=x.dataset.id;
    if(!confirm('Apagar este atendimento? Essa ação não pode ser desfeita.')) return;
    const { error } = await sb.from('agar_registros').delete().eq('id', id);
    if(error){ alert('Não foi possível apagar: '+error.message); return; }
    const i=db.regs.findIndex(o=>o.id===id); if(i>=0) db.regs.splice(i,1);
    renderRegList(); renderAtalhos(); updateCount();
  });
}
function maisUsadas(key, n){
  const m = {}; db.regs.forEach(r=> (r[key]||[]).forEach(v=>{ const nm=(typeof v==='object')?v.nome:v; m[nm]=(m[nm]||0)+1; }));
  return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,n).map(e=>e[0]);
}
function renderAtalhos(){
  [['ata-com','com',pickCom],['ata-qx','qx',pickQx]].forEach(([id,key,pk])=>{
    const box = $(id); const tops = maisUsadas(key,6);
    box.innerHTML = '<span class="lbl">Mais frequentes:</span>' + tops.map(t=>`<span class="a" data-n="${enc(t)}">+ ${esc(t)}</span>`).join('');
    box.querySelectorAll('.a').forEach(a=> a.onclick = ()=>pk.add(dec(a.dataset.n)));
  });
}
function updateCount(){
  const t = today();
  const at = db.regs.filter(r=>r.data===t).length;
  const ft = db.faltas.filter(f=>f.data===t).reduce((s,f)=>s+f.qtd,0);
  const el = $('r-count'); if(el) el.textContent = `Hoje: ${at} atendimento(s) · ${ft} falta(s)`;
}
function renderRecBox(){
  const box = $('rec-box');
  box.innerHTML = db.cfg.rec.map(r=>{
    const alvo = ['Geral',...PROFS].map(a=>`<option>${a}</option>`).join('');
    return `<div class="rec-item"><input type="checkbox" data-r="${enc(r.nome)}"> <span style="flex:1">${esc(r.nome)}</span>
      <select class="alvo hidden" data-a="${enc(r.nome)}">${alvo}</select></div>`;
  }).join('');
  box.querySelectorAll('input[type=checkbox]').forEach(c=> c.onchange = ()=>{
    box.querySelector(`select[data-a="${c.dataset.r}"]`).classList.toggle('hidden', !c.checked);
  });
}
async function salvarRegistro(novo){
  const rec = [];
  document.querySelectorAll('#rec-box .rec-item').forEach(it=>{
    const c = it.querySelector('input[type=checkbox]');
    if (c.checked) rec.push({ nome:dec(c.dataset.r), alvo:it.querySelector('select').value });
  });
  const com = pickCom.get(), qx = pickQx.get();
  if (!com.length && !qx.length && !rec.length){ showErr($('r-err'),'Selecione ao menos uma comorbidade, queixa ou reclamação.'); return; }

  const btnA = $('r-salvar-novo'), btnB = $('r-salvar'); btnA.disabled = btnB.disabled = true;
  const { data, error } = await sb.from('agar_registros').insert({
    profissional: $('r-prof').value, data: $('r-data').value,
    comorbidades: com, queixas: qx, reclamacoes: rec
  }).select().single();
  btnA.disabled = btnB.disabled = false;
  if (error){ showErr($('r-err'),'Não foi possível salvar: '+error.message); return; }

  db.regs.unshift({ id:data.id, prof:data.profissional, data:data.data, com:data.comorbidades||[], qx:data.queixas||[], rec:data.reclamacoes||[] });
  flash($('r-ok'));
  pickCom.reset(); pickQx.reset(); renderRecBox(); renderAtalhos(); updateCount(); renderRegList();
  if (!novo) document.querySelector('nav button[data-tab=dashboard]').click();
}

// ============================================================
// FALTOMETRO
// ============================================================
async function salvarFalta(){
  const q = parseInt($('f-qtd').value||'0',10);
  const ag = parseInt($('f-agen').value||'0',10);
  const btn = $('f-salvar'); btn.disabled = true;
  const { data, error } = await sb.from('agar_faltas').insert({
    data: $('f-data').value, turno: $('f-turno').value, agendados: ag, faltas: q
  }).select().single();
  btn.disabled = false;
  if (error){ showErr($('f-err'),'Não foi possível registrar: '+error.message); return; }
  db.faltas.unshift({ id:data.id, data:data.data, turno:data.turno, agen:data.agendados||0, qtd:data.faltas||0 });
  flash($('f-ok'), 2500);
  $('f-qtd').value=0; $('f-agen').value=0; renderFaltaTab(); updateCount();
}
function renderFaltaTab(){
  $('f-data').value = $('f-data').value || today();
  const tb = document.querySelector('#f-tab tbody');
  tb.innerHTML = db.faltas.slice().sort((a,b)=>b.data.localeCompare(a.data)).slice(0,12).map(f=>{
    const tx = f.agen ? Math.round(f.qtd/f.agen*100)+'%' : '—';
    return `<tr><td>${fmt(f.data)}</td><td>${f.turno}</td><td>${f.qtd}</td><td>${f.agen||'—'}</td><td>${tx}</td><td><span class="x" data-id="${f.id}" title="Apagar">×</span></td></tr>`;
  }).join('');
  tb.querySelectorAll('.x').forEach(x=> x.onclick = async ()=>{
    const id=x.dataset.id;
    if(!confirm('Apagar esta falta? Essa ação não pode ser desfeita.')) return;
    const { error } = await sb.from('agar_faltas').delete().eq('id', id);
    if(error){ alert('Não foi possível apagar: '+error.message); return; }
    const i=db.faltas.findIndex(o=>o.id===id); if(i>=0) db.faltas.splice(i,1);
    renderFaltaTab(); updateCount();
  });
}

// ============================================================
// CONFIGURACOES
// ============================================================
let cfgTipo = 'comorbidade';
function wireCfg(){
  document.querySelectorAll('#cfg-seg button').forEach(b=> b.onclick = ()=>{
    document.querySelectorAll('#cfg-seg button').forEach(x=>x.classList.remove('active'));
    b.classList.add('active'); cfgTipo = b.dataset.cfg; renderCfg();
  });
}
async function addCfg(){
  const n = $('cfg-nome').value.trim(), d = $('cfg-def').value.trim();
  if (!n){ showErr($('cfg-err'),'Informe o nome do item.'); return; }
  const btn = $('cfg-add'); btn.disabled = true;
  const { data, error } = await sb.from('agar_config').insert({
    tipo: cfgTipo, nome: n, definicao: d || ''
  }).select().single();
  btn.disabled = false;
  if (error){ showErr($('cfg-err'),'Não foi possível adicionar: '+error.message); return; }
  db.cfg[KEY_DE[cfgTipo]].push({ id:data.id, nome:data.nome, def:data.definicao });
  $('cfg-nome').value=''; $('cfg-def').value='';
  renderCfg(); renderRecBox();
}
function renderCfg(){
  const key = KEY_DE[cfgTipo];
  const l = $('cfg-list');
  l.innerHTML = db.cfg[key].map(it=>`<div class="it"><div class="t"><b>${esc(it.nome)}</b><div>${esc(it.def||'(sem definição)')}</div></div><span class="x" data-id="${it.id}">excluir</span></div>`).join('');
  l.querySelectorAll('.x').forEach(x=> x.onclick = async ()=>{
    const id = x.dataset.id;
    const it = db.cfg[key].find(o=>o.id===id);
    if (!confirm('Excluir "'+(it?it.nome:'')+'"? Essa ação não pode ser desfeita.')) return;
    const { error } = await sb.from('agar_config').delete().eq('id', id);
    if (error){ showErr($('cfg-err'),'Não foi possível excluir: '+error.message); return; }
    const arr = db.cfg[key]; const i = arr.findIndex(o=>o.id===id); if(i>=0) arr.splice(i,1);
    renderCfg(); renderRecBox();
  });
}

// ============================================================
// DASHBOARD
// ============================================================
let chartMode = 'bar', charts = {};
function wireDash(){
  document.querySelectorAll('#d-chart button').forEach(b=> b.onclick = ()=>{
    document.querySelectorAll('#d-chart button').forEach(x=>x.classList.remove('active'));
    b.classList.add('active'); chartMode = b.dataset.ch; renderDash();
  });
}
function initDash(){
  $('d-prof').innerHTML = '<option value="">Todos</option>' + PROFS.map(p=>`<option>${p}</option>`).join('');
  $('d-de').value = ''; $('d-ate').value = today();
}
function filtered(){
  const de=$('d-de').value, ate=$('d-ate').value, pr=$('d-prof').value;
  return db.regs.filter(r=>(!de||r.data>=de)&&(!ate||r.data<=ate)&&(!pr||r.prof===pr));
}
function tally(regs,key){ const m={}; regs.forEach(r=>(r[key]||[]).forEach(v=>{ const n=(typeof v==='object')?v.nome:v; m[n]=(m[n]||0)+1; })); return m; }
function topChart(id,map,color){
  const ent = Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,10);
  draw(id, ent.map(e=>e[0]), ent.map(e=>e[1]), color);
}
function draw(id,labels,data,color){
  if (charts[id]) charts[id].destroy();
  const ctx = $(id);
  const palette = ['#294468','#4a6ea4','#d98aa0','#c8d9e6','#7c9ac0','#e7a9b8','#a7b8cc','#cf6f88','#93a7bd','#dbc4cb'];
  charts[id] = new Chart(ctx, {
    type: chartMode==='pie'?'pie':'bar',
    data:{ labels, datasets:[{ data, backgroundColor: chartMode==='pie'?palette:(color||'#294468'), borderRadius:6 }] },
    options:{ indexAxis: chartMode==='bar'?'y':'x',
      plugins:{ legend:{ display:chartMode==='pie', position:'bottom', labels:{ boxWidth:12, font:{ size:11 } } } },
      scales: chartMode==='pie'?{}:{ x:{ beginAtZero:true, ticks:{ precision:0 } } } }
  });
}
function faltasFiltradas(){
  const de=$('d-de').value, ate=$('d-ate').value;
  return db.faltas.filter(f=>(!de||f.data>=de)&&(!ate||f.data<=ate));
}
function graficosVisiveis(){ const g=$('dash-graficos'); return g && !g.classList.contains('hidden'); }
function toggleFiltros(){
  const f=$('dash-filtros'); f.classList.toggle('hidden');
  $('btn-filtros').classList.toggle('active', !f.classList.contains('hidden'));
}
function toggleGraficos(){
  const g=$('dash-graficos'); g.classList.toggle('hidden');
  const b=$('btn-graficos');
  if (graficosVisiveis()){ b.textContent='📊 Ocultar gráficos'; renderDash(); } else { b.textContent='📊 Ver gráficos'; }
}
function baixarPDF(){
  if (!graficosVisiveis()){ $('dash-graficos').classList.remove('hidden'); $('btn-graficos').textContent='📊 Ocultar gráficos'; renderDash(); }
  setTimeout(()=>window.print(), 450);
}
function renderDash(){
  const regs = filtered(); const fal = faltasFiltradas();
  const totFaltas = fal.reduce((s,f)=>s+f.qtd,0);
  const totAgen = fal.reduce((s,f)=>s+(f.agen||0),0);
  const absent = totAgen ? Math.round(totFaltas/totAgen*100)+'%' : '—';
  $('kpis').innerHTML = [
    ['Atendimentos',regs.length], ['Reclamações',regs.reduce((s,r)=>s+(r.rec?r.rec.length:0),0)],
    ['Faltas',totFaltas], ['Absenteísmo',absent]
  ].map(k=>`<div class="kpi"><div class="n">${k[1]}</div><div class="l">${k[0]}</div></div>`).join('');
  gerarBoletim(regs, fal, totFaltas, totAgen, absent);
  if (!graficosVisiveis()) return; // gráficos escondidos: canvas sem tamanho, não renderiza
  topChart('ch-com', tally(regs,'com'), '#294468');
  topChart('ch-qx', tally(regs,'qx'), '#4a6ea4');
  topChart('ch-rec', tally(regs,'rec'), '#d98aa0');
  const ft = {'Manhã':0,'Tarde':0}; fal.forEach(f=> ft[f.turno]=(ft[f.turno]||0)+f.qtd);
  draw('ch-falta', Object.keys(ft), Object.values(ft), '#7c9ac0');
  const sel = $('d-item');
  const all = [...db.cfg.com.map(c=>c.nome), ...db.cfg.qx.map(c=>c.nome)];
  const cur = sel.value; sel.innerHTML = all.map(n=>`<option>${esc(n)}</option>`).join('');
  if (cur && all.includes(cur)) sel.value = cur;
  renderSerie();
}
function renderSerie(){
  const item = $('d-item').value; const regs = filtered();
  const m = {}; regs.forEach(r=>{ if((r.com||[]).includes(item)||(r.qx||[]).includes(item)){ const k=r.data.slice(0,7); m[k]=(m[k]||0)+1; } });
  const keys = Object.keys(m).sort();
  draw('ch-serie', keys.map(fmtMes), keys.map(k=>m[k]), '#4a6ea4');
}

// ---------- boletim ----------
function gerarBoletim(regs,fal,totFaltas,totAgen,absent){
  const de=$('d-de').value, ate=$('d-ate').value, pr=$('d-prof').value;
  const per = (de||ate) ? `de ${fmt(de)} a ${fmt(ate)}` : 'todo o período';
  const alvo = pr ? ` (profissional: ${pr})` : '';
  const top = (map,n)=>Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,n);
  const pc = c=> regs.length ? Math.round(c/regs.length*100)+'%' : '0%';
  const com = top(tally(regs,'com'),3), qx = top(tally(regs,'qx'),1), rec = top(tally(regs,'rec'),2);
  const ft = {'Manhã':0,'Tarde':0}; fal.forEach(f=> ft[f.turno]=(ft[f.turno]||0)+f.qtd);
  let t = `Período: ${per}${alvo}.\n`;
  t += `Foram ${regs.length} atendimento(s) registrado(s).\n`;
  if (com.length) t += `Comorbidades mais frequentes: ${com.map(c=>`${c[0]} (${pc(c[1])})`).join(', ')}.\n`;
  if (qx.length)  t += `Queixa mais comum: ${qx[0][0]} (${pc(qx[0][1])}).\n`;
  t += `Faltas: ${totFaltas} (${ft['Manhã']} manhã / ${ft['Tarde']} tarde)`;
  t += totAgen ? `, absenteísmo de ${absent} sobre ${totAgen} agendados.\n` : `.\n`;
  if (rec.length) t += `Reclamações registradas: ${regs.reduce((s,r)=>s+(r.rec?r.rec.length:0),0)} no total; mais citadas: ${rec.map(r=>`${r[0]} (${r[1]})`).join(', ')}.\n`;
  $('boletim').textContent = t.trim();
}
function copiarBoletim(){
  const t = $('boletim').textContent;
  navigator.clipboard.writeText(t).then(
    ()=>alert('Boletim copiado para a área de transferência.'),
    ()=>alert('Selecione e copie o texto manualmente.')
  );
}

// ============================================================
// EVENTOS ESTATICOS (ligados uma vez no boot)
// ============================================================
function wireStaticEvents(){
  wireLogin();
  wireNav();
  wireCfg();
  wireDash();
  $('btn-logout').onclick = async ()=>{ await sb.auth.signOut(); };
  $('r-salvar-novo').onclick = ()=>salvarRegistro(true);
  $('r-salvar').onclick = ()=>salvarRegistro(false);
  $('f-salvar').onclick = ()=>salvarFalta();
  $('cfg-add').onclick = ()=>addCfg();
  $('d-aplicar').onclick = ()=>renderDash();
  $('d-pdf').onclick = ()=>baixarPDF();
  $('btn-filtros').onclick = ()=>toggleFiltros();
  $('btn-graficos').onclick = ()=>toggleGraficos();
  $('d-item').onchange = ()=>renderSerie();
  $('b-copiar').onclick = ()=>copiarBoletim();
}
