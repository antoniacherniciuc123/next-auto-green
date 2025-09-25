// netlify/functions/scrape.js
export default async (req) => {
  try {
    const { url } = JSON.parse(req.body || "{}");
    if (!url) return json(400, { error: "Missing url" });

    const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
    const html = await res.text();

    // IAAI: Selling Branch: Syracuse (NY)
    const iaaiMatch = html.match(/Selling\s+Branch:\s*([^<]+)\((\s*[A-Z]{2})\)/i);
    // Copart: Location: Hartford, CT (exemplu) — adaptat dacă vrei
    const copartMatch = html.match(/Location:\s*([^<\(]+)\s*\(?([A-Z]{2})\)?/i);

    let city = "", state = "";
    if (iaaiMatch) {
      city = iaaiMatch[1].trim().replace(/["']/g, "");
      state = iaaiMatch[2].trim().replace(/[\(\)\s]/g, "");
    } else if (copartMatch) {
      city = copartMatch[1].trim().replace(/["']/g, "");
      state = copartMatch[2].trim();
    } else {
      return json(422, { error: "Nu am reușit să detectez Branch/State din pagină." });
    }

    return json(200, { city, state });
  } catch (e) {
    return json(500, { error: e.message });
  }
};

function json(statusCode, body) {
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
    },
  });
}

