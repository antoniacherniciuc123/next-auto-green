// app.js

const el = {
  adUrl: document.getElementById("adUrl"),
  btnScrape: document.getElementById("btnScrape"),
  pdfInput: document.getElementById("pdfInput"),
  pdfStatus: document.getElementById("pdfStatus"),

  branch: document.getElementById("branch"),
  state: document.getElementById("state"),

  port: document.getElementById("port"),
  ground: document.getElementById("ground"),
  delivery: document.getElementById("delivery"),

  bid: document.getElementById("bid"),
  bidAcc: document.getElementById("bidAcc"),
  thc: document.getElementById("thc"),
  comm: document.getElementById("comm"),
  customs: document.getElementById("customs"),
  vat: document.getElementById("vat"),

  totalUsd: document.getElementById("totalUsd"),
  totalRon: document.getElementById("totalRon"),
  msg: document.getElementById("msg"),
  btnCopy: document.getElementById("btnCopy"),
};

// Curs fix USD->RON
const FX = 4.35;

// Harta de porturi (cheie -> etichetă & zonă)
const PORTS = [
  { key: "NJ", label: "New Jersey (NJ)", zone: "E" },
  { key: "GA", label: "Savannah (GA)",  zone: "E" },
  { key: "TX", label: "Houston (TX)",   zone: "E" },
  { key: "CA", label: "Los Angeles (CA)", zone: "W" },
  { key: "WA", label: "Seattle (WA)",   zone: "W" },
];

// Map oraș+stat -> { NJ: val, GA: val, TX: val, CA: val, WA: val }
let groundMap = null;

// Setați Delivery în funcţie de port (E=1500, W=2150)
function setDeliveryByPort(portKey) {
  const portObj = PORTS.find((p) => p.key === portKey);
  if (!portObj) return;
  el.delivery.value = portObj.zone === "W" ? 2150 : 1500;
}

// Populează drop-down-ul portului (pre-definit)
function populatePorts() {
  // deja definit în HTML
}

// Recalculează totalul și mesajul pentru client
function computeTotal() {
  const bid     = +el.bid.value     || 0;
  const ground  = +el.ground.value  || 0;
  const deliv   = +el.delivery.value|| 0;
  const bidAcc  = +el.bidAcc.value  || 0;
  const thc     = +el.thc.value     || 0;
  const comm    = +el.comm.value    || 0;

  const vamaPct = (+el.customs.value || 0) / 100;
  const vatPct  = (+el.vat.value     || 0) / 100;

  const subtotal = bid + ground + deliv + bidAcc + thc + comm;
  const vama = subtotal * vamaPct;
  const baza = subtotal + vama;
  const tva  = baza * vatPct;
  const total = subtotal + vama + tva;

  el.totalUsd.textContent = total.toFixed(2);
  el.totalRon.textContent = (total * FX).toFixed(2);

  // Mesaj client
  const city = el.branch.value || "";
  const st   = (el.state.value || "").toUpperCase();
  const pk   = el.port.value  || "";
  const portLabel = PORTS.find((p) => p.key === pk)?.label || "";
  const lines = [
    `Branch: "${city}" (${st})`,
    `Port: ${portLabel || "-"}`,
    `Ground: ${ground.toFixed(0)} USD`,
    `Delivery: ${deliv.toFixed(0)} USD`,
    `Bid: ${bid.toFixed(0)} USD`,
    `Bid account: ${bidAcc.toFixed(0)} USD`,
    `THC + comisar: ${thc.toFixed(0)} USD`,
    `Comision noi: ${comm.toFixed(0)} USD`,
    `Vamă 10%: ${(subtotal * vamaPct).toFixed(0)} USD`,
    `TVA 21%: ${(baza * vatPct).toFixed(0)} USD`,
    `TOTAL: ${total.toFixed(2)} USD (~${(total * FX).toFixed(2)} RON)`
  ];
  el.msg.value = lines.join("\n");
}

// Când selectăm portul manual
el.port.addEventListener("change", () => {
  const pk = el.port.value;
  setDeliveryByPort(pk);
  // Dacă avem groundMap și branch/state, completăm taxa ground
  const key = `${el.branch.value.trim()}, ${el.state.value.trim().toUpperCase()}`;
  if (groundMap && groundMap[key] && groundMap[key][pk]) {
    el.ground.value = groundMap[key][pk];
  }
  computeTotal();
});

// Creează map-ul din PDF
el.pdfInput.addEventListener("change", async (ev) => {
  const file = ev.target.files?.[0];
  if (!file) return;
  el.pdfStatus.textContent = "PDF: se procesează…";
  try {
    if (!window.pdfjsLib) throw new Error("pdfjsLib nu este încărcat.");
    const buf = await file.arrayBuffer();
    const pdfDoc = await pdfjsLib.getDocument({ data: buf }).promise;

    const entries = [];
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const text = await page.getTextContent();
      const str = text.items.map((t) => t.str).join(" ");
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
    entries.forEach((e) => {
      const key = `${e.city}, ${e.st}`;
      groundMap[key] = { NJ: e.NJ, GA: e.GA, TX: e.TX, CA: e.CA, WA: e.WA };
    });
    localStorage.setItem("groundMapCache", JSON.stringify(groundMap));
    el.pdfStatus.textContent = "PDF: încărcat ✓";
    // actualizează porturile dacă avem branch/state
    const key = `${el.branch.value.trim()}, ${el.state.value.trim().toUpperCase()}`;
    if (groundMap[key]) {
      fillPortOptions(key);
    }
    computeTotal();
  } catch (err) {
    el.pdfStatus.textContent = "PDF: eroare";
    alert("Nu am reuşit să extrag tabelele: " + err.message);
  }
});

// Încărcăm map-ul din cache (dacă există)
(() => {
  try {
    const raw = localStorage.getItem("groundMapCache");
    if (raw) {
      groundMap = JSON.parse(raw);
      el.pdfStatus.textContent = "PDF: încărcat din cache ✓";
    }
  } catch {}
})();

// Extrage branch/stat din link
el.btnScrape.addEventListener("click", async () => {
  const url = el.adUrl.value.trim();
  if (!url) {
    alert("Introduceți link-ul IAAI / Copart.");
    return;
  }
  try {
    const res = await fetch(`/.netlify/functions/scrape?url=${encodeURIComponent(url)}`);
    const data = await res.json();
    if (!data || data.error) throw new Error(data.error || "Eroare necunoscută");
    el.branch.value = data.branch || "";
    el.state.value  = data.state  || "";
    // completați porturi după branch/state
    const key = `${data.branch}, ${data.state}`;
    fillPortOptions(key);
    computeTotal();
  } catch (err) {
    alert("Eroare: " + err.message);
  }
});

// La orice modificare a câmpurilor numerice => recalculează totalul
["input", "change"].forEach((evt) => {
  [
    el.bid, el.ground, el.delivery, el.bidAcc, el.thc, el.comm,
    el.customs, el.vat,
  ].forEach((inp) => {
    inp.addEventListener(evt, computeTotal);
  });
});

// Copiază mesaj
el.btnCopy.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(el.msg.value);
    alert("Mesaj copiat!");
  } catch {}
});

// Inițial calculează cu zero
computeTotal();
