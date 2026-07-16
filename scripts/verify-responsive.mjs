import puppeteer from "puppeteer-core";
const b = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true, args: ["--no-sandbox"],
});
const pages = ["/", "/login", "/register"];
const widths = [320, 390, 430, 768, 1024, 1440];
let bad = 0;
for (const path of pages) {
  for (const w of widths) {
    const p = await b.newPage();
    await p.setViewport({ width: w, height: 900 });
    await p.goto("http://localhost:3000" + path, { waitUntil: "networkidle2" });
    const r = await p.evaluate(() => ({
      vw: document.documentElement.clientWidth,
      sw: document.documentElement.scrollWidth,
    }));
    const over = r.sw - r.vw;
    if (over > 1) bad++;
    console.log(`${over > 1 ? " FAIL " : "  ok  "} ${path.padEnd(10)} @${String(w).padStart(4)}px  ${over > 1 ? `overflows ${over}px` : "no horizontal scroll"}`);
    await p.close();
  }
}
console.log(bad === 0 ? "\nNo page scrolls sideways at any width.\n" : `\n${bad} overflowing.\n`);
await b.close();
process.exit(bad === 0 ? 0 : 1);
