// =======================================================
// KISAYOL
// =======================================================
const $ = (id) => document.getElementById(id);

// =======================================================
// ELEMENTLER
// =======================================================
const adEl = $("ad_soyad"),
  telEl = $("telefon"),
  adresEl = $("adres"),
  sehirEl = $("sehir"),
  ilceEl = $("ilce"),
  firmaEl = $("firma"),
  alanEl = $("siparisi_alan"),
  cokSatanContainer = $("cokSatanContainer"),
  musteriNotuEl = $("musteri_notu"),
  digerSelect = $("digerSelect"),
  digerKgOptions = $("digerKgOptions"),
  digerAdet = $("digerAdet"),
  digerEkleBtn = $("digerEkleBtn"),
  digerListeContainer = $("digerListeContainer"),
  toplamEl = $("toplam"),
  toplamHint = $("toplamHint"),
  odemeEl = $("odeme"),
  notlarEl = $("notlar"),
  sonucEl = $("sonuc"),
  musteriHint = $("musteriHint"),
  siparisNoEl = $("siparis_no"),
  btnIptal = $("btnIptal"),
  btnUcretsiz = $("btnUcretsiz");

// LOGIN
const loginScreen = $("loginScreen"),
  appContainer = $("appContainer"),
  loginForm = $("loginForm"),
  loginUsername = $("loginUsername"),
  loginPassword = $("loginPassword"),
  loginMessage = $("loginMessage"),
  currentUserEl = $("currentUser"),
  adminBadge = $("adminBadge"),
  logoutBtn = $("logoutBtn");

// POPUP
const popup = $("popup"),
  popupBox = $("popupBox"),
  popupMsg = $("popupMsg"),
  popupClose = $("popupClose");

// ===============================
// POPUP FONKSİYONU EKLENTİSİ
// ===============================
function showPopup(msg, type="ok") {

  // ikonlar
  let icon = "";
  if (type === "ok") {
    icon = "✔️"; // yeşil tik
    popupBox.style.borderColor = "#2ecc71"; 
    popupBox.style.color = "#d4ffd4";
  } else {
    icon = "❌"; // kırmızı çarpı
    popupBox.style.borderColor = "#e74c3c";
    popupBox.style.color = "#ffd4d4";
  }

  popupMsg.innerHTML = `<div style="font-size:40px; margin-bottom:10px;">${icon}</div>${msg}`;

  popup.classList.remove("hidden");
}

// =======================================================
// SİPARİŞLERİM
// =======================================================
async function getUserOrdersByAssignee(username){
  const tables = ["queen_siparisler","esin_siparisler","tasdipli_siparisler"];
  const all = [];
  for(const t of tables){
    const rows = await sbFetch(t, {
      query: `siparis_alan=ilike.${encodeURIComponent(username.trim())}&select=*`
    });
    rows.forEach(r => r._tbl = t);
    all.push(...rows);
  }

  // Teslim edilmeyenler → en üst
  // Teslim edilenler → en alt
  // Aynı grupta → siparis_no yeni → eski
  return all.sort((a,b)=>{
    const da = isDeliveredComputed(a), db = isDeliveredComputed(b);
    if(da !== db) return da ? 1 : -1;
    return (Number(b.siparis_no)||0) - (Number(a.siparis_no)||0);
  });
}



// =======================================================
// GLOBALS
// =======================================================
let cokSatanUrunler = [];
let digerUrunler = [];
let digerSecimler = [];

let manualFreeMode = false;
let autoCalcLocked = false;
let currentUser = null;
let appInitialized = false;
let lastQueried = "";

const STORAGE_KEY = "siparisUser";

const SIPARISI_ALAN_LISTESI = ["Seda","Betül","İbrahim","Ceylan","Özkan","Cennet","Ahmet"];

// =======================================================
// UI & HELPERS
// =======================================================
function showApp(){ loginScreen.classList.add("hidden"); appContainer.classList.remove("hidden"); }
function showLogin(msg=""){ loginScreen.classList.remove("hidden"); appContainer.classList.add("hidden"); loginMessage.textContent=msg; loginMessage.className="text-sm text-center text-red-400"; }
function updateUserUI(user){ currentUserEl.textContent=user.username; adminBadge.classList.toggle("hidden", !user.admin); }

function fillSelect(el, arr, placeholder="Seçiniz…"){
  el.innerHTML = `<option value="">${placeholder}</option>`;
  arr.forEach(v=>{
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    el.appendChild(opt);
  });
}
async function setSiparisiAlan(user){
  const users = await getAllUsers();
  const userList = users.map(u => u.username);

  if(!user.admin){
    // Admin değil → tek seçenek kendisi
    fillSelect(alanEl, [user.username], "");
    alanEl.value = user.username;
    alanEl.disabled = true;
  } else {
    // Admin → tüm kullanıcılar listede
    fillSelect(alanEl, userList, "Seçiniz…");
    alanEl.disabled = false;
  }
}

popupClose.onclick = ()=> popup.classList.add("hidden");

// =======================================================
// LOGIN / STORAGE
// =======================================================
function saveUser(user){ const data={...user, exp: Date.now()+8*60*60*1000}; localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
function loadUser(){ try{ const raw=localStorage.getItem(STORAGE_KEY); if(!raw) return null; const u=JSON.parse(raw); if(Date.now()>u.exp){ localStorage.removeItem(STORAGE_KEY); return null;} return u; }catch{return null;} }

async function handleLogin(e){
  e.preventDefault();
  loginMessage.textContent="Giriş yapılıyor…";
  loginMessage.className="text-center text-blue-300 text-sm";

  try{
    const user = await loginUser(loginUsername.value.trim(), loginPassword.value);
    if(!user){ showLogin("Kullanıcı adı veya şifre hatalı."); return; }

    currentUser=user;
    saveUser(user);
    updateUserUI(user);
    showApp();
    setSiparisiAlan(user);
    await initApp();

  }catch{
    showLogin("Giriş hatası.");
  }
}


// =======================================================
// ŞEHİR / İLÇE
// =======================================================
async function loadCities(){
  const cities = await getCities();
  sehirEl.innerHTML = `<option value="">Şehir seçiniz…</option>`;
  cities.forEach(c=>{
    const opt=document.createElement("option");
    opt.value=c.id; opt.textContent=c.name;
    sehirEl.appendChild(opt);
  });
}
async function loadDistrictsUI(cityId){
  ilceEl.disabled = true;
  ilceEl.innerHTML = `<option value="">Yükleniyor…</option>`;
  const d = await getDistricts(cityId);
  ilceEl.innerHTML = `<option value="">İlçe seçiniz…</option>`;
  d.forEach(x=>{
    const o=document.createElement("option");
    o.value=`${x.id}|${x.code}|${x.name}`;
    o.textContent=x.name;
    ilceEl.appendChild(o);
  });
  ilceEl.disabled=false;
}

// =======================================================
// ÜRÜNLER
// =======================================================
async function loadUrunlerUI(){
  const firma = firmaEl.value; if(!firma) return;
  const items = await getUrunler(firma);

  cokSatanUrunler = items.filter(u=>u.cok_satan);
  digerUrunler = items.filter(u=>!u.cok_satan);

  renderCokSatan();
  renderDigerDropdown();
  autoRecalc();
}

function renderCokSatan(){
  cokSatanContainer.innerHTML="";
  cokSatanUrunler.forEach(u=>{
    const box=document.createElement("div");
    box.className="product-box";
    box.innerHTML=`<div class="product-title">${u.ad}</div>`;
    box.appendChild(renderKgRow(u,10,u.fiyat_10));
    box.appendChild(renderKgRow(u,5,u.fiyat_5));
    cokSatanContainer.appendChild(box);
  });
}
function renderKgRow(u,kg,fiyat){
  const line=document.createElement("div");
  line.className="product-line";
  line.innerHTML=`
    <label class="flex items-center gap-2">
      <input type="checkbox" class="kg-check" data-id="${u.id}" data-kg="${kg}">
      <span class="text-sm">${kg} kg — <b>${fiyat} TL</b></span>
    </label>
    <div class="flex items-center gap-2">
      <span class="text-xs">Adet:</span>
      <input type="number" value="1" min="1"
             class="kg-adet"
             data-id="${u.id}"
             data-kg="${kg}">
    </div>
  `;
  return line;
}

function renderDigerDropdown(){
  digerSelect.innerHTML="";
  
  digerUrunler.forEach(u=>{
    const opt = document.createElement("option");

    // ÜRÜN ADI + 10 KG FİYATI GÖRÜNÜR
    opt.value = u.id;
    opt.textContent = `${u.ad}  —  ${u.fiyat_10} TL (10 kg)`;

    digerSelect.appendChild(opt);
  });

  updateDigerKgOptions();
}

function updateDigerKgOptions(){
  const id=Number(digerSelect.value);
  const u=digerUrunler.find(x=>x.id===id);
  if(!u){ digerKgOptions.innerHTML=""; return; }
  digerKgOptions.innerHTML=`
    <label class="flex items-center gap-2">
      <input type="radio" name="digerKg" value="10|${u.fiyat_10}" checked>
      <span>10 kg — ${u.fiyat_10} TL</span>
    </label>
    <label class="flex items-center gap-2">
      <input type="radio" name="digerKg" value="5|${u.fiyat_5}">
      <span>5 kg — ${u.fiyat_5} TL</span>
    </label>
  `;
}
digerSelect.onchange=updateDigerKgOptions;

digerEkleBtn.onclick = (e)=>{
  e.preventDefault();
  const id=Number(digerSelect.value);
  const u=digerUrunler.find(x=>x.id===id);
  if(!u) return;

  const kgRadio=document.querySelector('input[name="digerKg"]:checked');
  if(!kgRadio) return;

  const [kg,fiyat]=kgRadio.value.split("|").map(Number);
  const adet=Number(digerAdet.value||1);

  digerSecimler.push({
    id:u.id, ad:u.ad, kg, adet,
    fiyat, toplam:fiyat*adet
  });

  renderDigerListe();
  autoRecalc();
};

function renderDigerListe(){
  digerListeContainer.innerHTML="";
  digerSecimler.forEach((x,i)=>{
    const row=document.createElement("div");
    row.className="diger-item";
    row.innerHTML=`
      <div>${x.ad}</div>
      <div>${x.kg} kg</div>
      <div>x${x.adet}</div>
      <div>${x.toplam} TL</div>
      <button type="button" class="remove-btn" data-index="${i}">Sil</button>
    `;
    digerListeContainer.appendChild(row);
  });

  document.querySelectorAll(".remove-btn").forEach(b=>{
    b.onclick=()=>{
      const i=Number(b.dataset.index);
      digerSecimler.splice(i,1);
      renderDigerListe();
      autoRecalc();
    };
  });
}

// =======================================================
// TOPLAM
// =======================================================
function hesaplaToplam(){
  if(manualFreeMode) return 0;
  let total=0;

  document.querySelectorAll(".kg-check:checked").forEach(chk=>{
    const id=chk.dataset.id;
    const kg=Number(chk.dataset.kg);
    const adetEl=document.querySelector(`.kg-adet[data-id="${id}"][data-kg="${kg}"]`);
    const adet=Number(adetEl.value||1);
    const u=cokSatanUrunler.find(x=>x.id==id);
    const fiyat = kg===10 ? u.fiyat_10 : u.fiyat_5;
    total += fiyat*adet;
  });

  digerSecimler.forEach(x=> total+=x.toplam);

  return total;
}
function autoRecalc(){
  if(autoCalcLocked) return;
  toplamEl.value = hesaplaToplam();
  toplamHint.textContent="Otomatik hesaplandı.";
}

// =======================================================
// ÜCRETSİZ / DEĞİŞİM
// =======================================================
btnUcretsiz.onclick = ()=>{
  manualFreeMode = !manualFreeMode;

  if(manualFreeMode){
    toplamEl.value=0;
    odemeEl.disabled=true;
    autoCalcLocked = true;
    btnUcretsiz.textContent="Ücretli Yap";
  }else{
    odemeEl.disabled=false;
    autoCalcLocked=false;
    btnUcretsiz.textContent="Ücretsiz / Değişim";
    autoRecalc();
  }
};

// =======================================================
// TELEFON LOOKUP (10 hane)
// =======================================================
async function handleTelLookup(){
  let raw=telEl.value.replace(/\D/g,"").slice(0,10);
  telEl.value=raw;

  if(raw.length!==10){
    musteriHint.textContent="";
    return;
  }
  if(raw===lastQueried) return;
  lastQueried=raw;

  musteriHint.textContent="Müşteri sorgulanıyor…";

  try{
    const m = await findMusteriByTel(raw);
    if(!m){
      musteriHint.textContent="Bu numara kayıtlı değil.";
      return;
    }

    adEl.value = m.ad_soyad || "";
    adresEl.value = m.adres || "";

    if(m.firma){
      firmaEl.value=m.firma;
      await loadUrunlerUI();
    }

    if(m.sehir){
      const cityOpt=[...sehirEl.options].find(o=>o.textContent===m.sehir);
      if(cityOpt){
        sehirEl.value=cityOpt.value;
        await loadDistrictsUI(cityOpt.value);

        const ilOpt=[...ilceEl.options].find(o=>o.textContent===m.ilce);
        if(ilOpt) ilceEl.value=ilOpt.value;
      }
    }

    musteriHint.textContent="Müşteri bilgileri yüklendi.";

  }catch(err){
    musteriHint.textContent="Sorgu hatası.";
  }
}
telEl.addEventListener("input", handleTelLookup);

// =======================================================
// SUBMIT (N8N’e gider)
// =======================================================
function temizleForm() {
  // Tüm inputları temizle
  adEl.value = "";
  telEl.value = "";
  adresEl.value = "";
  sehirEl.value = "";
  ilceEl.innerHTML = `<option value="">Önce şehir seçiniz…</option>`;
  firmaEl.value = "";
  alanEl.value = "";
  musteriNotuEl.value = "";
  notlarEl.value = "";
  siparisNoEl.value = "";

  // Çok satan ürünleri sıfırla
  cokSatanContainer.querySelectorAll('.kg-check').forEach(c=> c.checked = false);
  cokSatanContainer.querySelectorAll('.kg-adet').forEach(i=> i.value = 1);

  // Diğer ürünleri sıfırla
  digerSecimler = [];
  renderDigerListe();

  // Toplam sıfırla
  toplamEl.value = 0;
  toplamHint.textContent = "";

  // Ücretsiz mod kapat
  manualFreeMode = false;
  odemeEl.disabled = false;
  btnUcretsiz.textContent = "Ücretsiz / Değişim";
}




$("form").onsubmit = async (e)=>{
  e.preventDefault();

  // ===========================================
  // ZORUNLU: En az 1 ürün seçilmeli
  // ===========================================
  const seciliCokSatan = document.querySelectorAll(".kg-check:checked").length;
  const seciliDiger = digerSecimler.length;

  console.log("Kontrol:", seciliCokSatan, seciliDiger); // debug

  if (seciliCokSatan === 0 && seciliDiger === 0) {
    showPopup("Lütfen en az 1 ürün ekleyin.", "error");
    sonucEl.textContent = "";
    return;
  }

  sonucEl.textContent="Gönderiliyor…";


  const siparisNo = siparisNoEl.value.trim() || null;
  const sehirAd = sehirEl.options[sehirEl.selectedIndex]?.textContent || "";
  const sehirKodu = sehirEl.value || null;
  const ilceAd = ilceEl.value ? ilceEl.value.split("|")[2] : "";
  const ilceKodu = ilceEl.value ? ilceEl.value.split("|")[1] : null;

  // =======================================================
  // SEÇİLEN ÜRÜNLERİ TOPLA
  // =======================================================
  const secilen = [];

  // --- ÇOK SATAN ÜRÜNLER ---
  document.querySelectorAll(".kg-check:checked").forEach(chk=>{
    const id = chk.dataset.id;
    const kg = Number(chk.dataset.kg);
    const adetEl = document.querySelector(`.kg-adet[data-id="${id}"][data-kg="${kg}"]`);
    const adet = Number(adetEl.value || 1);
    const u = cokSatanUrunler.find(x => x.id == id);
    const fiyat = kg === 10 ? u.fiyat_10 : u.fiyat_5;

    secilen.push({
      id: u.id,
      ad: u.ad,
      kg,
      kargo_kg: kg === 10 ? u.kargo_kg_10 : u.kargo_kg_5,
      fiyat: manualFreeMode ? 0 : fiyat,
      adet,
      toplam: manualFreeMode ? 0 : fiyat * adet
    });
  });

  // --- DİĞER ÜRÜNLER ---
  digerSecimler.forEach(x=>{
    const u = digerUrunler.find(item => item.id === x.id);

    secilen.push({
      id: x.id,
      ad: x.ad,
      kg: x.kg,
      kargo_kg: x.kg === 10 ? u.kargo_kg_10 : u.kargo_kg_5,
      fiyat: manualFreeMode ? 0 : x.fiyat,
      adet: x.adet,
      toplam: manualFreeMode ? 0 : x.toplam
    });
  });

  // =======================================================
  // KARGO KG VE ADET
  // =======================================================
  let kargoKgListesi = [];
  let toplamKargoAdet = 0;

  secilen.forEach(u=>{
    for (let i = 0; i < u.adet; i++) {
      kargoKgListesi.push(u.kargo_kg);
    }
    toplamKargoAdet += u.adet;
  });

  const kargoKgMetni = kargoKgListesi.join(",");

  // =======================================================
  // ÜRÜN METNİ
  // =======================================================
  const urunBilgisiMetni = secilen
    .map(u => `${u.ad} ${u.kg} kg ${u.adet} adet`)
    .join("\n");

  // =======================================================
  // PAYLOAD
  // =======================================================
  const kayit = {
    siparis_no:siparisNo,
    musteri_tel:telEl.value,
    musteri_ad_soyad:adEl.value,
    musteri_adres:adresEl.value,
    sehir:sehirAd,
    ilce:ilceAd,
    sehir_kodu: sehirKodu,
    ilce_kodu: ilceKodu,
    firma:firmaEl.value,
    siparis_alan:alanEl.value,

    // 🔥 EKLENENLER
    kargo_kg: kargoKgMetni,
    kargo_adet: toplamKargoAdet,

    urun_bilgisi: urunBilgisiMetni,
    secilen_urunler:JSON.stringify(secilen),
    toplam_tutar:manualFreeMode?0:Number(toplamEl.value),
    odeme_turu:manualFreeMode?null:odemeEl.value,
    notlar:notlarEl.value,
    musteri_notu: musteriNotuEl.value || ""
  };

  // =======================================================
  // GÖNDERİM
  // =======================================================
try {
    const res = await insertFormSiparis(kayit);

    showPopup("Sipariş başarıyla gönderildi.", "ok");  // POPUP ✔

    temizleForm(); // form temizle

} catch {
    showPopup("Gönderim başarısız oldu.", "error");   // POPUP ❌
}


};

// =======================================================
// SİPARİŞ NO
// =======================================================
siparisNoEl.onblur = loadSiparisByNo;
siparisNoEl.addEventListener("keydown",(e)=>{
  if(e.key==="Enter"){ e.preventDefault(); loadSiparisByNo(); }
});

async function loadSiparisByNo() {
  const no = siparisNoEl.value.trim();
  if (!no) return;

  try {
    // --- 1) Siparişi çek ---
    const rows = await sbFetch("tum_siparisler", {
      query: `siparis_no=eq.${no}&select=*`
    });

    if (!rows.length) {
      showPopup("Sipariş bulunamadı.", "error");
      return;
    }

    const d = rows[0];

    // --- 2) YETKİ KONTROLÜ (EN BAŞTA) ---
    // EŞLEŞME: d.siparis_alan === currentUser.username
    if (!currentUser.admin && d.siparis_alan?.trim() !== currentUser.username?.trim()) {
      showPopup(`Bu sipariş size ait değildir. (${d.siparis_alan})`, "error");
      return;
    }

    // --- 3) Temel müşteri bilgileri ---
    telEl.value = d.musteri_tel || "";
    adEl.value = d.ad_soyad || "";
    adresEl.value = d.adres || "";
    notlarEl.value = d.notlar || "";
    if (d.musteri_notu) musteriNotuEl.value = d.musteri_notu;

    // --- 4) Firma yükle ---
    if (d.firma) {
      firmaEl.value = d.firma;
      await loadUrunlerUI();
    }

    // --- 5) Şehir / İlçe ---
    if (d.sehir) {
      const cityOpt = [...sehirEl.options].find(o => o.textContent === d.sehir);
      if (cityOpt) {
        sehirEl.value = cityOpt.value;
        await loadDistrictsUI(cityOpt.value);

        const ilOpt = [...ilceEl.options].find(o => o.textContent === d.ilce);
        if (ilOpt) ilceEl.value = ilOpt.value;
      }
    }

    // --- 6) Siparişi Alan ---
    if (!currentUser.admin) {
      // Normal kullanıcı → sadece kendisi görür
      fillSelect(alanEl, [currentUser.username], "");
      alanEl.value = currentUser.username;
      alanEl.disabled = true;

    } else {
      // Admin → tüm kullanıcı listesi
      await setSiparisiAlan(currentUser);
      if (d.siparis_alan) alanEl.value = d.siparis_alan;
    }

    // --- 7) Ürünleri sıfırla ve yükle ---
    digerSecimler = [];
    uncheckAllCokSatan();

    try {
      const urunler = Array.isArray(d.secilen_urunler)
        ? d.secilen_urunler
        : JSON.parse(d.secilen_urunler || "[]");

      urunler.forEach(it => {
        const cs = cokSatanUrunler.find(x => x.id == it.id);

        if (cs) {
          const chk = cokSatanContainer.querySelector(
            `.kg-check[data-id="${it.id}"][data-kg="${it.kg}"]`
          );
          const adetInp = cokSatanContainer.querySelector(
            `.kg-adet[data-id="${it.id}"][data-kg="${it.kg}"]`
          );

          if (chk) chk.checked = true;
          if (adetInp) adetInp.value = it.adet || 1;

        } else {
          digerSecimler.push({
            id: it.id,
            ad: it.ad,
            kg: Number(it.kg),
            adet: Number(it.adet || 1),
            fiyat: Number(it.fiyat || 0),
            toplam: Number(it.toplam || 0)
          });
        }
      });

      renderDigerListe();
    } catch {
      renderDigerListe();
    }

    // --- 8) Ücretsiz / Ücretli ---
    if (Number(d.toplam_tutar) === 0) {
      manualFreeMode = true;
      odemeEl.disabled = true;
      btnUcretsiz.textContent = "Ücretli Yap";
      toplamEl.value = 0;
    } else {
      manualFreeMode = false;
      odemeEl.disabled = false;
      btnUcretsiz.textContent = "Ücretsiz / Değişim";
      toplamEl.value = d.toplam_tutar || hesaplaToplam();
    }

    if (d.odeme_turu) odemeEl.value = d.odeme_turu;

    toplamHint.textContent = "Sipariş yüklendi.";

  } catch (err) {
    showPopup("Sipariş yüklenemedi.", "error");
  }
}



function uncheckAllCokSatan(){
  cokSatanContainer.querySelectorAll('.kg-check').forEach(c=>c.checked=false);
  cokSatanContainer.querySelectorAll('.kg-adet').forEach(i=>i.value=1);
}

// =======================================================
// SİPARİŞ İPTAL
// =======================================================
btnIptal.onclick = async ()=>{
  const no=siparisNoEl.value.trim();
  if(!no){ showPopup("Önce sipariş no gir.","error"); return; }
  const neden = prompt("İptal nedeni:");
  if(neden===null) return;
  await sendCancelToN8N(no, neden, currentUser.username);
  showPopup("İptal bilgisi gönderildi.","ok");
};

// =======================================================
// INIT
// =======================================================
async function initApp(){
  if(appInitialized) return;
  appInitialized=true;

  fillSelect(firmaEl, ["Tasdipli","Esin","Queen"], "Firma seçiniz…");

  setSiparisiAlan(currentUser);
  await loadCities();

  ilceEl.disabled=true;
  ilceEl.innerHTML=`<option value="">Önce şehir seçiniz…</option>`;
}

// ===========================
// 📦 SİPARİŞLER POPUP - STATE
// ===========================
const ordersModal  = document.getElementById("ordersModal");
const openOrders   = document.getElementById("openOrders");
const closeOrders  = document.getElementById("closeOrders");
const ordersList   = document.getElementById("ordersList");
const ordersSearch = document.getElementById("ordersSearch");
const ordersFilter = document.getElementById("ordersFilter");
const ordersSort   = document.getElementById("ordersSort");

let _ordersFull = [];

// Teslim edildi mi? (boolean + shipmentStatus metninden türet)
function isDeliveredComputed(o){
  return !!(o.isDelivered || (o.shipmentStatus && o.shipmentStatus.toLowerCase().includes("teslim")));
}

// 3 tablodan sipariş çek (siparis_alan = formdaki "Siparişi Alan")
async function getUserOrdersByAssignee(username){
  const tables = ["queen_siparisler","esin_siparisler","tasdipli_siparisler"];
  const all = [];
  for(const t of tables){
    const rows = await sbFetch(t, {
      query: `siparis_alan=ilike.${encodeURIComponent(username.trim())}&select=*`
    });
    rows.forEach(r => r._tbl = t);
    all.push(...rows);
  }
  // Teslim edilmeyenler üstte → sonra yeni → eski
  return all.sort((a,b)=>{
    const da = isDeliveredComputed(a), db = isDeliveredComputed(b);
    if(da !== db) return da ? 1 : -1;
    return (Number(b.siparis_no)||0) - (Number(a.siparis_no)||0);
  });
}

// Listeyi tablo gibi render et
function renderOrders(list) {
  if (!list.length) {
    ordersList.innerHTML = `<div class="text-slate-400 text-sm">Kayıt yok.</div>`;
    return;
  }

  ordersList.innerHTML = list
    .map((o) => {
      const teslim = isDeliveredComputed(o);

      const statusBadge = `<span class="px-2 py-1 rounded bg-slate-700 text-[11px]">
        ${o.shipmentStatus || "—"}
      </span>`;

      const teslimBadge = o.isDelivered === true
  ? `<span class="px-2 py-1 rounded bg-green-700 text-[11px]">✔ Teslim</span>`
  : `<span class="px-2 py-1 rounded bg-red-700 text-[11px]">❌ Bekliyor</span>`;


      const takipLink = o.kargo_takip_url
        ? `<a href="${o.kargo_takip_url}" target="_blank" class="text-blue-400 underline">Takip</a>`
        : "—";

      return `
      <div class="relative grid grid-cols-[70px_1fr_110px_100px_120px_100px_140px_80px] 
                  gap-3 items-center border-b border-slate-800 py-2
                  hover:bg-slate-800/60 rounded cursor-pointer">

        <div class="font-semibold">${o.siparis_no}</div>
        <div>${o.ad_soyad || "-"}</div>
        <div>${o.musteri_tel || "-"}</div>
        <div>${o.firma || "-"}</div>
        <div>${statusBadge}</div>
        <div>${teslimBadge}</div>
        <div>${o.kargo_takip_kodu || "—"}</div>
        <div>${takipLink}</div>

        <!-- ⭐ SADECE kargo_durumu === 'Bekliyor' İSE DÜZENLE GÖRÜNÜR -->
        ${
          o.kargo_durumu === "Bekliyor"
            ? `<button class="edit-btn absolute right-2 top-2 px-2 py-1 text-xs 
                         bg-yellow-600 hover:bg-yellow-500 rounded z-10"
                       data-no="${o.siparis_no}">
                   ✏️ Düzenle
               </button>`
            : ""
        }

        <!-- DETAY BLOĞU -->
        <div class="col-span-8 text-xs text-slate-300 mt-2 hidden detail-box"></div>
      </div>
      `;
    })
    .join("");

  // Detay aç/kapa
  Array.from(ordersList.children).forEach((row, idx) => {
    row.addEventListener("click", (e) => {
      if (e.target.closest(".edit-btn")) return;

      const o = list[idx];
      const detail = row.querySelector(".detail-box");
      const teslim = isDeliveredComputed(o);

detail.innerHTML = `
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6
              bg-slate-900/60 p-4 rounded border border-slate-700">

    <!-- ================= SOL TARAF ================= -->
    <div class="space-y-2 text-sm order-1">

      <div><b>Müşteri Adı:</b> ${o.ad_soyad || "-"}</div>
      <div><b>Telefon:</b> ${o.musteri_tel || "-"}</div>

      <div class="pt-1">
        <b>Adres:</b><br>
        <span class="text-slate-300">${o.adres || "-"}</span>
      </div>

      <div class="pt-1">
        <b>İl / İlçe:</b>
        ${o.sehir || "-"} / ${o.ilce || "-"}
      </div>

      <div class="text-xs text-slate-400">
        İl Kodu: ${o.sehir_kodu ?? "-"} |
        İlçe Kodu: ${o.ilce_kodu ?? "-"}
      </div>

      <div class="pt-1">
        <b>Firma:</b>
        <span class="font-semibold text-emerald-400">
          ${o.firma || "-"}
        </span>
      </div>

      <div class="pt-2">
        <b>Ürün Bilgisi:</b><br>
        ${(o.urun_bilgisi || "").replace(/\n/g, "<br>")}
      </div>

      <div class="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
        <div class="chip">Kargo KG: ${o.kargo_kg || "-"}</div>
        <div class="chip">Adet: ${o.kargo_adet || "-"}</div>
        <div class="chip font-semibold bg-slate-800">
          Toplam: ${o.toplam_tutar ?? "-"} TL
        </div>
      </div>
    </div>

    <!-- ================= SAĞ TARAF ================= -->
    <div class="space-y-2 text-sm order-2">

      <div><b>Kargo Aşaması:</b> ${o.shipmentStatus || "—"}</div>

<div>
  <b>Teslim Durumu:</b>
  ${
    o.isDelivered === true
      ? `<span class="text-green-400 font-semibold">✔ Evet</span>`
      : `<span class="text-red-400 font-semibold">❌ Hayır</span>`
  }
</div>


      <div><b>Kargo Takip Kodu:</b> ${o.kargo_takip_kodu || "—"}</div>

      <div>
        <b>Kargo Takip Linki:</b>
        ${
          o.kargo_takip_url
            ? `<a href="${o.kargo_takip_url}" target="_blank"
                 class="text-blue-400 underline">Takip Et</a>`
            : "—"
        }
      </div>

      <div class="pt-2">
        <b>Teslimat Açıklaması:</b><br>
        <span class="text-slate-300">
          ${o.teslimat_aciklama || "—"}
        </span>
      </div>

    </div>

  </div>
`;





      detail.classList.toggle("hidden");
    });
  });
}

// Arama + filtre + sıralama uygula
function applyOrdersFilters(){
  const q = (ordersSearch.value || "").toLowerCase();
  let list = _ordersFull.filter(o=>{
    if(!q) return true;
    return (o.ad_soyad||"").toLowerCase().includes(q) ||
           (o.musteri_tel||"").toLowerCase().includes(q) ||
           String(o.siparis_no||"").includes(q);
  });

  if(ordersFilter.value==="edildi"){
    list = list.filter(o=> isDeliveredComputed(o));
  }else if(ordersFilter.value==="edilmedi"){
    list = list.filter(o=> !isDeliveredComputed(o));
  }

  if(ordersSort.value==="yeni"){
    list.sort((a,b)=> (Number(b.siparis_no)||0)-(Number(a.siparis_no)||0));
  }else{
    list.sort((a,b)=> (Number(a.siparis_no)||0)-(Number(b.siparis_no)||0));
  }

  // teslim edilmeyenler yine en üstte kalsın (ikincil kural)
  list.sort((a,b)=>{
    const da = isDeliveredComputed(a), db = isDeliveredComputed(b);
    if(da !== db) return da ? 1 : -1;
    return 0;
  });

  renderOrders(list);
}

// Aç/Kapat & Yükle
openOrders.onclick = async ()=>{
  ordersList.innerHTML = `<div class="text-sm text-slate-400">Yükleniyor…</div>`;
  ordersModal.classList.remove("hidden");

  const username = alanEl.value?.trim() || currentUser?.username;
  _ordersFull = await getUserOrdersByAssignee(username);

  applyOrdersFilters();
};
closeOrders.onclick = ()=> ordersModal.classList.add("hidden");

ordersSearch.oninput = applyOrdersFilters;
ordersFilter.onchange = applyOrdersFilters;
ordersSort.onchange   = applyOrdersFilters;

// =======================================================
// EVENTLER
// =======================================================
loginForm.onsubmit = handleLogin;
logoutBtn.onclick = ()=>{ localStorage.removeItem(STORAGE_KEY); location.reload(); };

sehirEl.onchange = (e)=>{
  if(!e.target.value){
    ilceEl.disabled=true;
    ilceEl.innerHTML=`<option value="">Önce şehir seçiniz…</option>`;
    return;
  }
  loadDistrictsUI(e.target.value);
};

firmaEl.onchange = loadUrunlerUI;

document.addEventListener("input", (e)=>{
  if(e.target.classList.contains("kg-check") ||
     e.target.classList.contains("kg-adet")){
    autoRecalc();
  }
});

toplamEl.oninput = ()=>{ autoCalcLocked=true; };

// Auto login
(function(){
  const saved=loadUser();
  if(saved){
    currentUser=saved;
    updateUserUI(saved);
    showApp();
    setSiparisiAlan(saved);
    initApp();
  }else{
    showLogin();
  }
})();
// DÜZENLE butonu event delegation (her zaman çalışır)
ordersList.addEventListener("click", (e)=>{
  const btn = e.target.closest(".edit-btn");
  if(!btn) return;

  e.stopPropagation(); // satır tıklama (detay toggle) tetiklenmesin

  const no = btn.dataset.no;
  siparisNoEl.value = no;
  ordersModal.classList.add("hidden");
  loadSiparisByNo(); // siparişi forma yükle
});

// =======================================================
// 🍏 iOS – Ana Ekrana Ekle Popup
// =======================================================

(function iosAddToHomePopup() {

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const isStandalone = window.navigator.standalone === true;

  // sadece iOS Safari + ana ekrana ekli değilse
  if (!isIos || !isSafari || isStandalone) return;

  // daha önce gösterildiyse tekrar gösterme
  if (localStorage.getItem("iosA2HShown")) return;

  // mevcut popup sistemini kullan
  showPopup(`
    <b>📲 Uygulama gibi kullanmak için</b><br><br>
    Safari alt menüsünden <br>
    <b>Paylaş</b> → <b>Ana Ekrana Ekle</b><br><br>
    Böylece tam ekran, adres çubuğu olmadan açılır.
  `, "error"); // 🔴 kırmızı kenarlık

  localStorage.setItem("iosA2HShown", "1");

})();

// =======================================================
// 🔁 SERVICE WORKER REGISTER (APP.JS İÇİN DOĞRU YER)
// =======================================================
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/service-worker.js").then(reg => {

    reg.addEventListener("updatefound", () => {
      const newWorker = reg.installing;
      if (!newWorker) return;

      newWorker.addEventListener("statechange", () => {
        if (
          newWorker.state === "activated" &&
          navigator.serviceWorker.controller
        ) {
          location.reload(); // 🔥 auto update
        }
      });
    });

  });
}
