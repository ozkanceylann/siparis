/* ============================================
   AYARLAR
============================================ */
// Supabase
const SUPABASE_URL = "https://jarsxtpqzqzhlshpmgot.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphcnN4dHBxenF6aGxzaHBtZ290Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyODExMTcsImV4cCI6MjA3Nzg1NzExN30.98oYONSkb8XSDrfGW2FxhFmt2BLB5ZRo3Ho50GhZYgE";

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// N8N Webhook URL'leri
const N8N_KARGO_WEBHOOK = "https://n8n.ozkanceylan.uk/webhook/kargola";
const N8N_BARKOD_LOG_WEBHOOK =
  "https://n8n.ozkanceylan.uk/webhook/barkod_yazdir_log";
const N8N_KARGO_IPTAL_WEBHOOK =
  "https://n8n.ozkanceylan.uk/webhook/kargo_iptal";

// QZ Tray için yazıcı adı (gerçek adla değiştir)
const QZ_PRINTER_NAME = "Zebra_Printer";

/* ============================================
   GLOBAL STATE
============================================ */
let currentTab = "bekleyen";
let currentPage = 1;
let selectedOrder = null;
let isSearching = false;
const PAGE_SIZE = 10;

/* ============================================
   YARDIMCI: TAB FİLTRESİ
============================================ */
function applyTabFilter(query) {
  if (currentTab === "bekleyen") {
    query = query.eq("kargo_durumu", "Bekliyor");
  } else if (currentTab === "hazirlandi") {
    query = query.eq("kargo_durumu", "Hazırlandı");
  } else if (currentTab === "kargolandi") {
    query = query.or(
      "kargo_durumu.eq.Kargolandı," +
        "kargo_durumu.eq.Kargoya Verildi," +
        "kargo_durumu.eq.Kargo Verildi," +
        "kargo_durumu.eq.kargolandı"
    );
  } else if (currentTab === "iptal") {
    query = query.eq("kargo_durumu", "İptal");
  }
  return query;
}

/* ============================================
   SİPARİŞ LİSTELEME (PAGINATION + APPEND)
============================================ */
async function loadOrders(reset = false) {
  const tbody = document.getElementById("ordersBody");
  const loadMoreBtn = document.getElementById("loadMoreBtn");

  if (reset) {
    currentPage = 1;
    tbody.innerHTML = "";
    isSearching = false;
  }

  let query = db.from("tum_siparisler").select("*");
  query = applyTabFilter(query);

  const start = (currentPage - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE - 1;

  query = query.order("siparis_no", { ascending: false }).range(start, end);

  const { data, error } = await query;

  if (error) {
    if (reset) {
      tbody.innerHTML = `<tr><td colspan="7">HATA: ${error.message}</td></tr>`;
    }
    console.error(error);
    return;
  }

  const rows = data || [];

  if (reset) {
    renderTable(rows, false);
  } else {
    if (rows.length === 0) {
      currentPage--;
      loadMoreBtn.style.display = "none";
      return;
    }
    renderTable(rows, true);
  }

  if (rows.length < PAGE_SIZE) {
    loadMoreBtn.style.display = "none";
  } else if (!isSearching) {
    loadMoreBtn.style.display = "block";
  }
}

/* ============================================
   TABLO RENDER
============================================ */
function renderTable(data, append = false) {
  const tbody = document.getElementById("ordersBody");

  if (!append) {
    tbody.innerHTML = "";
  }

  if (!data || data.length === 0) {
    if (!append) {
      tbody.innerHTML = `<tr><td colspan="7">Kayıt bulunamadı.</td></tr>`;
    }
    return;
  }

  data.forEach((order) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${order.siparis_no}</td>
      <td>${order.ad_soyad}</td>
      <td>${parseProduct(order.urun_bilgisi)}</td>
      <td>${order.toplam_tutar} TL</td>
      <td>${order.kargo_durumu || "-"}</td>
      <td>${order.kargo_takip_kodu ?? "-"}</td>
      <td><button class="btn-open">Aç</button></td>
    `;

    tr.addEventListener("click", (e) => {
      if (!e.target.classList.contains("btn-open")) {
        openOrder(order.siparis_no);
      }
    });

    tr.querySelector(".btn-open").addEventListener("click", (e) => {
      e.stopPropagation();
      openOrder(order.siparis_no);
    });

    tbody.appendChild(tr);
  });
}

/* ============================================
   ÜRÜN PARSE
============================================ */
function parseProduct(value) {
  if (!value) return "-";

  try {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        const json = JSON.parse(trimmed);
        if (Array.isArray(json)) {
          return json
            .map((v) =>
              typeof v === "object" ? Object.values(v).join(" ") : String(v)
            )
            .join(", ");
        }
      }
    }
  } catch (_) {}

  return String(value);
}

/* ============================================
   KARGO_KG PARSE + GÖSTERİM
============================================ */
function parseKargoKg(value) {
  if (value == null) return { parts: [], total: null };

  let raw = value;
  let arr = [];

  if (Array.isArray(raw)) {
    arr = raw;
  } else if (typeof raw === "string") {
    const trimmed = raw.trim();

    // JSON array dene
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        arr = parsed;
      }
    } catch (_) {
      // regex ile içindeki sayıları al
      const matches = trimmed.match(/[\d]+(?:[.,]\d+)?/g) || [];
      arr = matches.map((s) => parseFloat(s.replace(",", ".")));
    }
  } else if (typeof raw === "number") {
    arr = [raw];
  }

  arr = arr.filter((n) => typeof n === "number" && !isNaN(n));
  if (!arr.length) return { parts: [], total: null };

  const total = arr.reduce((sum, n) => sum + n, 0);
  return { parts: arr, total };
}

function formatKargoKgDisplay(value) {
  if (!value) return "-";

  const { parts, total } = parseKargoKg(value);
  if (!parts.length) return String(value);

  const base = parts.join("-");
  if (total != null && !isNaN(total)) {
    return `${base} (Toplam: ${total} kg)`;
  }
  return base;
}

/* ============================================
   MODAL – AÇ
============================================ */
async function openOrder(id) {
  const { data, error } = await db
    .from("tum_siparisler")
    .select("*")
    .eq("siparis_no", id)
    .single();

  if (error || !data) {
    alert("Sipariş bulunamadı!");
    return;
  }

  selectedOrder = data;

  renderDetailsView();
  document.getElementById("orderModal").style.display = "flex";
}

/* ============================================
   MODAL – KAPAT
============================================ */
function closeModal() {
  document.getElementById("orderModal").style.display = "none";
}

/* ============================================
   SİPARİŞ DETAY GÖRÜNÜMÜ
============================================ */
function renderDetailsView() {
  const d = selectedOrder;
  if (!d) return;

  const kargoKgText = formatKargoKgDisplay(d.kargo_kg);
  const kargoAdetText = d.kargo_adet != null ? d.kargo_adet : "-";

  const detailsHtml = `
    <p><b>No:</b> ${d.siparis_no}</p>
    <p><b>İsim:</b> ${d.ad_soyad}</p>
    <p><b>Telefon:</b> ${d.siparis_tel || "-"}</p>
    <p><b>Müşteri Tel:</b> ${d.musteri_tel || "-"}</p>
    <p><b>Siparişi Alan:</b> ${d.siparis_alan || "-"}</p>
    <p><b>Adres:</b> ${d.adres || "-"}</p>
    <p><b>Şehir / İlçe:</b> ${d.sehir || "-"} / ${d.ilce || "-"}</p>
    <p><b>Ürün:</b> ${parseProduct(d.urun_bilgisi)}</p>
    <p><b>Kargo KG:</b> ${kargoKgText}</p>
    <p><b>Kargo Adet:</b> ${kargoAdetText}</p>
    <p><b>Tutar:</b> ${d.toplam_tutar} TL</p>
    <p><b>Ödeme:</b> ${d.odeme_sekli || "-"}</p>
    <p><b>Not:</b> ${d.notlar ?? "-"}</p>
  `;

  document.getElementById("orderDetails").innerHTML = detailsHtml;

  const isCancelled = d.kargo_durumu === "İptal";

  document.getElementById("editButtons").style.display = "none";
  document.getElementById("cancelForm").style.display = "none";

  if (isCancelled) {
    document.getElementById("actionButtons").style.display = "none";
    document.getElementById("restoreButtons").style.display = "flex";
  } else {
    document.getElementById("restoreButtons").style.display = "none";
    document.getElementById("actionButtons").style.display = "flex";
    configureActionButtonsForTab();
  }
}

/* ============================================
   TAB'A GÖRE BUTONLARI AYARLA
============================================ */
function configureActionButtonsForTab() {
  const btnHazirla = document.getElementById("btnHazirla");
  const btnKargola = document.getElementById("btnKargola");
  const btnBarkod = document.getElementById("btnBarkod");
  const btnDuzenle = document.getElementById("btnDuzenle");
  const btnIptal = document.getElementById("btnIptal");

  btnHazirla.style.display = "none";
  btnKargola.style.display = "none";
  btnBarkod.style.display = "none";
  btnDuzenle.style.display = "none";
  btnIptal.style.display = "none";

  if (currentTab === "bekleyen") {
    btnHazirla.style.display = "inline-block";
    btnDuzenle.style.display = "inline-block";
    btnIptal.style.display = "inline-block";
  } else if (currentTab === "hazirlandi") {
    btnKargola.style.display = "inline-block";
    btnDuzenle.style.display = "inline-block";
    btnIptal.style.display = "inline-block";
  } else if (currentTab === "kargolandi") {
    btnBarkod.style.display = "inline-block";
    btnIptal.style.display = "inline-block";
  }
}

/* ============================================
   DÜZENLE EKRANI
============================================ */
function enterEditMode() {
  const d = selectedOrder;
  if (!d) return;

  document.getElementById("orderDetails").innerHTML = `
    <div class="edit-grid">

      <div class="form-group">
        <label>Ad Soyad</label>
        <input id="ad_soyad" value="${d.ad_soyad || ""}">
      </div>

      <div class="form-group">
        <label>Telefon</label>
        <input id="siparis_tel" value="${d.siparis_tel || ""}">
      </div>

      <div class="form-group">
        <label>Müşteri Tel</label>
        <input id="musteri_tel" value="${d.musteri_tel || ""}">
      </div>

      <div class="form-group full-row">
        <label>Adres</label>
        <textarea id="adres">${d.adres || ""}</textarea>
      </div>

      <div class="form-group">
        <label>Şehir</label>
        <input id="sehir" value="${d.sehir || ""}">
      </div>

      <div class="form-group">
        <label>İlçe</label>
        <input id="ilce" value="${d.ilce || ""}">
      </div>

      <div class="form-group full-row">
        <label>Ürün</label>
        <textarea id="urun_bilgisi">${d.urun_bilgisi || ""}</textarea>
      </div>

      <div class="form-group">
        <label>Kargo KG (AI çıktısı)</label>
        <input id="kargo_kg" value="${d.kargo_kg || ""}">
      </div>

      <div class="form-group">
        <label>Kargo Adet</label>
        <input id="kargo_adet" value="${d.kargo_adet ?? ""}">
      </div>

      <div class="form-group">
        <label>Tutar</label>
        <input id="toplam_tutar" value="${d.toplam_tutar || ""}">
      </div>

      <div class="form-group">
        <label>Ödeme</label>
        <input id="odeme_sekli" value="${d.odeme_sekli || ""}">
      </div>

      <div class="form-group full-row">
        <label>Not</label>
        <textarea id="notlar">${d.notlar ?? ""}</textarea>
      </div>

    </div>
  `;

  document.getElementById("actionButtons").style.display = "none";
  document.getElementById("editButtons").style.display = "flex";
  document.getElementById("cancelForm").style.display = "none";
  document.getElementById("restoreButtons").style.display = "none";
}

/* ============================================
   Düzenle → Kaydet
============================================ */
async function saveEdit() {
  if (!selectedOrder) return;

  const updated = {
    ad_soyad: document.getElementById("ad_soyad").value,
    siparis_tel: document.getElementById("siparis_tel").value,
    musteri_tel: document.getElementById("musteri_tel").value,
    adres: document.getElementById("adres").value,
    sehir: document.getElementById("sehir").value,
    ilce: document.getElementById("ilce").value,
    urun_bilgisi: document.getElementById("urun_bilgisi").value,
    kargo_kg: document.getElementById("kargo_kg").value,
    kargo_adet: document.getElementById("kargo_adet").value,
    toplam_tutar: document.getElementById("toplam_tutar").value,
    odeme_sekli: document.getElementById("odeme_sekli").value,
    notlar: document.getElementById("notlar").value,
  };

  const { error } = await db
    .from("tum_siparisler")
    .update(updated)
    .eq("siparis_no", selectedOrder.siparis_no);

  if (error) {
    alert("Kaydedilirken hata oluştu: " + error.message);
    return;
  }

  alert("Kaydedildi!");
  closeModal();
  loadOrders(true);
}

/* ============================================
   Düzenle → Vazgeç
============================================ */
function cancelEdit() {
  renderDetailsView();
}

/* ============================================
   BEKLEYEN / HAZIRLANDI İPTAL AKIŞI
============================================ */
function handleCancelClick() {
  if (currentTab === "kargolandi") {
    // Kargolandı ise özel modal
    openCargoCancelModal();
  } else {
    // Bekleyen / Hazırlandı için normal iptal formu
    document.getElementById("cancelForm").style.display = "block";
    document.getElementById("actionButtons").style.display = "none";
    document.getElementById("editButtons").style.display = "none";
    document.getElementById("restoreButtons").style.display = "none";
  }
}

async function confirmCancelNormal() {
  if (!selectedOrder) return;

  const reason = document.getElementById("iptalInput").value.trim();
  if (!reason) {
    alert("İptal nedeni gerekli!");
    return;
  }

  const { error } = await db
    .from("tum_siparisler")
    .update({
      kargo_durumu: "İptal",
      iptal_nedeni: reason,
      iptal_tarihi: new Date().toISOString(),
    })
    .eq("siparis_no", selectedOrder.siparis_no);

  if (error) {
    alert("İptal sırasında hata oluştu: " + error.message);
    return;
  }

  alert("Sipariş iptal edildi");
  closeModal();
  loadOrders(true);
}

/* ============================================
   KARGOLANDI → İPTAL MODALI
============================================ */
function openCargoCancelModal() {
  document.getElementById("cargoCancelReason").value = "";
  document.getElementById("cargoCancelModal").style.display = "flex";
}

function closeCargoCancelModal() {
  document.getElementById("cargoCancelModal").style.display = "none";
}

async function confirmCancelCargo() {
  if (!selectedOrder) return;

  const reason = document.getElementById("cargoCancelReason").value.trim();
  if (!reason) {
    alert("İptal nedeni zorunludur!");
    return;
  }

  try {
    // 1) N8N'e kargo iptal webhook gönder
    await fetch(N8N_KARGO_IPTAL_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siparis_no: selectedOrder.siparis_no,
        kargo_takip_kodu: selectedOrder.kargo_takip_kodu,
        musteri_adi: selectedOrder.ad_soyad,
        neden: reason,
      }),
    });

    // 2) Supabase'de iptal et
    const { error } = await db
      .from("tum_siparisler")
      .update({
        kargo_durumu: "İptal",
        iptal_nedeni: reason,
        iptal_tarihi: new Date().toISOString(),
      })
      .eq("siparis_no", selectedOrder.siparis_no);

    if (error) {
      alert("Veritabanı güncelleme hatası: " + error.message);
      return;
    }

    alert("Kargolanmış sipariş iptal edildi!");
    closeCargoCancelModal();
    closeModal();
    loadOrders(true);
  } catch (err) {
    alert("Kargo iptal hatası: " + err.message);
  }
}

/* ============================================
   İPTALİ GERİ AL
============================================ */
async function restoreOrder() {
  if (!selectedOrder) return;

  const { error } = await db
    .from("tum_siparisler")
    .update({
      kargo_durumu: "Bekliyor",
      iptal_nedeni: null,
      iptal_tarihi: null,
    })
    .eq("siparis_no", selectedOrder.siparis_no);

  if (error) {
    alert("Geri alma sırasında hata oluştu: " + error.message);
    return;
  }

  alert("Geri Alındı!");
  closeModal();
  loadOrders(true);
}

/* ============================================
   HAZIRLANDI
============================================ */
async function markPrepared() {
  if (!selectedOrder) return;

  const { error } = await db
    .from("tum_siparisler")
    .update({ kargo_durumu: "Hazırlandı" })
    .eq("siparis_no", selectedOrder.siparis_no);

  if (error) {
    alert("Güncelleme hatası: " + error.message);
    return;
  }

  alert("Hazırlandı olarak işaretlendi!");
  closeModal();
  loadOrders(true);
}

/* ============================================
   KARGOLA ONAY MODALI
============================================ */
function openKargolaConfirm() {
  if (!selectedOrder) return;
  document.getElementById("kargolaConfirmModal").style.display = "flex";
}

function closeKargolaConfirm() {
  document.getElementById("kargolaConfirmModal").style.display = "none";
}

/* ============================================
   Kargola → N8N Create Order
============================================ */
async function confirmKargola() {
  if (!selectedOrder) return;

  try {
    await fetch(N8N_KARGO_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siparis_no: selectedOrder.siparis_no,
        musteri_adi: selectedOrder.ad_soyad,
        telefon: selectedOrder.musteri_tel || selectedOrder.siparis_tel,
        adres: selectedOrder.adres,
        sehir: selectedOrder.sehir,
        ilce: selectedOrder.ilce,
        urun_bilgisi: selectedOrder.urun_bilgisi,
        toplam_tutar: selectedOrder.toplam_tutar,
        kargo_kg: selectedOrder.kargo_kg,
        kargo_adet: selectedOrder.kargo_adet,
      }),
    });

    // N8N:
    // - DHL create order
    // - tracking number + zpl_base64 üret
    // - Supabase kaydını güncelle
    // - kargo_durumu = 'Kargolandı'

    alert("Kargo oluşturma isteği N8N'e iletildi.");
    closeKargolaConfirm();
    closeModal();
    loadOrders(true);
  } catch (err) {
    alert("Kargo gönderim hatası: " + err.message);
  }
}

/* ============================================
   QZ TRAY BAĞLANTI
============================================ */
let qzConfig = null;

async function ensureQzConnected() {
  if (!window.qz) {
    throw new Error("QZ Tray script yüklü değil (qz-tray.js).");
  }

  if (!qz.websocket.isActive()) {
    await qz.websocket.connect();
  }

  if (!qzConfig) {
    const printer = await qz.printers.find(QZ_PRINTER_NAME);
    qzConfig = qz.configs.create(printer);
  }

  return qzConfig;
}

/* ============================================
   BARKOD KES (KARGOLANDI)
   - 1 kez izin
   - kargo_adet kadar etiket
   - N8N log
============================================ */
async function printLabel() {
  if (!selectedOrder) return;

  if (selectedOrder.barkod_yazdirildi) {
    alert("Bu sipariş için barkod daha önce yazdırılmış.");
    return;
  }

  if (!selectedOrder.zpl_base64) {
    alert("Bu siparişte kayıtlı bir barkod etiketi (zpl_base64) yok.");
    return;
  }

  let copies = parseInt(selectedOrder.kargo_adet, 10);
  if (!Number.isFinite(copies) || copies < 1) {
    copies = 1;
  }

  try {
    // 1) N8N log
    await fetch(N8N_BARKOD_LOG_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siparis_no: selectedOrder.siparis_no,
        kargo_takip_kodu: selectedOrder.kargo_takip_kodu,
        musteri_adi: selectedOrder.ad_soyad,
        kargo_adet: copies,
        zpl_kaynak: "supabase",
      }),
    });

    // 2) QZ Tray ile yazdır
    const config = await ensureQzConnected();
    const zplRaw = atob(selectedOrder.zpl_base64);

    for (let i = 0; i < copies; i++) {
      await qz.print(config, [
        {
          type: "raw",
          format: "plain",
          data: zplRaw,
        },
      ]);
    }

    // 3) Supabase'de barkod_yazdirildi = true
    const { error } = await db
      .from("tum_siparisler")
      .update({ barkod_yazdirildi: true })
      .eq("siparis_no", selectedOrder.siparis_no);

    if (error) {
      console.error(error);
      alert("Barkod yazdırıldı ama veritabanı güncellenemedi!");
    } else {
      alert("Barkod yazdırıldı!");
    }

    closeModal();
    loadOrders(true);
  } catch (err) {
    alert("Barkod yazdırma hatası: " + err.message);
  }
}

/* ============================================
   TAB DEĞİŞTİR
============================================ */
function setTab(tab) {
  currentTab = tab;

  document.querySelectorAll(".menu li").forEach((li) =>
    li.classList.remove("active")
  );
  const activeLi = document.getElementById("tab_" + tab);
  if (activeLi) activeLi.classList.add("active");

  document.getElementById("loadMoreBtn").style.display = "block";
  loadOrders(true);
}

/* ============================================
   LOAD MORE
============================================ */
function loadMore() {
  if (isSearching) return;
  currentPage++;
  loadOrders(false);
}

/* ============================================
   ARAMA
============================================ */
async function searchOrders() {
  const q = document.getElementById("searchInput").value.trim();

  if (!q) {
    isSearching = false;
    document.getElementById("loadMoreBtn").style.display = "block";
    loadOrders(true);
    return;
  }

  isSearching = true;
  document.getElementById("loadMoreBtn").style.display = "none";

  let query = db.from("tum_siparisler").select("*");
  query = applyTabFilter(query);

  query = query.or(
    `siparis_no.eq.${q},ad_soyad.ilike.%${q}%,siparis_tel.ilike.%${q}%,musteri_tel.ilike.%${q}%`
  );

  const { data, error } = await query;

  if (error) {
    alert("Arama hatası: " + error.message);
    return;
  }

  renderTable(data || [], false);
}

function clearSearch() {
  document.getElementById("searchInput").value = "";
  isSearching = false;
  document.getElementById("loadMoreBtn").style.display = "block";
  loadOrders(true);
}

/* ============================================
   HAMBURGER MENÜ (MOBİL)
============================================ */
function initMobileMenu() {
  const mobileBtn = document.getElementById("mobileBtn");
  const sidebar = document.getElementById("sidebar");

  if (!mobileBtn || !sidebar) return;

  mobileBtn.addEventListener("click", () => {
    sidebar.classList.toggle("open");
  });
}

/* ============================================
   INIT
============================================ */
function init() {
  initMobileMenu();
  loadOrders(true);
}

init();
