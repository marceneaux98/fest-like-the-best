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
