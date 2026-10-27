#!/usr/bin/env node
// Copyright 2026 Compound Labs. All rights reserved.
import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const defaults = Object.freeze({
  desktopWidth: 1280, height: 844, widths: [320, 390, 430, 768],
  buriedFraction: 0.5, chromeFraction: 0.15, maxNavLinks: 6,
  minSidebarHeight: 160, timeout: 30000, settleMs: 250,
  mainSelector: null, sidebarSelector: null, readySelector: null,
});

function validate(config) {
  for (const key of ['desktopWidth', 'height', 'minSidebarHeight', 'timeout']) {
    if (!Number.isFinite(config[key]) || config[key] <= 0) throw new Error(`${key} must be positive`);
  }
  for (const key of ['buriedFraction', 'chromeFraction']) {
    if (!Number.isFinite(config[key]) || config[key] <= 0 || config[key] > 1) throw new Error(`${key} must be >0 and <=1`);
  }
  if (!Array.isArray(config.widths) || !config.widths.length || config.widths.some(w => !Number.isInteger(w) || w < 240 || w > 4096)) throw new Error('widths must contain integer CSS widths from 240 to 4096');
  if (!Number.isInteger(config.maxNavLinks) || config.maxNavLinks < 0) throw new Error('maxNavLinks must be a nonnegative integer');
  if (!Number.isFinite(config.settleMs) || config.settleMs < 0) throw new Error('settleMs must be nonnegative');
}

// Runs in the inspected page. DOM paths identify the same node after resizing;
// no audit attributes, styles, or other mutations are injected into the site.
function measure({ config, tracked }) {
  const rect = el => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
  };
  const visible = el => {
    if (!el) return false;
    const s = getComputedStyle(el), r = rect(el);
    if (s.display === 'none' || s.visibility !== 'visible' || +s.opacity === 0 || r.width < 1 || r.height < 1) return false;
    if (el.closest('dialog:not([open]), [hidden], [inert]')) return false;
    for (let p = el.parentElement; p; p = p.parentElement) {
      const ps = getComputedStyle(p);
      if (ps.visibility !== 'visible' || ps.display === 'none' || +ps.opacity === 0) return false;
    }
    return true;
  };
  const selector = el => {
    if (!el) return null;
    if (el.id) return '#' + CSS.escape(el.id);
    const parts = [];
    for (let p = el; p && p !== document.documentElement; p = p.parentElement) {
      parts.unshift(p.tagName.toLowerCase() + ':nth-child(' + (Array.prototype.indexOf.call(p.parentElement.children, p) + 1) + ')');
    }
    return 'html > ' + parts.join(' > ');
  };
  const children = el => [...el.children].flatMap(k => getComputedStyle(k).display === 'contents' ? children(k) : [k]).filter(visible);
  const textLength = el => (el.innerText || '').trim().length;
  let main = tracked ? document.querySelector(tracked.main) : config.mainSelector ? document.querySelector(config.mainSelector) : document.querySelector('main, [role="main"]');
  if (config.mainSelector && !main) throw new Error('mainSelector did not match an element');
  const warnings = [];
  if (!main) warnings.push('No main landmark found; set mainSelector to identify primary content.');
  if (!tracked && main && !config.mainSelector) {
    const kids = children(main);
    const columns = kids.filter(k => kids.some(other => other !== k && Math.min(rect(k).bottom, rect(other).bottom) > Math.max(rect(k).y, rect(other).y) + 80 && Math.min(rect(k).right, rect(other).right) <= Math.max(rect(k).x, rect(other).x) + 2));
    const content = columns.filter(k => !k.matches('aside, nav, [role="navigation"], [role="complementary"]'));
    if (content.length) main = content.sort((a,b) => textLength(b) - textLength(a))[0];
  }
  const nodes = [...document.querySelectorAll('body *')].slice(0, 15000);
  if (document.querySelectorAll('body *').length > 15000) warnings.push('DOM measurement limited to first 15000 elements.');
  const mainRect = main && visible(main) ? rect(main) : null;
  let rails = [];
  if (tracked) {
    rails = tracked.sidebars.map(s => ({ selector: s, element: document.querySelector(s) }));
  } else if (mainRect) {
    const candidates = config.sidebarSelector ? [...document.querySelectorAll(config.sidebarSelector)] : nodes.filter(el => {
      if (!visible(el) || el.contains(main) || main.contains(el)) return false;
      const r = rect(el);
      const outside = 1 - Math.max(0, Math.min(r.right, mainRect.right) - Math.max(r.x, mainRect.x)) / r.width;
      const overlap = Math.max(0, Math.min(r.bottom, mainRect.bottom) - Math.max(r.y, mainRect.y));
      return r.height >= config.minSidebarHeight && outside > 0.6 && overlap >= Math.min(r.height, mainRect.height) * 0.5;
    });
    if (config.sidebarSelector && !candidates.length) throw new Error('sidebarSelector did not match an element');
    // Keep outermost blocks so a rail and each of its descendants are not counted twice.
    rails = candidates.filter(el => !candidates.some(other => other !== el && other.contains(el))).map(element => ({ selector: selector(element), element }));
  }
  const firstInk = root => {
    if (!root || !visible(root)) return null;
    const painted = [root, ...root.querySelectorAll('*')].filter(el => visible(el) && !el.closest('aside, nav, [role="navigation"], [role="complementary"]') &&
      ([...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) || el.matches('img,svg,canvas,video,input,button')));
    return painted.length ? Math.min(...painted.map(el => rect(el).y)) : rect(root).y;
  };
  const findings = [];
  const add = (code, kind, target, detail, evidence) => findings.push({ code, kind, selector: target, detail, evidence });
  if (tracked && !mainRect) warnings.push('Tracked primary content is missing or hidden at this viewport.');
  const sidebars = rails.map(({ selector: s, element: el }) => {
    if (!el || !visible(el)) return { selector: s, visible: false, missing: !el };
    const r = rect(el), links = [...el.querySelectorAll('a[href]')].filter(visible).length;
    const inFlow = !['absolute','fixed'].includes(getComputedStyle(el).position);
    if (tracked && mainRect && inFlow && r.bottom <= mainRect.y + 2) add('SIDEBAR_BEFORE_CONTENT','heuristic',s,'A desktop side column now appears before primary content.',{ sidebarBottom: r.bottom, mainTop: mainRect.y });
    return { selector: s, visible: true, rect: r, links, inFlow };
  });
  const inkTop = firstInk(main);
  if (tracked && inkTop !== null && inkTop > innerHeight * config.buriedFraction) add('CONTENT_BURIED','heuristic',selector(main),'Primary content starts below the configured first-screen budget.',{ top: inkTop, fraction: inkTop / innerHeight, threshold: config.buriedFraction });
  const chrome = nodes.filter(el => visible(el) && ['sticky','fixed'].includes(getComputedStyle(el).position) && rect(el).y <= 2 && rect(el).bottom > 0 && rect(el).width > innerWidth * 0.5);
  const chromeBottom = Math.max(0, ...chrome.map(el => Math.min(innerHeight,rect(el).bottom)));
  if (tracked && chromeBottom / innerHeight > config.chromeFraction) add('CHROME_DENSE','heuristic',selector(chrome.sort((a,b) => rect(b).bottom - rect(a).bottom)[0]),'Pinned content occupies a large share of the initial viewport.',{ height: chromeBottom, fraction: chromeBottom / innerHeight, threshold: config.chromeFraction });
  for (const nav of document.querySelectorAll('header nav, header [role="navigation"], [role="banner"] nav')) {
    const links = [...nav.querySelectorAll('a[href]')].filter(el => visible(el) && rect(el).x < innerWidth && rect(el).right > 0);
    if (tracked && links.length > config.maxNavLinks) add('NAV_DENSE','heuristic',selector(nav),'Header navigation has many simultaneously visible destinations; review priority and wrapping.',{ links: links.length, threshold: config.maxNavLinks });
  }
  const overflow = Math.max(document.documentElement.scrollWidth,document.body.scrollWidth) - innerWidth;
  if (overflow > 2) add('PAGE_OVERFLOW','measurement','html','The document scrolls horizontally at this viewport.',{ pixels: overflow });
  const clipped = nodes.filter(el => {
    if (!visible(el) || !el.matches('button,a,input,select,textarea,[role="button"]')) return false;
    const r = rect(el);
    // Fixed off-canvas drawers are intentional closed states; do not call them clipped controls.
    if (el.closest('dialog') || getComputedStyle(el).position === 'fixed') return false;
    return r.y >= 0 && r.y < innerHeight && (r.x < -2 || r.right > innerWidth + 2);
  }).slice(0,20);
  for (const el of clipped) add('CONTROL_OUTSIDE_VIEWPORT','measurement',selector(el),'A visible control extends beyond the viewport; inspect scrolling and clipping.',rect(el));
  return { viewport: { width: innerWidth, height: innerHeight }, main: selector(main), mainRect, firstContentTop: inkTop,
    sidebars, findings, warnings, tracking: { main: selector(main), sidebars: rails.map(s => s.selector) } };
}

export async function audit(url, options = {}) {
  const config = { ...defaults, ...options };
  validate(config);
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only HTTP(S) URLs are supported');
  if (parsed.username || parsed.password) throw new Error('Do not put credentials in the URL');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: config.desktopWidth, height: config.height }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(config.timeout);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: config.timeout });
    if (!response || !response.ok()) throw new Error(`Navigation failed with HTTP ${response?.status() ?? 'unknown'}`);
    if (config.readySelector) await page.locator(config.readySelector).waitFor({ state: 'visible' });
    await page.evaluate(timeout => Promise.race([
      document.fonts.ready,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Font readiness timed out')), timeout)),
    ]), config.timeout);
    await page.waitForTimeout(config.settleMs);
    const desktop = await page.evaluate(measure, { config, tracked: null });
    if (!desktop.main) throw new Error('Cannot identify primary content; provide --main CSS_SELECTOR');
    if (config.artifacts) {
      await mkdir(config.artifacts, { recursive: true });
      await page.screenshot({ path: join(config.artifacts,`desktop-${config.desktopWidth}.png`),fullPage:true });
    }
    const viewports = [];
    for (const width of [...new Set(config.widths)]) {
      await page.setViewportSize({ width, height: config.height });
      await page.evaluate(() => scrollTo(0,0));
      await page.waitForTimeout(config.settleMs);
      const result = await page.evaluate(measure, { config, tracked: desktop.tracking });
      if (config.artifacts) await page.screenshot({ path: join(config.artifacts,`viewport-${width}.png`), fullPage:true });
      viewports.push(result);
    }
    const report = { schemaVersion: 1, url: page.url(), measuredAt: new Date().toISOString(), config, desktop, viewports, pageErrors: [...new Set(errors)],
      limitations: ['Geometry heuristics require visual confirmation.', 'Chromium viewport checks do not certify accessibility or real-device behavior.', 'No controls are activated and no forms are submitted. Inspect interactive states separately.'] };
    if (config.artifacts) await writeFile(join(config.artifacts,'report.json'),JSON.stringify(report,null,2)+'\n');
    return report;
  } finally { await browser.close(); }
}

export async function main(argv) {
  let url, config = {}, fail = false;
  const values = { '--widths':'widths','--height':'height','--desktop-width':'desktopWidth','--main':'mainSelector','--sidebars':'sidebarSelector','--ready':'readySelector','--artifacts':'artifacts','--settle-ms':'settleMs' };
  for (let i=0; i<argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help') { console.log('Usage: node audit.mjs URL [--widths 320,390,430,768] [--main SELECTOR] [--sidebars SELECTOR] [--ready SELECTOR] [--config FILE.json] [--artifacts DIR] [--fail-on-findings]\nOutputs JSON. Exit: 0 measured, 1 findings with --fail-on-findings, 2 execution/configuration error.'); return 0; }
    if (arg === '--fail-on-findings') { fail = true; continue; }
    if (arg === '--config') {
      if (!argv[i+1]) throw new Error('--config needs a path');
      const file = JSON.parse(await readFile(argv[++i], 'utf8'));
      if (!file || typeof file !== 'object' || Array.isArray(file)) throw new Error('config must be an object');
      const unknown = Object.keys(file).filter(k => !(k in defaults));
      if (unknown.length) throw new Error(`Unknown config keys: ${unknown.join(', ')}`);
      config = { ...config, ...file }; continue;
    }
    if (values[arg]) {
      if (!argv[i+1] || argv[i+1].startsWith('--')) throw new Error(`${arg} needs a value`);
      const value = argv[++i], key = values[arg];
      config[key] = key === 'widths' ? value.split(',').map(Number) : ['height','desktopWidth','settleMs'].includes(key) ? Number(value) : value;
      continue;
    }
    if (arg.startsWith('-') || url) throw new Error(`Unexpected argument: ${arg}`);
    url = arg;
  }
  if (!url) throw new Error('A URL is required; use --help');
  if (config.artifacts) config.artifacts = resolve(config.artifacts);
  const report = await audit(url,config);
  console.log(JSON.stringify(report,null,2));
  return fail && [report.desktop,...report.viewports].some(v => v.findings.length) ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).then(code => { process.exitCode = code; }).catch(error => {
    console.error(`mobile-refine: ${error.message}`); process.exitCode = 2;
  });
}
