// app.js

// --- Configuri ---
const USD_RON = 4.35;

// Est vs Vest pentru Delivery to Romania
const EAST = new Set([
  'ME','NH','VT','MA','RI','CT','NY','NJ','PA','DE','MD','DC','VA','NC','SC','GA','FL',
  'AL','TN','KY','OH','MI','IN','IL','WI','WV'
]);

const WEST = new Set([
  'TX','NM','AZ','CA','NV','UT','CO','WY','MT','ID','OR','WA','ND','SD','NE','KS','OK','AR','LA','MS'
]);

// Heuristici de port după stat (poți ajusta după preferință)
function pickPortByState(state) {
  if (!state) return 'New Jersey (NJ)';
  if (['ME','NH','VT','MA','RI','CT','NY','NJ','PA','DE','MD','DC','VA','WV'].includes(state))
    return 'New Jersey (NJ)';
  if (['NC','SC','GA','FL','AL','TN','KY','OH','MI','IN','IL','WI'].includes(state))
    return 'Savannah (GA)';
  if (['TX','OK','NM','AR','LA','MS','KS'].includes(state))
    return 'Houston (TX)';
  if (['CA','NV','AZ'].includes(state))
    return 'Los Angeles (CA)';
  if (['WA','OR','ID','MT','WY','UT','CO','ND','SD','NE'].includes(state))
    return 'Seattle (WA)';
  return 'New Jersey (NJ)';
}

// Încărcare opțională ground.csv
let groundTable = null;
async function loadGroundCsvIfAny() {
  try {
    const res = await fetch('ground.csv', { cache: 'no-store' });
    if (res.ok) {
      const text = await res.text();
      // CSV: auction,city,state,nj,savannah,houston,la,seattle
      groundTable = text
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(l => l && !/^auction,/i.test(l) ? true : (l && !l.toLowerCase().startsWith('auction')))
        .map(l => l.split(',').map(s => s.trim()));
    }
  } catch {}
}
loadGroundCsvIfAny();

function findGround(platform, branch, state, portLabel) {
  if (!groundTable) return null;
  // normalizări
  const auc = (platform||'').toLowerCase();
  const city = (branch||'').toLowerCase();
  const st   = (state||'').toLowerCase();

  let col = 'nj';
  if (/savannah/i.test(portLabel)) col = 'savannah';
  else if (/houston/i.test(portLabel)) col = 'houston';
  else if (/los\s*angeles/i.test(portLabel)) col = 'la';
  else if (/seattle/i.test(portLabel)) col = 'seattle';

  // indexare coloane
  // presupunem header: auction,city,state,nj,savannah,houston,la,seattle
  const header = ['auction','city','state','nj','savannah','houston','la','seattle'];

  for (const row of groundTable) {
    const rec = Object.fromEntries(row.map((v,i)=>[header[i]||`c${i}`, v]));
    if (!rec.auction) continue;

    if (rec.auction.toLowerCase() === auc &&
        rec.city?.toLowerCase() === city &&
        rec.state?.toLowerCase() === st &&
        rec[col] && !isNaN(+rec[col])) {
      return +rec[col];
    }
  }
  return null;
}

// --- Elemente UI ---
const $ = sel => document.querySelector(sel);
const url = $('#url');
const grab = $('#grab');

const platform = $('#platform');
const branch = $('#branch');
const state = $('#state');

const port = $('#port');
const ground = $('#ground');
const delivery = $('#delivery');

const bidacc = $('#bidacc');
const thc = $('#thc');
const fee = $('#fee');
const duty = $('#duty');
const vat = $('#vat');

const calc = $('#calc');
const totalUsd = $('#totalUsd');
const totalRon = $('#totalRon');
const msg = $('#msg');
const copyBtn = $('#copy');

// --- „Preia locația din link” ---
grab.addEventListener('click', async () => {
  const u = (url.value || '').trim();
  if (!u) { alert('Introdu link IAAI/Copart'); return; }

  try {
    grab.disabled = true;
    grab.textContent = 'Se citește…';
    const api = `/api/scrape?url=${encodeURIComponent(u)}`;
    const res = await fetch(api, { cache: 'no-store' });
    const data = await res.json();

    if (!res.ok) {
      alert(data.error || 'Eroare scrape');
      return;
    }

    if (data.platform) platform.value = data.platform;
    if (data.branch) branch.value = data.branch;
    if (data.state)  state.value = data.state;

    // alege portul și delivery
    const p = pickPortByState(state.value.toUpperCase());
    port.value = p;

    const isEast = EAST.has(state.value.toUpperCase());
    delivery.value = isEast ? 1500 : 2150;

    // încearcă să populăm automat Ground din CSV (dacă există)
    const g = findGround(platform.value, branch.value, state.value, port.value);
    if (g != null) ground.value = g;

    buildMessage();
  } catch (e) {
    alert('Eroare: ' + (e.message || e));
  } finally {
    grab.disabled = false;
    grab.textContent = 'Preia locația din link';
  }
});

// --- Calcule ---
calc.addEventListener('click', () => {
  const g = +ground.value || 0;
  const del = +delivery.value || 0;
  const ba = +bidacc.value || 0;
  const thcV = +thc.value || 0;
  const feeV = +fee.value || 0;

  const subtotal = g + del + ba + thcV + feeV;

  const dutyP = (+duty.value || 0) / 100;
  const vatP = (+vat.value || 0) / 100;

  const vama = subtotal * dutyP;
  const bazaTVA = subtotal + vama;
  const tva = bazaTVA * vatP;

  const total = subtotal + vama + tva;

  totalUsd.textContent = total.toFixed(2);
  totalRon.textContent = (total * USD_RON).toFixed(2);

  buildMessage(total, vama, tva);
});

function buildMessage(total=0, vama=0, tva=0) {
  const lines = [];
  lines.push(`Branch: ${branch.value || '-'} (${(state.value || '').toUpperCase()})`);
  lines.push(`Port: ${port.value}`);
  lines.push(`Ground: $${(+ground.value||0).toFixed(0)}`);
  lines.push(`Delivery: $${(+delivery.value||0).toFixed(0)}`);
  lines.push(`Bid account: $${(+bidacc.value||0).toFixed(0)}`);
  lines.push(`THC + comisar: $${(+thc.value||0).toFixed(0)}`);
  lines.push(`Comision noi: $${(+fee.value||0).toFixed(0)}`);
  lines.push(`Vamă 10%: $${vama.toFixed(0)} | TVA 21%: $${tva.toFixed(0)}`);
  lines.push(`Total: $${(+total).toFixed(2)}  (~${(total*USD_RON).toFixed(2)} RON)`);
  msg.value = lines.join('\n');
}

copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(msg.value);
  } catch { /* ignore */ }
});
