// =======================================================
// Supabase REST – DOĞRU AYARLANMIŞ FİNAL SÜRÜM
// =======================================================

const SUPABASE_URL = "https://jarsxtpqzqzhlshpmgot.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphcnN4dHBxenF6aGxzaHBtZ290Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyODExMTcsImV4cCI6MjA3Nzg1NzExN30.98oYONSkb8XSDrfGW2FxhFmt2BLB5ZRo3Ho50GhZYgE";

const SB_HEADERS = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  "Content-Type": "application/json",
};

// =======================================================
// GENEL SUPABASE FETCH FONKSİYONU
// =======================================================
async function sbFetch(tableOrView, params = {}) {
  const { query = "", select = "" } = params;
  const q = [];

  if (query) q.push(query);
  if (select) q.push(`select=${encodeURIComponent(select)}`);

  const url = `${SUPABASE_URL}/rest/v1/${tableOrView}?${q.join("&")}`;

  console.log("SB FETCH:", url); // debugging için

  const r = await fetch(url, { headers: SB_HEADERS });

  if (!r.ok) {
    console.error("Supabase HATA:", r.status, await r.text());
    throw new Error("Supabase erişim hatası");
  }

  return r.json();
}

// =======================================================
// LOGIN
// =======================================================
async function loginUser(username, password) {
  const rows = await sbFetch("users", {
    query: `username=eq.${encodeURIComponent(username)}&password=eq.${encodeURIComponent(password)}&select=*`,
  });

  if (!rows.length) return null;

  return {
    id: rows[0].id,
    username: rows[0].username,
    admin: !!rows[0].admin,
  };
}
async function getAllUsers() {
  return sbFetch("users", {
    query: "select=username,admin"
  });
}


// =======================================================
// ŞEHİR – İLÇE
// =======================================================
async function getCities() {
  return sbFetch("sehir", {
    query: "select=id,name&order=name.asc",
  });
}

async function getDistricts(cityId) {
  return sbFetch("ilce", {
    query: `city_id=eq.${cityId}&select=id,code,name&order=name.asc`,
  });
}

// =======================================================
// ÜRÜNLER (Firma bazlı)
// =======================================================
async function getUrunler(firma) {
  return sbFetch("urunler", {
    query: `firma=eq.${encodeURIComponent(firma)}&aktif=is.true&select=id,ad,fiyat_10,fiyat_5,kargo_kg_10,kargo_kg_5,cok_satan&order=ad.asc`,
  });
}


// =======================================================
// TELEFON → MÜŞTERİ lookup
// =======================================================
async function findMusteriByTel(tel10) {
  const rows = await sbFetch("musteriler", {
    query: `musteri_tel=eq.${encodeURIComponent(tel10)}&select=*`,
  });

  return rows[0] || null;
}

// =======================================================
// SİPARİŞ GÖNDER (INSERT/UPDATE KARARI N8N’DE)
// =======================================================
async function insertFormSiparis(payload) {
  const url = "https://n8n.ozkanceylan.uk/webhook/form_siparis";

  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!r.ok) throw new Error("N8N gönderim hatası");

  return r.json().catch(() => ({}));
}

// =======================================================
// SİPARİŞ İPTAL
// =======================================================
async function sendCancelToN8N(siparis_no, neden, iptal_eden) {
  const url = "https://n8n.ozkanceylan.uk/webhook/form_siparis_iptal";

  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ siparis_no, neden, iptal_eden }),
  });
}
