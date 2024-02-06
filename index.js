import { chromium } from 'playwright-chromium';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import fs from 'fs';
import YAML from 'yaml';

dotenv.config();

const configFile = fs.readFileSync('./config.yml', 'utf8');
const config = YAML.parse(configFile);

if (!config.url || !config.office || !config.services) {
  console.log('Please make sure to provide valid config file.');
  process.exit(1);
}

const locale = 'de-DE';
const timeZone = 'Europe/Berlin';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(config.url);

  const heading = await page.$('h1:has-text("Terminvereinbarung")');

  if (!heading) {
    // Some municipalities show a splash notice at the beginning.
    await page.click('button:has-text("Weiter")');
  }

  await page.waitForSelector('#id_buergerauswahldienststelle_tree-office');

  // For some municipalities, the list of offices is initially collapsed
  const expandButton = await page.$(
    `.searchTreeItemChild:has-text('${config.office}') button[title="öffnen"]`
  );

  if (expandButton) {
    await expandButton.click();
  }

  // Select office
  await page.click(
    `.treeItem_searchChild:has-text('${config.office}') button:has-text("Termin vereinbaren")`
  );

  // Select services
  for (const [label, value] of Object.entries(config.services)) {
    await page.selectOption(`text=${label}`, value.toString());
  }

  await page.click('button:has-text("Weiter")');

  // Confirm services
  await page.click('button:has-text("Weiter")');

  // Find available dates
  await page.waitForSelector('.ekolCalendar_Container');
  const available = await page.$$('.ekolCalendar_ButtonDayFreeX');

  if (available.length <= 0) {
    console.log('Exiting as no appointments are available.');
    return await browser.close();
  }

  const availableSlots = Object.fromEntries(
    await Promise.all(
      available.map(async (element) => {
        const id = await element.getAttribute('id');
        const parts = id.split('||');
        const timestamp = parts[parts.length - 1];

        const slotsContainer = await element.$(
          '.ekolCalendar_FreeTimeContainer'
        );
        const slotsCount = parseInt(await slotsContainer.textContent());

        return [timestamp, slotsCount];
      })
    )
  );

  const slotsCount = Object.values(availableSlots).reduce(
    (prev, curr) => prev + curr
  );

  const formatDate = (timestamp) => {
    const date = new Date(parseInt(timestamp));
    return date.toLocaleDateString(locale, { timeZone });
  };

  const dates = Object.keys(availableSlots);
  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];

  const message =
    `Es gibt aktuell ${slotsCount} freie Termine ` +
    `zwischen ${formatDate(firstDate)} und ${formatDate(lastDate)}.`;

  console.log('Sending notification.');
  const res = await fetch('https://api.pushover.net/1/messages.json', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      token: process.env.PUSHOVER_API_TOKEN,
      user: process.env.PUSHOVER_USER_KEY,
      message,
    }),
  });

  await browser.close();
})();
