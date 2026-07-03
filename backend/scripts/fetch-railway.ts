async function fetchLedger() {
  try {
    const r = await fetch('https://eranadapi.webziointernational.in/api/inventory/production-stock/c9bcc4eb-5445-4974-8820-da5a801ef12e/ledger');
    console.log(r.status);
    const text = await r.text();
    console.log(text.substring(0, 1000));
  } catch(e) {
    console.error(e);
  }
}
fetchLedger();
