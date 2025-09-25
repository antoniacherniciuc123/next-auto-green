// app.js

// elemente
const el = {
  adUrl:    document.getElementById('adUrl'),
  btnScrape:document.getElementById('btnScrape'),
  pdfInput: document.getElementById('pdfInput'),
  pdfStatus:document.getElementById('pdfStatus'),

  platform: document.getElementById('platform'),
  branch:   document.getElementById('branch'),
  state:    document.getElementById('state'),

  port:     document.getElementById('port'),
  ground:   document.getElementById('ground'),
  delivery: document.getElementById('delivery'),

  bid:      document.getElementById('bid'),
  bidAcc:   document.getElementById('bidAcc'),
  thc:      document.getElementById('thc'),
  comm:     document.getElementById('comm'),
  customs:  document.getElementById('customs'),
  vat:      document.getElementById('vat'),

  totalUsd: document.getElementById('totalUsd'),
  totalRon: document.getElementById('totalRon'),
  msg:      document.getElementById('msg'),
  btnCopy:  document.getElementById('btnCopy')
};

// curs fix
const FX = 4.35;

// mapă completă { "City, ST": { NJ: x, GA: y, TX: z, CA: m, WA: n } }
let groundMap = null;

// porturi definite şi zona (Est/Vest) pentru Delivery
const PORTS = [
  { key: 'NJ', label: 'New Jersey (NJ)', zone: 'E' },
  { key: 'GA', label: 'Savannah (GA)',  zone: 'E' },
  { key: 'TX', label: 'Houston (TX)',   zone: 'E' },
  { key: 'CA', label: 'Los Angeles (CA)', zone:'W' },
  { key: 'WA', label: 'Seattle (WA)',   zone: 'W' }
];

function setDeliveryByPortKey(k) {
  const port = PORTS.find(p => p.key === k);
  if (!port) return;
  el.delivery.value = port.zone === 'W' ? 2150 : 1500;
}

function fillPortOptionsFor(cityKey) {
  el.port.innerHTML = '<option value="">— alege port —</option>';
  if (!groundMap || !groundMap[cityKey]) return;
  const row = groundMap[cityKey];
  PORTS.forEach(p => {
    const v = row[p.key];
    if (v && !isNaN(v)) {
      const opt = document.createElement('option');
      opt.value = p.key;
      opt.textContent = `${p.label} — ${v} USD`;
      el.port.appendChild(opt);
    }
  });
}

function updateGroundFromPort(cityKey) {
  const pk = el.port.value;
  if (!pk || !groundMap || !groundMap[cityKey]) return;
  const row = groundMap[cityKey];
  if (row[pk]) el.ground.value = row[pk];
  setDeliveryByPortKey(pk);
  compute();
}

function compute() {
  // citim valori
  const bid    = Number(el.bid.value    || 0);
  const ground = Number(el.ground.value || 0);
  const del    = Number(el.delivery.value || 0);
  const bidAcc = Number(el.bidAcc.value || 0);
  const thc    = Number(el.thc.value    || 0);
  const comm   = Number(el.comm.value   || 0);

  const customPct = Number(el.customs.value || 0) / 100;
  const vatPct    = Number(el.vat.value     || 0) / 100;

  // subtotal
  const subtotal = bid + ground + del + bidAcc + thc + comm;
  const vama  = subtotal * customPct;
  const baza  = subtotal + vama;
  const tva   = baza * vatPct;
  const total = subtotal + vama + tva;

  el.totalUsd.textContent = total.toFixed(2);
  el.totalRon.textContent = (total * FX).toFixed(2);

  // mesaj
  const city = (el.branch.value || '').trim();
  const st   = (el.state.value  || '').trim().toUpperCase();
  const pk   = el.port.value;
  const portLabel = PORTS.find(p => p.key === pk)?.label || '';
  const lines = [
    `Branch: "${city}" (${st})`,
    `Port: ${portLabel || '-'}`,
    `Ground: ${ground.toFixed(0)} USD`,
    `Delivery: ${del.toFixed(0)} USD`,
    `Bid: ${bid.toFixed(0)} USD`,
    `Bid account: ${bidAcc.toFixed(0)} USD`,
    `THC + comisar: ${thc.toFixed(0)} USD`,
    `Comision noi: ${comm.toFixed(0)} USD`,
    `Vamă 10%: ${vama.toFixed(0)} USD`,
    `TVA 21%: ${(tva).toFixed(0)} USD`,
    `TOTAL: ${total.toFixed(2)} USD (~${(total*FX).toFixed(2)} RON la curs ${FX})`
  ];
  el.msg.value = lines.join('\n');
}

// încercăm autocompletarea după ce avem branch/state
function tryAutoPortGround() {
  const city = (el.branch.value || '').trim();
  const st   = (el.state.value || '').trim().toUpperCase();
  if (!city || !st || !groundMap) return;
  const key = `${city}, ${st}`;
  if (!groundMap[key]) return;

  fillPortOptionsFor(key);
  const row = groundMap[key];
  // default: cel mai mic cost
  let bestKey = null, bestVal = Infinity;
  Object.entries(row).forEach(([k,v]) => {
    if (v && v < bestVal) { bestVal = v; bestKey = k; }
  });
  if (bestKey) {
    el.port.value = bestKey;
    updateGroundFromPort(key);
  }
}

// Scrape locatia din link
el.btnScrape.addEventListener('click', async () => {
  const url = (el.adUrl.value || '').trim();
  if (!url) { alert('Pune link-ul IAAI/Copart.'); return; }
  try {
    const r = await fetch(`/.netlify/functions/scrape?url=${encodeURIComponent(url)}`);
    const data = await r.json();
    if (!data.ok) throw new Error(data.error || 'Eroare funcție');
    el.branch.value = data.branch;
    el.state.value  = data.state;
    tryAutoPortGround();
    compute();
  } catch (e) {
    alert('Eroare: ' + e.message);
  }
});

// Upload PDF -> parse tabele
el.pdfInput.addEventListener('change', async (ev) => {
  const file = ev.target.files?.[0];
  if (!file) return;
  el.pdfStatus.textContent = 'PDF: se procesează…';
  try {
    if (!window.pdfjsLib) throw new Error('pdfjsLib nu este încărcat.');
    const buf = await file.arrayBuffer();
    const doc = await pdfjsLib.getDocument({ data: buf }).promise;

    const entries = [];
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const content = await page.getTextContent();
      const text = content.items.map(i => i.str).join(' ');

      // extrage pattern-uri
      const re1 = /([A-Z][A-Za-z.'\-\s]+)\s+([A-Z]{2})\s+([0-9]{2,4})\s+([0-9]{2,4})\s+([0-9]{2,4})\s+([0-9]{2,4})(?:\s+([0-9]{2,4}))?/g;
      const re2 = /([A-Z][A-Za-z.'\-\s]+)\s+([A-Z]{2})\s+—?\s*NJ:? ?([0-9]{2,4})\s+GA:? ?([0-9]{2,4})\s+TX:? ?([0-9]{2,4})\s+CA:? ?([0-9]{2,4})(?:\s+WA:? ?([0-9]{2,4}))?/g;
      const push = (m) => {
        const city = (m[1] || '').trim();
        const st   = (m[2] || '').trim().toUpperCase();
        const NJ = m[3] ? Number(m[3]) : undefined;
        const GA = m[4] ? Number(m[4]) : undefined;
        const TX = m[5] ? Number(m[5]) : undefined;
        const CA = m[6] ? Number(m[6]) : undefined;
        const WA = m[7] ? Number(m[7]) : undefined;
        if (city && st) entries.push({ city, st, NJ, GA, TX, CA, WA });
      };
      let m;
      while ((m = re1.exec(text)) !== null) push(m);
      while ((m = re2.exec(text)) !== null) push(m);
    }
    // construim map
    groundMap = {};
    entries.forEach(e => {
      const key = `${e.city}, ${e.st}`;
      groundMap[key] = { NJ:e.NJ, GA:e.GA, TX:e.TX, CA:e.CA, WA:e.WA };
    });
    // salvăm în localStorage
    localStorage.setItem('groundMapCache', JSON.stringify(groundMap));
    el.pdfStatus.textContent = `PDF: încărcat ✓`;
    tryAutoPortGround();
    compute();
  } catch (e) {
    el.pdfStatus.textContent = 'PDF: eroare';
    alert(`Eroare PDF: ${e.message}`);
  }
});

// încercăm să încărcăm map-ul din cache la pornire
(() => {
  try {
    const raw = localStorage.getItem('groundMapCache');
    if (raw) {
      groundMap = JSON.parse(raw);
      el.pdfStatus.textContent = 'PDF: încărcat din cache ✓';
    }
  } catch {}
})();

// recalcul la input-uri
['input','change'].forEach(evt => {
  [el.bid, el.ground, el.delivery, el.bidAcc, el.thc, el.comm, el.customs, el.vat].forEach(elm => {
    elm.addEventListener(evt, compute);
  });
});
el.port.addEventListener('change', () => {
  const key = `${(el.branch.value||'').trim()}, ${(el.state.value||'').trim().toUpperCase()}`;
  updateGroundFromPort(key);
});
el.btnCopy.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(el.msg.value); } catch {}
});

// calcul iniţial
compute();
