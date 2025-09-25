function preiaLocatia() {
  let link = document.getElementById("auctionLink").value;

  // Simulare: caută "Selling Branch: Syracuse (NY)" în link
  // În realitate, se va folosi un API sau scraping (dar GitHub Pages/Netlify rulează static)
  // Exemplu fallback: branch = "Syracuse", state = "NY"

  let branch = "Syracuse";
  let state = "NY";

  document.getElementById("branch").value = branch;
  document.getElementById("state").value = state;

  // Selectare port și costuri în funcție de stat (est/vest)
  let port = (["NY", "NJ", "PA", "OH", "VA"].includes(state)) ? "New Jersey (NJ)" : "Houston (TX)";
  document.getElementById("port").innerHTML = `<option>${port}</option>`;

  let ground = (port.includes("New Jersey")) ? 525 : 750;
  document.getElementById("ground").value = ground;

  let delivery = (port.includes("New Jersey")) ? 1500 : 2150;
  document.getElementById("delivery").value = delivery;

  document.getElementById("result").value =
    `Branch: ${branch} (${state})\nPort: ${port}\nGround: ${ground}\nDelivery: ${delivery}`;
}
