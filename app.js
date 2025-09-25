const linkInput = document.getElementById("link");
const btn = document.getElementById("btn");
const branchInput = document.getElementById("branch");
const stateInput = document.getElementById("state");
const portSelect = document.getElementById("port");
const groundInput = document.getElementById("ground");
const deliveryInput = document.getElementById("delivery");
const msgArea = document.getElementById("msg");
const totalUsd = document.getElementById("total_usd");
const totalRon = document.getElementById("total_ron");

const USD_TO_RON = 4.35;

const PORTS = {
  AL: { port: "New Jersey (NJ)", side: "E" },
  NY: { port: "New Jersey (NJ)", side: "E" },
  NJ: { port: "New Jersey (NJ)", side: "E" },
  GA: { port: "Savannah (GA)", side: "E" },
  TX: { port: "Houston (TX)", side: "W" },
  CA: { port: "Los Angeles (CA)", side: "W" },
  WA: { port: "Seattle (WA)", side: "W" },
};

const GROUND = {
  NY: 525,
  NJ: 525,
  GA: 350,
  TX: 375,
  CA: 400,
  WA: 450,
};

function deliveryForSide(side) {
  return side === "W" ? 2150 : 1500;
}

btn.addEventListener("click", async () => {
  try {
    const url = linkInput.value.trim();
    if (!url) {
      alert("Introdu linkul IAAI / Copart.");
      return;
    }

    btn.disabled = true;
    btn.textContent = "Se citește…";

    const api = `/.netlify/functions/scrape?url=${encodeURIComponent(url)}`;
    const r = await fetch(api);
    if (!r.ok) throw new Error("Fetch error");
    const data = await r.json();

    branchInput.value = data.branch || "";
    stateInput.value = data.state || "";

    const st = (data.state || "").toUpperCase();
    const map = PORTS[st];
    if (map) {
      setSelectValue(portSelect, map.port);
      groundInput.value = GROUND[st] || "";
      deliveryInput.value = deliveryForSide(map.side);
    }

    recalc();
  } catch (e) {
    alert(`Eroare: ${e.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = "Preia locația din link";
  }
});

function setSelectValue(sel, textVal) {
  const i = [...sel.options].findIndex((o) => o.text.trim() === textVal);
  if (i >= 0) sel.selectedIndex = i;
}

function recalc() {
  const ground = +groundInput.value || 0;
  const delivery = +deliveryInput.value || 0;
  const bid = +document.getElementById("bid").value || 0;
  const thc = +document.getElementById("thc").value || 0;
  const comision = +document.getElementById("comision").value || 0;
  const vama = +document.getElementById("vama").value || 0;

  let total = ground + delivery + bid + thc + comision;
  total += (total * vama) / 100;

  totalUsd.textContent = total.toFixed(2);
  totalRon.textContent = (total * USD_TO_RON).toFixed(2);

  msgArea.value = `Branch: ${branchInput.value} (${stateInput.value})
Port: ${portSelect.value}
Ground: ${ground} USD
Delivery: ${delivery} USD
TOTAL: ${total.toFixed(2)} USD (${(total * USD_TO_RON).toFixed(2)} RON)`;
}

document.querySelectorAll("input, select").forEach((el) =>
  el.addEventListener("input", recalc)
);

document.getElementById("copy").addEventListener("click", () => {
  msgArea.select();
  document.execCommand("copy");
  alert("Mesaj copiat!");
});
