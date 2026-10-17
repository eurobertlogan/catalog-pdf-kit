#!/usr/bin/env node
/**
 * Build do catálogo.
 *
 *   1. lê data/produtos.csv e data/loja.json e gera data/dados.js
 *   2. gera as imagens que faltam em assets/
 *   3. chama o Chrome headless para imprimir o PDF
 *
 * Modo paginado (padrão): o render empacota as linhas em folhas A4.
 * Modo --single: uma página longa. Aqui o build roda em dois passos, porque a
 * altura da página só existe depois do JS montar o DOM: primeiro lê a altura
 * publicada em <html data-altura>, depois imprime com @page do tamanho certo.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { produtosDeCsv } from "./csv.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(RAIZ, "src");
const SAIDA = join(RAIZ, "out");
// Perfil próprio: sem isso o headless briga com um Chrome já aberto na máquina.
const PERFIL = join(tmpdir(), "catalog-pdf-kit-profile");

const argv = process.argv.slice(2);
const opcao = (nome) => {
  const i = argv.indexOf(`--${nome}`);
  return i === -1 ? null : (argv[i + 1] ?? null);
};

const modoUnico = argv.includes("--single");
const tirarPrints = argv.includes("--shots");
const destino = opcao("out") ?? join(SAIDA, modoUnico ? "catalogo-pagina-unica.pdf" : "catalogo.pdf");

function gerarDados() {
  const produtos = produtosDeCsv(readFileSync(join(RAIZ, "data", "produtos.csv"), "utf8"));
  if (produtos.length === 0) throw new Error("data/produtos.csv não tem nenhum produto");
  const semNome = produtos.filter((p) => !p.nome);
  if (semNome.length > 0) throw new Error(`produto sem nome na linha ${produtos.indexOf(semNome[0]) + 2}`);

  const loja = JSON.parse(readFileSync(join(RAIZ, "data", "loja.json"), "utf8"));
  const conteudo = `/* gerado por scripts/build.mjs a partir de data/produtos.csv: não editar à mão */
window.CATALOGO = ${JSON.stringify({ loja, itens: produtos }, null, 2)};
`;
  writeFileSync(join(RAIZ, "data", "dados.js"), conteudo, "utf8");
  return produtos;
}

function garantirImagens(produtos) {
  const faltando = produtos.filter((p) => p.foto && !existsSync(join(RAIZ, "assets", p.foto)));
  if (faltando.length === 0) return;
  const resultado = spawnSync(process.execPath, [join(RAIZ, "scripts", "gen-images.mjs")], { stdio: "inherit" });
  if (resultado.status !== 0) throw new Error("falha ao gerar as imagens");
}

function acharChrome() {
  const candidatos = [
    opcao("chrome"),
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ].filter(Boolean);

  for (const caminho of candidatos) {
    if (existsSync(caminho)) return caminho;
  }
  throw new Error(
    "Chrome não encontrado. Passe o caminho com --chrome ou defina CHROME_PATH.\n" +
      "Exemplo: npm run build -- --chrome \"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome\"",
  );
}

function rodarChrome(chrome, argumentos) {
  const resultado = spawnSync(chrome, argumentos, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (resultado.status !== 0) {
    throw new Error(`Chrome falhou (código ${resultado.status}):\n${resultado.stderr || resultado.stdout}`);
  }
  return resultado.stdout ?? "";
}

function imprimir(chrome, url, arquivo) {
  mkdirSync(dirname(arquivo), { recursive: true });
  rodarChrome(chrome, [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=${PERFIL}`,
    "--allow-file-access-from-files",
    "--virtual-time-budget=20000",
    "--no-pdf-header-footer",
    `--print-to-pdf=${arquivo}`,
    url,
  ]);
}

/** Conta as páginas lendo a estrutura do PDF, que o Chrome grava sem compressão. */
function contarPaginas(arquivo) {
  const binario = readFileSync(arquivo).toString("latin1");
  const paginas = binario.match(/\/Type\s*\/Page[^s]/g);
  return paginas ? paginas.length : 0;
}

function capturarPaginas(chrome, urlBase, total) {
  mkdirSync(SAIDA, { recursive: true });
  for (let p = 1; p <= total; p++) {
    const arquivo = join(SAIDA, `pagina-${p}.png`);
    rodarChrome(chrome, [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      `--user-data-dir=${PERFIL}-shot`,
      "--force-device-scale-factor=2",
      "--window-size=794,1123",
      "--virtual-time-budget=10000",
      `--screenshot=${arquivo}`,
      `${urlBase}?p=${p}`,
    ]);
  }
  return total;
}

// --- build ---

const produtos = gerarDados();
garantirImagens(produtos);
const chrome = acharChrome();

const url = pathToFileURL(join(SRC, "catalog.html")).href;

if (modoUnico) {
  // Passo 1: descobre a altura real da página montada.
  const dom = rodarChrome(chrome, [
    "--headless=new",
    "--disable-gpu",
    `--user-data-dir=${PERFIL}`,
    "--allow-file-access-from-files",
    "--virtual-time-budget=25000",
    "--dump-dom",
    `${url}?modo=unico`,
  ]);
  const altura = /data-altura="([\d.]+)"/.exec(dom)?.[1];
  if (!altura) throw new Error("a página não publicou data-altura; o render falhou?");

  // Passo 2: imprime com @page do tamanho exato, com 2 mm de folga.
  const alturaPagina = Math.ceil(Number(altura)) + 2;
  const temporario = join(SRC, ".unico.html");
  const html = readFileSync(join(SRC, "catalog.html"), "utf8").replace(
    "<!-- PAGINA -->",
    `<style>@page { size: 210mm ${alturaPagina}mm; margin: 0 }</style>`,
  );
  writeFileSync(temporario, html, "utf8");

  try {
    imprimir(chrome, `${pathToFileURL(temporario).href}?modo=unico`, destino);
  } finally {
    rmSync(temporario, { force: true });
  }

  console.log(`PDF de página única: ${destino} (210 x ${alturaPagina} mm)`);
} else {
  imprimir(chrome, url, destino);
  const total = contarPaginas(destino);
  console.log(`PDF: ${destino} (${total} páginas, ${produtos.length} produtos)`);

  if (tirarPrints) {
    const quantidade = capturarPaginas(chrome, url, total);
    console.log(`${quantidade} PNG(s) em out/ para conferência visual`);
  }
}
