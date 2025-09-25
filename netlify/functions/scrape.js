// netlify/functions/scrape.js
exports.handler = async (event) => {
  try {
    const url = event.queryStringParameters?.url;
    if (!url) {
      return respond(400, { error: 'Missing url' });
    }

    const response = await fetch(url, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible)' },
    });
    const html = await response.text();

    let city = '', state = '';

    // IAAI: Selling Branch: Oraș (ST)
    const iaaiMatch = html.match(/Selling\\s*Branch[^:]*:\\s*([^<]+)\\(\\s*([A-Z]{2})\\s*\\)/i);
    // Copart: Location: Oraș, ST
    const copartMatch = html.match(/Location[^:]*:\\s*([\\w\\s.'-]+?),\\s*([A-Z]{2})\\b/i);

    if (iaaiMatch) {
      city  = iaaiMatch[1].trim().replace(/["']/g, '');
      state = iaaiMatch[2].trim().toUpperCase();
    } else if (copartMatch) {
      city  = copartMatch[1].trim().replace(/["']/g, '');
      state = copartMatch[2].trim().toUpperCase();
    } else {
      return respond(422, { error: 'Nu am putut detecta Branch/State în pagină' });
    }

    return respond(200, { branch: city, state });
  } catch (err) {
    return respond(500, { error: err.message });
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
