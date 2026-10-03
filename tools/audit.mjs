/* ============================================================================
   audit.mjs
   ----------------------------------------------------------------------------
   A pre-submission check of the things that are easy to get wrong and tedious
   to eyeball. Run it before you push:

     node tools/audit.mjs

   Covers: JS and CSS syntax, HTML tag balance, internal anchors, local asset
   references, form labelling and validation wiring, heading structure, page
   title and meta description length, WCAG contrast for every colour pair in the
   palette, drift between the audited palette and the stylesheet, the design
   patterns this project deliberately avoids, leftover placeholder text, and
   file sizes.

   Exits non-zero if anything fails, so it works as a pre-commit hook.
   It is a lint, not a test suite: it reads files, it does not drive a browser.
   ========================================================================= */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

let problems = 0;
const fail = (msg) => { problems += 1; console.log(`  FAIL  ${msg}`); };
const pass = (msg) => console.log(`  ok    ${msg}`);

/* ---------------------------------------------------------------- syntax */
console.log('\n1. Syntax');
for (const f of ['assets/js/main.js', 'tools/generate-icons.mjs']) {
  try {
    execFileSync(process.execPath, ['--check', join(ROOT, f)], { stdio: 'pipe' });
    pass(`${f} parses`);
  } catch (e) {
    fail(`${f}: ${e.stderr?.toString().split('\n')[2] || 'parse error'}`);
  }
}

const css = read('assets/css/styles.css');
const braces = (css.match(/{/g) || []).length - (css.match(/}/g) || []).length;
braces === 0 ? pass('styles.css braces balanced') : fail(`styles.css brace mismatch: ${braces}`);

const parens = (css.match(/\(/g) || []).length - (css.match(/\)/g) || []).length;
parens === 0 ? pass('styles.css parens balanced') : fail(`styles.css paren mismatch: ${parens}`);

/* ---------------------------------------------------------- tag balance */
console.log('\n2. HTML tag balance');
const VOID = new Set(['area','base','br','col','embed','hr','img','input','link',
  'meta','param','source','track','wbr','path','rect','circle','use','stop']);
for (const file of ['index.html', '404.html']) {
  const html = read(file);
  const stack = [];
  let bad = null;
  /* Strip comments, doctype, script and style bodies so their contents are
     not mistaken for markup. */
  const clean = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!doctype[^>]*>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');
  for (const m of clean.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)([^>]*?)(\/?)>/g)) {
    const [, closing, name, attrs, selfClose] = m;
    const tag = name.toLowerCase();
    if (VOID.has(tag) || selfClose === '/') continue;
    if (closing) {
      const top = stack.pop();
      if (top !== tag) { bad = `</${tag}> closed <${top}>`; break; }
    } else stack.push(tag);
  }
  if (bad) fail(`${file}: ${bad}`);
  else if (stack.length) fail(`${file}: unclosed <${stack.join('>, <')}>`);
  else pass(`${file} tags balanced`);
}

/* ------------------------------------------------------------- anchors */
console.log('\n3. Internal anchors resolve');
for (const file of ['index.html', '404.html']) {
  const html = read(file);
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const hrefs = [...html.matchAll(/href="(#[^"]+)"/g)].map((m) => m[1]);
  const dead = [...new Set(hrefs)].filter((h) => !ids.has(h.slice(1)));
  dead.length ? fail(`${file}: anchors with no target: ${dead.join(', ')}`)
              : pass(`${file}: ${new Set(hrefs).size} anchors, all resolve`);
}

/* ----------------------------------------------------- local references */
console.log('\n4. Local files referenced actually exist');
for (const file of ['index.html', '404.html', 'site.webmanifest', 'robots.txt']) {
  const text = read(file);
  const refs = new Set(
    [...text.matchAll(/(?:href|src)="(?!https?:|mailto:|tel:|#|data:)([^"]+)"/g)].map((m) => m[1])
  );
  const missing = [...refs].filter((r) => !existsSync(join(ROOT, r.split('#')[0])));
  missing.length ? fail(`${file}: missing ${missing.join(', ')}`)
                 : pass(`${file}: ${refs.size} local refs, all present`);
}
{
  const mf = JSON.parse(read('site.webmanifest'));
  const bad = mf.icons.filter((i) => !existsSync(join(ROOT, i.src)));
  bad.length ? fail(`webmanifest: missing ${bad.map((b) => b.src).join(', ')}`)
             : pass('site.webmanifest: all icons present');
}

/* -------------------------------------------------------------- labels */
console.log('\n5. Form wiring');
{
  const html = read('index.html');
  const inputs = [...html.matchAll(/<(input|select|textarea)[^>]*\sid="([^"]+)"/g)].map((m) => m[2]);
  const labelled = inputs.filter((id) => new RegExp(`<label[^>]*for="${id}"`).test(html));
  const described = inputs.filter((id) => new RegExp(`id="${id}"[^>]*aria-describedby="([^"]*)"`).test(html));
  /* main.js builds the error ids from the field name, so check the convention. */
  const js = read('assets/js/main.js');
  const noErr = inputs.filter((id) => !html.includes(`id="${id}-error"`));
  labelled.length === inputs.length ? pass(`${inputs.length} fields, all labelled`)
    : fail(`unlabelled: ${inputs.filter((i) => !labelled.includes(i)).join(', ')}`);
  described.length === inputs.length ? pass(`${inputs.length} fields, all have aria-describedby`)
    : fail(`no aria-describedby: ${inputs.filter((i) => !described.includes(i)).join(', ')}`);
  noErr.length === 0 ? pass('every field has a matching error element in the HTML')
    : fail(`no error element for: ${noErr.join(', ')}`);
  js.includes("'#' + name + '-error'") || js.includes('#\' + name + \'-error\'')
    ? pass('main.js targets those error elements') : fail('main.js does not look up the error elements');
  const keys = [...js.match(/var validators = \{([\s\S]*?)\n {2}\};/)[1]
    .matchAll(/^\s{4}(\w+):/gm)].map((m) => m[1]);
  keys.length === inputs.length ? pass(`validators match fields (${keys.length}: ${keys.join(', ')})`)
    : fail(`validators ${keys.length} vs fields ${inputs.length}`);
}

/* ------------------------------------------------------------ headings */
console.log('\n6. Headings and landmarks');
{
  const html = read('index.html');
  const h1 = (html.match(/<h1[\s>]/g) || []).length;
  h1 === 1 ? pass('exactly one h1') : fail(`${h1} h1 elements`);
  ['<header', '<main', '<footer', 'role="region"', '<nav'].forEach((t) => {
    html.includes(t) ? pass(`has ${t}`) : fail(`missing ${t}`);
  });
  const title = html.match(/<title>([^<]+)<\/title>/)[1];
  title.length >= 15 && title.length <= 70
    ? pass(`title length ${title.length}: "${title}"`)
    : fail(`title length ${title.length}, want 15-70`);
  const desc = html.match(/name="description" content="([^"]+)"/)[1];
  desc.length >= 60 && desc.length <= 160
    ? pass(`meta description length ${desc.length}`)
    : fail(`meta description length ${desc.length}, want 60-160`);
}

/* ------------------------------------------------------------ contrast */
console.log('\n7. Colour contrast (WCAG AA)');
{
  const lum = (hex) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
    return (x + 0.05) / (y + 0.05);
  };
  const pairs = [
    ['body text', '#4b473c', '#f3efe6', 4.5],
    ['headings', '#1b1a15', '#f3efe6', 4.5],
    ['accent text', '#a63d22', '#f3efe6', 4.5],
    ['faint label', '#676250', '#f3efe6', 4.5],
    ['faint on sunk', '#676250', '#ece6d9', 4.5],
    ['faint on raised', '#676250', '#f8f5ee', 4.5],
    ['accent-dark error', '#7e2d17', '#f3efe6', 4.5],
    ['placeholder text', '#79735f', '#f3efe6', 3.0],
    ['solid button', '#f8f5ee', '#1b1a15', 4.5],
    ['accent button', '#f8f5ee', '#a63d22', 4.5],
    ['focus ring', '#a63d22', '#f3efe6', 3.0],
  ];
  for (const [name, fg, bg, min] of pairs) {
    const r = ratio(fg, bg);
    r >= min ? pass(`${name} ${r.toFixed(2)}:1 (min ${min})`)
             : fail(`${name} ${r.toFixed(2)}:1 is under ${min}`);
  }
}

/* Token drift: the palette in the stylesheet must be the palette audited above. */
console.log('\n7b. Stylesheet tokens match the audited palette');
{
  const expected = { '--ink': '#1b1a15', '--ink-soft': '#4b473c', '--ink-faint': '#676250',
    '--ink-ghost': '#79735f', '--accent': '#a63d22', '--accent-dark': '#7e2d17',
    '--paper': '#f3efe6', '--paper-sunk': '#ece6d9', '--paper-raised': '#f8f5ee' };
  for (const [token, value] of Object.entries(expected)) {
    const re = new RegExp(`${token}:\\s*(${value})`, 'i');
    re.test(css) ? pass(`${token} is ${value}`)
                 : fail(`${token} should be ${value} in styles.css`);
  }
  const p404 = read('404.html');
  p404.includes('--ink-faint: #676250') ? pass('404.html tokens in step')
    : fail('404.html token drift');
}

/* ---------------------------------------------- patterns to avoid */
console.log('\n8. Patterns this project avoids');
{
  const html = read('index.html');
  /* Comments are stripped first: this file writes sentences such as "no glow"
     and "no drop shadows" in its own margins, and those are documentation,
     not usage. */
  const cssAll = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const checks = [
    ['purple', /\b(purple|violet|indigo|#[0-9a-f]{0,2}(8|9|a|b)[0-9a-f]{1,2}ff?[0-9a-f]{0,2})\b/i, html + cssAll],
    ['em dash in copy', /—/g, html],
    ['Inter / Space Grotesk font', /\bInter\b|Space Grotesk/i, html + cssAll],
    ['emoji', /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u, html],
    ['checkmark bullet', /[\u2713\u2714\u2715\u279c]/u, html + cssAll],
    ['glassmorphism', /backdrop-filter|blur\(|liquid|glassmorphism/i, cssAll],
    ['drop shadow', /box-shadow|drop-shadow|filter:\s*drop-shadow/i, cssAll],
    ['gradient', /linear-gradient|radial-gradient|conic-gradient/i, cssAll],
    ['neon / glow', /\bneon\b|\bglow\b|text-shadow/i, html + cssAll],
    ['skeleton loader', /skeleton|shimmer|placeholder-shimmer/i, html + cssAll + read('assets/js/main.js')],
    ['terminal window', /\$\s|bash|prompt|~\/|class="terminal/i, html],
    ['bento grid', /bento/i, html + cssAll],
    ['pricing tiers', /\bpricing\b|\bstarter plan\b|\bper month\b|\/mo\b/i, html],
    ['keycap arrow', /[→←⇒⇐➔➜]/u, html],
    ['dot grid background', /radial-gradient\([\s\S]{0,80}(circle|dot)/i, cssAll],
  ];
  for (const [name, re, target] of checks) {
    const hit = target.match(re);
    hit ? fail(`${name} found: ${JSON.stringify(hit[0])}`)
         : pass(`no ${name}`);
  }

  /* Not-quite-features copy pattern: "Not X. Y." as a sentence opener. */
  const notPattern = /(^|[.!?]\s+)Not\s+\w+\.\s+\w+/gm;
  const copyOnly = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const np = copyOnly.match(notPattern);
  np ? fail(`"Not X. Y." pattern: ${JSON.stringify(np[0])}`) : pass('no "Not X. Y." copy');

  /* Services must not be three equal cards in a row. */
  const items = (html.match(/class="index-list__item/g) || []).length;
  const cards = (html.match(/class="[^"]*\bcard\b/g) || []).length;
  items === 4 && cards === 0
    ? pass(`services are an index list of ${items}, zero card components`)
    : fail(`services: ${items} index items, ${cards} card elements`);

  /* Border radius should stay tight everywhere. */
  const radii = [...cssAll.matchAll(/border-radius:\s*([^;]+);/g)].map((m) => m[1].trim());
  const soft = radii.filter((r) => /(\d{2,})(px|rem)/.test(r) && !/^2px$/.test(r));
  soft.length === 0 ? pass(`all ${radii.length} radii tight: ${[...new Set(radii)].join(', ')}`)
    : fail(`soft radii found: ${soft.join(', ')}`);
}

/* ------------------------------------------------------------- hygiene */
console.log('\n9. Content hygiene');
{
  const html = read('index.html');
  const copy = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ');
  ['lorem', 'ipsum', 'TODO', 'FIXME', 'XXX', 'placeholder text', 'your text here',
   'coming soon', 'tbd', 'undefined', 'NaN'].forEach((word) => {
    copy.toLowerCase().includes(word.toLowerCase())
      ? fail(`copy contains "${word}"`) : pass(`no "${word}"`);
  });
  const quotes = (html.match(/class="quote /g) || []).length;
  quotes === 3 ? pass('3 testimonials with attribution') : fail(`${quotes} testimonials`);
  const attrs = (html.match(/class="quote__name"[^>]*>/g) || []).length;
  attrs === 3 ? pass('all 3 testimonials name a person and a role') : fail('missing attribution');
}

/* ------------------------------------------------------------ file size */
console.log('\n10. Sizes');
for (const f of ['index.html', '404.html', 'assets/css/styles.css', 'assets/js/main.js',
                 'assets/img/favicon.svg', 'assets/img/favicon.ico',
                 'assets/img/apple-touch-icon.png', 'assets/img/og-image.png']) {
  const bytes = readFileSync(join(ROOT, f)).length;
  const limit = f.includes('img') ? 16384 : 40960;
  bytes < limit ? pass(`${f} ${(bytes / 1024).toFixed(1)} KB`)
                : fail(`${f} ${(bytes / 1024).toFixed(1)} KB over ${limit / 1024} KB`);
}

console.log(problems === 0
  ? '\nAll checks passed.\n'
  : `\n${problems} problem(s) found.\n`);
process.exit(problems === 0 ? 0 : 1);