// netlify/functions/scrape.js
exports.handler = async (event) => {
  try {
    const url = event.queryStringParameters?.url;
    if (!url) return respond(400, { error: "Missing url" });

    const res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible)" },
    });
    const html = await res.text();

    let branch = "", state = "";

    // IAAI: Selling Branch: City (ST)
    const iaai = html.match(/Selling\\s*Branch[^:]*:\\s*([\\w\\s.'-]+?)[\\s<]*\\(\\s*([A-Z]{2})\\s*\\)/i);
    // Copart: Location: City, ST
    const copart = html.match(/Location[^:]*:\\s*([\\w\\s.'-]+?)\\s*,\\s*([A-Z]{2})(?:\\s|<)/i);

    if (iaai) {
      branch = iaai[1].trim().replace(/[\"']/g, "");
      state  = iaai[2].trim().toUpperCase();
    } else if (copart) {
      branch = copart[1].trim().replace(/[\"']/g, "");
      state  = copart[2].trim().toUpperCase();
    } else {
      return respond(422, { error: "Nu am putut detecta Branch/State în pagină" });
    }

    return respond(200, { branch, state });
  } catch (err) {
    return respond(500, { error: err.message });
  }
};

function respond(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
    },
    body: JSON.stringify(body),
  };
}
