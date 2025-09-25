// netlify/functions/scrape.js
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return json(405, { error: 'Use POST' });
    }

    let url;
    try {
      const body = JSON.parse(event.body || '{}');
      url = body.url;
    } catch (e) {
      return json(400, { error: 'Body must be JSON' });
    }

    if (!url) {
      return json(400, { error: 'Missing url' });
    }

    const res = await fetch(url, {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'accept': 'text/html,application/xhtml+xml'
      }
    });

    const html = await res.text();

    // IAAI: Selling Branch: Syracuse (NY)
    const iaaiMatch = html.match(/Selling\s+Branch:\s*([^<]+)\s*\(\s*([A-Z]{2})\s*\)/i);
    // Copart (fallback simplu): Location: Hartford, CT
    const copartMatch = html.match(/Location:\s*([^<\(]+?)\s*,\s*([A-Z]{2})\b/i);

    let city = '', state = '';
    if (iaaiMatch) {
      city  = (iaaiMatch[1] || '').trim().replace(/["']/g, '');
      state = (iaaiMatch[2] || '').trim().toUpperCase();
    } else if (copartMatch) {
      city  = (copartMatch[1] || '').trim().replace(/["']/g, '');
      state = (copartMatch[2] || '').trim().toUpperCase();
    } else {
      return json(422, { error: 'Nu am reușit să detectez Branch/State din pagină.' });
    }

    return json(200, { city, state });
  } catch (e) {
    return json(500, { error: e.message });
  }
};

function json(statusCode, obj) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*'
    },
    body: JSON.stringify(obj)
  };
}
