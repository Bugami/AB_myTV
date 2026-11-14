// Bugami/AB_myTV: the owner's design (#ab=1, which this repository's screensaver sends) in a real browser, offline:
// the day, the Hijri and the Gregorian dates on three lines of one size; the weather as a picture and the temperature;
// no next prayer; a dhikr instead of the countdown; the verse card with a verse and a hadith; the football home's wide card
// with a verse and a hadith and no games. Without #ab=1 the page is the original's (tests/page.test.mjs keeps that).
//   node tests/ab_page.test.mjs
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;
const check = (name, ok, detail = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '  -> ' + detail)); if (!ok) failed++; };
const NOW = Date.parse('2026-11-13T11:25:00Z');   // 2:25 pm in Riyadh, a Friday

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
async function open(hash, { width = 1920, height = 1080 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, timezoneId: 'Asia/Riyadh' });
  await ctx.route(/^https?:/, r => {
    const u = r.request().url(), i = u.indexOf('/master/'), rel = i > 0 ? u.slice(i + 8) : '';
    if (/^assets\/fonts\//.test(rel)) return r.fulfill({ path: path.join(ROOT, rel), headers: { 'Access-Control-Allow-Origin': '*' } });   // as the app serves them
    if (u.includes('air-quality')) return r.fulfill({ json: { current: { pm10: 20, dust: 5 } }, headers: { 'Access-Control-Allow-Origin': '*' } });
    if (u.includes('open-meteo.com')) return r.fulfill({ json: { current: { temperature_2m: 24.4, apparent_temperature: 23, relative_humidity_2m: 31,
      wind_speed_10m: 9, weather_code: 2, is_day: 1, visibility: 20000 }, daily: { time: ['2026-11-13'], temperature_2m_max: [30], temperature_2m_min: [18], weather_code: [2] } },
      headers: { 'Access-Control-Allow-Origin': '*' } });
    return r.abort();
  });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.clock.setFixedTime(NOW);
  await p.goto('file://' + path.join(ROOT, 'dist', 'tv.html') + '#' + hash);
  await p.waitForTimeout(1500);
  return { p, ctx, errors };
}

for (const [w, h] of [[1920, 1080], [960, 540]]) {
  const { p, ctx, errors } = await open('city=الرياض&slot=none&mkbar=off&ab=1', { width: w, height: h });
  const r = await p.evaluate(() => {
    const t = id => document.getElementById(id).textContent.trim();
    const fs = id => getComputedStyle(document.getElementById(id)).fontSize;
    const vis = sel => { const e = document.querySelector(sel); return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0; };
    const big = document.querySelector('.p-mid .big');
    return { ab: document.documentElement.classList.contains('ab'), day: t('dday'), hijri: t('hijri'), greg: t('greg'),
      sizes: [fs('dday'), fs('hijri'), fs('greg')], icon: !!document.querySelector('#wx-icon svg'), temp: t('wx-temp'),
      desc: vis('#wx-desc'), prayer: vis('.bottom .p-prayer'), dhikr: !!big && big.classList.contains('dhikr'),
      dhikrText: big ? big.textContent.trim() : '', pair: document.querySelectorAll('.week li.quote.pair').length,
      hd2: !!document.querySelector('.week li.hd2'), hadith: (document.querySelector('.week li.quote.hadith') || {}).textContent || '' };
  });
  const at = ` (${w}x${h})`;
  check('#ab=1 marks the page' + at, r.ab, JSON.stringify(r));
  check('the day on its own line, the Hijri date and the Gregorian date under it with no weekday, «م» after it' + at,
    r.day === 'الجمعة' && /^[٠-٩]+ جمادى الآخرة [٠-٩]+ هـ$/.test(r.hijri) && /^[٠-٩]+ نوفمبر [٠-٩]+ م$/.test(r.greg), JSON.stringify([r.day, r.hijri, r.greg]));
  check('the three date lines one size' + at, new Set(r.sizes).size === 1, r.sizes.join());
  check('the weather: a picture and the temperature, the condition word hidden' + at, r.icon && /°$/.test(r.temp) && !r.desc, JSON.stringify(r));
  check('no next prayer at the bottom' + at, !r.prayer);
  check('a dhikr in the middle instead of the countdown' + at, r.dhikr && r.dhikrText.length > 5, r.dhikrText);
  check('the verse card: a verse, «حديث اليوم», a hadith of the Prophet ﷺ' + at, r.pair === 2 && r.hd2 && r.hadith.startsWith('قال رسول الله'), JSON.stringify(r));
  check('no errors' + at, !errors.length, errors.join('; '));
  await ctx.close();
}

{
  const { p, ctx, errors } = await open('city=الرياض&slot=none&mkbar=off');
  const r = await p.evaluate(() => ({ ab: document.documentElement.classList.contains('ab'), day: document.getElementById('dday').textContent,
    hijri: document.getElementById('hijri').textContent, dhikr: !!document.querySelector('.p-mid .big.dhikr'), pair: document.querySelectorAll('.week li.quote.pair').length }));
  check('without #ab=1 the original page: no day line, the weekday in the Hijri date, no dhikr, no pair',
    !r.ab && r.day === '' && r.hijri.startsWith('الجمعة') && !r.dhikr && r.pair === 0, JSON.stringify(r));
  check('no errors (the original)', !errors.length, errors.join('; '));
  await ctx.close();
}

{
  const { p, ctx, errors } = await open('city=الرياض&widget=1&football=1&ab=1', { width: 1920, height: 832 });
  const r = await p.evaluate(() => ({ h3: document.querySelector('#fb-mt h3').textContent.trim(), qs: document.querySelectorAll('#fb-mt-c .fq').length,
    rows: document.querySelectorAll('#fb-mt-c .mrow, #fb-mt-c li').length, fpn: !!document.querySelector('.fpn') }));
  check('the football home: «آية وحديث», a verse and a hadith side by side, no games, no countdown under the prayers',
    r.h3 === 'آية وحديث' && r.qs === 2 && r.rows === 0 && !r.fpn, JSON.stringify(r));
  const g = await p.evaluate(() => { fbTop(250); fbPills(156);
    return fbRects().split(';').reduce((a, x) => { const [k, v] = x.split(':'); a[k] = v.split(',').map(Number); return a; }, {}); });
  // in CSS px of a 1920-wide page: the weather and the prayers from y 200 (under the buttons, beside the clock), the verse and hadith
  // across the screen under them, all of it above y 760 (the tray of seven tiles starts at 819, the app's name 56 above it)
  check('the home: the weather and the prayers up at the end side, the verse and hadith wide under them, clear of the tray',
    g.wx[1] === 200 && g.pr[1] === 200 && g.wx[0] + g.wx[2] <= g.pr[0] && g.pr[0] + g.pr[2] <= 1010
      && g.mt[1] >= g.pr[1] + g.pr[3] + 16 && g.mt[2] >= 1600 && g.mt[1] + g.mt[3] <= 760, JSON.stringify(g));
  // every short verse and saying the card can show: at most two lines (a long one a step smaller, fbFitQuotes), its column not overflowing
  await p.evaluate(() => Promise.all([document.fonts.load('36px UthmanicHafs', VERSES[0].text), document.fonts.load('36px Thmanyah', 'قال')]));
  const fit = await p.evaluate(() => {
    const c = document.getElementById('fb-mt-c'), bad = [];
    const one = (html, what) => { c.innerHTML = `<div class="fqs2">${html}</div>`; fbFitQuotes();
      c.querySelectorAll('.fq').forEach(q => { const t = q.querySelector('.fqt'); if (t && (textLines(t) > 2 || q.scrollHeight > q.clientHeight + 1)) bad.push(what); }); };
    VERSES_SHORT.forEach(v => one(`<div class="fq"><span class="fqw">قال الله تعالى</span><span class="fqt"><span class="orn">﴿</span><span class="qt">${v.text}</span><span class="orn">﴾</span></span><span class="fqs">${v.surah}</span></div><div class="fq"></div>`, v.surah + ' ' + v.ayah));
    HADITH_SHORT.forEach(h => one(`<div class="fq"></div><div class="fq"><span class="fqw">قال رسول الله</span><span class="fqt">«${h.t}»</span><span class="fqs">${h.s}</span></div>`, h.s));
    fbRender();
    return bad; });
  check('every verse and saying whole inside the card, on two lines at most', !fit.length, fit.slice(0, 5).join(' | '));
  check('no errors (the football home)', !errors.length, errors.join('; '));
  await ctx.close();
}

await browser.close();
if (failed) { console.log(`${failed} failed`); process.exit(1); }
console.log('all AB_myTV page tests passed');
