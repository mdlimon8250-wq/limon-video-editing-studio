const {app,BrowserWindow,ipcMain,dialog}=require('electron');
const path=require('path'),fs=require('fs'),os=require('os'),{spawn}=require('child_process');
const ffmpeg=require('ffmpeg-static');
let win;
app.whenReady().then(()=>{win=new BrowserWindow({width:1440,height:880,backgroundColor:'#16181d',webPreferences:{nodeIntegration:true,contextIsolation:false}});win.setMenuBarVisibility(false);win.loadFile('index.html')});
app.on('window-all-closed',()=>app.quit());

const run=(args,cwd,onT)=>new Promise((res,rej)=>{const p=spawn(ffmpeg,args,{cwd});let e='';p.stderr.on('data',d=>{const s=d.toString();e+=s;const m=s.match(/time=(\d+):(\d+):([\d.]+)/);if(m&&onT)onT(+m[1]*3600+ +m[2]*60+ +m[3])});p.on('close',c=>c===0?res():rej(new Error(e.slice(-900))))});
const probe=f=>new Promise(r=>{const p=spawn(ffmpeg,['-i',f]);let e='';p.stderr.on('data',d=>e+=d);p.on('close',()=>{const d=e.match(/Duration: (\d+):(\d+):([\d.]+)/),img=/\.(png|jpe?g|webp|bmp)$/i.test(f);r({path:f,name:path.basename(f),dur:img?5:d?+d[1]*3600+ +d[2]*60+ +d[3]:0,type:img?'image':/Video:/.test(e)?'video':'audio',hasAudio:/Audio:/.test(e)})})});
ipcMain.handle('open',async()=>{const r=await dialog.showOpenDialog(win,{properties:['openFile','multiSelections']});return r.canceled?[]:Promise.all(r.filePaths.map(probe))});
ipcMain.handle('save',async(_,j)=>{const r=await dialog.showSaveDialog(win,{defaultPath:'project.limon'});if(!r.canceled)fs.writeFileSync(r.filePath,j)});
ipcMain.handle('load',async()=>{const r=await dialog.showOpenDialog(win,{properties:['openFile']});return r.canceled?null:fs.readFileSync(r.filePaths[0],'utf8')});

const tempo=s=>{const a=[];while(s>2){a.push('atempo=2');s/=2}while(s<.5){a.push('atempo=.5');s*=2}a.push('atempo='+s);return a.join(',')};
const PRE={bw:',hue=s=0',sepia:',colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131:0',warm:',colorbalance=rs=.12:bs=-.12',cool:',colorbalance=rs=-.1:bs=.12',vivid:',eq=saturation=1.5:contrast=1.1'};
const ts=s=>`${Math.floor(s/3600)}:${String(Math.floor(s%3600/60)).padStart(2,'0')}:${(s%60).toFixed(2).padStart(5,'0')}`;
const ass=P=>{const c=(P.style.color||'#ffffff').slice(1),bgr=c.slice(4,6)+c.slice(2,4)+c.slice(0,2);return `[Script Info]\nScriptType: v4.00+\nPlayResX: 1280\nPlayResY: 720\n\n[V4+ Styles]\nFormat: Name,Fontname,Fontsize,PrimaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding\nStyle: D,${P.style.font},${P.style.size},&H00${bgr},&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,3,1,2,40,40,50,1\n\n[Events]\nFormat: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\n`+P.caps.map(k=>`Dialogue: 0,${ts(k.s)},${ts(k.e)},D,,0,0,0,,${k.text.replace(/\n/g,'\\N')}`).join('\n')};

function build(P,ao,tmp){
  const args=[],f=[],cat=[];let n=0;
  const V=P.clips.filter(c=>c.track==='v'),A=P.clips.filter(c=>c.track==='a');
  V.forEach((c,i)=>{const m=P.media[c.mid],d=(c.out-c.in)/c.speed,k=n++,fd=c.trans==='fade'&&d>1;
    args.push(...(m.type==='image'?['-loop','1','-t',String(c.out),'-i',m.path]:['-i',m.path]));
    if(!ao){f.push(`[${k}:v]trim=${c.in}:${c.out},setpts=(PTS-STARTPTS)/${c.speed},scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,eq=brightness=${c.b}:contrast=${c.c}:saturation=${c.s}${PRE[c.preset]||''}${fd?`,fade=t=in:st=0:d=.5,fade=t=out:st=${d-.5}:d=.5`:''}[v${i}]`);cat.push(`[v${i}]`)}
    const src=m.type==='video'&&m.hasAudio?`[${k}:a]atrim=${c.in}:${c.out},asetpts=PTS-STARTPTS,${tempo(c.speed)},volume=${c.vol}`:`anullsrc=r=44100:cl=stereo,atrim=0:${d},asetpts=PTS-STARTPTS`;
    f.push(`${src},aresample=44100,aformat=channel_layouts=stereo${fd?`,afade=t=in:st=0:d=.5,afade=t=out:st=${d-.5}:d=.5`:''}[a${i}]`);cat.push(`[a${i}]`)});
  if(!V.length)throw new Error('Add at least one video or image to the timeline.');
  f.push(`${cat.join('')}concat=n=${V.length}:v=${ao?0:1}:a=1${ao?'[ac]':'[vc][ac]'}`);
  const al=['[ac]'];
  A.forEach((c,j)=>{const m=P.media[c.mid],k=n++,ms=Math.round(c.start*1000);args.push('-i',m.path);
    f.push(`[${k}:a]atrim=${c.in}:${c.out},asetpts=PTS-STARTPTS,${tempo(c.speed)},volume=${c.vol},aresample=44100,aformat=channel_layouts=stereo,adelay=${ms}|${ms}[x${j}]`);al.push(`[x${j}]`)});
  f.push(al.length>1?`${al.join('')}amix=inputs=${al.length}:normalize=0:duration=longest[aout]`:'[ac]anull[aout]');
  if(!ao){if(P.caps.length){fs.writeFileSync(path.join(tmp,'s.ass'),ass(P));f.push('[vc]subtitles=s.ass[vf]')}else f.push('[vc]null[vf]')}
  return {args,fc:f.join(';')};
}
const tmpdir=()=>fs.mkdtempSync(path.join(os.tmpdir(),'limon-studio-'));

ipcMain.handle('export',async(_,P)=>{
  const r=await dialog.showSaveDialog(win,{defaultPath:'video.mp4',filters:[{name:'MP4',extensions:['mp4']}]});if(r.canceled)return 'cancel';
  try{const tmp=tmpdir(),g=build(P,false,tmp);
    await run([...g.args,'-filter_complex',g.fc,'-map','[vf]','-map','[aout]','-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-y',r.filePath],tmp,t=>win.webContents.send('prog',t/P.total));return 'ok'}
  catch(e){return 'ERR:'+e.message}});

let asr,asrM;
ipcMain.handle('caption',async(_,P,model,lang)=>{
  try{const tmp=tmpdir(),raw=path.join(tmp,'a.raw'),g=build(P,true,tmp);
    win.webContents.send('msg','Extracting audio…');
    await run([...g.args,'-filter_complex',g.fc,'-map','[aout]','-ac','1','-ar','16000','-f','f32le','-y',raw],tmp);
    const b=fs.readFileSync(raw),pcm=new Float32Array(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));
    const {pipeline,env}=await import('@xenova/transformers');env.cacheDir=path.join(app.getPath('userData'),'models');
    if(asrM!==model){asr=await pipeline('automatic-speech-recognition','Xenova/whisper-'+model,{progress_callback:p=>win.webContents.send('msg',p.status==='progress'?`Downloading model ${Math.round(p.progress)}% (first time only)`:'Loading model…')});asrM=model}
    win.webContents.send('msg','Transcribing… (may take a while)');
    const o=await asr(pcm,{language:lang==='auto'?undefined:lang,task:'transcribe',return_timestamps:true,chunk_length_s:30,stride_length_s:5});
    return o.chunks.map(c=>({s:c.timestamp[0],e:c.timestamp[1]??c.timestamp[0]+2,text:c.text.trim()}))}
  catch(e){return 'ERR:'+e.message}});
