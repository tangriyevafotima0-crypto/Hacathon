const assert = require('node:assert/strict');
const { chromium } = require('playwright');

async function run() {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.ATLAS_BASE_URL || 'http://127.0.0.1:4173');
    const fixture = require('../../src/atlas/data/bass-three.json').rows.find(row => row.trial_id === 'GMT216-T25');
    let completeNasa;
    await page.route('**/api/nasa/bass-ii', route => new Promise(resolve => {
      completeNasa = async () => {
        await route.fulfill({ json: { csv: 'intentionally invalid to detect stale results' } });
        resolve();
      };
    }));

    const nasaRequested = page.waitForRequest('**/api/nasa/bass-ii');
    await page.getByRole('button', { name: 'NASA’dan olish' }).click();
    await nasaRequested;
    const manual = { ...fixture, sample_width_cm: '3.3', sample_width_raw: '33', sample_width_unit: 'mm' };
    const text = page.getByRole('textbox', { name: 'Import matni' });
    const importText = JSON.stringify([manual, { ...manual, trial_id: 'UNREVIEWED-PMMA', material: 'PMMA' }]);
    await page.getByRole('combobox', { name: /^Format/ }).selectOption('json');
    await text.fill(importText);
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    const nasaResponse = page.waitForResponse('**/api/nasa/bass-ii');
    await completeNasa();
    await nasaResponse;
    await page.getByRole('button', { name: 'NASA’dan olish' }).click({ trial: true });
    assert.equal(await text.inputValue(), importText);
    assert.equal(await page.getByRole('status').allTextContents().then(items => items.join('')), '');
    await page.getByRole('checkbox', { name: /Bayroqlarni/ }).check();
    await page.getByRole('button', { name: 'Tasdiqlash va saqlash' }).click();
    await page.getByText('PSI-25 · BASS-II (2)', { exact: true }).click();
    await page.getByRole('checkbox', { name: /UNREVIEWED-PMMA/ }).check();
    assert.equal(await page.getByRole('button', { name: 'Enni API orqali tekshirish' }).count(), 0);
    await page.getByRole('checkbox', { name: /GMT216-T25/ }).check();
    await page.route('**/api/re-evaluate', async route => {
      const body = route.request().postDataJSON();
      assert.equal(body.trial_id, 'GMT216-T25');
      assert.equal(body.value, 3.3);
      await route.fulfill({ json: { status: 'PROPOSED_CORRECTION', proposed_raw_patch: { sample_width_cm: '2.2' } } });
    });
    const check = page.getByRole('button', { name: 'Enni API orqali tekshirish' });
    const proposal = page.getByRole('region', { name: 'API correction' });
    await check.click();
    await proposal.getByText('sample_width_raw · 33 → 22').waitFor();
    await proposal.getByText('sample_width_cm · 3.3 → 2.2').waitFor();
    await proposal.getByRole('button', { name: 'Rad etish' }).click();
    const t25 = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'GMT216-T25' }) });
    await t25.getByRole('button', { name: '33 mm', exact: true }).waitFor();
    await check.click();
    await proposal.getByRole('button', { name: 'Tuzatishni tasdiqlash' }).click();
    await t25.getByRole('button', { name: '22 mm', exact: true }).waitFor();
    assert.deepEqual(errors, []);
    console.log('PASS late NASA response, trial scope, paired width diff, reject and confirm');
  } finally {
    await browser.close();
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
