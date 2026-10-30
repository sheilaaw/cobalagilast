// ===== PENGATURAN ADMIN =====
const CONFIG={
  SHEET_URL:'https://script.google.com/macros/s/AKfycbwvGyfn4RyeCoNqiuXQ7RW3tq4endTaa27D1ObxRzwjsafcqv3ONKhukW24NNWtzMYp/exec', // URL Web App dari Apps Script
  TOKEN:'PORSIKU1234',          // harus sama dengan TOKEN di code.gs
  WA:'6285134507500',          // WhatsApp Tim Porsiku (+62 851-3450-7500)
  HARGA:0                      // nominal konsultasi (rupiah), 0 = tidak ditampilkan
};

const MAKRO={p:.15,l:.25,kh:.60};  // acuan % energi protein, lemak, karbohidrat (ubah jika ada acuan baru)
const TKG={min:90,max:119};        // tingkat kecukupan gizi: 90-119% = cukup

const ALERGI=['Telur','Susu','Kacang','Seafood','Gluten','Kedelai','Lainnya'];
const POLA={susu:/susu|yoghurt|yogurt|keju/i,telur:/telur/i,kacang:/kacang tanah/i,seafood:/ikan|udang|cumi|kerang|tongkol|kembung|tuna/i,gluten:/\boat\b|terigu|gandum|roti/i,kedelai:/tahu|tempe|kedelai/i};
const SANTAN=[122,2,10,7.6]; // TKPI 2020: Santan (dengan air) per 100 g = energi, protein, lemak, KH
const GRUP=[['Unggas','ayam, bebek',null],['Daging merah','sapi, kambing',null],['Ikan dan seafood','ikan, udang, cumi','seafood'],['Telur','ayam, bebek, puyuh','telur'],['Susu dan olahannya','susu, yoghurt, keju','susu']];

const AKT=[
 [1.1,'Sangat rendah','Sebagian besar waktu berbaring atau duduk; perawatan diri dasar, sangat sedikit berjalan.'],
 [1.2,'Sedenter','Bekerja/belajar sambil duduk, pakai komputer, membaca, menonton, berjalan singkat di rumah.'],
 [1.3,'Sedenter + sedikit bergerak','Mayoritas duduk, sesekali berdiri, berjalan mengambil barang, pindah jarak dekat.'],
 [1.4,'Aktivitas ringan','Belajar/bekerja sambil duduk, memasak, mencuci piring, merapikan kamar, berjalan singkat.'],
 [1.5,'Ringan menuju sedang','Pekerjaan rumah rutin, lebih sering berjalan, aktivitas fisik ringan durasi lebih panjang.'],
 [1.6,'Aktivitas sedang','Banyak berjalan, bersepeda santai, pekerjaan rumah cukup aktif, atau olahraga sedang rutin.'],
 [1.7,'Sedang menuju tinggi','Aktivitas fisik durasi panjang, banyak berjalan, pekerjaan yang menuntut gerak hampir seharian.'],
 [1.8,'Aktivitas tinggi','Pekerjaan lapangan aktif, banyak berjalan, mengangkat barang, atau latihan berat rutin.'],
 [1.9,'Sangat tinggi','Pekerjaan fisik berat + latihan intens, atau aktivitas fisik berdurasi panjang.']];
const TABEL={
 'Indikator harian':{head:['Faktor','Kategori','Rincian kegiatan sehari-hari'],rows:AKT.map(a=>[a[0].toFixed(1).replace('.',','),a[1],a[2]]),note:'Faktor ini yang dikalikan dengan BMR untuk total energi.'},
 'Anak & dewasa':{head:['Aktivitas fisik','Anak L','Anak P','Dewasa L','Dewasa P'],rows:[['Ringan','1,00','1,00','1,00','1,00'],['Aktivitas rendah','1,13','1,16','1,11','1,12'],['Aktif','1,26','1,31','1,25','1,27'],['Sangat aktif','1,46','1,56','1,48','1,56']],note:'Tabel referensi. Kolom yang menyala sesuai kelompokmu.'},
 'Perempuan':{head:['Aktivitas','Jenis kegiatan','Faktor'],rows:[['Sangat ringan','100% waktu berdiri/duduk','1,30'],['Ringan','75% berdiri/duduk, 25% aktivitas lain','1,55'],['Sedang','60% berdiri/duduk, 40% aktivitas lain','1,70'],['Berat','40% berdiri/duduk, 60% aktivitas lain','2,00']],note:'Sumber: Almatsier S, 2011.'}};
const SLOT_U=[['Makan pagi',.25],['Makan siang',.30],['Makan malam',.25]],SLOT_S=[['Selingan pagi',.10],['Selingan sore',.10]];

const $=s=>document.querySelector(s);
const fmt=(n,d=1)=>(+n).toFixed(d).replace('.',',');
const rp=n=>'Rp '+Math.round(n).toLocaleString('id-ID');
const stTkg=v=>v<TKG.min?['Kurang','low']:v<=TKG.max?['Cukup','ok']:['Lebih','high']; // cukup = 90-119% (berdasarkan nilai asli)
function muatUser(){try{const u=JSON.parse(localStorage.getItem('porsiku')||'null');return u&&u.nama&&u.usia>0&&u.bb>0&&u.tb>0&&u.af>0&&(u.jk==='L'||u.jk==='P')?u:null}catch(e){return null}}
let user=muatUser(),tab='Indikator harian',filterResep='Semua',rencana=[],pilihan=new Set();

// ----- tampilan awal -----
$('#acts').innerHTML=AKT.map((a,i)=>`<label><input type="radio" name="af" value="${a[0]}" ${i==1?'checked':''}><span><em>${a[0].toFixed(1)}</em><b>${a[1]}</b>${a[2]}</span></label>`).join('');
$('#alergi').innerHTML=ALERGI.map(x=>`<label><input type="checkbox" name="alergi" value="${x.toLowerCase()}"><span>${x}</span></label>`).join('');
$('#alergi').onchange=()=>{const on=$('#alergi input[value=lainnya]').checked,box=$('#alergiLain');box.hidden=!on;box.required=on;if(!on)box.value=''};
const FOTOS=Object.keys(FOTO_MENU),strip=FOTOS.concat(FOTOS).map(id=>`<img src="${FOTO_MENU[id]}" data-id="${id}" alt="" onerror="fotoErr(this)">`).join('');
// kalau foto gagal dimuat: coba nama cadangan, lalu sembunyikan
function fotoErr(im){const alt=FOTO_ALT[im.dataset.id];if(alt&&!im.dataset.coba){im.dataset.coba=1;im.src=encodeURI(alt)}else if(im.classList.contains('foto-kartu')){const d=document.createElement('div');d.className='ph';im.replaceWith(d)}else im.style.display='none'}
$('#m1').innerHTML=strip;

// ----- navigasi antar halaman (hash: #beranda #data #gizi #menu #konsultasi) -----
const HALAMAN=['beranda','data','gizi','menu','konsultasi'],BUTUH_DATA=['gizi','menu','konsultasi'];
let pesanData='';
function go(id){if(location.hash==='#'+id)route();else location.hash=id}
function perluData(msg){pesanData=msg||'Isi data dirimu dulu ya, supaya menu dan porsinya bisa disesuaikan denganmu.';go('data')} // pengaman
function startFlow(){go(user?'gizi':'data')}
function route(){
  let id=location.hash.slice(1);if(!HALAMAN.includes(id))id='beranda';
  if (BUTUH_DATA.includes(id) && !user) {

    if (id === 'gizi') {
        alert(
            'Untuk melihat informasi gizi, isi data diri terlebih dahulu ya. Data diri diperlukan agar perhitungan kebutuhan dan kecukupan gizimu sesuai.'
        );
    }

    perluData(
        id === 'gizi'
        ? 'Isi data diri terlebih dahulu untuk melihat informasi gizimu.'
        : 'Isi data dirimu dulu ya, supaya menu dan porsinya bisa disesuaikan denganmu.'
    );

    return;
}
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===id));
  document.body.dataset.page=id;
  document.querySelectorAll('.links a').forEach(a=>a.classList.toggle('on',a.dataset.p===id));
  const n=$('#notice');n.textContent=pesanData;n.hidden=!(id==='data'&&pesanData);if(id!=='data')pesanData='';
  $('#navBtn').textContent=user?'Ubah data':'Mulai';
  if(user)rencanaHarian();
  if(id==='data')isiForm();
  if(id==='gizi')renderGizi();
  if(id==='menu')renderMenu();
  if(id==='konsultasi')renderKonsultasi();
  scrollTo(0,0);
}
addEventListener('hashchange',route);

function isiForm(){
  const f=$('#form');if(!user)return;
  f.nama.value=user.nama;f.jk.value=user.jk;f.usia.value=user.usia;f.bb.value=user.bb;f.tb.value=user.tb;
  f.querySelectorAll('input[name=af]').forEach(i=>i.checked=+i.value===user.af);
  const lain=user.lain||[];
  f.querySelectorAll('input[name=alergi]').forEach(i=>i.checked=user.alergi.includes(i.value)||(i.value==='lainnya'&&lain.length>0));
  $('#alergiLain').value=lain.join(', ');$('#alergi').onchange();
}
$('#form').onsubmit=e=>{
  e.preventDefault();const f=new FormData(e.target),al=f.getAll('alergi');
  const lain=al.includes('lainnya')?(f.get('alergiLain')||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean):[];
  user={nama:f.get('nama').trim(),jk:f.get('jk'),usia:+f.get('usia'),bb:+f.get('bb'),tb:+f.get('tb'),af:+f.get('af'),alergi:al.filter(x=>x!=='lainnya'),lain};
  pilihan.clear();pesanData='';localStorage.setItem('porsiku',JSON.stringify(user));
  kirim({tipe:'pengguna',...ringkas()});go('gizi');
};

// ----- perhitungan -----
function kategoriIMT(v){const i=Math.round(v*10)/10;return i<17?'Sangat kurus':i<18.5?'Kurus':i<=25?'Normal':i<=27?'Gemuk':'Obesitas'} // cut-off Kemenkes
function hitung(x){
  const imt=x.bb/Math.pow(x.tb/100,2);
  const bmr=x.jk==='L'?66+13.7*x.bb+5*x.tb-6.8*x.usia:655+9.6*x.bb+1.8*x.tb-4.7*x.usia; // Harris-Benedict
  const tee=bmr*x.af;
  return{imt,kat:kategoriIMT(imt),bmr,tee,p:tee*MAKRO.p/4,l:tee*MAKRO.l/9,kh:tee*MAKRO.kh/4};
}
function alergiUser(){const pre=new Set(user.alergi),bebas=[];(user.lain||[]).forEach(t=>POLA[t]?pre.add(t):bebas.push(t));return{pre,bebas}}

// resep disesuaikan alergi: susu diganti santan, alergen lain = menu dibuang
function adaptasi(r){
  const{pre,bebas}=alergiUser();let bahan=r.bahan.map(b=>b.slice()),ganti=[];
  for(const a of pre){
    if(a==='susu')bahan=bahan.map(b=>{if(!POLA.susu.test(b[0]))return b;ganti.push(b[0]);return['Santan (pengganti susu)',b[1],b[2],...SANTAN.map(v=>+(v*b[2]/100).toFixed(2))]});
    else if(POLA[a]&&bahan.some(b=>POLA[a].test(b[0])))return null;
  }
  if(bebas.some(t=>r.nama.toLowerCase().includes(t)||bahan.some(b=>b[0].toLowerCase().includes(t))))return null;
  return{...r,bahan,ganti,tot:[3,4,5,6].map(j=>+bahan.reduce((s,b)=>s+b[j],0).toFixed(2))};
}
function pilih(jenis,slots,h){
  const share=slots.reduce((s,x)=>s+x[1],0)/slots.length;
  return RESEP.filter(r=>r.jenis===jenis).map(adaptasi).filter(Boolean).map(r=>{
    let s=-Math.abs(Math.log(h.tee*share/r.tot[0]));
    if(h.kat.includes('kurus'))s+=r.tot[0]/2000;
    if(h.kat==='Gemuk'||h.kat==='Obesitas')s-=r.tot[2]*9/r.tot[0];
    return[s,r]}).sort((a,b)=>b[0]-a[0]).slice(0,slots.length).map(x=>x[1]);
}
function porsi(r,share,h){ // porsi diskalakan supaya energi menu = kebutuhan waktu makan (TKG sekitar 100%)
  const target=h.tee*share,m=Math.min(3,Math.max(.4,Math.round(target/r.tot[0]/.05)*.05));
  return{m,t:r.tot.map(v=>v*m),need:[target,target*MAKRO.p/4,target*MAKRO.l/9,target*MAKRO.kh/4],harga:Math.round(HARGA_MENU[r.id]*m/500)*500};
}

// ----- deteksi alergi (daftar alergi + "alergi lainnya" yang diketik pengguna) -----
function daftarAlergi(){return[...new Set([...user.alergi,...(user.lain||[])])]}
function cekAlergi(r,adapted){ // adapted=true: resep sudah diganti santan, jadi hanya cek bahan
  const{pre,bebas}=alergiUser(),hit=new Set();
  for(const a of pre)if((!adapted&&r.alergen.includes(a))||(POLA[a]&&r.bahan.some(b=>POLA[a].test(b[0]))))hit.add(a);
  for(const t of bebas)if(r.nama.toLowerCase().includes(t)||r.bahan.some(b=>b[0].toLowerCase().includes(t)))hit.add(t);
  return[...hit];
}
const chipAl=a=>a.map(x=>`<span class="chip-al">${x}</span>`).join('');

// ----- halaman informasi gizi -----
function renderGizi(){
  const h=hitung(user),akt=AKT.find(a=>a[0]===user.af),al=daftarAlergi();
  $('#halo').textContent=`Halo, ${user.nama}`;
  $('#ringkas').textContent=`${user.jk==='L'?'Laki-laki':'Perempuan'} · ${user.usia} th · ${user.bb} kg · ${user.tb} cm · ${akt[1]}`;
  $('#alergiRingkas').innerHTML=al.length?`<span class="small muted">Alergi tercatat:</span> ${chipAl(al)}`:'';
  $('#stats').innerHTML=`
   <div class="stat big"><span>Kebutuhan energi per hari</span><b>${Math.round(h.tee)} kkal</b></div>
   <div class="stat"><span>IMT (Kemenkes)</span><b>${fmt(h.imt)}</b><span>${h.kat}${user.usia<18?' · anak memakai Z-score':''}</span></div>
   <div class="stat"><span>BMR Harris-Benedict</span><b>${Math.round(h.bmr)}</b><span>kkal/hari</span></div>
   <div class="stat"><span>Protein (${Math.round(MAKRO.p*100)}%)</span><b>${Math.round(h.p)} g</b></div>
   <div class="stat"><span>Lemak (${Math.round(MAKRO.l*100)}%)</span><b>${Math.round(h.l)} g</b></div>
   <div class="stat"><span>Karbohidrat (${Math.round(MAKRO.kh*100)}%)</span><b>${Math.round(h.kh)} g</b></div>`;
  renderProtein();renderTabel();
}
// ----- halaman menu -----
function renderMenu(){
  const h=hitung(user),al=daftarAlergi(),bad=RESEP.filter(r=>cekAlergi(r).length);
  $('#alergiBanner').innerHTML=al.length?`<div class="alergi-banner ${bad.length?'bad':'ok'}"><div><b>Alergimu:</b> ${chipAl(al)}</div><p>${bad.length?`<b>Perhatian:</b> ${bad.length} dari ${RESEP.length} menu mengandung alergimu (${bad.map(r=>r.nama).join('; ')}). Tombol pilih pada menu tersebut otomatis berwarna merah.`:'Tidak ada menu yang mengandung alergimu.'}</p></div>`:'<p class="muted small">Kamu belum mencatat alergi. Tambahkan lewat "Ubah data" kalau ada, nanti menu yang mengandungnya ditandai merah.</p>';
  renderResep(h);renderSemuaResep();
}
function renderProtein(){
  const{pre,bebas}=alergiUser();
  $('#protein').innerHTML=GRUP.map(([n,c,k])=>{const bad=(k&&pre.has(k))||bebas.some(t=>c.includes(t));return`<div class="pg ${bad?'no':'ok'}"><b>${n}</b><span class="small muted">${c}</span><br><span class="tagx">${bad?'Hindari':'Aman'}</span></div>`}).join('');
  $('#proteinInfo').textContent=pre.has('susu')?'Menu yang mengandung susu otomatis diganti santan. Pilih protein hewani yang berstatus aman.':'Pilih sumber protein hewani yang berstatus aman sesuai alergimu.';
}
function renderTabel(){
  $('#tabs').innerHTML=Object.keys(TABEL).map(k=>`<button type="button" class="${k===tab?'on':''}" data-tab="${k}">${k}</button>`).join('');
  $('#tabs').querySelectorAll('button').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;renderTabel()});
  const t=TABEL[tab],af=fmt(user.af),col=tab==='Anak & dewasa'?(user.usia<18?0:2)+(user.jk==='L'?1:2):-1;
  $('#tabel').innerHTML='<tr>'+t.head.map((x,i)=>`<th class="${i===col?'hi':''}">${x}</th>`).join('')+'</tr>'+
   t.rows.map(r=>`<tr>${r.map((c,i)=>`<td class="${(tab==='Indikator harian'&&r[0]===af)||i===col?'hi':''}">${c}</td>`).join('')}</tr>`).join('');
  $('#catatan').textContent=t.note;
}
function rencanaHarian(){
  const h=hitung(user),U=pilih('utama',SLOT_U,h),S=pilih('selingan',SLOT_S,h);
  rencana=[...U.map((r,i)=>[r,...SLOT_U[i]]),...S.map((r,i)=>[r,...SLOT_S[i]])].map(([r,slot,share])=>({r,slot,p:porsi(r,share,h)}));
}
function renderResep(h){
  const al=[...user.alergi,...(user.lain||[])];
  $('#resepInfo').textContent=`Porsi tiap menu sudah disesuaikan agar pas dengan kebutuhan ${Math.round(h.tee)} kkal kamu${al.length?' dan bebas '+al.join(', '):''}.`;
  if(!rencana.length){$('#ringkasMenu').innerHTML='';$('#resep').innerHTML='<p class="muted">Belum ada menu yang aman dari alergimu.</p>';return}
  const T=rencana.reduce((a,x)=>a.map((v,j)=>v+x.p.t[j]),[0,0,0,0]),tk=T[0]/h.tee*100,[lab]=stTkg(tk);
  $('#ringkasMenu').innerHTML=`
   <div><b>${Math.round(T[0])} kkal</b><span>Total menu hari ini, TKG energi ${Math.round(tk)}% (${lab})</span></div>
   <div><b>P ${Math.round(T[1]*4/T[0]*100)}% · L ${Math.round(T[2]*9/T[0]*100)}% · KH ${Math.round(T[3]*4/T[0]*100)}%</b><span>Komposisi energi (acuan ${Math.round(MAKRO.p*100)}/${Math.round(MAKRO.l*100)}/${Math.round(MAKRO.kh*100)})</span></div>
   <div><b>${rp(rencana.reduce((s,x)=>s+x.p.harga,0))}</b><span>Perkiraan biaya menu sehari</span></div>`;
  $('#resep').innerHTML=rencana.map(kartu).join('');
}
function kartu({r,slot,p}){
  const img=FOTO_MENU[r.id]?`<img class="foto-kartu" data-id="${r.id}" src="${FOTO_MENU[r.id]}" alt="Foto ${r.nama}" onerror="fotoErr(this)">`:`<div class="ph"></div>`;
  const tkg=p.t.map((v,j)=>v/p.need[j]*100),[lab,cls]=stTkg(tkg[0]);
  const rows=r.bahan.map(b=>`<tr><td>${b[0]}</td><td>${b[1]||'-'}</td><td>${fmt(b[2]*p.m)}</td><td>${fmt(b[3]*p.m)}</td><td>${fmt(b[4]*p.m)}</td><td>${fmt(b[5]*p.m)}</td><td>${fmt(b[6]*p.m)}</td></tr>`).join('');
  return`<article class="recipe${cekAlergi(r,true).length?' alert':''}">${img}<div class="rbody"><span class="slot">${slot}</span><h4>${r.nama}</h4>
   <div class="price">${rp(p.harga)} <small>porsi ×${fmt(p.m,2)}</small></div>
   <div class="badges"><span class="badge">${Math.round(p.t[0])} kkal</span><span class="badge">P ${fmt(p.t[1])} g</span><span class="badge">L ${fmt(p.t[2])} g</span><span class="badge">KH ${fmt(p.t[3])} g</span><span class="st ${cls}">TKG ${Math.round(tkg[0])}% · ${lab}</span></div>
   ${r.ganti.length?`<span class="note">Disesuaikan alergi: ${r.ganti.join(', ').toLowerCase()} diganti santan</span>`:''}
   ${peringatan(r,true)}${tombolPilih(r,true)}
   <details><summary>Bahan dan perhitungan gizi</summary><div class="table-wrap"><table>
   <tr><th>Bahan</th><th>URT ×1</th><th>Berat (g)</th><th>Energi</th><th>Prot</th><th>Lemak</th><th>KH</th></tr>${rows}
   <tr><th colspan="3">Total nilai gizi</th>${p.t.map(v=>`<th>${fmt(v)}</th>`).join('')}</tr>
   <tr><td colspan="3">Kebutuhan ${slot.toLowerCase()}</td>${p.need.map(v=>`<td>${fmt(v)}</td>`).join('')}</tr>
   <tr class="tkg"><td colspan="3">TKG (%)</td>${tkg.map(v=>`<td>${Math.round(v)}</td>`).join('')}</tr>
   <tr><td colspan="3">Status (${TKG.min}-${TKG.max}% = cukup)</td>${tkg.map(v=>`<td>${stTkg(v)[0]}</td>`).join('')}</tr>
   </table></div></details></div></article>`;
}
// ----- tombol pilih menu: merah + peringatan kalau mengandung alergi -----
function peringatan(r,adapted){const b=cekAlergi(r,adapted);return b.length?`<div class="warnbox"><b>Perhatian alergi:</b> menu ini mengandung ${b.join(', ')}.</div>`:''}
function tombolPilih(r,adapted){
  const bad=cekAlergi(r,adapted),on=pilihan.has(r.id);
  const label=bad.length?(on?'Dipilih · mengandung alergi':'Mengandung alergi: '+bad.join(', ')):(on?'Menu dipilih':'Pilih menu ini');
  return`<button type="button" class="btn sm ${bad.length?'danger':on?'':'ghost'}" data-pilih="${r.id}" data-adapted="${adapted?1:0}" aria-pressed="${on}" onclick="toggle(${r.id},this)">${label}</button>`;
}
function toggle(id,b){
  const r=RESEP.find(x=>x.id===id),bad=cekAlergi(r);
  if(!pilihan.has(id)&&bad.length&&!confirm(`Menu "${r.nama}" mengandung ${bad.join(', ')}, yang kamu catat sebagai alergi. Tetap dipilih?`))return;
  pilihan.has(id)?pilihan.delete(id):pilihan.add(id);
  document.querySelectorAll(`[data-pilih="${id}"]`).forEach(btn=>{
    const ad=btn.dataset.adapted==='1';btn.outerHTML=tombolPilih(ad?(adaptasi(r)||r):r,ad)});
}

// ----- semua resep (dari Excel) -----
function renderSemuaResep(){
  const F=['Semua','Makan besar','Selingan','Aman untukku'];
  $('#resepTabs').innerHTML=F.map(f=>`<button type="button" class="${f===filterResep?'on':''}" data-f="${f}">${f}</button>`).join('');
  $('#resepTabs').querySelectorAll('button').forEach(b=>b.onclick=()=>{filterResep=b.dataset.f;renderSemuaResep()});
  const list=RESEP.filter(r=>filterResep==='Semua'||(filterResep==='Selingan'?r.jenis==='selingan':filterResep==='Makan besar'?r.jenis==='utama':!cekAlergi(r).length));
  $('#semuaResep').innerHTML=list.length?list.map(kartuLengkap).join(''):'<p class="muted">Belum ada menu pada kategori ini.</p>';
}
function kartuLengkap(r){
  const x=RESEP_EXTRA[r.id]||{},sub=x.sub,src=x.src||[],bad=cekAlergi(r);
  const h=hitung(user);

  // Target kebutuhan per waktu makan: makan besar 30%, selingan 10% dari TEE.
  // Pembagian makro mengikuti konfigurasi MAKRO yang sudah digunakan Porsiku.
  const share=r.jenis==='utama'?0.30:0.10;
  const targetEnergi=h.tee*share;
  const need=[
    targetEnergi,
    targetEnergi*MAKRO.p/4,
    targetEnergi*MAKRO.l/9,
    targetEnergi*MAKRO.kh/4
  ];
  const tkg=r.tot.map((v,i)=>need[i]>0?v/need[i]*100:0);
  const status=tkg.map(v=>stTkg(v));
  const highlight=v=>v>=TKG.min&&v<=TKG.max?'hi-tkg':'';

  const img=FOTO_MENU[r.id]
    ?`<img class="foto-kartu" data-id="${r.id}" src="${FOTO_MENU[r.id]}" alt="Foto ${r.nama}" onerror="fotoErr(this)">`
    :`<div class="ph"></div>`;
  const rows=r.bahan.map((b,i)=>`<tr>${sub?`<td>${sub[i]||'-'}</td>`:''}<td>${b[0]}</td><td>${b[1]||'-'}</td><td>${fmt(b[2])}</td><td>${fmt(b[3])}</td><td>${fmt(b[4],2)}</td><td>${fmt(b[5],2)}</td><td>${fmt(b[6],2)}</td><td>${src[i]||'-'}</td></tr>`).join('');
  const al=r.alergen.map(a=>`<span class="badge${bad.includes(a)?' warn':''}">${a}${bad.includes(a)?' (alergimu)':''}</span>`).join('');
  const labelCols=sub?4:3;
  const [labelEnergi,kelasEnergi]=status[0];
  const barisTkg=`
    <tr><th colspan="${labelCols}">TKG (%)</th>${tkg.map(v=>`<td class="${highlight(v)}">${fmt(v,1)}%</td>`).join('')}<td>-</td></tr>
    <tr><th colspan="${labelCols}">Status TKG</th>${status.map(([label],i)=>`<td class="${highlight(tkg[i])}">${label}</td>`).join('')}<td>-</td></tr>`;

  return`<article class="recipe full${bad.length?' alert':''}">${img}<div class="rbody">
   <span class="slot">${x.label||(r.jenis==='utama'?'Makan besar':'Selingan')}</span><h4>${r.nama}</h4>
   <div class="price">${rp(HARGA_MENU[r.id])} <small>per 1 porsi dasar</small></div>
   <div class="badges"><span class="badge">${fmt(r.tot[0])} kkal</span><span class="badge">P ${fmt(r.tot[1],2)} g</span><span class="badge">L ${fmt(r.tot[2],2)} g</span><span class="badge">KH ${fmt(r.tot[3],2)} g</span><span class="st ${kelasEnergi}">TKG energi ${fmt(tkg[0],1)}% · ${labelEnergi}</span></div>
   <div class="badges">Alergen: ${al||'-'}</div>
   ${peringatan(r,false)}${tombolPilih(r,false)}
   <details><summary>Bahan dan nilai gizi</summary><div class="table-wrap"><table>
   <tr>${sub?'<th>Komponen</th>':''}<th>Bahan</th><th>URT</th><th>Berat (g)</th><th>Energi</th><th>Prot</th><th>Lemak</th><th>KH</th><th>Sumber</th></tr>${rows}
   <tr class="tkg"><th colspan="${labelCols}">Total nilai gizi</th>${r.tot.map(v=>`<td>${fmt(v,2)}</td>`).join('')}<td>-</td></tr>
   <tr><td colspan="${labelCols}">Target kebutuhan per waktu makan</td>${need.map(v=>`<td>${fmt(v,2)}</td>`).join('')}<td>-</td></tr>
   ${barisTkg}
   </table></div>
   <p class="tkg-legend"><span class="legend-green"></span> TKG cukup: ${TKG.min}–${TKG.max}%</p>
   <p class="muted small">TKG dihitung dari kebutuhan gizi personal dan target waktu makan. Makan besar menggunakan target 30% dan selingan 10% dari kebutuhan energi harian. Highlight hijau menandakan nilai TKG 90–119%.</p>
   </details></div></article>`;
}

// ===== Simpan ke Google Sheets =====
function ringkas(){
  const h=hitung(user),a=AKT.find(x=>x[0]===user.af);
  return{nama:user.nama,jk:user.jk==='L'?'Laki-laki':'Perempuan',usia:user.usia,bb:user.bb,tb:user.tb,aktivitas:`${fmt(user.af)} – ${a[1]}`,
    alergi:[...user.alergi,...(user.lain||[])].join(', ')||'-',imt:+h.imt.toFixed(1),kategori:h.kat,bmr:Math.round(h.bmr),tee:Math.round(h.tee)};
}
function kirim(data){
  if(!CONFIG.SHEET_URL)return;
  fetch(CONFIG.SHEET_URL,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain'},body:JSON.stringify({token:CONFIG.TOKEN,...data})}).catch(()=>{});
}

// ===== Konsultasi: pilih menu, bayar QRIS, unggah bukti, kirim ke WhatsApp =====
function renderKonsultasi(){
  $('#menuPilih').innerHTML=RESEP.map(r=>{const bad=cekAlergi(r);return`<label class="consent${bad.length?' bad':''}"><input type="checkbox" value="${r.id}" ${pilihan.has(r.id)?'checked':''}><span>${r.nama}${bad.length?` <em class="mini-al">mengandung alergi: ${bad.join(', ')}</em>`:''}</span></label>`}).join('');
  $('#menuPilih').onchange=e=>{const i=e.target;if(i.type==='checkbox')i.checked?pilihan.add(+i.value):pilihan.delete(+i.value)};
  $('#harga').textContent=CONFIG.HARGA?'Nominal: '+rp(CONFIG.HARGA):'';
}
$('#bukti').onchange=e=>{const f=e.target.files[0],p=$('#prev');$('#waBtn').disabled=!f;if(f){p.src=URL.createObjectURL(f);p.hidden=false}else p.hidden=true};

async function kompres(file){
  const img=await new Promise((ok,err)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=err;i.src=URL.createObjectURL(file)});
  const s=Math.min(1,1200/Math.max(img.width,img.height)),c=document.createElement('canvas');
  c.width=Math.round(img.width*s);c.height=Math.round(img.height*s);c.getContext('2d').drawImage(img,0,0,c.width,c.height);
  return c.toDataURL('image/jpeg',.8).split(',')[1]; // base64 saja, tanpa awalan data:
}
function denganBatas(p,ms){return Promise.race([p,new Promise((_,no)=>setTimeout(()=>no(new Error('timeout')),ms))])}
async function kirimWA(){
  if(!user){perluData();return}
  const b=$('#waBtn'),st=$('#status'),tl=$('#waLink');tl.hidden=true;
  const w=window.open('about:blank','_blank'); // dibuka saat klik supaya tidak diblokir browser
  b.disabled=true;st.textContent='Mengunggah bukti pembayaran...';
  const ids=[...document.querySelectorAll('#menuPilih input:checked')].map(i=>+i.value);
  const menu=ids.map(id=>{const r=RESEP.find(x=>x.id===id),it=rencana.find(x=>x.r.id===id),bad=cekAlergi(r);
    return`${it?it.slot+': ':''}${r.nama} (${it?`porsi ×${fmt(it.p.m,2)}, ${rp(it.p.harga)}`:`porsi dasar, ${rp(HARGA_MENU[id])}`})${bad.length?' [mengandung alergi: '+bad.join(', ')+']':''}`});
  const k=$('#keluhan').value.trim()||'-',r0=ringkas(),kode='PRS-'+Date.now().toString(36).toUpperCase().slice(-6);let link='',gagalUnggah=false;
  // unggah bukti ke Sheet/Drive. Kalau gagal, WhatsApp TETAP dibuka (bukti dikirim manual di chat)
  let alasan='';
  try{
    if(CONFIG.SHEET_URL){
      const data=await denganBatas(kompres($('#bukti').files[0]),15000);
      const body=JSON.stringify({token:CONFIG.TOKEN,tipe:'konsultasi',kode,...r0,menu:menu.join('; ')||'-',keluhan:k,bukti:data});
      try{
        const res=await denganBatas(fetch(CONFIG.SHEET_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body}),30000);
        const j=await res.json();if(!j.ok)throw new Error(j.pesan||'ditolak server');link=j.url||'';
        if(j.drive)alasan='Drive: '+j.drive;
      }catch(e1){
        if(e1 instanceof TypeError||e1.message==='timeout'){ // respons tidak terbaca (CORS/jaringan): kirim ulang tanpa menunggu balasan; server menolak kode ganda
          fetch(CONFIG.SHEET_URL,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body}).catch(()=>{});
          alasan='data dikirim, tapi balasan server tidak terbaca';
        }else throw e1;
      }
    }
  }catch(e){console.warn('Unggah bukti gagal:',e);gagalUnggah=true;alasan=String(e.message||e)}
  if(alasan)console.warn('Info unggah:',alasan);
  const pesan=`Halo Tim Porsiku,
Saya ingin konsultasi.
Kode konsultasi: ${kode}

Nama: ${r0.nama}
Jenis kelamin: ${r0.jk}
Usia: ${r0.usia} tahun
BB / TB: ${r0.bb} kg / ${r0.tb} cm
IMT: ${r0.imt} (${r0.kategori})
Kebutuhan energi: ${r0.tee} kkal/hari (BMR ${r0.bmr} kkal, faktor ${r0.aktivitas})
Alergi: ${r0.alergi}

Menu pilihan:
${menu.length?menu.map(m=>'- '+m).join('\n'):'- (belum memilih menu)'}

Keluhan/pertanyaan: ${k}

Bukti pembayaran QRIS: ${link||'(saya kirim manual di chat ini)'}`;
  const url=`https://api.whatsapp.com/send?phone=${CONFIG.WA}&text=${encodeURIComponent(pesan)}`;
  tl.href=url;tl.hidden=false; // tautan cadangan kalau tab WhatsApp tidak terbuka otomatis
  if(w&&!w.closed)w.location.href=url;else location.href=url;
  st.textContent=(gagalUnggah||(alasan&&!link))?'Bukti belum terkonfirmasi tersimpan ('+alasan+'). Kirim fotonya langsung di chat WhatsApp ya.':'Terkirim. Lanjutkan percakapan di WhatsApp.';
  b.disabled=false;
}

// ----- latar: slideshow foto makanan sehat (foto menu lokal + foto dari Wikimedia Commons) -----
(function(){
  const el=$('#slides'),dots=$('#dots'),slides=[];let cur=-1,timer;
  const src=f=>/^(https?|data):/.test(f)?f:encodeURI(f);
  function tampil(n){
    if(!slides.length)return;const kids=el.children;
    if(cur>=0&&kids[cur])kids[cur].classList.remove('on');
    cur=n%slides.length;kids[cur].classList.add('on');
    dots.querySelectorAll('i').forEach((d,k)=>d.classList.toggle('on',k===cur));
    clearInterval(timer);if(slides.length>1)timer=setInterval(()=>tampil(cur+1),6000);
  }
  function tambah(f){ // hanya foto yang berhasil dimuat yang dipakai
    if(slides.some(s=>s.f===f))return;
    const im=new Image();
    im.onload=()=>{
      if(slides.some(s=>s.f===f))return;slides.push({f});
      const d=document.createElement('div');d.className='slide';d.style.backgroundImage=`url("${src(f)}")`;el.appendChild(d);
      const dot=document.createElement('i');dot.dataset.i=slides.length-1;dot.title='Foto '+slides.length;dots.appendChild(dot);
      tampil(slides.length===1?0:cur);
    };
    im.onerror=()=>{};im.src=src(f);
  }
  dots.onclick=e=>{if(e.target.dataset.i!=null)tampil(+e.target.dataset.i)};
  BG_FOTO.forEach(f=>tambah(f)); // langsung tampil, tidak menunggu internet

  // foto makanan sehat dari Wikimedia Commons (gratis, berlisensi CC); gagal/offline = tetap pakai foto lokal
  (async()=>{
    const bad=/map|locator|logo|flag|icon|diagram|chart|poster|sign|banner|stamp|drawing|painting|illustration|label|packag|menu board/i;
    const A='https://commons.wikimedia.org/w/api.php?format=json&origin=*&action=query&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=1600&generator=search&gsrnamespace=6&gsrlimit=30&gsrsearch=';
    const Q=['gado-gado','healthy salad bowl','fresh fruit platter','indonesian vegetable dish','tempeh tofu dish'];
    const R=await Promise.all(Q.map(q=>fetch(A+encodeURIComponent(q+' filetype:bitmap')).then(r=>r.json()).catch(()=>null)));
    const hasil=[];
    R.forEach(j=>{if(!j||!j.query)return;let n=0;
      Object.values(j.query.pages).sort((a,b)=>(a.index||0)-(b.index||0)).forEach(p=>{
        const i=p.imageinfo&&p.imageinfo[0];if(!i||n>=3||bad.test(p.title||''))return;
        const m=i.extmetadata||{},lic=(m.LicenseShortName&&m.LicenseShortName.value)||'';
        if(i.mime!=='image/jpeg'||i.width<1200||i.width<i.height*1.2||!i.thumburl||!/^(CC|Public domain|PD)/i.test(lic))return;
        const art=((m.Artist&&m.Artist.value)||'').replace(/<[^>]+>/g,'').trim().slice(0,40);
        hasil.push(i.thumburl);n++})});
    hasil.sort(()=>Math.random()-.5).slice(0,8).forEach(u=>tambah(u));
  })();
})();

route();