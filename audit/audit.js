const { chromium } = require('playwright');

const SECURITY_HEADERS = [
  { name: 'content-security-policy',    label: 'Content-Security-Policy', severity: 'high' },
  { name: 'strict-transport-security',  label: 'HSTS',                    severity: 'high' },
  { name: 'x-content-type-options',     label: 'X-Content-Type-Options',  severity: 'medium' },
  { name: 'x-frame-options',            label: 'X-Frame-Options',         severity: 'medium' },
  { name: 'referrer-policy',            label: 'Referrer-Policy',         severity: 'low' },
  { name: 'permissions-policy',         label: 'Permissions-Policy',      severity: 'low' },
];

const SENSITIVE_KEYS = /token|password|secret|key|auth|jwt|session|credential/i;

function pad(label) {
  return label.padEnd(8);
}

async function checkHeaders(page, url, findings) {
  try {
    const headers = await page.evaluate(async (pageUrl) => {
      const resp = await fetch(pageUrl, { method: 'HEAD', credentials: 'include' });
      const h = {};
      resp.headers.forEach((v, k) => { h[k] = v; });
      return h;
    }, url);

    for (const hdr of SECURITY_HEADERS) {
      if (!headers[hdr.name]) {
        findings.push({ category: 'Headers', severity: hdr.severity, issue: `Missing ${hdr.label}` });
      } else if (hdr.name === 'x-content-type-options' && headers[hdr.name] !== 'nosniff') {
        findings.push({ category: 'Headers', severity: 'low', issue: `X-Content-Type-Options should be 'nosniff' (got: ${headers[hdr.name]})` });
      }
    }
  } catch (e) {
    findings.push({ category: 'Headers', severity: 'info', issue: `Could not fetch headers (CORS may block HEAD request)` });
  }
}

async function checkCookies(page, url, findings) {
  const cookies = await page.context().cookies();
  const isHttps = url.startsWith('https://');

  if (cookies.length === 0) {
    findings.push({ category: 'Cookies', severity: 'info', issue: 'No cookies found on this page' });
    return;
  }

  for (const c of cookies) {
    if (!c.httpOnly) {
      findings.push({ category: 'Cookies', severity: 'medium', issue: `'${c.name}' missing HttpOnly (accessible via JS)` });
    }
    if (isHttps && !c.secure) {
      findings.push({ category: 'Cookies', severity: 'medium', issue: `'${c.name}' missing Secure flag on HTTPS site` });
    }
    if (!c.sameSite || c.sameSite === 'None') {
      findings.push({ category: 'Cookies', severity: 'low', issue: `'${c.name}' SameSite=${c.sameSite || 'not set'} (CSRF risk)` });
    }
  }
}

async function checkMixedContent(page, url, findings) {
  if (!url.startsWith('https://')) return;

  const items = await page.evaluate(() => {
    const http = [];
    const sel = (tag, attr) => document.querySelectorAll(`${tag}[${attr}]`).forEach(el => {
      const val = el[attr] || el.getAttribute(attr);
      if (val && val.startsWith('http:')) http.push({ tag, url: val });
    });
    sel('script', 'src');
    sel('img', 'src');
    sel('iframe', 'src');
    sel('link', 'href');
    return http;
  });

  for (const item of items) {
    findings.push({ category: 'Mixed Content', severity: 'high', issue: `HTTP <${item.tag}>: ${item.url}` });
  }
}

async function checkThirdPartyScripts(page, url, findings) {
  try {
    const host = new URL(url).hostname;
    const scripts = await page.evaluate((pageHost) => {
      const external = [];
      document.querySelectorAll('script[src]').forEach(el => {
        try {
          const h = new URL(el.src).hostname;
          if (h && h !== pageHost && !h.endsWith('.' + pageHost)) {
            external.push(el.src);
          }
        } catch {}
      });
      return external;
    }, host);

    if (scripts.length > 0) {
      findings.push({
        category: 'Third-party Scripts',
        severity: 'info',
        issue: `${scripts.length} external script(s): ${scripts.slice(0, 3).map(s => new URL(s).hostname).join(', ')}${scripts.length > 3 ? ` +${scripts.length - 3} more` : ''}`
      });
    }
  } catch {}
}

async function checkStorage(page, findings) {
  const issues = await page.evaluate((pattern) => {
    const found = [];
    const check = (store, name) => {
      for (let i = 0; i < store.length; i++) {
        const key = store.key(i);
        if (new RegExp(pattern, 'i').test(key)) found.push({ store: name, key });
      }
    };
    try { check(localStorage, 'localStorage'); } catch {}
    try { check(sessionStorage, 'sessionStorage'); } catch {}
    return found;
  }, SENSITIVE_KEYS.source);

  for (const s of issues) {
    findings.push({ category: 'Storage', severity: 'medium', issue: `Sensitive key '${s.key}' stored in ${s.store}` });
  }
}

async function checkForms(page, url, findings) {
  const issues = await page.evaluate((isHttps) => {
    const found = [];
    document.querySelectorAll('form').forEach((form, i) => {
      const hasPassword = form.querySelector('input[type="password"]');
      if (!hasPassword) return;

      const action = form.action;
      if (action && action.startsWith('http:')) {
        found.push(`Form #${i + 1} submits password to HTTP endpoint: ${action}`);
      }
      if (!isHttps) {
        found.push(`Password form on a non-HTTPS page`);
      }
    });
    return found;
  }, url.startsWith('https://'));

  for (const issue of issues) {
    findings.push({ category: 'Forms', severity: 'high', issue });
  }
}

async function checkInlineScripts(page, findings) {
  const count = await page.evaluate(() => {
    let inline = 0;
    document.querySelectorAll('script:not([src])').forEach(el => {
      if (el.textContent.trim()) inline++;
    });
    return inline;
  });

  if (count > 0) {
    findings.push({ category: 'CSP Risk', severity: 'info', issue: `${count} inline script(s) found — would be blocked by strict CSP` });
  }
}

async function run() {
  process.stdout.write('Connecting to Chrome on port 9222...\n');

  let browser;
  try {
    browser = await chromium.connectOverCDP('http://localhost:9222');
  } catch (e) {
    console.error('\nCould not connect. Make sure Chrome is running with:\n  --remote-debugging-port=9222\n');
    process.exit(1);
  }

  const contexts = browser.contexts();
  const pages = contexts.flatMap(c => c.pages());

  if (pages.length === 0) {
    console.error('No open tabs found.');
    await browser.close();
    process.exit(1);
  }

  // Use last page (most recently opened)
  const page = pages[pages.length - 1];
  const url = page.url();
  const title = await page.title();

  console.log('\n' + '═'.repeat(62));
  console.log(' SITE AUDIT REPORT');
  console.log('═'.repeat(62));
  console.log(` URL   : ${url}`);
  console.log(` Title : ${title}`);
  console.log(` Time  : ${new Date().toLocaleString()}`);
  console.log('─'.repeat(62));

  const findings = [];

  process.stdout.write(' Checking security headers...\n');
  await checkHeaders(page, url, findings);

  process.stdout.write(' Checking cookies...\n');
  await checkCookies(page, url, findings);

  process.stdout.write(' Checking mixed content...\n');
  await checkMixedContent(page, url, findings);

  process.stdout.write(' Checking third-party scripts...\n');
  await checkThirdPartyScripts(page, url, findings);

  process.stdout.write(' Checking storage...\n');
  await checkStorage(page, findings);

  process.stdout.write(' Checking forms...\n');
  await checkForms(page, url, findings);

  process.stdout.write(' Checking inline scripts...\n');
  await checkInlineScripts(page, findings);

  console.log('\n' + '═'.repeat(62));
  console.log(' FINDINGS');
  console.log('═'.repeat(62));

  const order = ['high', 'medium', 'low', 'info'];
  const labels = { high: '[HIGH]  ', medium: '[MED]   ', low: '[LOW]   ', info: '[INFO]  ' };
  const grouped = Object.fromEntries(order.map(s => [s, []]));

  for (const f of findings) {
    (grouped[f.severity] || grouped.info).push(f);
  }

  let any = false;
  for (const severity of order) {
    for (const f of grouped[severity]) {
      console.log(` ${labels[severity]}${f.category}: ${f.issue}`);
      any = true;
    }
  }

  if (!any) {
    console.log(' No issues found.');
  }

  const counts = order.map(s => `${grouped[s].length} ${s}`).join('  |  ');
  console.log('\n' + '─'.repeat(62));
  console.log(` ${counts}`);
  console.log('═'.repeat(62) + '\n');

  await browser.close();
}

run().catch(e => { console.error(e.message); process.exit(1); });
