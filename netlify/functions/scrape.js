export async function handler(event) {
  try {
    const url = (event.queryStringParameters || {}).url;
    if (!url) {
      return json(400, { error: "Missing ?url=" });
    }

    const res = await fetch(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
        accept: "text/html,application/xhtml+xml",
      },
    });

    if (!res.ok) {
      return json(res.status, { error: `Fetch failed: ${res.status}` });
    }

    const html = await res.text();

    let branch = "";
    let state = "";

    const patterns = [
      /Selling\s*Branch[^<]*>\s*([^<(]+)\s*\((\w{2})\)/i,
      /Selling\s*Branch[^:]*:\s*<\/[^>]+>\s*([^<(]+)\s*\((\w{2})\)/i,
      /Selling\s*Branch[^:]*:\s*([^<(]+)\s*\((\w{2})\)/i,
    ];

    for (const re of patterns) {
      const m = html.match(re);
      if (m) {
        branch = m[1].trim();
        state = m[2].trim().toUpperCase();
        break;
      }
    }

    if (!state) {
      const m = html.match(/\b([A-Z][A-Za-z .'-]+)\s*\((?:US-)?([A-Z]{2})\)/);
      if (m) {
        branch = m[1].trim();
        state = m[2].toUpperCase();
      }
    }

    if (!state) {
      return json(422, { error: "Nu am putut găsi Selling Branch în pagină." });
    }

    return json(200, { branch, state });
  } catch (err) {
    return json(500, { error: String(err) });
  }
}

function json(status, body) {
  return {
    statusCode: status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
    },
    body: JSON.stringify(body),
  };
}
