/* ======================== UTIL ======================== */
const $ = (sel) => document.querySelector(sel);
const fmt = (n) => (Number(n || 0)).toFixed(2);

const PORTS_EAST = ["New Jersey", "Savannah"];
const PORTS_WEST = ["Houston", "Los Angeles"];

/* Curs fix cerut: 4.35 */
const CURS = 4.35;
$("#curs-badge").textContent = CURS.toFixed(2);

/* Elemente UI */
const linkInput   = $("#linkInput");
const btnParse    = $("#btnParse");
const pdfInput    = $("#pdfInput");
const pdfStatus   = $("#pdfStatus");

const platformSel = $("#platform");
const branchInput = $("#branch");
const stateInput  = $("#state");

const portSel     = $("#port");
const groundInput = $("#ground");
const deliveryInp = $("#delivery");

const bidAccInp   = $("#bidAccount");
const thcInp      = $("#thc");
const feeInp      = $("#fee");
const vamaInp     = $("#vama");

const totalUsdEl  = $("#total-usd");
const totalRonEl  = $("#total-ron");
const msgTextarea = $("#msg");
const copyBtn     = $("#copyBtn");

/* ===================== GROUND MAP ===================== */
/** Mapă completă: groundMap[state][city] = { port, ground } */
let groundMap = loadMapFromLocal();

function loadMapFromLocal() {
  try {
    const raw = localStorage.getItem("groundMap");
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (_) { return {}; }
}

function saveMapToLocal() {
  localStorage.setItem("groundMap", JSON.stringify(groundMap));
  updatePdfStatus();
}

function updatePdfStatus() {
  const countStates = Object.keys(groundMap).length;
  pdfStatus.textContent = countStates ? `PDF: încărcat (state: ${countStates})` : "PDF: neîncărcat";
}

/* ======== Heuristic fallback când nu avem din PDF ======== */
function fallbackPortByState(state) {
  const WEST = new Set(["CA","OR","WA","NV","AZ","UT","ID","NM","CO","WY","MT","AK","HI"]);
  const HOU  = new Set(["TX","OK"]);
  const SAVA = new Set(["GA","FL","AL","SC","NC","TN","MS"]);
  if (WEST.has(state)) return "Los Angeles";
  if (HOU.has(state))  return "Houston";
  if (SAVA.has(state)) return "Savannah";
  return "New Jersey";
}

function deliveryByPort(port) {
  if (PORTS_EAST.includes(port)) return 1500;
  if (PORTS_WEST.includes(port)) return 2150;
  // default Est
  return 1500;
}

/* =============== PDF PARSING (pdf.js) ===================
   Strategia:
   - extragem textul brut din fiecare pagină
   - detectăm blocuri pe secțiuni de stat (titluri precum "Wisconsin", "Washington" etc.)
   - detectăm rânduri (oraș + port + ground)
   - construim groundMap[state][city] = { port, ground }
   NOTE: PDF-urile cu tabele variază; acest parser e tolerant:
   - caută pattern-uri "ORAȘ  STATE  -> PORT  PRICE" ca text concatenat pe rând
   - portul e valid doar dacă e în setul nostru
   - cifra 'ground' e ultimul număr din rând
*/
async function parsePdfAndBuildMap(file) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;

  const portsCanon = new Set(["NEW JERSEY","SAVANNAH","HOUSTON","LOS ANGELES"]);
  const pagesText = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const text = content.items.map(it => it.str).join(" ").replace(/\s+/g, " ").trim();
    pagesText.push(text);
  }

  const all = pagesText.join("\n");

  // Heuristică: împărțim după numele statelor (majuscule și nume comune)
  // Vom folosi lista standard US states; parserul prinde block-uri pe " STATE " ca delimitator
  const US_STATES = [
    "ALABAMA","ALASKA","ARIZONA","ARKANSAS","CALIFORNIA","COLORADO","CONNECTICUT","DELAWARE","FLORIDA","GEORGIA","HAWAII","IDAHO","ILLINOIS","INDIANA","IOWA","KANSAS","KENTUCKY","LOUISIANA","MAINE","MARYLAND","MASSACHUSETTS","MICHIGAN","MINNESOTA","MISSISSIPPI","MISSOURI","MONTANA","NEBRASKA","NEVADA","NEW HAMPSHIRE","NEW JERSEY","NEW MEXICO","NEW YORK","NORTH CAROLINA","NORTH DAKOTA","OHIO","OKLAHOMA","OREGON","PENNSYLVANIA","RHODE ISLAND","SOUTH CAROLINA","SOUTH DAKOTA","TENNESSEE","TEXAS","UTAH","VERMONT","VIRGINIA","WASHINGTON","WEST VIRGINIA","WISCONSIN","WYOMING"
  ];

  // Construim regex pentru a tăia în blocuri de stat
  const stateRegex = new RegExp(`\\b(${US_STATES.join("|")})\\b`, "g");
  const blocks = [];
  let match, lastIdx = 0, lastState = null;

  while ((match = stateRegex.exec(all)) !== null) {
    if (lastState) {
      blocks.push({ state: lastState, text: all.slice(lastIdx, match.index) });
    }
    lastState = match[1];
    lastIdx = match.index + match[0].length;
  }
  if (lastState) blocks.push({ state: lastState, text: all.slice(lastIdx) });

  let newMap = {};
  const pushRow = (st2, city, port, ground) => {
    if (!st2 || !city || !port || ground == null) return;
    if (!newMap[st2]) newMap[st2] = {};
    if (!newMap[st2][city]) newMap[st2][city] = { port, ground };
  };

  // Normalizări
  const normPort = (s) => s.toUpperCase().replace(/[^A-Z ]/g,"").trim();
  const to2 = (stateFull) => {
    // mică hartă full->2 litere
    const m = {
      "ALABAMA":"AL","ALASKA":"AK","ARIZONA":"AZ","ARKANSAS":"AR","CALIFORNIA":"CA","COLORADO":"CO","CONNECTICUT":"CT","DELAWARE":"DE","FLORIDA":"FL","GEORGIA":"GA","HAWAII":"HI","IDAHO":"ID","ILLINOIS":"IL","INDIANA":"IN","IOWA":"IA","KANSAS":"KS","KENTUCKY":"KY","LOUISIANA":"LA","MAINE":"ME","MARYLAND":"MD","MASSACHUSETTS":"MA","MICHIGAN":"MI","MINNESOTA":"MN","MISSISSIPPI":"MS","MISSOURI":"MO","MONTANA":"MT","NEBRASKA":"NE","NEVADA":"NV","NEW HAMPSHIRE":"NH","NEW JERSEY":"NJ","NEW MEXICO":"NM","NEW YORK":"NY","NORTH CAROLINA":"NC","NORTH DAKOTA":"ND","OHIO":"OH","OKLAHOMA":"OK","OREGON":"OR","PENNSYLVANIA":"PA","RHODE ISLAND":"RI","SOUTH CAROLINA":"SC","SOUTH DAKOTA":"SD","TENNESSEE":"TN","TEXAS":"TX","UTAH":"UT","VERMONT":"VT","VIRGINIA":"VA","WASHINGTON":"WA","WEST VIRGINIA":"WV","WISCONSIN":"WI","WYOMING":"WY"
    };
    return m[stateFull] || null;
  };

  // În fiecare block, căutăm rânduri de forma:
  //  <Oraș> ... <PORT> ... <număr (ground)>
  blocks.forEach(b => {
    const st2 = to2(b.state);
    if (!st2) return;

    // rupem textul în pseudo-rânduri
    const lines = b.text.split(/(?:(?:IAAI|Copart)\s+)?/i).join(" ").split(/\s{2,}| \| /);

    for (let raw of lines) {
      const line = raw.replace(/\s+/g, " ").trim();
      if (!line) continue;

      // extrage ultimul număr ca ground
      const mNum = line.match(/(\d{2,4})(?!.*\d)/);
      if (!mNum) continue;
      const ground = Number(mNum[1]);

      // caută un port valid în linie
      const mPort = [...portsCanon].find(p => line.toUpperCase().includes(p));
      if (!mPort) continue;

      // orașul = începutul liniei până la port (tăiem numărul de la final)
      let cityPart = line.toUpperCase().split(mPort)[0].trim().replace(/\d+$/,'').trim();
      // curățări comune
      cityPart = cityPart.replace(/^[\-\–\|]+/,'').replace(/[^A-Z \-]/g,'').trim();
      // oraș în format normalizat (prima literă mare)
      const city = cityPart.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()).replace(/\s+/g," ").trim();
      if (!city) continue;

      // mapăm port
      let port = "New Jersey";
      if (mPort.includes("SAVANNAH")) port = "Savannah";
      else if (mPort.includes("HOUSTON")) port = "Houston";
      else if (mPort.includes("LOS ANGELES")) port = "Los Angeles";

      pushRow(st2, city, port, ground);
    }
  });

  // combinăm cu ce aveam (nu ștergem intrările vechi dacă apar)
  groundMap = Object.assign({}, groundMap, newMap);
  saveMapToLocal();
}

/* ==================== AUTOCOMPLETE ==================== */
async function handleParseLink() {
  const url = linkInput.value.trim();
  if (!url) return alert("Pune linkul de anunț.");

  try {
    const res = await fetch("/.netlify/functions/scrape", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    const city = (data.city || "").replace(/["”]/g,"").trim();
    const state = (data.state || "").trim().toUpperCase();

    branchInput.value = city;
    stateInput.value  = state;

    autoFillFromMap(city, state);
    recalcTotals();
  } catch (e) {
    alert("Eroare: " + e.message);
  }
}

function autoFillFromMap(city, state) {
  const st = (state || "").toUpperCase();
  const cty = (city || "").trim();

  let port = "";
  let ground = "";

  if (groundMap[st] && groundMap[st][cty]) {
    port   = groundMap[st][cty].port;
    ground = groundMap[st][cty].ground;
  } else {
    // fallback din stat
    port   = fallbackPortByState(st);
    ground = ""; // necunoscut până nu e în PDF
  }

  portSel.value     = port || "";
  groundInput.value = ground || "";
  deliveryInp.value = deliveryByPort(port);
}

function recalcTotals() {
  // SUMĂ = BidAccount + THC + Fee + Ground + Delivery (fără vamă; dacă vrei, poți include)
  const vals = [bidAccInp, thcInp, feeInp, groundInput, deliveryInp].map(i => Number(i.value||0));
  const subtotal = vals.reduce((a,b)=>a+b,0);

  totalUsdEl.textContent = fmt(subtotal);
  totalRonEl.textContent = fmt(subtotal * CURS);

  const city = branchInput.value || "";
  const st   = (stateInput.value || "").toUpperCase();
  const port = portSel.value || "";
  const txtLines = [
    `Branch: "${city}" (${st})`,
    `Port: ${port || "-"}`,
    `Ground: ${fmt(groundInput.value||0)} USD`,
    `Delivery: ${fmt(deliveryInp.value||0)} USD`,
    `TOTAL: ${fmt(subtotal)} USD (${fmt(subtotal*CURS)} RON)`
  ];
  msgTextarea.value = txtLines.join("\n");
}

/* ===================== EVENTS ===================== */
btnParse.addEventListener("click", handleParseLink);
[portSel, groundInput, deliveryInp, bidAccInp, thcInp, feeInp, vamaInp].forEach(el => {
  el.addEventListener("input", recalcTotals);
});
copyBtn.addEventListener("click", () => {
  msgTextarea.select();
  document.execCommand("copy");
});

pdfInput.addEventListener("change", async (ev) => {
  const f = ev.target.files?.[0];
  if (!f) return;
  pdfStatus.textContent = "PDF: se procesează…";
  try {
    await parsePdfAndBuildMap(f);
    alert("Tabelele au fost încărcate și salvate. Autocompletarea se face din PDF.");
  } catch (e) {
    alert("Nu am reușit să extrag tabelele: " + e.message);
  } finally {
    updatePdfStatus();
  }
});

updatePdfStatus();
