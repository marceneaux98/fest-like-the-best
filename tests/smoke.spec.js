// Smoke test: the one thing the app must always do.
//
// Open the lineup, switch to Thursday, pick two sets on different stages, go to "My day" and
// check that the plan lists both stops with a "Leave <time>" between them, and that neither page
// logged a JavaScript error. Runs once at desktop size and once at phone size (see the config).
// @ts-check
const { test, expect } = require('@playwright/test');

const toMin = (t) => { const [h, m] = t.split(':'); return +h * 60 + +m; };

test('pick two Thursday sets and get a walking plan', async ({ page, request, baseURL }) => {
  // --- which sets to pick: taken from the live schedule so the test survives lineup changes ---
  const schedule = await (await request.get(baseURL + '/data/schedule.json')).json();
  const thursday = schedule.days.find((d) => d.weekday === 'Thursday');
  expect(thursday, 'schedule.json has a Thursday').toBeTruthy();

  const dayPerfs = schedule.performances
    .filter((p) => p.date === thursday.date)
    .sort((a, b) => toMin(a.start) - toMin(b.start));
  const first = dayPerfs[0];
  // Second pick: another stage, another act, and starting after the first ends so the plan is a plain walk.
  const second =
    dayPerfs.find((p) => p.stage !== first.stage && p.act !== first.act && toMin(p.start) >= toMin(first.end)) ||
    dayPerfs.find((p) => p.stage !== first.stage && p.act !== first.act);
  expect(second, 'Thursday has sets on two different stages').toBeTruthy();

  // --- collect JavaScript errors from both pages ---
  const errors = [];
  page.on('pageerror', (err) => errors.push('pageerror: ' + err.message));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const url = msg.location().url || '';
    // Map tiles, fonts and CDN libraries come from the internet; a hiccup there is not an app bug.
    if (/Failed to load resource/.test(msg.text()) && url && !url.startsWith(baseURL)) return;
    errors.push('console: ' + msg.text() + (url ? ' (' + url + ')' : ''));
  });

  // --- lineup: Thursday, two picks ---
  await page.goto('/lineup.html');
  await page.locator('#days [data-day="' + thursday.date + '"]').click();
  await expect(page.locator('#days [data-day="' + thursday.date + '"]')).toHaveAttribute('aria-selected', 'true');

  for (const p of [first, second]) {
    const set = page.locator('#view [data-id="' + p.id + '"]');
    await set.scrollIntoViewIfNeeded();
    await set.click();
    await expect(set).toHaveAttribute('aria-pressed', 'true');
  }
  await expect(page.locator('#picks .pick')).toHaveCount(2);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('fil-picks') || '[]'));
  expect(saved).toEqual(expect.arrayContaining([first.id, second.id]));

  // --- my day: two stops and a leave-by time ---
  await page.goto('/itinerary.html?day=' + thursday.date);
  const timeline = page.locator('#timeline');
  await expect(timeline.locator('.stop:not(.merchstop)')).toHaveCount(2);
  await expect(timeline).toContainText(first.act);
  await expect(timeline).toContainText(second.act);
  const leave = timeline.locator('.leg .leave').first();
  await expect(leave).toBeVisible();
  await expect(leave).toHaveText(/\d{1,2}[:h]\d{2}/); // "Leave 7:45 PM" (or 19 h 45 in French)

  expect(errors, 'no JavaScript errors on lineup.html or itinerary.html').toEqual([]);
});

// Share links can be typed or damaged by hand. One naming a shop that doesn't exist, even with a name every
// JavaScript object has ("constructor"), must still open the plan, and My day must keep working after a reload
// (the plan is saved on a device with no picks of its own).
test('a damaged share link still opens the plan', async ({ page, request, baseURL }) => {
  const schedule = await (await request.get(baseURL + '/data/schedule.json')).json();
  const thursday = schedule.days.find((d) => d.weekday === 'Thursday');
  const dayPerfs = schedule.performances.filter((p) => p.date === thursday.date).sort((a, b) => toMin(a.start) - toMin(b.start));
  const first = dayPerfs[0];
  const second = dayPerfs.find((p) => p.stage !== first.stage && toMin(p.start) >= toMin(first.end));
  const code = (p) => p.date.slice(5, 7) + p.date.slice(8, 10) + p.stage + p.start.replace(':', '');   // see FIL.plan in common.js
  const errors = [];
  page.on('pageerror', (err) => errors.push('pageerror: ' + err.message));

  await page.goto('/itinerary.html#e=' + schedule.edition + '&p=' + code(first) + '.' + code(second) +
    '&m=' + code(first).slice(0, 4) + '~b~constructor');
  const stops = page.locator('#timeline .stop:not(.merchstop)');
  await expect(stops).toHaveCount(2);
  await page.reload();
  await expect(stops).toHaveCount(2);
  await expect(page.locator('#timeline .leg .leave').first()).toHaveText(/\d{1,2}[:h]\d{2}/);
  expect(errors, 'no JavaScript errors on My day').toEqual([]);
});

// Printable schedules (print.html): every festival day prints as one Letter page with every set on it and no text
// cut off, and "My picks" (opened from My day) lists the picked sets with their leave-by times.
test('printable schedules: one page per day, and my picks with leave-by times', async ({ page, request, baseURL }) => {
  const schedule = await (await request.get(baseURL + '/data/schedule.json')).json();
  const errors = [];
  page.on('pageerror', (err) => errors.push('pageerror: ' + err.message));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const url = msg.location().url || '';
    if (/Failed to load resource/.test(msg.text()) && url && !url.startsWith(baseURL)) return;
    errors.push('console: ' + msg.text() + (url ? ' (' + url + ')' : ''));
  });

  // --- full schedule, all days ---
  await page.goto('/print.html?day=all');
  await expect(page.locator('#sheets')).toHaveAttribute('data-ready', '1');
  await expect(page.locator('.page.full')).toHaveCount(schedule.days.length);
  // every set is a box on its day's grid, or listed under the header ("Also this day: …") when far from the rest
  const boxes = await page.locator('.sh-set').count();
  const extras = (await page.locator('.sh-extra').allTextContents()).reduce((n, t) => n + t.split('; ').length, 0);
  expect(boxes + extras, 'every set in schedule.json is on the printout').toBe(schedule.performances.length);
  const clipped = await page.$$eval('.sh-set, .page', (els) =>
    els.filter((el) => el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1).map((el) => el.textContent.slice(0, 60)));
  expect(clipped, 'no text cut off in the boxes').toEqual([]);

  // print preview: controls hidden, one Letter page per day
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.pr-bar')).toBeHidden();
  const pdf = await page.pdf({ preferCSSPageSize: true });
  const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page(?!s)/g) || []).length;
  expect(pages, 'one printed page per festival day').toBe(schedule.days.length);
  await page.emulateMedia({ media: 'screen' });

  // --- my picks: two Thursday sets, opened from My day ---
  const thursday = schedule.days.find((d) => d.weekday === 'Thursday');
  const dayPerfs = schedule.performances.filter((p) => p.date === thursday.date).sort((a, b) => toMin(a.start) - toMin(b.start));
  const first = dayPerfs[0];
  const second = dayPerfs.find((p) => p.stage !== first.stage && toMin(p.start) >= toMin(first.end));
  await page.evaluate((ids) => localStorage.setItem('fil-picks', JSON.stringify(ids)), [first.id, second.id]);
  await page.goto('/itinerary.html?day=' + thursday.date);
  await page.locator('a.back.print').click();
  await expect(page).toHaveURL(/\/print\.html\?view=mine&day=\d{4}-\d{2}-\d{2}$/);
  expect(page.url()).toContain('day=' + thursday.date);
  await expect(page.locator('#sheets')).toHaveAttribute('data-ready', '1');
  await expect(page.locator('.ag-stop')).toHaveCount(2);
  await expect(page.locator('.ag-list')).toContainText(first.act);
  await expect(page.locator('.ag-list')).toContainText(second.act);
  await expect(page.locator('.ag-leg b').first()).toHaveText(/\d{1,2}[:h]\d{2}/); // "Leave 6:03 PM"

  expect(errors, 'no JavaScript errors on print.html').toEqual([]);
});
