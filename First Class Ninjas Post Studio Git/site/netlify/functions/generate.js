// Netlify Function: generate FCN post copy from key points.
// Reads ANTHROPIC_API_KEY from the site's environment variables.
// POST { keypoints: string, type: "flight"|"airline"|"hotel", image?: dataURL }
// Returns { type, route, airline, hotelName, logo, kicker, prices:[{label,value}], headline, sub }

const LOGOS = [
  ['air-canada','Air Canada','airline'],['air-france','Air France','airline'],['air-india','Air India','airline'],
  ['ana','ANA','airline'],['british-airways','British Airways','airline'],['cathay-pacific','Cathay Pacific','airline'],
  ['egyptair','EgyptAir','airline'],['emirates','Emirates','airline'],['etihad','Etihad','airline'],
  ['ita-airways','ITA Airways','airline'],['japan-airlines','Japan Airlines','airline'],['klm','KLM','airline'],
  ['lufthansa','Lufthansa','airline'],['lot-polish-airlines','LOT Polish Airlines','airline'],['qatar-airways','Qatar Airways','airline'],
  ['singapore-airlines','Singapore Airlines','airline'],['swiss','SWISS','airline'],['thai-airways','Thai Airways','airline'],
  ['turkish-airlines','Turkish Airlines','airline'],['united-airlines','United Airlines','airline'],['virgin-atlantic','Virgin Atlantic','airline'],
  ['bvlgari-hotels','Bvlgari Hotels','hotel'],['edition','EDITION','hotel'],['jw-marriott','JW Marriott','hotel'],
  ['the-luxury-collection','The Luxury Collection','hotel'],['the-ritz-carlton','The Ritz-Carlton','hotel'],['st-regis','St. Regis','hotel'],['w-hotels','W Hotels','hotel']
];

const SYSTEM = `You write social posts for First Class Ninjas (FCN), who sell discounted Business & First Class flights and luxury hotels to smart, successful Indians (28-45), mostly over WhatsApp.

VOICE: a sharp friend who knows how to get business class at half price — confident, witty, a little cheeky. Sentence case always, never ALL CAPS. No emoji. Never say "Message us to book now". About 1 in 5 posts leans humorous.

You will receive KEY POINTS describing a deal (and sometimes an uploaded airline ad image to read the deal from). Extract the facts and write FCN-style copy.

Return ONLY a JSON object, no markdown, with these keys:
- "type": "flight" | "hotel" | "lastmin" (lastmin = a specific dated last-minute flight with route/timing/layover/seat details; hotel = a hotel/brand stay; flight = any other flight deal, INCLUDING a single named airline)
- "airlineName": the airline's display name if named, else ""
- "hotelName": the hotel/brand display name if named, else ""
- "route": for lastmin, the airport-code routing exactly as given joined with " – " (e.g. "DEL – WAW – LHR"); otherwise the single destination city/region if clear, else "" (never include the origin city for non-lastmin)
- "kicker": a SHORT tag. For lastmin use the travel DATE or DATE RANGE exactly as given, normalised (e.g. "22 June", or "22–25 June" when a range like "22nd June – 25th June" is given — keep BOTH ends). Otherwise an urgency tag ONLY if implied ("Next 30 days only", "Limited seats", "Book by 30 June"); else ""
- "prices": array of { "label": region/route or "", "value": "from ₹79K" } — ONLY if prices are given; else []. Format Indian style: 79k -> "₹79K", 1.49L or 1.49 lakh -> "₹1.49L". Always prefix "from ". For lastmin a single { "label":"", "value":"from ₹89K" } is typical.
- "exCity": the ex-departure note for the caption if a departure city/origin is given (e.g. "ex-Delhi"); for lastmin infer from the first airport code (DEL->Delhi, BOM->Mumbai, BLR->Bangalore); else ""
- "headline": 2-4 words per line, 1-3 lines, use \\n for line breaks. Sentence case. The witty hook — NOT a data dump. The request will name a HEADLINE ANGLE — build the headline from THAT angle, written fresh for this specific deal (never copy a stock phrase). BANNED patterns (worn out, never use): "<City> calling", "<City> calls", "Suddenly, <City>", "Turn left for <City>". For lastmin, the headline must also work in a seats line — ALWAYS include the seat count if given in ANY phrasing ("3 seats", "3 Seats available", "Seats - 3"); keep route/timing/layover OUT of the headline. Tie festive/seasonal angles back to travel.
- "sub": For lastmin, a single pipe-joined detail line in this order: route | Timing <time> | Layover <place/duration> | <N stops> | Non-refundable (omit any not given), e.g. "DEL – WAW – LHR  |  Timing 8:00 AM - 5:10 PM  |  Layover Warsaw - 2h 40m  |  Non-refundable". For other types, ONE witty supporting sentence — vary its construction too (don't open every sub the same way, and never recycle the headline's joke into the sub).

Keep it tight. No filler. Capitalize "Business Class" and "First Class".`;

// One angle is picked at random per request and named in the prompt, so repeated
// generations of the same deal come out constructed differently. Descriptions only —
// no example headlines, so the model can't copy a stock phrase verbatim.
const ANGLES = [
  'DECISION MADE: the trip is already decided, stated as a done deal — short, declarative, full stops',
  'PRICE COUP: the gag is the arithmetic — a premium cabin at a number that should not be possible',
  'THE CABIN: write about the seat/experience itself (flat bed, champagne, the front of the plane), destination secondary',
  'SECOND PERSON: put the reader in the picture — their seat, their weekend, their upgrade',
  'UNDERSTATEMENT: dry, sensible-sounding words for an extravagant thing',
  'DESTINATION TEXTURE: one vivid, specific image of the destination (season, food, weather, a street) — no clichés',
  'INSIDER WHISPER: the tone of a tip shared quietly before everyone else finds out',
  'PERMISSION: gently talk the reader into the indulgence they were already considering',
  'TIME PLAY: the gag is how soon/short/sudden it is — timing, not the place, is the hook',
  'ECONOMY ROAST: a light jab at flying economy or paying full fare (never punch at the reader)',
  'QUIET FLEX: what it feels like to have booked this before anyone else knew it existed',
  'PLAIN CONFIDENCE: no joke at all — just the fact of the deal said beautifully and briefly'
];

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { statusCode: 500, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) { return { statusCode: 400, body: 'Bad JSON' }; }
  const keypoints = (body.keypoints || '').toString().slice(0, 4000);
  const image = body.image; // optional dataURL of an airline ad
  // Recent headlines from this browser (sent by the client) — the model must not echo them.
  const avoid = Array.isArray(body.avoid)
    ? body.avoid.filter(s => typeof s === 'string').map(s => s.replace(/\s+/g, ' ').trim().slice(0, 120)).filter(Boolean).slice(0, 10)
    : [];
  const angle = ANGLES[Math.floor(Math.random() * ANGLES.length)];
  let steer = '\n\nHEADLINE ANGLE for this post: ' + angle + '.';
  if (avoid.length) steer += '\nRecent headlines already used (write something CLEARLY different in wording AND structure):\n- ' + avoid.join('\n- ');

  const content = [];
  if (image && /^data:image\//.test(image)) {
    const m = image.match(/^data:(image\/[a-z]+);base64,(.*)$/i);
    if (m) {
      content.push({ type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } });
      content.push({ type: 'text', text: 'Read the deal from this airline ad. Additional notes: ' + (keypoints || '(none)') + steer });
    }
  }
  if (!content.length) {
    content.push({ type: 'text', text: 'KEY POINTS:\n' + keypoints + steer });
  }

  let data;
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 700,
        system: SYSTEM,
        messages: [{ role: 'user', content }]
      })
    });
    if (!resp.ok) {
      const t = await resp.text();
      return { statusCode: 502, body: JSON.stringify({ error: 'anthropic ' + resp.status, detail: t.slice(0, 300) }) };
    }
    data = await resp.json();
  } catch (e) {
    return { statusCode: 502, body: JSON.stringify({ error: String(e) }) };
  }

  let txt = '';
  try { txt = data.content.map(b => b.text || '').join(''); } catch (e) {}
  let obj;
  try {
    const js = txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1);
    obj = JSON.parse(js);
  } catch (e) {
    return { statusCode: 502, body: JSON.stringify({ error: 'parse', raw: txt.slice(0, 300) }) };
  }

  // map airline/hotel name -> our logo slug
  let logo = '';
  const nameForMatch = (obj.airlineName || obj.hotelName || '').toLowerCase();
  if (nameForMatch) {
    const hit = LOGOS.find(l => nameForMatch.includes(l[1].toLowerCase()) || l[1].toLowerCase().includes(nameForMatch));
    if (hit) logo = hit[0];
  }

  // UI now has only flight / hotel / lastmin — collapse any "airline" into "flight".
  let outType = ['flight','hotel','lastmin'].includes(obj.type) ? obj.type : (obj.type === 'airline' ? 'flight' : (body.type || 'flight'));
  const out = {
    type: outType,
    route: obj.route || '',
    airline: obj.airlineName || '',
    hotelName: obj.hotelName || '',
    logo,
    kicker: obj.kicker || '',
    prices: Array.isArray(obj.prices) ? obj.prices.filter(p => p && p.value).map(p => ({ label: p.label || '', value: p.value })) : [],
    exCity: obj.exCity || '',
    headline: obj.headline || '',
    sub: obj.sub || ''
  };

  return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(out) };
};
