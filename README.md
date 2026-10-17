# catalog-pdf-kit

Turn a CSV and a folder of images into a print-ready **A4 catalog PDF** using HTML, CSS and the Chrome you already have. No dependencies, no design tool, no build step beyond one command.

```bash
npm run build          # out/catalogo.pdf, paginated
npm run build:single   # out/catalogo-pagina-unica.pdf, one long page
npm run shots          # PNG of every page, for visual review
```

The demo data is fictional: a homeware store called Casa Aurora, with invented products, prices and generated illustrations. Replace the CSV and the images and it is your catalog.

## Requirements

- Node 18 or newer
- Chrome, Chromium or Edge installed (the build looks for the usual paths, or accepts `--chrome <path>` / `CHROME_PATH`)

There is nothing to install: the project has no dependencies.

## Data

`data/produtos.csv` is the source of truth. The first row is the header:

| column | meaning |
|---|---|
| `id` | any identifier, also used to pick the illustration variant |
| `nome` | product name |
| `categoria` | section label shown above the name |
| `descricao` | one or two factual lines |
| `composicao` | material |
| `medida` | size or capacity, free text |
| `preco_vista` | price in BRL, dot as decimal separator (`189.00`) |
| `parcelas` | number of installments, `1` or `0` hides the line |
| `parcela_valor` | installment amount, same number format |
| `cores` | color swatches as hex, separated by `;` |
| `foto` | file name inside `assets/`, or empty for the "photo coming" placeholder |

`data/loja.json` holds the store name, tagline, title, intro, contact and footer text.

Rows with a comma inside a value must be quoted (`"1,8 L de capacidade"`), the same rule as any CSV.

## Images

Put real photos in `assets/` and reference them in the `foto` column. Any format Chrome renders works (JPG, PNG, WebP, SVG).

`npm run images` generates an SVG illustration for every row with a `foto` and no file yet. They are deterministic: same id and colors, same drawing. Delete them as you add real photos.

## How the pagination works

This is the part that makes the kit worth reading. A browser does not know what a page is, so the layout measures itself:

1. Every sheet is a real box of `210mm x 297mm`, and the stylesheet sets `@page { size: A4; margin: 0 }`. Without that, Chrome adds its own margins and each sheet turns into **two** pages.
2. The renderer builds one empty sheet first and reads its content area with `clientWidth` / `clientHeight`. That gives the usable height at runtime, in pixels, for the current fonts and margins.
3. Each card is measured at the exact column width, then rows of two are packed while they fit in the remaining height. The measurement happens in a hidden container, so nothing flashes on screen.
4. Blocks use **padding, not margin**, for vertical rhythm: `getBoundingClientRect()` counts padding and border, but not margin. Measuring with margins gives heights that are too small and rows that overflow.
5. `document.fonts.ready` is awaited before the first measurement. Measuring with a fallback font produces heights that the real font does not honor.
6. When the product count is odd, the last card becomes a full-width feature instead of an orphan in half a column.
7. A closing block fills the end of the last page, and a page that ends with a single block is vertically centered, so the leftover space reads as breathing room instead of a hole.

The single-page mode needs two passes, because the page height only exists after the JavaScript runs:

1. `--dump-dom` renders the page and the renderer publishes its height in `<html data-altura="...">` (millimeters).
2. The build writes a copy of the HTML with `@page { size: 210mm <height>mm }` in place of the `<!-- PAGINA -->` marker and prints that copy.

## Commands

```bash
npm run build                                  # paginated A4
npm run build -- --single --out meu.pdf        # single long page, custom path
npm run build -- --shots                       # also writes out/pagina-N.png
npm run build -- --chrome "/caminho/do/chrome"
```

## Pitfalls this kit already handles

- **`@page` with a zero margin** is mandatory. One missing line doubles every page.
- **`--virtual-time-budget`** is required: without it Chrome prints before the JavaScript builds the pages and the PDF comes out empty or half done.
- **`--allow-file-access-from-files`** lets the page load the local CSS, data and images over `file://`.
- **A page with `overflow: hidden` silently clips** whatever did not fit. The packing keeps a running total for exactly this reason.
- **The lone product on the last page** needs a different composition, not a half column. That is the full-width feature.
- **Chrome caps PDF height at 5080 mm.** A single page longer than that is truncated, so a catalog with many products belongs in the paginated mode.

## Limitations

- Prices are formatted with `Intl.NumberFormat("pt-BR")`. Change the locale in `src/render.js` for another market.
- One product per row pair, no nested sections or index with page numbers.
- No crop marks and no bleed. The PDF is meant for screen sharing and office printers.
- The generated images are illustrations, not photos. A real catalog needs real photography.

## Structure

```
data/produtos.csv     the catalog data
data/loja.json        store name, intro, contact
assets/               product images
src/catalog.html      the page shell
src/estilo.css        print stylesheet and design tokens
src/render.js         cards, measurement and pagination
scripts/csv.mjs       dependency-free CSV reader
scripts/gen-images.mjs placeholder illustrations
scripts/build.mjs     Chrome headless and the two-pass single page
```

## Author

[robertlogan.cc](https://robertlogan.cc)

## License

MIT
