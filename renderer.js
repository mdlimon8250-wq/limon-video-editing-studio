const {ipcRenderer:ipc}=require('electron'),{pathToFileURL}=require('url');
const $=s=>document.querySelector(s),P={media:[],clips:[],caps:[],style:{font:'Arial',size:42,color:'#ffffff'}};
let t=0,playing=false,sel=null,Z=40,last=performance.now(),T=0;
const dur=c=>(c.out-c.in)/c.speed,V=()=>P.clips.filter(c=>c.track==='v'),A=()=>P.clips.filter(c=>c.track==='a');
const at=(l,x)=>l.find(c=>x>=c.start&&x<c.start+dur(c));
const PC={none:'',bw:'grayscale(1)',sepia:'sepia(.9)',warm:'sepia(.3) saturate(1.3)',cool:'hue-rotate(15deg) saturate(.9)',vivid:'saturate(1.6) contrast(1.1)'};
const css=c=>`brightness(${1+c.b}) contrast(${c.c}) saturate(${c.s}) ${PC[c.preset]}`;
function lay(){let x=0;V().forEach(c=>{c.start=x;x+=dur(c)});T=Math.max(x,0,...A().map(c=>c.start+dur(c)))}
function setSrc(el,m){const u=pathToFileURL(m.path).href;if(el.dataset.u!==u){el.dataset.u=u;el.src=u}}
function sync(el,c,on){if(!c){if(!el.paused)el.pause();return}
  const g=c.in+(t-c.start)*c.speed;if(Math.abs(el.currentTime-g)>(playing?.35:.03))el.currentTime=g;
  el.playbackRate=c.speed;el.volume=Math.min(1,c.vol);if(playing&&el.paused)el.play().catch(()=>{});if(!playing&&!el.paused)el.pause()}
function render(){lay();const vc=at(V(),t),ac=at(A(),t),vid=$('#vid'),img=$('#img');vid.style.display=img.style.display='none';
  if(vc){const m=P.media[vc.mid],el=m.type==='image'?img:vid;el.style.display='block';el.style.filter=css(vc);setSrc(el,m);if(el===vid)sync(vid,vc);else if(!vid.paused)vid.pause()}else if(!vid.paused)vid.pause();
  if(ac){setSrc($('#aud'),P.media[ac.mid])}sync($('#aud'),ac);
  const k=P.caps.find(k=>t>=k.s&&t<k.e);$('#cap').textContent=k?k.text:'';$('#cap').style.fontSize=P.style.size/2+'px';$('#cap').style.color=P.style.color;
  $('#ph').style.left=t*Z+'px';$('#tm').textContent=`${fmt(t)} / ${fmt(T)}`}
const fmt=s=>`${Math.floor(s/60)}:${(s%60).toFixed(1).padStart(4,'0')}`;
function frame(now){const dt=(now-last)/1000;last=now;if(playing){t+=dt;if(t>=T){t=T;setPlay(false)}}render();requestAnimationFrame(frame)}
function setPlay(p){playing=p;$('#pl').textContent=p?'Pause':'Play';if(p&&t>=T)t=0}
function draw(){lay();$('#tracks').style.width=Math.max(T*Z+300,900)+'px';
  const r=$('#ruler');r.innerHTML='';const step=Math.ceil(70/Z);for(let s=0;s<=T+10;s+=step){const i=document.createElement('i');i.style.left=s*Z+'px';i.textContent=fmt(s).slice(0,-2);r.appendChild(i)}
  for(const [id,l] of [['#tv',V()],['#ta',A()]])$(id).querySelectorAll('.clip').forEach(e=>e.remove()),l.forEach(c=>{const d=document.createElement('div');d.className='clip'+(c===sel?' sel':'');d.style.left=c.start*Z+'px';d.style.width=Math.max(dur(c)*Z,8)+'px';d.textContent=P.media[c.mid].name;
    d.onmousedown=e=>{sel=c;insp();if(c.track==='a'){const x0=e.clientX,s0=c.start;const mv=ev=>{c.start=Math.max(0,s0+(ev.clientX-x0)/Z);d.style.left=c.start*Z+'px'};const up=()=>{removeEventListener('mousemove',mv);removeEventListener('mouseup',up);draw()};addEventListener('mousemove',mv);addEventListener('mouseup',up)}};
    d.onclick=()=>draw();$(id).appendChild(d)})}
$('#tracks').addEventListener('click',e=>{if(e.target.closest('.clip')&&e.target.closest('#ta'))return;t=Math.max(0,Math.min(T,(e.clientX-$('#tracks').getBoundingClientRect().left-60)/Z))});
const K={sp:'speed',vo:'vol',br:'b',co:'c',sa:'s',pr:'preset',tr:'trans'};
function insp(){for(const id in K){const e=$('#'+id);e.disabled=!sel;if(sel)e.value=sel[K[id]]}}
for(const id in K)$('#'+id).oninput=()=>{if(!sel)return;const v=$('#'+id).value;sel[K[id]]=['pr','tr'].includes(id)?v:(+v||1);if(id==='br')sel.b=+v;draw()};
function drawMedia(){const l=$('#ml');l.innerHTML='';P.media.forEach((m,i)=>{const d=document.createElement('div');d.className='mi';d.innerHTML='<span></span><button>+</button>';d.firstChild.textContent=`${m.type}: ${m.name}`;d.lastChild.onclick=()=>{const a=m.type==='audio';P.clips.push({mid:i,track:a?'a':'v',start:a?t:0,in:0,out:m.dur||5,speed:1,vol:1,b:0,c:1,s:1,preset:'none',trans:'none'});sel=P.clips.at(-1);draw();insp()};l.appendChild(d)})}
function drawCaps(){const l=$('#caps');l.innerHTML='';P.caps.sort((a,b)=>a.s-b.s);P.caps.forEach((k,i)=>{const r=document.createElement('div');r.className='cap';r.innerHTML='<input type=number step=.1><input type=number step=.1><input><button>×</button>';const [a,b,c,x]=r.children;a.value=k.s.toFixed(1);b.value=k.e.toFixed(1);c.value=k.text;a.oninput=()=>k.s=+a.value;b.oninput=()=>k.e=+b.value;c.oninput=()=>k.text=c.value;x.onclick=()=>{P.caps.splice(i,1);drawCaps()};l.appendChild(r)})}
function split(){const c=at(sel&&sel.track==='v'?[sel]:V(),t)||at(V(),t);if(!c)return;const p=c.in+(t-c.start)*c.speed;if(p<=c.in+.05||p>=c.out-.05)return;const n={...c,in:p};c.out=p;P.clips.splice(P.clips.indexOf(c)+1,0,n);n.start=c.start+dur(c);draw()}
function del(){if(!sel)return;P.clips.splice(P.clips.indexOf(sel),1);sel=null;draw();insp()}
function move(d){if(!sel||sel.track!=='v')return;const v=V(),i=v.indexOf(sel),o=v[i+d];if(!o)return;const a=P.clips.indexOf(sel),b=P.clips.indexOf(o);[P.clips[a],P.clips[b]]=[P.clips[b],P.clips[a]];draw()}
const msg=s=>$('#msg').textContent=s;ipc.on('msg',(_,s)=>msg(s));ipc.on('prog',(_,p)=>msg(`Exporting ${Math.min(99,Math.round(p*100))}%`));
const pay=()=>{lay();P.style={font:$('#fo').value,size:+$('#fs').value,color:$('#fc').value};return {...P,total:T}};
$('#imp').onclick=async()=>{P.media.push(...await ipc.invoke('open'));drawMedia()};
$('#pl').onclick=()=>setPlay(!playing);$('#sp1').onclick=split;$('#dl').onclick=del;$('#mL').onclick=()=>move(-1);$('#mR').onclick=()=>move(1);
$('#zi').onclick=()=>{Z=Math.min(200,Z*1.5);draw()};$('#zo').onclick=()=>{Z=Math.max(5,Z/1.5);draw()};
$('#ad').onclick=()=>{P.caps.push({s:t,e:t+2,text:'New caption'});drawCaps()};
$('#ac').onclick=async()=>{const r=await ipc.invoke('caption',pay(),$('#md').value,$('#lg').value);if(typeof r==='string')return msg(r.slice(0,200));P.caps=r;drawCaps();msg(`${r.length} captions added — edit them below`)};
$('#ex').onclick=async()=>{msg('Exporting…');const r=await ipc.invoke('export',pay());msg(r==='ok'?'Export finished ✔':r==='cancel'?'':r.slice(0,200))};
$('#sv').onclick=()=>ipc.invoke('save',JSON.stringify(pay()));
$('#ld').onclick=async()=>{const j=await ipc.invoke('load');if(!j)return;Object.assign(P,JSON.parse(j));sel=null;drawMedia();drawCaps();draw();insp()};
addEventListener('keydown',e=>{if(/INPUT|SELECT/.test(e.target.tagName))return;if(e.code==='Space'){e.preventDefault();setPlay(!playing)}if(e.key==='s')split();if(e.key==='Delete')del()});
draw();insp();requestAnimationFrame(frame);
