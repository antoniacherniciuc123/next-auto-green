// netlify/functions/scrape.js
exports.handler = async (event) => {
  try {
    const url = (event.queryStringParameters || {}).url;
    if (!url) {
      return respond(400, { ok: false, error: 'Missing url' });
    }

    const res = await fetch(url, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible)' },
    });
    if (!res.ok) {
      return respond(res.status, { ok: false, error: `Fetch ${res.status}` });
    }
    const html = await res.text();

    let city = '', state = '';

    // IAAI: Selling Branch: City (ST)
    const iaai = html.match(/Selling\s*Branch[^:]*:\s*[^<]*(?:<[^>]*>)*([^<]+)\s*\(\s*([A-Z]{2})\s*\)/i);
    // Copart: Location: City, ST
    const copart = html.match(/Location[^:]*:\s*[^<]*(?:<[^>]*>)*([\w\s.'-]+?),\s*([A-Z]{2})\b/i);

    if (iaai) {
      city  = iaai[1].trim().replace(/["']/g, '');
      state = iaai[2].trim().toUpperCase();
    } else if (copart) {
      city  = copart[1].trim().replace(/["']/g, '');
      state = copart[2].trim().toUpperCase();
    } else {
      return respond(422, { ok: false, error: 'Nu am putut detecta Branch/State în pagină' });
    }

    return respond(200, { ok: true, branch: city, state });
  } catch (err) {
    return respond(500, { ok: false, error: err.message });
  }
};

function respond(statusCode, body) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
    },
    body: JSON.stringify(body),
  };
}
