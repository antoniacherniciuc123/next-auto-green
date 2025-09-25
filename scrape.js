// netlify/functions/scrape.js
export default async (req) => {
  try {
    const url = new URL(req.url);
    const target = url.searchParams.get('url');

    if (!target) {
      return json({ error: 'Missing ?url=' }, 400);
    }

    // mică igienizare
    if (!/^https?:\/\/(www\.)?(iaai|copart)\.com/i.test(target)) {
      return json({ error: 'URL trebuie să fie de pe IAAI sau Copart' }, 400);
    }

    const res = await fetch(target, {
      headers: {
        // ajută la încărcarea unei versiuni „publice” a paginii
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
      },
    });

    const html = await res.text();

    // --- Parsare IAAI ---
    // Caută secțiunea "Selling Branch: Syracuse (NY)"
    let branch = null;
    let state = null;
    let platform = null;

    if (/iaai/i.test(target)) {
      platform = 'IAAI';

      // 1) variantă cu "Selling Branch"
      // e.g. Selling Branch: Syracuse (NY)
      let m =
        html.match(/Selling\s*Branch\s*:\s*([^<\n\r]+?)\s*\((\w{2})\)/i) ||
        html.match(/Selling\s*Branch[^:]*:\s*<\/[^>]+>([^<]+)\s*\((\w{2})\)/i);

      // 2) fallback: unele pagini au aria-label / dt-dd etc.
      if (!m) {
        m = html.match(
          /(?:Branch|Selling\s*Branch)[^:]*:\s*<\/[^>]+>\s*([^<]+?)\s*\((\w{2})\)/i
        );
      }

      if (m) {
        branch = m[1].trim();
        state = m[2].trim().toUpperCase();
      }
    }

    // --- Parsare Copart ---
    if (!branch && /copart/i.test(target)) {
      platform = 'Copart';

      // Copart are multe variante; încercăm câteva tipare comune
      // ex: "Sale Location: Syracuse, NY"
      let m =
        html.match(/Sale\s*Location\s*:\s*([^,<\n\r]+)\s*,\s*(\w{2})/i) ||
        html.match(/Location\s*:\s*([^,<\n\r]+)\s*,\s*(\w{2})/i);

      if (m) {
        branch = m[1].trim();
        state = m[2].trim().toUpperCase();
      }
    }

    if (!branch || !state) {
      return json(
        {
          error:
            'Nu am reușit să extrag Branch/State din pagină. Verifică linkul sau încearcă altul.',
        },
        422
      );
    }

    return json({ platform, branch, state });
  } catch (e) {
    return json({ error: e.message || String(e) }, 500);
  }
};

// utilitar răspuns JSON + CORS
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'cache-control': 'no-store',
    },
  });
}
