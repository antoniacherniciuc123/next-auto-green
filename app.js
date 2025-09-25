// app.js

const el = {
  adUrl: document.getElementById('adUrl'),
  btnScrape: document.getElementById('btnScrape'),
  pdfInput: document.getElementById('pdfInput'),
  pdfStatus: document.getElementById('pdfStatus'),

  branch: document.getElementById('branch'),
  state: document.getElementById('state'),

  port: document.getElementById('port'),
  ground: document.getElementById('ground'),
  delivery: document.getElementById('delivery'),

  bid: document.getElementById('bid'),
  bidAcc: document.getElementById('bidAcc'),
  thc: document.getElementById('thc'),
  comm: document.getElementById('comm'),
  customs: document.getElementById('customs'),
  vat: document.getElementById('vat'),

  totalUsd: document.getElementById('totalUsd'),
  totalRon: document.getElementById('totalRon'),
  msg: document.getElementById('msg'),
  btnCopy: document.getElementById('btnCopy')
};

// Conversie USD-RON fixă (4.35)
const FX = 4.35;

// Harta oraș+stat -> valori porturi; se umple după încărcarea PDF-ului
let groundMap = null;

// Porturile (key + label + zona)
const PORTS = [
  { key: 'NJ', label: 'New Jersey (NJ)', zone: 'E' },
  { key: 'GA', label: 'Savannah (GA)',  zone: 'E' },
  { key: 'TX', label: 'Houston (TX)',   zone: 'E' },
  { key: 'CA', label: 'Los Angeles (CA)', zone: 'W' },
  { key: 'WA', label: 'Seattle (WA)',   zone: 'W' }
];

// setează delivery în funcție de port
function setDeliveryByPort(key) {
  const port = PORTS.find(p => p.key === key);
  if (!port) return;
  el.delivery.value = port.zone === 'W' ? 2150 : 1500;
}

// completare porturi după oraș+stat dacă avem map-ul; altfel lăsăm doar opțiunile de bază
function fillPortOptions(cityKey) {
  // Reset dropdown la opțiunile de bază
  el.port.innerHTML = `<option value="">— alege port —</option>
    <option value="NJ">New Jersey (NJ)</option>
    <option value="GA">Savannah (GA)</option>
    <option value="TX">Houston (TX)</option>
    <option value="CA">Los Angeles (CA)</option>
    <option value="WA">Seattle (WA)</option>`;
  if (!groundMap || !groundMap[cityKey]) return;
  const row = groundMap[cityKey];
  // Încărcăm fiecare port doar dacă există în tabel
  PORTS.forEach(p => {
    if (row[p.key]) {
      const opt = document.createElement('option');
      opt.value = p.key;
      opt.textContent = `${p.label} — ${row[p.key]} USD`;
      el.port.appendChild(opt);
    }
  });
}

// După selectarea manuală a portului
function updateGroundFromPort(cityKey) {
  const k = el.port.value;
  if (!groundMap || !groundMap[cityKey]) return;
  if (groundMap[cityKey][k]) el.ground.value = groundMap[cityKey][k];
  setDeliveryByPort(k);
  computeTotal();
}

// calculează totalul (inclusiv vamă 10% și TVA 21%)
function computeTotal() {
  const bid      = Number(el.bid.value    || 0);
  const ground   = Number(el.ground.value || 0);
  const deliv    = Number(el.delivery.value || 0);
  const bidAcc   = Number(el.bidAcc.value || 0);
  const thc      = Number(el.thc.value    || 0);
  const comm     = Number(el.comm.value   || 0);
  const vamaPct  = Number(el.customs.value || 0) / 100;
  const vatPct   = Number(el.vat.value     || 0) / 100;

  const subtotal = bid + ground + deliv + bidAcc + thc + comm;
  const vama  = subtotal * vamaPct;
  const baza  = subtotal + vama;
  const tva   = baza * vatPct;
  const total = subtotal + vama + tva;

  el.totalUsd.textContent = total.toFixed(2);
  el.totalRon.textContent = (total * FX).toFixed(2);

  // mesaj text
  const city = el.branch.value || "";
  const st   = (el.state.value || "").toUpperCase();
  const portKey   = el.port.value || "";
  const portLabel = PORTS.find(p => p.key === portKey)?.label || "";
  const lines = [
    `Branch: "${city}" (${st})`,
    `Port: ${portLabel || '-'}`,
    `Ground: ${ground.toFixed(0)} USD`,
    `Delivery: ${deliv.toFixed(0)} USD`,
    `Bid: ${bid.toFixed(0)} USD`,
    `Bid account: ${bidAcc.toFixed(0)} USD`,
    `THC + comisar: ${thc.toFixed(0)} USD`,
    `Comision noi: ${comm.toFixed(0)} USD`,
    `Vamă 10%: ${vama.toFixed(0)} USD`,
    `TVA 21%: ${tva.toFixed(0)} USD`,
    `TOTAL: ${total.toFixed(2)} USD (~${(total*FX).toFixed(2)} RON)`
  ];
  el.msg.value = lines.join('\n');
}

// detectare branch și stat, apoi completează câmpuri
el.btnScrape.addEventListener('click', async () => {
  const url = (el.adUrl.value || '').trim();
  if (!url) { alert('Introdu linkul licitației.'); return; }
  try {
    const res = await fetch(`/.netlify/functions/scrape?url=${encodeURIComponent(url)}`);
    const data = await res.json();
    if (!data || data.error) throw new Error(data.error || 'N/A');
    el.branch.value = data.branch || '';
    el.state.value  = data.state  || '';
    const key = `${data.branch}, ${data.state}`;
    fillPortOptions(key);
    computeTotal();
  } catch (e) {
    alert('Eroare: ' + e.message);
  }
});

// încărcare PDF și creare mapă oraș-stat -> costuri (folosește pdf.js)
el.pdfInput.addEventListener('change', async (ev) => {
  const f = ev.target.files?.[0];
  if (!f) return;
  el.pdfStatus.textContent = 'PDF: se procesează…';
  try {
    if (!window.pdfjsLib) throw new Error('pdfjsLib nu este încărcat.');
    const buf = await f.arrayBuffer();
    const doc = await pdfjsLib.getDocument({ data: buf }).promise;

    const entries = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const pg = await doc.getPage(p);
      const txt = await pg.getTextContent();
      const str = txt.items.map(i => i.str).join(' ');
      const re1 = /([A-Z][A-Za-z.'\-\s]+)\s+([A-Z]{2})\s+([0-9]{2,4})\s+([0-9]{2,4})\s+([0-9]{2,4})\s+([0-9]{2,4})(?:\s+([0-9]{2,4}))?/g;
      const re2 = /([A-Z][A-Za-z.'\-\s]+)\s+([A-Z]{2})\s+—?\s*NJ:? ?([0-9]{2,4})\s+GA:? ?([0-9]{2,4})\s+TX:? ?([0-9]{2,4})\s+CA:? ?([0-9]{2,4})(?:\s+WA:? ?([0-9]{2,4}))?/g;
      const push = (m) => {
        const city = m[1].trim(); const st = m[2].trim().toUpperCase();
        const NJ = m[3] ? +m[3] : undefined;
        const GA = m[4] ? +m[4] : undefined;
        const TX = m[5] ? +m[5] : undefined;
        const CA = m[6] ? +m[6] : undefined;
        const WA = m[7] ? +m[7] : undefined;
        entries.push({ city, st, NJ, GA, TX, CA, WA });
      };
      let m; while ((m = re1.exec(str)) !== null) push(m);
      while ((m = re2.exec(str)) !== null) push(m);
    }
    // construim map
    groundMap = {};
    entries.forEach(e => {
      const key = `${e.city}, ${e.st}`;
      groundMap[key] = { NJ:e.NJ, GA:e.GA, TX:e.TX, CA:e.CA, WA:e.WA };
    });
    localStorage.setItem('groundMapCache', JSON.stringify(groundMap));
    el.pdfStatus.textContent = 'PDF: încărcat ✓';
    // Daca avem deja branch/state, reîncărcăm porturile
    const b = el.branch.value || '';
    const s = el.state.value  || '';
    if (b && s) {
      fillPortOptions(`${b}, ${s}`);
      computeTotal();
    }
  } catch (e) {
    el.pdfStatus.textContent = 'PDF: eroare';
    alert('Eroare la procesarea PDF: ' + e.message);
  }
});

// Încearcă să încarce map-ul din cache local
(() => {
  try {
    const raw = localStorage.getItem('groundMapCache');
    if (raw) {
      groundMap = JSON.parse(raw);
      el.pdfStatus.textContent = 'PDF: încărcat din cache ✓';
    }
  } catch {}
})();

// Evenimente de recalculare
['input','change'].forEach(evt => {
  [el.bid, el.ground, el.delivery, el.bidAcc, el.thc, el.comm, el.customs, el.vat].forEach(input => {
    input.addEventListener(evt, computeTotal);
  });
});
el.port.addEventListener('change', () => {
  const key = `${(el.branch.value||'').trim()}, ${(el.state.value||'').trim().toUpperCase()}`;
  updateGroundFromPort(key);
});
el.btnCopy.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(el.msg.value);
  } catch {}
});

// calcul inițial
computeTotal();
