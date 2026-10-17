#!/usr/bin/env node
/**
 * Gera as imagens de exemplo em SVG a partir do CSV.
 *
 * O repositório não usa foto de terceiro: cada peça ganha uma composição
 * geométrica derivada do id e das cores declaradas na planilha. Ao trocar por
 * fotos reais, basta apontar a coluna "foto" para os arquivos em assets/.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { produtosDeCsv } from "./csv.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS = join(RAIZ, "assets");
const forcar = process.argv.includes("--force");

const hexParaRgb = (hex) => {
  const limpo = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(limpo.slice(i, i + 2), 16));
};

const rgbParaHex = ([r, g, b]) =>
  "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

/** Mistura uma cor com branco, para o fundo suave de cada peça. */
const clarear = (hex, quantidade) => {
  const [r, g, b] = hexParaRgb(hex);
  return rgbParaHex([r + (255 - r) * quantidade, g + (255 - g) * quantidade, b + (255 - b) * quantidade]);
};

const escapar = (texto) =>
  String(texto).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Três composições, escolhidas pelo id, para as peças não ficarem iguais. */
function composicao(variante, corA, corB) {
  if (variante === 0) {
    return `
      <circle cx="600" cy="420" r="250" fill="${corA}" opacity="0.45"/>
      <rect x="520" y="300" width="160" height="330" rx="80" fill="${corB}" opacity="0.85"/>`;
  }
  if (variante === 1) {
    return `
      <path d="M400 720 L400 430 A200 200 0 0 1 800 430 L800 720 Z" fill="${corA}" opacity="0.45"/>
      <circle cx="600" cy="520" r="90" fill="${corB}" opacity="0.9"/>`;
  }
  return `
    <rect x="380" y="250" width="440" height="440" rx="40" fill="${corA}" opacity="0.4"
      transform="rotate(-6 600 470)"/>
    <ellipse cx="600" cy="620" rx="220" ry="60" fill="${corB}" opacity="0.85"/>`;
}

function criarSvg(produto) {
  const corA = produto.cores[0] || "#9c5b3f";
  const corB = produto.cores[1] || "#2a2521";
  const variante = Number(produto.id) % 3;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" role="img">
  <rect width="1200" height="900" fill="${clarear(corA, 0.86)}"/>
  ${composicao(variante, corA, corB)}
  <text x="64" y="836" font-family="Georgia, 'Times New Roman', serif" font-size="30"
    fill="#2a2521" opacity="0.45">${escapar(produto.nome)}</text>
</svg>
`;
}

const produtos = produtosDeCsv(readFileSync(join(RAIZ, "data", "produtos.csv"), "utf8"));
mkdirSync(ASSETS, { recursive: true });

let criados = 0;
for (const produto of produtos) {
  if (!produto.foto) continue;
  const destino = join(ASSETS, produto.foto);
  if (existsSync(destino) && !forcar) continue;
  writeFileSync(destino, criarSvg(produto), "utf8");
  criados++;
}

console.log(`${criados} imagem(ns) gerada(s) em assets/ (${produtos.filter((p) => p.foto).length} no total)`);
