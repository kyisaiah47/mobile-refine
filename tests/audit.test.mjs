import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { chromium } from 'playwright';
import { audit } from '../skills/mobile-refine/scripts/audit.mjs';

const links = count => Array.from({length:count},(_,i) => `<a href="#section">Section ${i+1}</a>`).join('');
function fixture(bad = false, contents = false) {
  return `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Responsive audit fixture</title>
  <style>*{box-sizing:border-box}body{margin:0;font:16px/1.6 system-ui}header{height:56px;background:#eee;position:sticky;top:0}header nav{display:flex;gap:12px}a,button{display:inline-flex;align-items:center;min-height:44px}button{font:inherit}main{display:grid;grid-template-columns:200px 1fr;gap:24px;padding:24px}aside{height:500px}article{min-width:0}h1,p{margin:0 0 20px}#menu{display:none}dialog{padding:24px}#wrap{display:${contents ? 'contents' : 'block'}}
  @media(max-width:800px){main{display:block;padding:16px}aside{${bad ? 'display:block;height:520px' : 'display:none'}}#menu{display:inline-flex}${bad ? 'header{height:170px}header nav{display:flex;flex-wrap:wrap}article{min-width:900px}' : 'header nav{display:none}'}}
  </style><header><button id="menu" aria-controls="panel" aria-expanded="false">Menu</button><nav aria-label="Primary">${links(bad?8:3)}</nav></header>
  <main><div id="wrap"><aside id="rail"><nav aria-label="Sections">${links(4)}</nav></aside></div><article id="primary"><h1>Project activity</h1>${'<p>Read the latest project updates and choose the next action for your team. Each update includes a clear status and a link to the underlying work.</p>'.repeat(12)}<section id="section">Details</section></article></main>
  <dialog id="panel"><button id="close">Close menu</button><nav>${links(4)}</nav></dialog><script>const menu=document.querySelector('#menu'),panel=document.querySelector('#panel');menu.onclick=()=>{panel.showModal();menu.setAttribute('aria-expanded','true')};panel.addEventListener('close',()=>menu.setAttribute('aria-expanded','false'));document.querySelector('#close').onclick=()=>panel.close()</script></html>`;
}

async function serve(fn) {
  const server = createServer((req,res) => {
    if (req.url === '/missing') { res.writeHead(404).end('missing'); return; }
    res.setHeader('content-type','text/html');
    res.end(fixture(req.url.startsWith('/bad'),req.url.includes('contents')));
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  try { await fn(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test('good mobile drawer layout has no shape or overflow findings',async () => {
  await serve(async base => {
    const report = await audit(base+'/good',{widths:[320,390,430,768],settleMs:0,...(process.env.QA_ARTIFACT_DIR ? {artifacts:process.env.QA_ARTIFACT_DIR+'/good'} : {})});
    assert.equal(report.desktop.main,'#primary');
    assert.equal(report.desktop.sidebars.length,1);
    assert.deepEqual(report.viewports.flatMap(v=>v.findings),[]);
  });
});

test('stacked sidebar, buried content, dense chrome/navigation and overflow are measured',async () => {
  await serve(async base => {
    const report = await audit(base+'/bad',{widths:[390],settleMs:0,...(process.env.QA_ARTIFACT_DIR ? {artifacts:process.env.QA_ARTIFACT_DIR+'/bad'} : {})});
    const byCode = new Map(report.viewports[0].findings.map(f=>[f.code,f]));
    for (const code of ['SIDEBAR_BEFORE_CONTENT','CONTENT_BURIED','CHROME_DENSE','NAV_DENSE','PAGE_OVERFLOW']) assert.ok(byCode.has(code),code);
    assert.ok(byCode.get('CONTENT_BURIED').evidence.top>600);
    assert.ok(byCode.get('PAGE_OVERFLOW').evidence.pixels>500);
  });
});

test('display:contents wrappers preserve sidebar tracking and explicit selectors work',async () => {
  await serve(async base => {
    const report = await audit(base+'/bad-contents',{widths:[390],mainSelector:'#primary',sidebarSelector:'#rail',settleMs:0});
    assert.equal(report.desktop.sidebars[0].selector,'#rail');
    assert.ok(report.viewports[0].findings.some(f=>f.code==='SIDEBAR_BEFORE_CONTENT'));
  });
});

test('configurable budgets change heuristic findings without suppressing overflow',async () => {
  await serve(async base => {
    const report = await audit(base+'/bad',{widths:[390],chromeFraction:0.9,buriedFraction:1,maxNavLinks:12,settleMs:0});
    const codes = report.viewports[0].findings.map(f=>f.code);
    assert.ok(!codes.includes('CHROME_DENSE'));
    assert.ok(!codes.includes('CONTENT_BURIED'));
    assert.ok(!codes.includes('NAV_DENSE'));
    assert.ok(codes.includes('PAGE_OVERFLOW'));
  });
});

test('navigation and configuration failures never produce a passing audit',async () => {
  await assert.rejects(audit('file:///tmp/example.html'),/HTTP/);
  await assert.rejects(audit('http://localhost',{widths:[NaN]}),/widths/);
  await serve(async base => {
    await assert.rejects(audit(base+'/missing'),/404/);
    await assert.rejects(audit(base+'/good',{mainSelector:'#missing'}),/mainSelector/);
  });
});

test('representative drawer opens, takes focus, closes with Escape and returns focus',async () => {
  await serve(async base => {
    const browser = await chromium.launch({headless:true});
    try {
      const page = await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
      await page.goto(base+'/good');
      await page.getByRole('button',{name:'Menu',exact:true}).tap();
      assert.equal(await page.locator('#panel').evaluate(el=>el.open),true);
      assert.equal(await page.locator('#menu').getAttribute('aria-expanded'),'true');
      assert.equal(await page.evaluate(()=>document.activeElement.id),'close');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#panel').evaluate(el=>el.open),false);
      assert.equal(await page.evaluate(()=>document.activeElement.id),'menu');
      assert.equal(await page.locator('#menu').getAttribute('aria-expanded'),'false');
    } finally { await browser.close(); }
  });
});
