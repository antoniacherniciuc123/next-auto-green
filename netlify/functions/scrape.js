exports.handler = async (event) => {
  const url = (event.queryStringParameters || {}).url;
  if (!url) return respond(400, { error: "Missing url" });

  // Fetch nativ – Netlify foloseşte Node 18
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (compatible)" },
  });
  const html = await res.text();

  // IAAI: Selling Branch: City (ST)
  const iaai = html.match(/Selling\s*Branch[^:]*:\s*([^<]+)\(\s*([A-Z]{2})\s*\)/i);
  // Copart: Location: City, ST
  const copart = html.match(/Location[^:]*:\s*([\w\s.'-]+?),\s*([A-Z]{2})\b/i);

  let city = "", state = "";
  if (iaai) {
    city  = iaai[1].trim().replace(/["']/g, "");
    state = iaai[2].trim().toUpperCase();
  } else if (copart) {
    city  = copart[1].trim().replace(/["']/g, "");
    state = copart[2].trim().toUpperCase();
  } else {
    return respond(422, { error: "Nu am putut detecta Branch/State în pagină" });
  }

  return respond(200, { ok: true, branch: city, state });
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
