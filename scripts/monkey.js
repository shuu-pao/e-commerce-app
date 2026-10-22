// Monkey test: random taps, junk input, back, reload and resizing, checking for crashes and
// "NaN"/"undefined" on screen. Run it with Playwright MCP (browser_run_code_unsafe, filename)
// against a DEVICE-ONLY dev server, never the live data:
//   EXPO_PUBLIC_SUPABASE_URL= EXPO_PUBLIC_SUPABASE_ANON_KEY= npx expo start --web --port 8083
async (page) => {
  const BASE = 'http://localhost:8083';
  const RUNS = [101, 202];
  const STEPS = 500;
  const junk = ['', '0', '-5', '1e9', '99999999999', '12.345', 'abc', '₱120', '1,250.50', '   ', '=1+1', '😀🎉', "Ana \"AJ\" O'Neil", '<b>x</b>', 'a'.repeat(300), '100', '7', '0.01', '2026-02-30'];
  const sizes = [[1180, 820], [820, 1180], [390, 844], [1440, 900]];
  const report = [];

  for (const seed of RUNS) {
    let s = seed;
    const rand = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
    const pick = (a) => a[Math.floor(rand() * a.length)];
    const ctx = await page.context().browser().newContext({ viewport: { width: 1180, height: 820 }, acceptDownloads: true });
    const p = await ctx.newPage();
    const problems = [];
    const log = [];
    p.on('pageerror', (e) => problems.push({ step: log.length, last: log.slice(-3), kind: 'pageerror', msg: e.message.slice(0, 300) }));
    p.on('console', (m) => {
      if (m.type() !== 'error') return;
      const t = m.text();
      if (/Download the React DevTools|favicon/.test(t)) return;
      problems.push({ step: log.length, last: log.slice(-3), kind: 'console', msg: t.slice(0, 300) });
    });
    p.on('dialog', (d) => d.dismiss());
    await p.goto(BASE + '/');
    await p.getByText('Try it with sample products').click({ timeout: 20000 });
    await p.waitForTimeout(500);

    for (let i = 0; i < STEPS; i++) {
      const r = rand();
      try {
        if (r < 0.03) { const [w, h] = pick(sizes); await p.setViewportSize({ width: w, height: h }); log.push(`resize ${w}x${h}`); }
        else if (r < 0.05) { await p.goBack({ timeout: 3000 }).catch(() => {}); log.push('back'); }
        else if (r < 0.06) { await p.reload(); await p.waitForTimeout(1500); log.push('reload'); }
        else if (r < 0.08) { await p.keyboard.press(pick(['Escape', 'Enter', 'Tab'])); log.push('key'); }
        else {
          const els = p.locator('button:visible, [role=button]:visible, [role=link]:visible, [role=radio]:visible, [role=checkbox]:visible, input:visible, textarea:visible');
          const n = await els.count();
          if (!n) { log.push('none'); continue; }
          const el = els.nth(Math.floor(rand() * n));
          const tag = await el.evaluate((e) => e.tagName).catch(() => '');
          const name = ((await el.getAttribute('aria-label').catch(() => null)) || (await el.innerText().catch(() => '')) || tag).slice(0, 40).replace(/\s+/g, ' ');
          if (tag === 'INPUT' || tag === 'TEXTAREA') {
            const type = await el.getAttribute('type').catch(() => null);
            if (type === 'date') { await el.fill(pick(['2026-10-01', '2025-01-31', '2030-12-31'])).catch(() => {}); }
            else { await el.fill(pick(junk), { timeout: 2000 }).catch(() => {}); }
            log.push(`type into "${name}"`);
          } else {
            await el.click({ timeout: 2000, trial: false }).catch(() => {});
            log.push(`click "${name}"`);
          }
        }
        await p.waitForTimeout(60);
        const body = await p.evaluate(() => document.body.innerText).catch(() => '');
        const bad = body.match(/NaN|undefined|Infinity|\[object Object\]|Something went wrong|Uncaught Error/);
        if (bad) problems.push({ step: i, last: log.slice(-4), kind: 'screen', msg: `"${bad[0]}" on screen at ${p.url()}` });
        if (!body.trim()) {
          await p.waitForTimeout(1500);
          const again = await p.evaluate(() => document.body.innerText).catch(() => '');
          if (!again.trim()) problems.push({ step: i, last: log.slice(-4), kind: 'blank', msg: `blank page at ${p.url()}` });
        }
      } catch (e) {
        problems.push({ step: i, last: log.slice(-3), kind: 'driver', msg: String(e).slice(0, 200) });
      }
    }
    const urls = new Set();
    report.push({ seed, steps: STEPS, finalUrl: p.url(), problemCount: problems.length, problems: problems.slice(0, 12) });
    await ctx.close();
  }
  return report;
}
