// app.js

const el = {
  adUrl:    document.getElementById('adUrl'),
  btnScrape:document.getElementById('btnScrape'),
  pdfInput: document.getElementById('pdfInput'),
  pdfStatus:document.getElementById('pdfStatus'),

  branch: document.getElementById('branch'),
  state:  document.getElementById('state'),

  port:   document.getElementById('port'),
  ground: document.getElementById('ground'),
  delivery:document.getElementById('delivery'),

  bid:    document.getElementById('bid'),
  bidAcc: document.getElementById('bidAcc'),
  thc:    document.getElementById('thc'),
  comm:   document.getElementById('comm'),
  customs:document.getElementById('customs'),
  vat:    document.getElementById('vat'),

  totalUsd:document.getElementById('totalUsd'),
  totalRon:document.getElementById('totalRon'),
  msg:    document.getElementById('msg'),
  btnCopy:document.getElementById('btnCopy'),
};

// Conversie fixă USD→RON
const FX = 4.35;

// Definire porturi şi zona (E sau W)
const PORTS = [
  { key: 'NJ', label: 'New Jersey (NJ)',  zone: 'E' },
  { key: 'GA', label: 'Savannah (GA)',    zone: 'E' },
  { key: 'TX', label: 'Houston (TX)',     zone: 'E' },
  { key: 'CA', label: 'Los Angeles (CA)', zone: 'W' },
  { key: 'WA', label: 'Seattle (WA)',     zone: 'W' }
];

// Mapă oraș+stat → { NJ: val, GA: val, ... } – se va popula după încărcarea PDF-ului
let groundMap = null;

// Setează costul Delivery în funcție de zona portului
function setDeliveryByPort(portKey) {
  const port = PORTS.find(p => p.key === portKey);
  if (!port) return;
  el.delivery.value = port.zone === 'W' ? 2150 : 1500;
}

// Completa porturile (dacă ai mapă)
function fillPortOptions(cityKey) {
  // Reset dropdown (opțiunile de bază rămân)
  el.port.innerHTML = `<option value="">— alege port —</option>
    <option value="NJ">New Jersey (NJ)</option>
    <option value="GA">Savannah (GA)</option>
    <option value="TX">Houston (TX)</option>
    <option value="CA">Los Angeles (CA)</option>
    <option value="WA">Seattle (WA)</option>`;
  if (!groundMap || !groundMap[cityKey]) return;
  const row = groundMap[cityKey];
  // Adaugă doar porturile găsite în PDF
  PORTS.forEach(p => {
    if (row[p.key]) {
      const opt = document.createElement('option');
      opt.value = p.key;
      opt.textContent = `${p.label} — ${row[p.key]} USD`;
      el.port.appendChild(opt);
    }
  });
}

// Recalculare total general
function computeTotal() {
  const bid      = +el.bid.value    || 0;
  const ground   = +el.ground.value || 0;
  const delivery = +el.delivery.value || 0;
  const bidAcc   = +el.bidAcc.value || 0;
  const thc      = +el.thc.value    || 0;
  const comm     = +el.comm.value   || 0;

  const vamPct = (+el.customs.value || 0) / 100;
  const tvaPct = (+el.vat.value     || 0) / 100;

  const subtotal = bid + ground + delivery + bidAcc + thc + comm;
  const vama = subtotal * vamPct;
  const baza = subtotal + vama;
  const tva  = baza * tvaPct;
  const total = subtotal + vama + tva;

  el.totalUsd.textContent = total.toFixed(2);
  el.totalRon.textContent = (total * FX).toFixed(2);

  // Generează mesaj pentru client
  const city = el.branch.value || '';
  const st   = (el.state.value || '').toUpperCase();
  const pk   = el.port.value   || '';
  const portLabel = PORTS.find(p => p.key === pk)?.label || '';
  const lines = [
    `Branch: "${city}" (${st})`,
    `Port: ${portLabel || '-'}`,
    `Ground: ${ground.toFixed(0)} USD`,
    `Delivery: ${delivery.toFixed(0)} USD`,
    `Bid: ${bid.toFixed(0)} USD`,
    `Bid account: ${bidAcc.toFixed(0)} USD`,
    `THC + comisar: ${thc.toFixed(0)} USD`,
    `Comision noi: ${comm.toFixed(0)} USD`,
    `Vamă 10%: ${(subtotal * vamPct).toFixed(0)} USD`,
    `TVA 21%: ${(baza * tvaPct).toFixed(0)} USD`,
    `TOTAL: ${total.toFixed(2)} USD (~${(total * FX).toFixed(2)} RON)`
  ];
  el.msg.value = lines.join('\n');
}

// Când selectăm port manual
el.port.addEventListener('change', () => {
  const pk = el.port.value;
  setDeliveryByPort(pk);
  // Dacă avem mapă și branch+stat completate, luăm costul ground
  const key = `${el.branch.value.trim()}, ${el.state.value.trim().toUpperCase()}`;
  if (groundMap && groundMap[key] && groundMap[key][pk]) {
    el.ground.value = groundMap[key][pk];
  }
  computeTotal();
});

// Încarcă PDF şi extrage toate tabelele
el.pdfInput.addEventListener('change', async (ev) => {
  const file = ev.target.files?.[0];
  if (!file) return;
  el.pdfStatus.textContent = 'PDF: se procesează…';
  try {
    if (!window.pdfjsLib) throw new Error('pdfjsLib nu este încărcat.');
    const buf = await file.arrayBuffer();
    const doc = await pdfjsLib.getDocument({ data: buf }).promise;
    const entries = [];

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const text = await page.getTextContent();
      const str = text.items.map(x => x.str).join(' ');
      const re1 = /([A-Z][A-Za-z.'\-\s]+)\s+([A-Z]{2})\s+([0-9]{2,4})\s+([0-9]{2,4})\s+([0-9]{2,4})\s+([0-9]{2,4})(?:\s+([0-9]{2,4}))?/g;
      const re2 = /([A-Z][A-Za-z.'\-\s]+)\s+([A-Z]{2})\s+—?\s*NJ:? ?([0-9]{2,4})\s+GA:? ?([0-9]{2,4})\s+TX:? ?([0-9]{2,4})\s+CA:? ?([0-9]{2,4})(?:\s+WA:? ?([0-9]{2,4}))?/g;

      const pushMatch = (m) => {
        const city = m[1].trim();
        const st   = m[2].trim().toUpperCase();
        const NJ = m[3] ? +m[3] : undefined;
        const GA = m[4] ? +m[4] : undefined;
        const TX = m[5] ? +m[5] : undefined;
        const CA = m[6] ? +m[6] : undefined;
        const WA = m[7] ? +m[7] : undefined;
        entries.push({ city, st, NJ, GA, TX, CA, WA });
      };

      let match;
      while ((match = re1.exec(str)) !== null) pushMatch(match);
      while ((match = re2.exec(str)) !== null) pushMatch(match);
    }
    groundMap = {};
    entries.forEach(e => {
      groundMap[`${e.city}, ${e.st}`] = { NJ: e.NJ, GA: e.GA, TX: e.TX, CA: e.CA, WA: e.WA };
    });
    localStorage.setItem('groundMapCache', JSON.stringify(groundMap));
    el.pdfStatus.textContent = 'PDF: încărcat ✓';

    // dacă deja avem branch/state, refacem dropdown-ul porturilor
    const key = `${el.branch.value.trim()}, ${el.state.value.trim().toUpperCase()}`;
    if (groundMap[key]) fillPortOptions(key);
    computeTotal();
  } catch (err) {
    el.pdfStatus.textContent = 'PDF: eroare';
    alert('Eroare la procesarea PDF-ului: ' + err.message);
  }
});

// Încarcă map-ul din cache la pornire
(() => {
  try {
    const data = localStorage.getItem('groundMapCache');
    if (data) {
      groundMap = JSON.parse(data);
      el.pdfStatus.textContent = 'PDF: încărcat din cache ✓';
    }
  } catch {}
})();

// Buton Preia locaţia din link
el.btnScrape.addEventListener('click', async () => {
  const url = el.adUrl.value.trim();
  if (!url) return alert('Introduceţi link-ul IAAI / Copart.');
  try {
    const resp = await fetch(`/.netlify/functions/scrape?url=${encodeURIComponent(url)}`);
    const data = await resp.json();
    if (data.error) throw new Error(data.error);
    el.branch.value = data.branch || '';
    el.state.value  = data.state  || '';
    const key = `${data.branch}, ${data.state}`;
    fillPortOptions(key);
    computeTotal();
  } catch (e) {
    alert('Eroare: ' + e.message);
  }
});

// Recalculare la orice modificare a câmpurilor numerice
['input','change'].forEach(ev => {
  [el.bid, el.ground, el.delivery, el.bidAcc, el.thc, el.comm, el.customs, el.vat].forEach(inp => {
    inp.addEventListener(ev, computeTotal);
  });
});

// Copiere mesaj
el.btnCopy.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(el.msg.value); } catch {}
  alert('Mesaj copiat!');
});

// Calcul iniţial
computeTotal();
