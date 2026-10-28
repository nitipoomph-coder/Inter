const TH_MONTHS=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const TH_DAYS=['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
const STATUS={work:'ทำงาน',wfh:'WFH',leave:'ลา',holiday:'วันหยุด'};
const COLORS={work:'FFDCFCE7',wfh:'FFE0F2FE',leave:'FFFEF3C7',holiday:'FFFFE4E6'};
const $=id=>document.getElementById(id);
let entries=JSON.parse(localStorage.getItem('entries')||'{}');
let profile=JSON.parse(localStorage.getItem('profile')||'{}');
let cur=new Date();cur.setDate(1);let editing=null;

const key=(y,m,d)=>`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
const save=()=>localStorage.setItem('entries',JSON.stringify(entries));
function hours(e){if(!e||!(e.status==='work'||e.status==='wfh')||!e.in||!e.out)return 0;
  const[a,b]=e.in.split(':').map(Number),[c,d]=e.out.split(':').map(Number);
  return Math.max(0,((c*60+d)-(a*60+b)-(+e.brk||0))/60);}
function toast(t){const el=$('toast');el.textContent=t;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2200);}
function monthKeys(){const y=cur.getFullYear(),m=cur.getMonth(),n=new Date(y,m+1,0).getDate();
  return Array.from({length:n},(_,i)=>key(y,m,i+1));}

function render(){
  const y=cur.getFullYear(),m=cur.getMonth();
  $('month-label').textContent=`${TH_MONTHS[m]} ${y+543}`;
  const grid=$('grid');grid.innerHTML='';
  const first=new Date(y,m,1).getDay(),n=new Date(y,m+1,0).getDate(),tk=key(new Date().getFullYear(),new Date().getMonth(),new Date().getDate());
  for(let i=0;i<first;i++)grid.insertAdjacentHTML('beforeend','<div class="day empty"></div>');
  for(let d=1;d<=n;d++){const k=key(y,m,d),e=entries[k],wd=new Date(y,m,d).getDay();
    const div=document.createElement('div');div.className='day'+(wd%6===0?' weekend':'')+(k===tk?' today':'');
    div.id='day-'+k;div.style.animationDelay=d*12+'ms';
    div.innerHTML=`<span class="num">${d}</span>${e?`<span class="tag ${e.status}">${STATUS[e.status]}${hours(e)?' · '+hours(e).toFixed(1)+'ชม.':''}</span><small>${esc(e.task||'')}</small>`:''}`;
    div.onclick=()=>openDay(k,d);grid.appendChild(div);}
  const ks=monthKeys(),es=ks.map(k=>entries[k]).filter(Boolean);
  const total=es.reduce((s,e)=>s+hours(e),0),days=es.filter(e=>e.status==='work'||e.status==='wfh').length,leave=es.filter(e=>e.status==='leave').length;
  const all=Object.values(entries).reduce((s,e)=>s+hours(e),0);
  $('stats').innerHTML=[[total.toFixed(1),'ชั่วโมงเดือนนี้'],[days,'วันทำงานเดือนนี้'],[leave,'วันลาเดือนนี้'],[all.toFixed(1),'ชั่วโมงสะสมทั้งหมด']]
    .map(([v,l],i)=>`<div class="stat" style="animation-delay:${i*80}ms"><b>${v}</b><span>${l}</span></div>`).join('');
  $('list').querySelector('tbody').innerHTML=ks.filter(k=>entries[k]).map(k=>{const e=entries[k],d=new Date(k+'T00:00');
    return `<tr><td>${d.getDate()} ${TH_MONTHS[m].slice(0,3)} (${TH_DAYS[d.getDay()]})</td><td><span class="tag ${e.status}">${STATUS[e.status]}</span></td><td>${e.in||'-'}</td><td>${e.out||'-'}</td><td>${hours(e).toFixed(1)}</td><td>${esc(e.task||'')}</td></tr>`}).join('')
    ||'<tr><td colspan="6" style="text-align:center;color:var(--mute)">ยังไม่มีข้อมูล — คลิกวันในปฏิทินเพื่อเพิ่ม</td></tr>';
}
const esc=s=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

function openDay(k,d){editing=k;const e=entries[k]||{},dt=new Date(k+'T00:00');
  $('day-title').textContent=`วัน${TH_DAYS[dt.getDay()]}ที่ ${d} ${TH_MONTHS[dt.getMonth()]} ${dt.getFullYear()+543}`;
  $('f-status').value=e.status||(dt.getDay()%6===0?'holiday':'work');$('f-in').value=e.in||'09:00';$('f-out').value=e.out||'18:00';
  $('f-break').value=e.brk??60;$('f-task').value=e.task||'';$('f-learn').value=e.learn||'';$('f-note').value=e.note||'';
  $('btn-delete').style.visibility=entries[k]?'visible':'hidden';$('day-modal').showModal();}
$('day-form').onsubmit=()=>{entries[editing]={status:$('f-status').value,in:$('f-in').value,out:$('f-out').value,brk:+$('f-break').value,task:$('f-task').value.trim(),learn:$('f-learn').value.trim(),note:$('f-note').value.trim()};save();render();toast('บันทึกแล้ว ✓');};
$('btn-cancel').onclick=()=>$('day-modal').close();
$('btn-delete').onclick=()=>{delete entries[editing];save();render();$('day-modal').close();toast('ลบแล้ว');};
$('prev').onclick=()=>{cur.setMonth(cur.getMonth()-1);render();};
$('next').onclick=()=>{cur.setMonth(cur.getMonth()+1);render();};
$('today').onclick=()=>{cur=new Date();cur.setDate(1);render();};

const P=['name','id','major','uni','term','company','dept','start','end','mentor','advisor'];
const thDate=d=>`${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear()+543}`;
const WEEK_ORDER=[1,2,3,4,5,6,0];
function addWeekSheet(wb,mon){
  const F='TH Sarabun New',thin={style:'thin'},border={top:thin,left:thin,bottom:thin,right:thin};
  const sun=new Date(mon);sun.setDate(mon.getDate()+6);
  let no='';if(profile.start){const s=new Date(profile.start+'T00:00');s.setDate(s.getDate()-((s.getDay()+6)%7));no=Math.floor((mon-s)/864e5/7)+1;}
  const ws=wb.addWorksheet(no?`สัปดาห์ที่ ${no}`:`${mon.getDate()}-${sun.getDate()} ${TH_MONTHS[sun.getMonth()].slice(0,8)}`,{pageSetup:{paperSize:9,orientation:'portrait',fitToPage:true,fitToWidth:1,fitToHeight:1,horizontalCentered:true}});
  ws.columns=[{width:14},{width:62},{width:22}];
  ws.mergeCells('A1:C1');ws.getCell('A1').value='รายงานการบันทึกการปฏิบัติงาน';
  ws.getCell('A1').font={name:F,size:20,bold:true};ws.getCell('A1').alignment={horizontal:'center'};ws.getRow(1).height=34;
  ws.mergeCells('A2:C2');ws.getCell('A2').value=`สัปดาห์ที่ ${no||'......'}   ระหว่างวันที่ ${thDate(mon)}   ถึงวันที่ ${thDate(sun)}`;
  ws.getCell('A2').font={name:F,size:16};ws.getCell('A2').alignment={horizontal:'center'};
  ws.getRow(4).values=['วัน','บันทึกรายงานการปฏิบัติงาน','หมายเหตุ'];ws.getRow(4).height=26;
  ws.getRow(4).eachCell(c=>{c.font={name:F,size:16,bold:true,color:{argb:'FFFFFFFF'}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF2E2A6B'}};c.alignment={horizontal:'center',vertical:'middle'};c.border=border;});
  WEEK_ORDER.forEach((wd,i)=>{const d=new Date(mon);d.setDate(mon.getDate()+i);const e=entries[key(d.getFullYear(),d.getMonth(),d.getDate())];
    let txt='',note='';
    if(e){txt=e.task||(e.status==='holiday'?'วันหยุด':e.status==='leave'?'ลา':'');if(e.learn)txt+=`\n• ${e.learn}`;
      note=[e.status==='wfh'?'WFH':e.status==='leave'?'ลา':'',e.note].filter(Boolean).join(' / ');}
    const row=ws.getRow(5+i);row.values=[TH_DAYS[wd],txt,note||'-'];row.height=78;
    row.eachCell((c,col)=>{c.font={name:F,size:15,bold:col===1};c.border=border;c.alignment={vertical:col===1?'middle':'top',horizontal:col===2?'left':'center',wrapText:true};
      if(col===1)c.fill={type:'pattern',pattern:'solid',fgColor:{argb:wd%6===0?'FFFFE4E6':'FFEEEBFF'}};});});
  [[14,`ลงชื่อ ........................................ ผู้ควบคุมการฝึกงาน`,profile.mentor],[17,`ลงชื่อ ........................................ อาจารย์นิเทศ`,profile.advisor]].forEach(([r,t,n])=>{
    ws.mergeCells(`A${r}:C${r}`);ws.getCell(`A${r}`).value=t;ws.mergeCells(`A${r+1}:C${r+1}`);ws.getCell(`A${r+1}`).value=`( ${n||'........................................'} )`;
    [r,r+1].forEach(x=>{ws.getCell(`A${x}`).font={name:F,size:16};ws.getCell(`A${x}`).alignment={horizontal:'center'};});});
}
$('btn-profile').onclick=()=>{P.forEach(p=>$('p-'+p).value=profile[p]||'');$('profile-modal').showModal();};
$('profile-form').onsubmit=()=>{P.forEach(p=>profile[p]=$('p-'+p).value.trim());localStorage.setItem('profile',JSON.stringify(profile));toast('บันทึกข้อมูลแล้ว ✓');};

$('btn-export').onclick=async()=>{
  const y=cur.getFullYear(),m=cur.getMonth(),wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet(`สรุป ${TH_MONTHS[m]} ${y+543}`,{pageSetup:{paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0}});
  const F='TH Sarabun New',thin={style:'thin',color:{argb:'FFB4B9D6'}},border={top:thin,left:thin,bottom:thin,right:thin};
  ws.columns=[{width:6},{width:14},{width:12},{width:11},{width:9},{width:9},{width:8},{width:9},{width:48},{width:34}];
  ws.mergeCells('A1:J1');Object.assign(ws.getCell('A1'),{value:'แบบบันทึกการฝึกงานประจำเดือน'});
  ws.getCell('A1').font={name:F,size:22,bold:true,color:{argb:'FFFFFFFF'}};
  ws.getCell('A1').fill={type:'gradient',gradient:'angle',degree:0,stops:[{position:0,color:{argb:'FF7C5CFF'}},{position:1,color:{argb:'FF22D3EE'}}]};
  ws.getCell('A1').alignment={horizontal:'center',vertical:'middle'};ws.getRow(1).height=40;
  ws.mergeCells('A2:J2');ws.getCell('A2').value=`เดือน ${TH_MONTHS[m]} พ.ศ. ${y+543}`;
  ws.getCell('A2').font={name:F,size:16,bold:true,color:{argb:'FF4C3BB5'}};ws.getCell('A2').alignment={horizontal:'center'};
  const info=[['ชื่อ-นามสกุล',profile.name,'เลขประจำตัวนิสิต',profile.id],['คณะ/มหาวิทยาลัย',profile.uni,'สาขา',profile.major],['สถานที่ฝึกงาน',profile.company,'ผู้ควบคุมการฝึกงาน',profile.mentor]];
  info.forEach((r,i)=>{const row=4+i;ws.mergeCells(`A${row}:B${row}`);ws.mergeCells(`C${row}:H${row}`);
    ws.getCell(`A${row}`).value=r[0];ws.getCell(`C${row}`).value=r[1]||'-';ws.getCell(`I${row}`).value=r[2]+': '+(r[3]||'-');
    ['A','C','I'].forEach(c=>ws.getCell(`${c}${row}`).font={name:F,size:14,bold:c==='A'});});
  const hr=8,heads=['ลำดับ','วันที่','วัน','สถานะ','เข้า','ออก','พัก(น.)','ชั่วโมง','รายละเอียดงานที่ทำ','สิ่งที่ได้เรียนรู้ / ปัญหา'];
  ws.getRow(hr).values=heads;ws.getRow(hr).height=26;
  ws.getRow(hr).eachCell(c=>{c.font={name:F,size:14,bold:true,color:{argb:'FFFFFFFF'}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF2E2A6B'}};c.alignment={horizontal:'center',vertical:'middle'};c.border=border;});
  let r=hr+1,no=1,total=0,cnt={work:0,wfh:0,leave:0,holiday:0};
  monthKeys().forEach(k=>{const e=entries[k];if(!e)return;const d=new Date(k+'T00:00'),h=hours(e);total+=h;cnt[e.status]++;
    const row=ws.getRow(r++);
    row.values=[no++,`${d.getDate()}/${m+1}/${y+543}`,TH_DAYS[d.getDay()],STATUS[e.status],e.status==='work'||e.status==='wfh'?e.in:'-',e.status==='work'||e.status==='wfh'?e.out:'-',e.status==='work'||e.status==='wfh'?e.brk:'-',h?+h.toFixed(2):'-',e.task||'',e.learn||''];
    row.eachCell({includeEmpty:true},(c,col)=>{c.font={name:F,size:14};c.border=border;
      c.alignment={vertical:'top',wrapText:true,horizontal:col>=9?'left':'center'};
      c.fill={type:'pattern',pattern:'solid',fgColor:{argb:col===4?COLORS[e.status]:(no%2?'FFF7F7FD':'FFFFFFFF')}};});
    const lines=Math.max(1,...[e.task,e.learn].map(t=>Math.ceil((t||'').length/45)+((t||'').split('\n').length-1)));
    row.height=Math.max(22,lines*20);});
  ws.mergeCells(`A${r}:G${r}`);ws.getCell(`A${r}`).value='รวมชั่วโมงทั้งเดือน';ws.getCell(`H${r}`).value=+total.toFixed(2);
  ws.mergeCells(`I${r}:J${r}`);ws.getCell(`I${r}`).value=`ทำงาน ${cnt.work} วัน | WFH ${cnt.wfh} วัน | ลา ${cnt.leave} วัน | หยุด ${cnt.holiday} วัน`;
  ws.getRow(r).eachCell({includeEmpty:true},c=>{c.font={name:F,size:14,bold:true,color:{argb:'FF2E2A6B'}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFE4E0FF'}};c.border=border;c.alignment={horizontal:'center',vertical:'middle'};});
  ws.getRow(r).height=26;r+=3;
  ws.mergeCells(`B${r}:F${r}`);ws.mergeCells(`I${r}:J${r}`);
  ws.getCell(`B${r}`).value='ลงชื่อ ....................................... ผู้ฝึกงาน';ws.getCell(`I${r}`).value='ลงชื่อ ....................................... พี่เลี้ยง';
  ws.mergeCells(`B${r+1}:F${r+1}`);ws.mergeCells(`I${r+1}:J${r+1}`);
  ws.getCell(`B${r+1}`).value=`( ${profile.name||'.......................................'} )`;ws.getCell(`I${r+1}`).value=`( ${profile.mentor||'.......................................'} )`;
  [r,r+1].forEach(x=>['B','I'].forEach(c=>{ws.getCell(`${c}${x}`).font={name:F,size:14};ws.getCell(`${c}${x}`).alignment={horizontal:'center'};}));
  ws.views=[{state:'frozen',ySplit:hr}];
  const mon=new Date(y,m,1);mon.setDate(1-((mon.getDay()+6)%7));
  for(;mon<=new Date(y,m+1,0);mon.setDate(mon.getDate()+7))addWeekSheet(wb,new Date(mon));
  const buf=await wb.xlsx.writeBuffer(),a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
  a.download=`Timesheet_${TH_MONTHS[m]}_${y+543}.xlsx`;a.click();toast('Export Excel สำเร็จ ✓');
};
render();
