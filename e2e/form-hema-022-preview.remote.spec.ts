import fs from 'fs';
import path from 'path';
import { expect, test } from '@playwright/test';

const CREDENTIALS_PATH = path.join(process.cwd(), 'scripts', '.preview-secrets.local.json');
const ARTIFACT_DIR = path.join(process.cwd(), 'tmp', 'form-hema-022-preview-artifacts');

type CredentialsFile = {
  accounts: Record<string, { email: string; password: string }>;
};

function loadCredentials(): CredentialsFile {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error('Missing scripts/.preview-secrets.local.json — run preview-access-bootstrap.mjs');
  }
  return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8')) as CredentialsFile;
}

async function login(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/en/login');
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Password').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL(/\/en\/(?!login)/, { timeout: 60_000 });
}

test.describe('Form-Hema-022 Preview browser walkthrough', () => {
  test('full workflow with artifacts', async ({ page }) => {
    test.setTimeout(300_000);
    const creds = loadCredentials();
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

    const preparer = creds.accounts.preparer;
    const reviewer = creds.accounts.reviewer;
    const approver = creds.accounts.approver;
    const lotSuffix = Date.now().toString().slice(-6);
    const newLot = `RETIC-BRW-${lotSuffix}`;
    const oldLot = `RETIC-OLD-BRW-${lotSuffix}`;

    await login(page, preparer.email, preparer.password);
    await page.goto('/en/inventory/lot-to-lot-reagents');
    await page.getByRole('button', { name: 'Start Lot-to-Lot' }).click();
    await expect(page.getByText(/Form-Hema-022 · RETIC/i)).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '01-start-lot-to-lot-dialog.png'), fullPage: true });

    const dialog = page.getByRole('dialog', { name: 'Start Lot-to-Lot' });
    await dialog.getByText('Current lot #', { exact: true }).locator('..').locator('input').fill(oldLot);
    await dialog.getByText('New lot #', { exact: true }).locator('..').locator('input').fill(newLot);
    await dialog.getByText('Analyzer / Method', { exact: true }).locator('..').getByRole('combobox').click();
    await page.getByRole('option', { name: /ALINITY|Alinity/i }).first().click();
    await page.getByRole('button', { name: 'Create Lot-to-Lot Study' }).click();
    await page.waitForURL(/\/en\/inventory\/lot-to-lot-reagents\/[0-9a-f-]+/i, { timeout: 60_000 });
    const studyUrl = page.url();

    for (const sample of [1, 2, 3]) {
      const card = page.locator('div.rounded-xl.border').filter({
        has: page.getByRole('heading', { name: `Sample ${sample}` }),
      });
      for (const testName of ['RETIC', 'R%']) {
        const row = card.getByRole('row').filter({ hasText: testName });
        await row.locator('td').nth(2).locator('input').fill('100');
        await row.locator('td').nth(3).locator('input').fill('125');
      }
      await card.getByPlaceholder(/SYNTH/i).fill(`SYNTH-${String(sample).padStart(3, '0')}`);
    }

    await page.getByText('Conclusion', { exact: true }).locator('..').locator('textarea').fill(
      'Browser E2E: RETIC and R% within 25% TAE across three samples.',
    );
    await page.getByText('Comments', { exact: true }).locator('..').locator('textarea').fill(
      'Preview E2E comments — identities and interpretations verified.',
    );
    await page.getByRole('button', { name: 'Save Draft' }).click();
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText('Overall: PASS')).toBeVisible({ timeout: 45_000 });
    const workflow = page.locator('main');
    await expect(workflow.getByRole('button', { name: 'Review', exact: true })).toHaveCount(0);
    await expect(workflow.getByRole('button', { name: 'Approve', exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: 'Submit for Review' }).click();
    await expect(page.getByText('Submitted for review')).toBeVisible({ timeout: 45_000 });
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '02-saved-study-pending-review.png'), fullPage: true });

    await page.getByRole('button', { name: 'Logout' }).click();
    await login(page, reviewer.email, reviewer.password);
    await page.goto(studyUrl);
    await page.getByRole('button', { name: 'Review', exact: true }).click();
    await expect(page.getByText('Pending Approval')).toBeVisible({ timeout: 45_000 });
    await expect(page.getByRole('button', { name: 'Approve', exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: 'Logout' }).click();
    await login(page, approver.email, approver.password);
    await page.goto(studyUrl);
    await page.getByRole('button', { name: 'Approve', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Activate New Lot' })).toBeVisible({ timeout: 45_000 });
    await page.getByRole('button', { name: 'Activate New Lot' }).click();
    await expect(page.getByText('New lot activated')).toBeVisible({ timeout: 45_000 });
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '03-approved-activated-study.png'), fullPage: true });

    await page.goto('/en/inventory/lot-in-use');
    await expect(page.getByRole('cell', { name: 'Superseded' }).first()).toBeVisible({ timeout: 45_000 });
    await expect(page.getByRole('row', { name: /RETIC reagent.*Active/i }).first()).toBeVisible();

    await page.goto(studyUrl);
    await expect(page.getByText(newLot)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Activate New Lot' })).toHaveCount(0);

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export PDF' }).click();
    const download = await downloadPromise;
    const pdfPath = path.join(ARTIFACT_DIR, '04-form-hema-022-export.pdf');
    await download.saveAs(pdfPath);
    expect(fs.statSync(pdfPath).size).toBeGreaterThan(500);

    const pdfLatin = fs.readFileSync(pdfPath).toString('latin1');
    expect(pdfLatin).toMatch(/RETIC/);
    expect(pdfLatin).toMatch(/R%/);
    expect(pdfLatin).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    expect(pdfLatin).not.toMatch(/SYNTH-001|SYNTH-002|SYNTH-003/);

    const pngPath = path.join(ARTIFACT_DIR, '04-form-hema-022-export.png');
    try {
      const { execSync } = await import('child_process');
      execSync(`pdftoppm -png -singlefile -f 1 -l 2 "${pdfPath}" "${path.join(ARTIFACT_DIR, '04-form-hema-022-export')}"`, {
        stdio: 'ignore',
      });
      if (fs.existsSync(`${path.join(ARTIFACT_DIR, '04-form-hema-022-export')}.png`)) {
        fs.renameSync(`${path.join(ARTIFACT_DIR, '04-form-hema-022-export')}.png`, pngPath);
      }
    } catch {
      // Optional visual artifact when poppler is unavailable
    }
  });
});
