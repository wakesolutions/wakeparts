// Capturas reales del sandbox (/dev, datos de ejemplo) para la vitrina de la landing.
//
//   npm run dev                      (en otra terminal)
//   npm run capturas                 → public/capturas/*.webp
//   npm run capturas -- reporte      → solo una (mostrador, factura, reporte, compatibilidad, celular,
//                                      sitio, catalogo, avisos)
//
// Variables: BASE_URL (defecto http://localhost:3000) y CHROME_PATH (Chrome o Edge instalado;
// playwright-core no descarga navegadores).
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SOLO = process.argv[2];
const SALIDA = path.resolve(".capturas-tmp");
const PUBLICO = path.resolve("public/capturas");
fs.mkdirSync(SALIDA, { recursive: true });
fs.mkdirSync(PUBLICO, { recursive: true });

const RUTAS_CHROME = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
].filter(Boolean);
const executablePath = RUTAS_CHROME.find((r) => fs.existsSync(r));
if (!executablePath) throw new Error("No encontré Chrome ni Edge. Definí CHROME_PATH.");

const navegador = await chromium.launch({ executablePath, headless: true });

async function contexto({ ancho = 1440, alto = 900, movil = false } = {}) {
  const ctx = await navegador.newContext({
    viewport: { width: ancho, height: alto },
    deviceScaleFactor: 2,
    colorScheme: "dark",
    reducedMotion: "reduce",
    isMobile: movil,
    hasTouch: movil,
    locale: "es-HN",
    timezoneId: "America/Tegucigalpa",
  });
  // Sin recorrido guiado.
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("wp:recorrido:00000000-0000-0000-0000-000000000000", "visto");
      // El aviso de cookies tapa el dock: como un visitante que ya lo leyó.
      localStorage.setItem("wp:aviso-cookies", new Date().toISOString());
    } catch {}
  });
  return ctx;
}

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

async function escritorio(pagina) {
  await pagina.goto(`${BASE}/dev/escritorio`, { waitUntil: "networkidle" });
  await pagina.waitForSelector('[data-dock="cotizar"]');
  // Sin el indicador de desarrollo de Next.
  await pagina.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  await pausa(600);
}

async function terminarAnimaciones(pagina) {
  await pagina.evaluate(() => document.getAnimations().forEach((a) => { try { a.finish(); } catch {} }));
  await pausa(250);
}

async function armarMostrador(pagina) {
  await pagina.click('[data-dock="cotizar"]');
  await pagina.waitForSelector('[data-recorrido="vehiculo"]');
  await terminarAnimaciones(pagina);
  // El carrito demo ya trae TOYOTA COROLLA 2005. Productos:
  const buscador = pagina.locator('input[aria-label="Buscar productos"]');
  for (const t of ["pastiyas", "filtro aceite", "aceite 20w50", "candelas"]) {
    await buscador.fill(t);
    await pausa(1200);
    await buscador.press("Enter");
    await pausa(700);
  }
  await buscador.fill("frenos");
  await pausa(1400);
  await terminarAnimaciones(pagina);
}

const capturas = {
  async mostrador() {
    const ctx = await contexto();
    const p = await ctx.newPage();
    await escritorio(p);
    await armarMostrador(p);
    await p.screenshot({ path: `${SALIDA}/mostrador.png` });
    await ctx.close();
  },
  async factura() {
    const ctx = await contexto();
    const p = await ctx.newPage();
    await escritorio(p);
    await armarMostrador(p);
    await p.keyboard.press("F9");
    await pausa(700);
    const si = p.getByRole("button", { name: /Sí, facturar/ });
    await si.click();
    await pausa(1500);
    await terminarAnimaciones(p);
    await p.screenshot({ path: `${SALIDA}/factura.png` });
    // La factura impresa (el sandbox la guarda en localStorage).
    const href = await p.getByRole("link", { name: /Imprimir/ }).getAttribute("href");
    await p.setViewportSize({ width: 1100, height: 1400 });
    await p.goto(`${BASE}${href}`, { waitUntil: "networkidle" });
    await p.addStyleTag({ content: "nextjs-portal{display:none!important}" });
    await pausa(1200);
    await p.locator("article, [class*=hoja], [class*=documento]").first().screenshot({ path: `${SALIDA}/documento.png` });
    await ctx.close();
  },
  async reporte() {
    const ctx = await contexto();
    const p = await ctx.newPage();
    await escritorio(p);
    await p.click('[data-dock="ventas"]');
    await pausa(1200);
    await p.getByRole("button", { name: /Reporte de ventas/ }).click();
    await pausa(2200);
    await terminarAnimaciones(p);
    await p.screenshot({ path: `${SALIDA}/reporte.png` });
    await ctx.close();
  },
  async compatibilidad() {
    const ctx = await contexto({ ancho: 1200, alto: 760 });
    const p = await ctx.newPage();
    await p.goto(`${BASE}/dev/piezas`, { waitUntil: "networkidle" });
    await pausa(2500);
    const ir = p.locator('input[placeholder^="Ir a un vehículo"]');
    await ir.fill("corolla 05");
    await pausa(1800);
    await ir.press("Enter");
    await pausa(2500);
    await terminarAnimaciones(p);
    await p.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  const panel = p.locator("main > div").last();
    await panel.screenshot({ path: `${SALIDA}/compatibilidad.png` });
    await ctx.close();
  },
  async sitio() {
    const ctx = await contexto();
    const p = await ctx.newPage();
    await p.goto(`${BASE}/t/demo`, { waitUntil: "networkidle" });
    await p.addStyleTag({ content: "nextjs-portal{display:none!important}" });
    await pausa(1500);
    await terminarAnimaciones(p);
    await p.screenshot({ path: `${SALIDA}/sitio.png` });
    await ctx.close();
  },
  async catalogo() {
    const ctx = await contexto();
    const p = await ctx.newPage();
    // Toyota Corolla 2005 (ids del catálogo real).
    await p.goto(`${BASE}/t/demo/catalogo?marca=75&modelo=771&anio=7929`, { waitUntil: "networkidle" });
    await p.addStyleTag({ content: "nextjs-portal{display:none!important}" });
    await pausa(2500);
    await terminarAnimaciones(p);
    await p.screenshot({ path: `${SALIDA}/catalogo.png` });
    await ctx.close();
  },
  async avisos() {
    const ctx = await contexto();
    const p = await ctx.newPage();
    await escritorio(p);
    for (let i = 0; i < 2; i++) {
      await p.getByRole("button", { name: "Simular pedido web" }).click();
      await pausa(900);
    }
    // Sin el aviso emergente ni el botón del sandbox: solo la campanita abierta.
    await p.addStyleTag({ content: "[aria-live=polite]>*{display:none!important} main{visibility:hidden}" });
    await p.evaluate(() =>
      [...document.querySelectorAll("button")].find((b) => b.textContent === "Simular pedido web")?.parentElement?.remove(),
    );
    await p.locator('[aria-label^="Notificaciones"]').click();
    await pausa(800);
    await terminarAnimaciones(p);
    await p.screenshot({ path: `${SALIDA}/avisos.png` });
    await ctx.close();
  },
  async celular() {
    const ctx = await contexto({ ancho: 390, alto: 844, movil: true });
    const p = await ctx.newPage();
    await escritorio(p);
    await armarMostrador(p);
    await p.screenshot({ path: `${SALIDA}/celular.png`, clip: { x: 0, y: 0, width: 390, height: 752 } });
    await ctx.close();
  },
};

for (const [nombre, fn] of Object.entries(capturas)) {
  if (SOLO && SOLO !== nombre) continue;
  try {
    await fn();
    console.log("ok", nombre);
  } catch (e) {
    console.log("FALLO", nombre, e.message.split("\n")[0]);
  }
}
await navegador.close();

// PNG a WebP livianos en public/capturas (ancho en px).
const ANCHOS = {
  mostrador: 1920,
  reporte: 1920,
  documento: 1200,
  compatibilidad: 1600,
  celular: 780,
  sitio: 1920,
  catalogo: 1920,
  avisos: 1920,
};
for (const [nombre, ancho] of Object.entries(ANCHOS)) {
  const origen = path.join(SALIDA, `${nombre}.png`);
  if (!fs.existsSync(origen)) continue;
  const info = await sharp(origen).resize({ width: ancho }).webp({ quality: 82, effort: 6 }).toFile(path.join(PUBLICO, `${nombre}.webp`));
  console.log("webp", nombre, `${info.width}x${info.height}`, `${Math.round(info.size / 1024)} KB`);
}
fs.rmSync(SALIDA, { recursive: true, force: true });
