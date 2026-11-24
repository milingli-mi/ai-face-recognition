'use strict';

let legalChatMessages = []; // 存储报告内问答历史
let legalChatLoading = false;

let globalChatOpen = false;
let globalChatMessages = [];
let globalChatLoading = false;

const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths = {
  compare:'M8 3H4a1 1 0 0 0-1 1v4m13-5h4a1 1 0 0 1 1 1v4M3 16v4a1 1 0 0 0 1 1h4m8 0h4a1 1 0 0 0 1-1v-4M9 8l-4 4 4 4m6-8 4 4-4 4M5 12h14',
  shield:'M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z M8 12l3 3 5-6',
  history:'M3 11a9 9 0 1 1 2 7M3 4v7h7m2-4v5l3 2',
  folder:'M3 7V5a1 1 0 0 1 1-1h5l2 3h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7Z',
  plus:'M12 5v14M5 12h14',
  chevron:'m9 5 7 7-7 7',
  down:'m6 9 6 6 6-6',
  image:'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z M3 16l5-5 5 5 3-3 5 5 M8 7h.01',
  upload:'M12 15V3m-4 4 4-4 4 4M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5',
  arrow:'M4 12h16m-6-6 6 6-6 6',
  back:'M20 12H4m6-6-6 6 6 6',
  swap:'M4 8h16m-4-4 4 4-4 4M20 16H4m4-4-4 4 4 4',
  lock:'M6 10h12a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Zm2 0V6a4 4 0 0 1 8 0v4m-4 4v3',
  scan:'M8 3H4a1 1 0 0 0-1 1v4m13-5h4a1 1 0 0 1 1 1v4M3 16v4a1 1 0 0 0 1 1h4m8 0h4a1 1 0 0 0 1-1v-4M7 12h10m-5-5v10',
  file:'M14 3H5a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9l-6-6Zm0 0v6h6M8 13h8m-8 4h5',
  check:'m5 12 4 4L19 6',
  close:'m6 6 12 12M6 18 18 6',
  download:'M12 3v12m-5-5 5 5 5-5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4',
  search:'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm5 12 6 6',
  info:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 8v6m0-10v.01',
  external:'M14 3h7v7m0-7L10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5',
  layers:'m12 3 10 5-10 5L2 8l10-5Zm-10 9 10 5 10-5M2 16l10 5 10-5',
  edit:'m16 3 5 5-12 12-6 1 1-6L16 3Zm-2 2 5 5',
  scale:'M12 3v18M6 21h12M4 7h16M6 7l-4 8h8L6 7Zm12 0-4 8h8l-4-8Z',
  spark:'m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z',
};
const icon = (name, extra='') => `<svg class="icon ${extra}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.file}"/></svg>`;
const image = (url, alt, cls='') => `<img src="${esc(url)}" alt="${esc(alt)}" class="${cls}" loading="lazy">`;
const date = value => new Intl.DateTimeFormat('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Shanghai'}).format(new Date(value));
const fullDate = value => new Intl.DateTimeFormat('zh-CN',{dateStyle:'medium',timeStyle:'medium',hour12:false,timeZone:'Asia/Shanghai'}).format(new Date(value))+'（北京时间）';
const bytes = n => n < 1024*1024 ? Math.max(1,Math.round(n/1024))+' KB' : (n/1024/1024).toFixed(1)+' MB';
const modeName = value => value === 'personal' ? '个人对比' : '企业合规';
const folderName = id => workspace?.folders.find(f => f.id === id)?.name || '未分类';
const realFolders = () => workspace.folders.filter(f => f.id !== 'inbox');
const savedValue = key => {try {return localStorage.getItem(key);} catch {return null;}};
const saveValue = (key,value) => {try {localStorage.setItem(key,value);} catch { /* local archiving still works */ }};

let workspace = null, mode = 'personal', folder = savedValue('vj.folder'), record = null;
let files = {original:null,suspect:null,compliance:null}, previews = {}, selectionVersions = {};
let working = false, pendingStart = false, reportTab = 'visual', comparisonIndex = 0, showOverlay = true;
let historyMode = 'all', historyQuery = '', routeVersion = 0, toastTimer;
const expandedFolders = new Set();

function notify(message) {
  $('toast').textContent=message;$('toast').classList.add('visible');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),4200);
}
async function request(path, options={}) {
  let response;
  try {response=await fetch(path,options);} catch {throw new Error('本机服务暂时未连接，请检查启动窗口后重试。');}
  const result=await response.json();
  if(!response.ok) throw new Error(result.error || '操作未完成，请重试');
  return result;
}
const postJSON = (path,value) => request(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
async function refresh() {
  workspace=await request('/api/workspace');
  if(!realFolders().some(f=>f.id===folder)) folder=null;
}
function modalHead(id,title,description,symbol='folder') {
  return `<div class="modal-head"><div><div class="modal-symbol">${icon(symbol)}</div><h2 id="${id}">${title}</h2><p>${description}</p></div><button class="icon-button" data-close aria-label="关闭弹窗">${icon('close')}</button></div>`;
}
function openDialog(id) {if(!$(id).open)$(id).showModal();}
function setFolder(id) {folder=id;saveValue('vj.folder',id);expandedFolders.add(id);}
function renderSidebar() {
  const [page,id]=location.hash.slice(1).split('/');
  const active=page==='report'?(record?.mode || ''):page || 'personal';
  $('sidebar').innerHTML=`<a class="brand" href="#personal" aria-label="VisionJudge 首页"><span class="brand-logo"><svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="m5 7 11 19L27 7M11 7l5 9 5-9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span><span class="brand-name">VisionJudge</span><span class="brand-caption" style="display:block">视觉权利工作台</span></span></a>
    <div class="nav-label">开始检测</div><nav class="primary-nav" aria-label="检测模块">
    ${[['personal','compare','对比检测','个人用户 · 原创维权'],['compliance','shield','合规检查','企业用户 · AI 制作团队']].map(([key,symbol,title,sub])=>`<a class="nav-item ${active===key?'active':''}" href="#${key}" ${active===key?'aria-current="page"':''}>${icon(symbol)}<span><strong>${title}</strong><small>${sub}</small></span>${active===key?'<i class="nav-dot"></i>':''}</a>`).join('')}</nav>
    <div class="side-divider"></div><div class="record-nav-head"><a href="#history" ${page==='history'?'aria-current="page"':''}>${icon('history')}检测记录 <span class="count">${workspace.records.length || ''}</span></a><button class="icon-button" data-action="folder" aria-label="新建文件夹" title="新建文件夹">${icon('plus')}</button></div>
    ${workspace.folders.length?`<nav class="side-folders" aria-label="文件夹与检测记录">${workspace.folders.map(f=>{
      const rows=workspace.records.filter(r=>r.folder===f.id),expanded=expandedFolders.has(f.id);
      return `<div class="side-folder ${page==='history'&&id===f.id?'selected':''}"><button class="folder-expand ${expanded?'expanded':''}" data-action="expand" data-id="${f.id}" aria-label="${expanded?'收起':'展开'}${esc(f.name)}" aria-expanded="${expanded}">${icon('chevron')}</button><a class="side-folder-link" href="#history/${f.id}">${icon('folder')}<span>${esc(f.name)}</span><small class="count">${rows.length}</small></a></div>${expanded?`<div class="side-records">${rows.length?rows.map(r=>`<a href="#report/${r.id}" class="${id===r.id?'selected':''}" title="${esc(r.title)}">${esc(r.title)}</a>`).join(''):'<span class="small muted">还没有检测记录</span>'}</div>`:''}`;
    }).join('')}</nav>`:'<p class="sidebar-empty">你的检测会按文件夹归档，<br>在这里随时回看。</p>'}
    <div class="sidebar-bottom"><div class="local-card">${icon('lock')}<div><b>本地工作空间</b><p>文件在本机处理与保存</p></div><i class="status-dot" title="本机服务已连接"></i></div><div class="sidebar-version"><span>VISIONJUDGE</span><span>V 2.0</span></div></div>`;
}

function uploadSlot(key,number,title,tag) {
  const file=files[key];
  return `<section class="upload-column" aria-label="${title}"><div class="slot-label"><span class="slot-number">${number}</span>${title}<span class="slot-tag">${tag}</span></div>
    <input id="file-${key}" type="file" accept="image/jpeg,image/png,image/webp" data-slot="${key}" hidden>
    ${file?`<div class="preview-zone" data-drop="${key}">${image(previews[key],title)}<button class="remove-file" data-action="remove" data-slot="${key}" aria-label="移除${title}" title="移除图片">${icon('close')}</button><div class="file-caption">${icon('image')}<span title="${esc(file.name)}">${esc(file.name)}</span><small>${bytes(file.size)}</small><button data-action="pick" data-slot="${key}" class="text-link">更换</button></div></div>`:
      `<button class="dropzone" data-action="pick" data-slot="${key}" data-drop="${key}" aria-label="上传${title}"><span class="upload-illustration">${icon('image')}</span><b><span class="upload-link">点击上传</span> 或拖拽图片到这里</b><span class="file-hint">JPG、PNG、WebP · 单张不超过 16 MB</span></button>`}</section>`;
}
function ready() {return mode==='personal' ? !!(files.original&&files.suspect) : !!files.compliance;}
function renderNew() {
  const personal=mode==='personal';
  $('main').innerHTML=`<div class="main-content"><section class="intro"><span class="eyebrow">${personal?'PROTECT WHAT YOU CREATE':'CREATE WITH CONFIDENCE'}</span><h1>${personal?'为你的原创，<span class="title-accent">找到相似的线索。</span>':'让每一次发布，<span class="title-accent">更有依据。</span>'}</h1><p>${personal?'上传你的原创素材和疑似侵权作品，让视觉比对为下一步提供依据。':'上传待发布的作品，与已入库素材比对，提前发现需要核实的使用风险。'}</p></section>
    <section class="composer" aria-label="${personal?'个人作品对比':'企业素材合规检查'}"><div class="composer-header"><h2>${icon(personal?'compare':'shield')}${personal?'作品对比检测':'作品合规检查'}</h2><span class="small">${personal?'两张图片 · 一次对比':'单张图片 · 数据库比对'}</span></div>
    <div class="upload-grid ${personal?'':'single'}">${personal?uploadSlot('original','01','我的原创素材','作为对比依据')+`<div class="compare-bridge">${icon('swap')}</div>`+uploadSlot('suspect','02','疑似侵权作品','需要核查的图片'):uploadSlot('compliance','01','待检查的作品','发布前核查')}</div>
    <div class="composer-footer"><button class="archive-picker" data-action="folder" aria-label="选择或新建归档文件夹">${icon('folder')}<span class="archive-label">本次归档至</span><span class="folder-name">${folder?esc(folderName(folder)):'选择文件夹'}</span>${icon('down','chev')}</button><button class="primary" data-action="start" ${ready()?'':'disabled'}>${personal?'开始对比检测':'开始合规检查'}${icon('arrow')}</button></div></section>
    <div class="privacy-line">${icon('lock')}文件仅在本机处理，检测结果自动归档</div>
    ${personal?'':`<div class="scope-note">${icon('info')}<div><b>本次检索范围：${esc(workspace.database?.name || '本地素材库')} · ${workspace.database?.images || 0} 张图片。</b><br>仅核查当前已入库素材，不覆盖全网；未命中不代表可直接商用，也不判断作品是否由 AI 生成。</div></div>`}
    <div class="flow-grid">${[
      ['upload','01 · 上传作品',personal?'原创与疑似作品，左右一一对照':'上传一张待发布的图片'],
      ['scan','02 · 看见相似线索','查看匹配区域、分数与评判标准'],
      ['file','03 · 留存检测依据','报告自动归档，证据包随时导出']
    ].map(([symbol,title,text])=>`<div class="flow-item"><span class="flow-icon">${icon(symbol)}</span><div><h3>${title}</h3><p>${text}</p></div></div>`).join('')}</div>
    <section class="recent-section"><div class="section-heading"><h2>${icon('history')}最近检测</h2><a class="text-link" href="#history">查看全部记录 ${icon('arrow')}</a></div>${workspace.records.length?`<div class="recent-list">${workspace.records.slice(0,3).map(r=>`<button class="recent-row" data-action="view" data-id="${r.id}">${image('/api/images/'+r.sha,'已检测的作品')}<span class="record-name">${esc(r.title)}</span><span class="record-date">${date(r.created)}</span>${icon('chevron')}</button>`).join('')}</div>`:`<div class="empty-recent">${icon('folder')}还没有检测记录，完成第一次检测后会出现在这里。</div>`}</section></div>`;
}
async function selectFile(key,file) {
  if(!file) return;
  const version=(selectionVersions[key]||0)+1;selectionVersions[key]=version;
  try {
    if(file.size>16*1024*1024)throw new Error('单张图片不能超过 16 MB，请压缩后再试。');
    if(!/\.(jpe?g|png|webp)$/i.test(file.name))throw new Error('请选择 JPG、PNG 或 WebP 图片。');
    if(file.name.length>180)throw new Error('文件名过长，请缩短到 180 个字符以内。');
    const bitmap=await createImageBitmap(file);
    const pixels=bitmap.width*bitmap.height;bitmap.close();
    if(pixels>16000000)throw new Error('图片超过 1600 万像素，请缩小后再试。');
    if(selectionVersions[key]!==version || working) return;
    if(previews[key])URL.revokeObjectURL(previews[key]);
    files[key]=file;previews[key]=URL.createObjectURL(file);renderNew();
  } catch(e) {if(selectionVersions[key]===version)notify(e.message || '图片无法读取，请更换文件。');}
}
function showFolders(startAfter=false) {
  pendingStart=startAfter;
  const folders=realFolders(), first=!folders.length;
  $('folder-dialog').innerHTML=modalHead('folder-title',first?'先为这次检测建个文件夹':'选择归档文件夹',first?'给作品一个归属，后续的检测和证据都能在这里找到。':'这次检测会自动保存到所选目录，你也可以新建文件夹。')+
    `${folders.length?`<div class="folder-list">${folders.map(f=>`<button class="folder-option ${f.id===folder?'selected':''}" data-action="choose-folder" data-id="${f.id}">${icon('folder')}${esc(f.name)}<span class="option-count">${workspace.records.filter(r=>r.folder===f.id).length} 条记录</span>${f.id===folder?icon('check'):''}</button>`).join('')}</div>`:''}
    <form id="folder-form" class="create-folder"><label class="field" for="folder-name">${first?'文件夹名称':'或新建文件夹'}<input id="folder-name" name="name" maxlength="50" required placeholder="例如：摄影作品维权、品牌宣传素材" autocomplete="off" ${first?'autofocus':''}></label><p class="form-error" id="folder-error" role="alert"></p><div class="modal-actions"><button type="button" class="secondary" data-close>暂不创建</button><button class="primary">${first&&startAfter?'创建并开始检测':'创建并选择'}${icon('arrow')}</button></div></form>`;
  openDialog('folder-dialog');
}
function fileData(file) {
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();reader.onerror=()=>reject(new Error('读取图片失败，请重新选择。'));
    reader.onload=()=>resolve({name:file.name,data:String(reader.result).split(',')[1]});reader.readAsDataURL(file);
  });
}
async function startCheck() {
  if(working||!ready())return;
  if(!folder || !realFolders().some(f=>f.id===folder))return showFolders(true);
  working=true;pendingStart=false;
  const currentMode=mode,currentFolder=folder;
  $('busy-title').textContent=currentMode==='personal'?'正在寻找视觉线索':'正在核查素材使用线索';
  $('busy-detail').textContent='正在读取上传的图片…';
  ['read','analyze','save'].forEach(k=>$('step-'+k).classList.toggle('active',k==='read'));
  openDialog('busy-dialog');$('main').setAttribute('aria-busy','true');
  try {
    let options,path;
    if(currentMode==='personal') {
      const [reference,query]=await Promise.all([fileData(files.original),fileData(files.suspect)]);
      options={method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reference,query,folder:currentFolder})};path='/api/compare';
    } else {
      const file=files.compliance;
      options={method:'POST',headers:{'Content-Type':'application/octet-stream','X-Filename':encodeURIComponent(file.name),'X-Folder':currentFolder},body:file};path='/api/check';
    }
    $('step-read').classList.remove('active');$('step-analyze').classList.add('active');
    $('busy-detail').textContent='正在计算画面指纹、比对人脸与局部特征，请稍候…';
    const result=await request(path,options);
    $('step-analyze').classList.remove('active');$('step-save').classList.add('active');
    $('busy-detail').textContent='报告已保存，正在打开检测结果…';
    record=result;reportTab='visual';comparisonIndex=0;showOverlay=true;
    const keys=currentMode==='personal'?['original','suspect']:['compliance'];
    keys.forEach(k=>{files[k]=null;if(previews[k])URL.revokeObjectURL(previews[k]);delete previews[k];});
    try {await refresh();} catch {notify('检测已保存，记录列表稍后刷新。');}
    expandedFolders.add(result.folder);location.hash='report/'+result.snapshot.id;
  } catch(e) {notify(e.message);}
  finally {working=false;$('busy-dialog').close();$('main').removeAttribute('aria-busy');}
}

function renderHistory() {
  const [,id]=location.hash.slice(1).split('/');
  const selected=workspace.folders.find(f=>f.id===id);
  $('main').innerHTML=`<div class="main-content"><div class="page-heading"><div><span class="eyebrow">YOUR CREATIVE PAPER TRAIL</span><h1>${selected?esc(selected.name):'每一次核查，都有迹可循。'}</h1><p>按作品与项目归档，随时回看检测结果与证据。</p></div><button class="secondary" data-action="folder">${icon('plus')}新建文件夹</button></div>
    <div class="history-tools"><div class="segmented" aria-label="记录类型">${[['all','全部记录'],['personal','个人对比'],['compliance','企业合规']].map(([key,title])=>`<button class="segment ${historyMode===key?'active':''}" data-action="history-mode" data-id="${key}" aria-pressed="${historyMode===key}">${title}<span>${workspace.records.filter(r=>(!selected||r.folder===id)&&(key==='all'||r.mode===key)).length}</span></button>`).join('')}</div><label class="search-field">${icon('search')}<span class="sr-only">搜索检测记录</span><input id="history-search" value="${esc(historyQuery)}" placeholder="搜索文件名或记录名称"></label></div>
    <nav class="folder-filters" aria-label="按文件夹筛选"><a class="folder-chip ${!selected?'active':''}" href="#history">全部文件夹</a>${workspace.folders.map(f=>`<a class="folder-chip ${id===f.id?'active':''}" href="#history/${f.id}">${icon('folder')}${esc(f.name)}</a>`).join('')}</nav><div class="records-panel" id="record-list"></div></div>`;
  filterHistory();
}
function filterHistory() {
  const [,id]=location.hash.slice(1).split('/');
  const selected=workspace.folders.some(f=>f.id===id);
  const rows=workspace.records.filter(r=>(!selected||r.folder===id)&&(historyMode==='all'||r.mode===historyMode)&&r.title.toLowerCase().includes(historyQuery.trim().toLowerCase()));
  $('record-list').innerHTML=rows.length?`<div class="records-table-head"><span>检测作品</span><span>检测类型</span><span class="folder-head">归档目录</span><span class="time-head">检测时间</span><span></span></div>${rows.map(r=>`<button class="record-row" data-action="view" data-id="${r.id}"><span class="record-identity">${image('/api/images/'+r.sha,'作品缩略图')}<span><b title="${esc(r.title)}">${esc(r.title)}</b><small>${esc(r.status)} · ${r.id.slice(0,8).toUpperCase()}</small></span></span><span class="record-type">${modeName(r.mode)}</span><span class="record-folder">${esc(folderName(r.folder))}</span><time class="record-time" datetime="${esc(r.created)}">${date(r.created)}</time>${icon('chevron')}</button>`).join('')}`:
    `<div class="empty-state">${icon(historyQuery?'search':'folder')}<h3>${historyQuery?'没有找到相关记录':'这个目录，还在等待第一份记录'}</h3><p>${historyQuery?'试试其他关键词，或切换文件夹与检测类型。':'完成检测后，报告会自动保存在你选择的文件夹里。'}</p>${historyQuery?'':'<a class="secondary" href="#personal">开始一次检测 '+icon('arrow')+'</a>'}</div>`;
}

function faceBoxes(pairs, side, extra=[]) {
  const boxes = new Map();
  for (const pair of pairs) {
    const box = pair[side + '_box'];
    boxes.set(box.join(','), box);
  }
  for (const entry of extra) { const box=entry[side+'_box']; if (box) boxes.set(box.join(','),box); }
  return [...boxes.values()].sort((a,b) => a[0]-b[0] || a[1]-b[1]);
}
function pairTable(pairs, extra=[], personal=true) {
  if (!pairs.length) return '';
  const l=personal?'reference':'query', r=personal?'query':'reference';
  const left=faceBoxes(pairs,l,extra), right=faceBoxes(pairs,r,extra);
  const number = (boxes,box) => boxes.findIndex(b=>b.join(',')===box.join(','))+1;
  return `<section class="visual-panel"><div class="visual-header"><h3>逐对人脸分数</h3></div><div class="visual-explanation">报告列出 ${pairs.length} 组，${pairs.filter(p=>p.hit).length} 组达到阈值。按分数从高到低排列，最多列出 12 组。</div><table class="threshold-table"><thead><tr><th>左图</th><th>右图</th><th>人脸分数</th><th>筛选结果</th></tr></thead><tbody>${pairs.map(p=>`<tr><td>左 ${number(left,p[l+'_box'])}</td><td>右 ${number(right,p[r+'_box'])}</td><td>${p.score.toFixed(3)}</td><td>${p.hit?'达到阈值':'未达阈值'}</td></tr>`).join('')}</tbody></table></section>`;
}
function stage(url,alt,source,hit,side) {
  const [w,h]=source.size;
  let marks='';
  if(hit&&showOverlay) {
    const regions=hit.regions;
    if(regions.verified) {
      const polygon=regions[side+'_polygon'].map(([x,y])=>(x*100).toFixed(3)+','+(y*100).toFixed(3)).join(' ');
      marks+=`<polygon points="${polygon}" fill="#3b89652b" stroke="#3b8965" stroke-width=".5" vector-effect="non-scaling-stroke"/>`;
      marks+=regions.pairs.map(pair=>`<circle cx="${pair[side==='reference'?0:2]*100}" cy="${pair[side==='reference'?1:3]*100}" r=".7" fill="#3b8965" stroke="#fff" stroke-width=".2"/>`).join('');
    }
    faceBoxes(hit.face_pairs,side,hit.per_face).forEach((box,index)=>{
      const matched=hit.face_pairs.some(p=>p.hit && p[side+'_box'].join(',')===box.join(','));
      const color=matched?'#ba8d3c':'#627283';
      const [x,y,bw,bh]=box;
      marks+=`<rect x="${x/w*100}" y="${y/h*100}" width="${bw/w*100}" height="${bh/h*100}" rx=".5" fill="${matched?'#c4994522':'none'}" stroke="${color}" stroke-width=".6"/><text x="${x/w*100+1}" y="${y/h*100+4}" fill="#fff" stroke="#715522" stroke-width=".2" font-size="3.8">${(side==='reference')===(record.snapshot.mode==='personal')?'左':'右'}${index+1}</text>`;
    });
  }
  return `<div class="image-stage"><div class="image-surface" style="--image-width:min(100%,${Math.round(300*w/h)}px)">${image(url,alt)}${marks?`<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${marks}</svg>`:''}</div></div>`;
}
function metric(label,value,suffix,detail,threshold,status) {
  return `<div class="metric-card"><div class="metric-label">${label}${icon('info')}</div><div class="metric-value">${value}<small>${suffix}</small></div><p>${detail}</p><div class="metric-threshold"><span>${threshold}</span><span class="mini-status ${status===true?'hit':''}">${status===true?'达到筛选阈值':status===false?'未达阈值':'无法比较'}</span></div></div>`;
}
function faceScores(hit, methods) {
  const pairs = hit.face_pairs;
  const rows = hit.per_face || faceBoxes(pairs,'query').map(box =>
    pairs.find(p=>p.query_box.join(',')===box.join(',')));
  const lines = rows.map((p,i)=>`<p><b>${record.snapshot.mode==='personal'?'右':'左'}图人脸 ${i+1}</b>　${p.score == null ? '无法比较' : p.score.toFixed(3)+' · '+(p.hit?'达到阈值':'未达阈值')}</p>`);
  return `<div class="metric-card"><div class="metric-label">每张待检人脸的最高相似分</div>${!hit.per_face && lines.length ? '<small>按历史报告已保存的配对显示</small>' : ''}${lines.join('') || '<p>无可比较的人脸</p>'}<div class="metric-threshold">人脸筛选阈值 ≥ ${methods.cosine_min.toFixed(5)}</div></div>`;
}
function visualPane() {
  const s=record.snapshot, personal=s.mode==='personal', comparisons=s.comparisons;
  if(!comparisons.length) return `<div class="visual-panel"><div class="visual-header"><h3>${icon('scan')}待检查作品</h3></div><div style="padding:22px;max-width:580px;margin:auto">${stage(s.preview,'待检查的作品',s.source,null,'query')}</div><div class="visual-explanation">已与 ${s.summary.scope_count} 张入库图片比对，未发现达到当前阈值的候选。未命中不代表不存在侵权，请继续核实素材来源与授权范围。</div></div><div class="report-next"><div><h3>下一步：确认素材来源与使用许可</h3><p>将授权范围、商用限制、肖像许可与实际发布场景逐项核实。</p></div><button class="text-link" data-action="report-tab" data-id="legal">查看法律参考 ${icon('arrow')}</button></div>`;
  comparisonIndex=Math.min(comparisonIndex,comparisons.length-1);
  const hit=comparisons[comparisonIndex],m=s.methods;
  const hasRegions=hit.regions.verified,faceHits=hit.face_pairs.filter(f=>f.hit).length;
  return `${comparisons.length>1?`<nav class="comparison-picker" aria-label="命中素材">${comparisons.map((item,i)=>`<button data-action="comparison" data-index="${i}" class="${i===comparisonIndex?'active':''}">${image(item.preview,'命中素材缩略图')}${esc(item.title)}</button>`).join('')}</nav>`:''}
    <section class="visual-panel"><div class="visual-header"><h3>${icon('scan')}相似区域对照</h3><label class="overlay-toggle"><input id="overlay-toggle" type="checkbox" ${showOverlay?'checked':''}>显示检测标记</label></div><div class="visual-grid">${(personal?['reference','query']:['query','reference']).map(side=>{
      const ref=side==='reference', title=ref?hit.title:s.original_name;
      const label=ref?(personal?'我的原创素材':'命中的图库照片'):(personal?'疑似侵权作品':'待检查的作品');
      return `<div class="visual-cell"><div class="visual-caption">${label}<span title="${esc(title)}">${esc(title)}</span></div>${stage(ref?hit.preview:s.preview,label,ref?hit.reference_source:s.source,hit,side)}</div>`;
    }).join('')}</div><div class="visual-legend"><span><i class="legend-dot"></i>几何一致的特征点</span><span><i class="legend-dot outline"></i>特征点分布范围</span><span><i class="legend-dot amber"></i>达到阈值的人脸区域</span></div><p class="visual-explanation">${hasRegions?`发现 ${hit.regions.inliers} 个通过几何校验的局部对应点。标记范围由实际匹配点计算，不能解释为逐像素抄袭范围。`:esc(hit.regions.reason||'未发现可靠的局部对应区域。')}${faceHits?' 同时发现 '+faceHits+' 组达到阈值的人脸对应。':''}${!hasRegions&&!faceHits?' 没有可靠定位时不标记相似区域；画面指纹只说明整图结构相近。':''}</p></section>
    ${pairTable(hit.face_pairs,hit.per_face,personal)}
    <div class="metrics">${metric('画面指纹相似度',hit.image.similarity.toFixed(1),'%',`64 位指纹中有 ${64-hit.image.distance} 位一致${hit.image.exact?' · 原件摘要相同':''}`,`筛选阈值 ≥ ${m.image_similarity_min}%`,hit.image.hit)}${faceScores(hit,m)}${metric('局部几何一致点',String(hit.regions.inliers),'个',`内点率 ${(hit.regions.ratio*100).toFixed(1)}% · ${hit.regions.matches} 个初筛匹配`,`≥ ${m.region_inliers_min} 点且内点率 ≥ ${m.region_ratio_min*100}%`,hit.regions.verified)}</div>
    <p class="threshold-note">本报告使用 ${esc(s.pipeline)}。任一指标达到筛选阈值即提示候选。指纹百分数是位一致率，人脸分数和局部内点率也不是侵权概率；相似不能直接认定侵权。<button class="text-link" data-action="standards">查看完整评判标准 ${icon('external')}</button></p>
    ${personal?'':`<p class="threshold-note">命中素材来源：${esc(hit.source)} · 使用范围：${esc(hit.rights)}。来源与授权须另行核实。</p>`}
    <div class="report-next"><div><h3>${personal?'下一步：带着检测依据，核实权利与使用情况':'下一步：核对授权与发布场景'}</h3><p>${personal?'保留原创过程、首次发表记录，以及疑似侵权页面的完整信息。':'结合素材许可、肖像同意与实际用途，完成人工合规复核。'}</p></div><button class="text-link" data-action="report-tab" data-id="legal">${personal?'法律参考与援助':'查看法律参考'} ${icon('arrow')}</button></div>`;
}
function legalPane() {
  const legal=workspace.portrait_law?.[record.snapshot.mode] || record.snapshot.legal, aid=legal.aid;
  return `<p class="law-intro">AI 生成或改绘的形象，能否使人识别出某位自然人？请结合发布文案、人物特征、使用场景和本人同意情况阅读以下条款。此页显示当前指引，导出的历史报告保留生成时的法律参考。</p><div class="law-grid">${legal.articles.map(a=>`<article class="law-card"><h3>${esc(a.title)}</h3><div class="law-title">${esc(a.law)}</div><p>${esc(a.text)}</p><a class="text-link" href="${esc(a.url)}" target="_blank" rel="noopener noreferrer">${esc(a.source)} · 官方原文 ${icon('external')}</a></article>`).join('')}</div>
    ${aid?`<section class="aid-panel"><div><span class="eyebrow">SUPPORT FOR CREATORS</span><h3 style="margin-top:10px">${esc(aid.title)}</h3><div class="aid-phone">12348</div><p>${esc(aid.text)}</p><a class="text-link" href="${esc(aid.url)}" target="_blank" rel="noopener noreferrer">查看法律援助办事指南 ${icon('external')}</a></div><div><h4>咨询前，建议准备</h4><ul>${aid.materials.map(t=>`<li>${esc(t)}</li>`).join('')}</ul><a class="text-link" href="${esc(aid.source_url)}" target="_blank" rel="noopener noreferrer">司法部公共法律服务信息 ${icon('external')}</a></div></section>`:''}
    <p class="legal-notice">${esc(legal.notice)}<br>适用地域：${esc(legal.jurisdiction)} · 法律来源核对日期：${esc(legal.checked_on)}；实际适用请核对届时有效规定。</p>
    
    <!-- 新增：报告内 AI 问答面板 -->
    <div class="report-chat-panel">
      <h3>针对本次报告的 AI 法律解答</h3>
      <div class="chat-history" id="report-chat-history">
        ${legalChatMessages.map(msg => `
          <div class="chat-msg ${msg.role}">
            <div class="chat-bubble">${esc(msg.content)}</div>
          </div>
        `).join('')}
        ${legalChatLoading ? '<div class="chat-msg assistant"><div class="chat-bubble">思考中...</div></div>' : ''}
      </div>
      <div class="chat-input-area">
        <input type="text" id="report-chat-input" placeholder="例如：这张图的用途和授权情况对我有什么影响？" ${legalChatLoading ? 'disabled' : ''}>
        <button class="primary" data-action="report-chat-send">发送</button>
      </div>
    </div>`;
}
const kv = rows => `<dl class="audit-list">${rows.map(([key,value,hash])=>`<dt>${esc(key)}</dt><dd class="${hash?'hash':''}">${esc(value)}</dd>`).join('')}</dl>`;
function auditPane() {
  const s=record.snapshot,m=s.methods;
  return `<section class="audit-panel"><h3>归档与人工复核</h3><p>复核状态由查看报告的人手动保存。请在备注中记录已核对的素材和仍需确认的问题。</p>${kv([['记录名称',record.title],['归档文件夹',folderName(record.folder)],['复核状态',record.status],['备注',record.note||'尚未添加复核备注'],['生成时间',fullDate(s.created)]])}<div class="modal-actions"><button class="secondary" data-action="review">${icon('edit')}编辑名称、目录与复核</button></div></section>
    <section class="audit-panel"><h3>原件与报告完整性</h3>${kv([['待查原件 SHA-256',s.source.sha256,true],...(s.comparisons||[]).map(c=>['比对素材 SHA-256',c.reference_sha,true]),['标准副本 SHA-256',s.source.normalized_sha256,true],['报告 SHA-256',record.seal,true],['原始尺寸',s.source.original_size.join(' × ')],['文件 EXIF 方向',s.source.orientation_corrected?'已根据 EXIF 校正方向':'无需校正方向']])}<p class="audit-callout">证据包包含待查原文件、比对原文件、标准副本、带标记的可读报告、检测快照、法律参考、复核备注及 SHA-256 清单。摘要用于核对文件完整性；未接入公证或第三方可信时间戳。</p>
    <details class="audit-details"><summary>模型、阈值与检索范围</summary>${kv([['画面比对',m.phash],['人脸定位',m.detector+' · 置信度 ≥ '+m.detection_min],['人脸特征',m.encoder+' · '+m.feature_length+' 维'],['局部匹配',m.region_method||'旧版未运行局部匹配'],['检索范围',(s.summary?.scope_count || s.gallery.images)+' 张素材'],['计算设备',m.runtime.provider],['模型摘要',JSON.stringify(m.weights_sha256)],['说明',s.interpretation]])}</details></section>`;
}
function renderReport() {
  const s=record.snapshot;
  if(s.version!==2) return renderLegacy();
  const personal=s.mode==='personal';
  $('main').innerHTML=`<div class="main-content report-content"><a class="text-link back-link" href="#history/${record.folder}">${icon('back')}返回检测记录</a><div class="page-heading"><div><span class="eyebrow">${personal?'PERSONAL COMPARISON REPORT':'CONTENT COMPLIANCE REPORT'}</span><h1>检测报告</h1><p>${modeName(s.mode)} · ${date(s.created)} · 已归档至「${esc(folderName(record.folder))}」</p></div><div class="heading-actions"><a class="secondary" href="#${s.mode}">${icon('plus')}再次检测</a><button class="secondary" data-action="review">${icon('edit')}复核</button><a class="primary" href="/api/reports/${s.id}/evidence" download>${icon('download')}导出证据包</a></div></div>
    <section class="result-summary ${s.summary.hit?'hit':''}"><div class="summary-copy"><div class="summary-icon">${icon(s.summary.hit?'scan':'shield')}</div><div><h2>${s.summary.hit?'发现相似线索，建议进一步核实':'本次范围内未发现达标线索'}</h2><p>${personal?'本次仅对你上传的两张图片进行比对。':`已与 ${s.summary.scope_count} 张入库图片比对，发现 ${s.summary.match_count} 张候选素材。`} 结果不能直接认定${s.summary.hit?'侵权':'无侵权风险'}。</p></div></div><span class="summary-tag">${s.summary.hit?'建议人工复核':'仍需核实授权'}</span></section>
    <div class="result-tabs" role="tablist" aria-label="检测报告内容">${[['visual','相似区域与分数'],['legal',personal?'法律参考与援助':'法律参考'],['audit','归档与证据']].map(([key,title])=>`<button class="result-tab ${reportTab===key?'active':''}" data-action="report-tab" data-id="${key}" role="tab" tabindex="${reportTab===key?0:-1}" aria-selected="${reportTab===key}" aria-controls="report-pane" id="tab-${key}">${title}</button>`).join('')}</div><div id="report-pane" role="tabpanel" aria-labelledby="tab-${reportTab}">${reportTab==='visual'?visualPane():reportTab==='legal'?legalPane():auditPane()}</div><div class="report-meta"><span>记录 ${s.id.slice(0,8).toUpperCase()} · ${esc(record.status)}</span><span>本机计算与留档 · ${esc(s.pipeline)}</span></div></div>`;
}
function renderLegacy() {
  const s=record.snapshot;
  $('main').innerHTML=`<div class="main-content report-content"><a class="text-link back-link" href="#history">${icon('back')}返回记录</a><div class="page-heading"><div><h1>历史版本检测报告</h1><p>${esc(record.title)} · ${date(s.created)}</p></div><a class="primary" href="/api/reports/${s.id}/evidence" download>${icon('download')}导出证据包</a></div><p class="law-intro">这份记录由旧版生成，未运行双图或局部特征对比。原始快照与证据保留。</p><section class="audit-panel">${kv([['相同文件',(s.exact||[]).length+' 张'],['近似画面',(s.near||[]).length+' 张'],['检出人脸',(s.faces||[]).length+' 张'],['解释',s.interpretation]])}<a class="text-link" href="/api/reports/${s.id}/json" download>下载完整检测快照 ${icon('download')}</a></section><div style="max-width:500px;margin:20px auto">${stage(s.preview,'历史检测作品',s.source,null,'query')}</div></div>`;
}
function showReview() {
  $('review-dialog').innerHTML=modalHead('review-title-label','整理这次检测','先核对配对图片、来源和使用说明，再记录判断依据。核对完成选“已复核”，依据不足选“需补充材料”。','edit')+`<form id="review-form"><label class="field">记录名称<input name="title" maxlength="180" required value="${esc(record.title)}"></label><label class="field">归档文件夹<select name="folder">${workspace.folders.map(f=>`<option value="${f.id}" ${record.folder===f.id?'selected':''}>${esc(f.name)}</option>`).join('')}</select></label><label class="field">复核状态<select name="status">${['待复核','需补充材料','已复核'].map(t=>`<option ${record.status===t?'selected':''}>${t}</option>`).join('')}</select></label><label class="field">复核备注<textarea name="note" maxlength="4000" placeholder="记录权属、授权材料、发布场景或下一步处理意见">${esc(record.note)}</textarea></label><p id="review-error" class="form-error" role="alert"></p><div class="modal-actions"><button type="button" class="secondary" data-close>取消</button><button class="primary">保存复核 ${icon('check')}</button></div></form>`;
  openDialog('review-dialog');
}
function showStandards() {
  $('help-dialog').innerHTML=modalHead('help-title','从上传到留证，一次完成','了解检测范围，以及每一个分数的含义。','scale')+`<div class="help-sections"><section class="help-block"><h3>个人用户 / 对比检测</h3><p>左侧上传你的原创素材，右侧上传疑似侵权作品。系统只比较这两张图，查看整图结构、人脸与局部对应线索。</p></section><section class="help-block"><h3>企业用户 / 合规检查</h3><p>上传一张待发布作品，与本机已入库素材比对。当前素材库仅包含 ${workspace.database?.images||0} 张比赛演示图片，<b>不覆盖全网，不检测 AI 生成来源</b>。未命中不能作为商用授权证明。</p></section><section class="help-block"><h3>筛选标准，清楚可查</h3><table class="threshold-table"><tbody><tr><td>整图相似</td><td>64 位 pHash 汉明距离 ≤ 8，即指纹位一致率 ≥ 87.5%。百分数是位一致率。</td></tr><tr><td>人脸相似</td><td>2.2 版先校正人脸方向，再用按人物文件夹训练的度量计算余弦。筛选阈值由独立人物验证集选定。报告附原始 ArcFace 分数和同组配对的分数位置；历史报告采用生成时的阈值。</td></tr><tr><td>局部相似</td><td>ORB 特征通过 RANSAC 校验：几何一致点 ≥ 12，内点率 ≥ 40%，两图中点分布面积各 ≥ 0.2%。</td></tr></tbody></table><p style="margin-top:12px">任一指标达标即提示线索。<b>这些是未经业务数据校准的演示阈值，不是侵权概率或法律标准。</b>风格相似、同一人物或相似构图均不能直接证明侵权。</p></section><section class="help-block"><h3>自动归档与证据包</h3><p>首次检测时创建文件夹；上传框左下角可以更换目录。记录中可搜索、回看、复核与调整归档。证据包包含双方原件、标准副本、可读报告、快照、法律参考和摘要清单。时间来自本机，未经公证或可信时间戳认证。</p></section></div><div class="modal-actions"><button class="primary" data-close>了解了 ${icon('check')}</button></div>`;
  openDialog('help-dialog');
}

function renderGlobalChat() {
  const panel = $('global-chat-panel');
  if (!panel) return;
  panel.classList.toggle('open', globalChatOpen);
  panel.innerHTML = `
    <div class="chat-panel-header">
      <span>独立 AI 法律助理</span>
      <button class="icon-button" id="global-chat-close">${icon('close')}</button>
    </div>
    <div class="chat-history" id="global-chat-history">
      ${globalChatMessages.map(msg => `
        <div class="chat-msg ${msg.role}">
          <div class="chat-bubble">${esc(msg.content)}</div>
        </div>
      `).join('')}
      ${globalChatLoading ? '<div class="chat-msg assistant"><div class="chat-bubble">思考中...</div></div>' : ''}
    </div>
    <div class="chat-input-area">
      <input type="text" id="global-chat-input" placeholder="输入您的问题，如：AI 生成图像算侵权吗？" ${globalChatLoading ? 'disabled' : ''}>
      <button class="primary" id="global-chat-send">发送</button>
    </div>
  `;
  
  $('global-chat-close').onclick = () => { globalChatOpen = false; renderGlobalChat(); };
  $('global-chat-send').onclick = sendGlobalChat;
  $('global-chat-input').onkeydown = (e) => { if(e.key === 'Enter') sendGlobalChat(); };
}

function sendGlobalChat() {
  const input = $('global-chat-input');
  const text = input?.value.trim();
  if (!text || globalChatLoading) return;

  globalChatMessages.push({role: 'user', content: text});
  globalChatLoading = true;
  renderGlobalChat();

  fetch('/api/legal-chat', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({question: text, context: {mode: 'personal'}})
  })
  .then(res => res.json())
  .then(data => {
    globalChatMessages.push({role: 'assistant', content: data.answer || '服务异常'});
  })
  .catch(() => {
    globalChatMessages.push({role: 'assistant', content: '网络异常，请稍后重试'});
  })
  .finally(() => {
    globalChatLoading = false;
    renderGlobalChat();
  });
}

async function route() {
  if(!workspace)return;
  const version=++routeVersion;
  const [page='personal',id]=location.hash.slice(1).split('/');
  const current=['personal','compliance','history','report'].includes(page)?page:'personal';
  $('crumb').textContent={personal:'对比检测',compliance:'合规检查',history:'检测记录',report:'检测报告'}[current];
  document.title='VisionJudge · '+$('crumb').textContent;
  if(current==='report') {
    try {
      if(!record||record.snapshot.id!==id) {
        const loaded=await request('/api/reports/'+encodeURIComponent(id));
        if(version!==routeVersion)return;
        record=loaded;reportTab='visual';comparisonIndex=0;showOverlay=true;
      }
      expandedFolders.add(record.folder);renderReport();
    } catch(e) {$('main').innerHTML=`<div class="main-content"><div class="error-panel"><h2>这份记录暂时无法打开</h2><p>${esc(e.message)}</p><a class="secondary" href="#history">返回检测记录</a></div></div>`;}
  } else if(current==='history') {if(id)expandedFolders.add(id);renderHistory();}
  else {mode=current;renderNew();}
  renderSidebar();window.scrollTo(0,0);
}

document.addEventListener('click',async event=>{
  const close=event.target.closest('[data-close]');
  if(close){close.closest('dialog').close();return;}
  if(working&&!event.target.closest('form[action="/logout"]')&&event.target.closest('a,button')){event.preventDefault();return;}
  const button=event.target.closest('[data-action]');
  if(!button)return;
  const {action,id,slot,index}=button.dataset;
  if(action==='pick')$('file-'+slot).click();
  else if(action==='remove'){selectionVersions[slot]=(selectionVersions[slot]||0)+1;files[slot]=null;URL.revokeObjectURL(previews[slot]);delete previews[slot];renderNew();}
  else if(action==='start')await startCheck();
  else if(action==='folder')showFolders();
  else if(action==='choose-folder') {
    const resume=pendingStart;setFolder(id);$('folder-dialog').close();
    renderSidebar();if(['#personal','#compliance',''].includes(location.hash))renderNew();
    if(resume)await startCheck();else notify('已选择归档目录：'+folderName(id));
  }
  else if(action==='expand'){expandedFolders.has(id)?expandedFolders.delete(id):expandedFolders.add(id);renderSidebar();}
  else if(action==='view')location.hash='report/'+id;
  else if(action==='history-mode'){historyMode=id;renderHistory();}
  else if(action==='comparison'){comparisonIndex=Number(index);renderReport();}
  else if(action==='report-tab'){reportTab=id;renderReport();$('tab-'+id)?.focus({preventScroll:true});}
  else if(action==='review')showReview();
  else if(action==='standards')showStandards();
  else if(action==='report-chat-send') {
    const input = $('report-chat-input');
    const text = input?.value.trim();
    if(!text || legalChatLoading) return;
    
    legalChatMessages.push({role:'user', content:text});
    legalChatLoading = true;
    renderReport();
    
    // 提取真实报告背景数据
    const reportContext = {
      mode: record.snapshot.mode,
      face_signal: record.snapshot.summary?.hit ? "有相似线索" : "未发现达标线索",
      consent: "未知",
      use: "未知",
      similarity: record.snapshot.comparisons?.[0]?.image?.similarity || 0,
      match_count: record.snapshot.summary?.match_count || 0
    };

    fetch('/api/legal-chat', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({question: text, context: reportContext})
    })
    .then(res => res.json())
    .then(data => {
      legalChatMessages.push({role:'assistant', content:data.answer || '服务暂时异常，请稍后重试'});
    })
    .catch(() => {
      legalChatMessages.push({role:'assistant', content:'网络异常，请稍后重试，您仍可查看上方法律参考。'});
    })
    .finally(() => {
      legalChatLoading = false;
      renderReport();
    });
  }
});
document.addEventListener('change',event=>{
  if(event.target.matches('input[type=file][data-slot]'))selectFile(event.target.dataset.slot,event.target.files[0]);
  if(event.target.id==='overlay-toggle'){showOverlay=event.target.checked;renderReport();$('overlay-toggle')?.focus({preventScroll:true});}
});
document.addEventListener('input',event=>{if(event.target.id==='history-search'){historyQuery=event.target.value;filterHistory();}});
document.addEventListener('dragover',event=>{const zone=event.target.closest('[data-drop]');if(zone&&!working){event.preventDefault();zone.classList.add('dragover');}});
document.addEventListener('dragleave',event=>{const zone=event.target.closest('[data-drop]');if(zone&&!zone.contains(event.relatedTarget))zone.classList.remove('dragover');});
document.addEventListener('drop',event=>{
  if(event.dataTransfer?.files.length)event.preventDefault();
  const zone=event.target.closest('[data-drop]');if(!zone||working)return;
  zone.classList.remove('dragover');
  if(event.dataTransfer.files.length!==1)return notify('每个上传区域请选择一张图片。');
  selectFile(zone.dataset.drop,event.dataTransfer.files[0]);
});
document.addEventListener('submit',async event=>{
  const form=event.target;
  if(!['folder-form','review-form'].includes(form.id))return;
  event.preventDefault();
  const submit=form.querySelector('button[type=submit],button:not([type])');
  if(submit?.disabled)return;
  if(submit)submit.disabled=true;
  try {
    const data=Object.fromEntries(new FormData(form));
    if(form.id==='folder-form') {
      const resume=pendingStart;
      const created=await postJSON('/api/folders',{name:data.name});
      await refresh();setFolder(created.id);$('folder-dialog').close();await route();
      if(resume)await startCheck();else notify('已选择文件夹：'+created.name);
    } else {
      const rid=record.snapshot.id;
      record=await postJSON('/api/reports/'+rid+'/review',data);
      await refresh();expandedFolders.add(record.folder);$('review-dialog').close();await route();notify('复核信息已保存。');
    }
  } catch(e) {$(form.id==='folder-form'?'folder-error':'review-error').textContent=e.message;}
  finally {if(submit)submit.disabled=false;}
});
$('folder-dialog').addEventListener('close',()=>{pendingStart=false;});
$('busy-dialog').addEventListener('cancel',event=>{if(working)event.preventDefault();});
document.addEventListener('keydown',event=>{
  const tab=event.target.closest('[role=tab]');
  if(tab&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
    event.preventDefault();const tabs=['visual','legal','audit'];
    const i=tabs.indexOf(reportTab);reportTab=event.key==='Home'?'visual':event.key==='End'?'audit':tabs[(i+(event.key==='ArrowRight'?1:2))%3];renderReport();$('tab-'+reportTab).focus();
  }
});
window.addEventListener('hashchange',route);

// 初始化及全局助手绑定
$('global-chat-toggle').onclick = () => { globalChatOpen = !globalChatOpen; renderGlobalChat(); };
refresh().then(route).catch(error=>{
  $('main').innerHTML=`<div class="main-content"><div class="error-panel"><h2>工作空间暂时无法连接</h2><p>${esc(error.message)}</p><p>请通过项目中的「启动工作台.bat」打开本机服务。</p><button class="secondary" data-action="reload">重新连接</button></div></div>`;
  document.querySelector('[data-action=reload]')?.addEventListener('click',()=>location.reload());
});