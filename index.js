import { chromium } from 'playwright';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const url = 'https://egov.potsdam.de/tnv/';
const office = 'Bürgerservicecenter';

const services = {
  'Beantragung eines Personalausweises': 1,
  'Beantragung eines Reisepasses': 1,
};

// const url = 'https://ekol.memmingen.de/tnv/bgr';
// const office = 'Amt 35 Einwohnermelde- und Passamt';

// const services = {
//   'Beantragung von Personalausweis und/oder Reisepass': 1,
// };

const locale = 'de-DE';
const timeZone = 'Europe/Berlin';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url);

  const heading = await page.$('h3:has-text("neuen Termin vereinbaren")');

  if (!heading) {
    // Some municipalities show a splash notice at the beginning.
    await page.click('button:has-text("Weiter")');
  }

  await page.waitForSelector('#id_buergerauswahldienststelle_tree-office');

  // For some municipalities, the list of offices is initially collapsed
  const expandButton = await page.$(
    `.searchTreeItemChild:has-text('${office}') button[title="öffnen"]`
  );

  if (expandButton) {
    await expandButton.click();
  }

  // Select office
  await page.click(
    `.searchTreeItemChild:has-text('${office}') button:has-text("Termin vereinbaren")`
  );

  // Select services
  for (const [label, value] of Object.entries(services)) {
    await page.selectOption(`text=${label}`, value.toString());
  }

  await page.click('button:has-text("Weiter")');

  // Confirm services
  await page.click('button:has-text("Weiter")');

  // Find available dates
  await page.waitForSelector('.ekolCalendarContainer');
  const available = await page.$$('.eKOLCalendarButtonDayFreeX');

  if (available.length <= 0) {
    return await browser.close();
  }

  const availableSlots = Object.fromEntries(
    await Promise.all(
      available.map(async (element) => {
        const id = await element.getAttribute('id');
        const parts = id.split('||');
        const timestamp = parts[parts.length - 1];

        const slotsContainer = await element.$(
          '.ekolCalendarFreeTimeContainer'
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
