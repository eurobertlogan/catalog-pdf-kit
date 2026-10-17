# catalog-pdf-kit

Transforma uma planilha CSV e uma pasta de imagens em um **catálogo em PDF A4** pronto para imprimir, usando HTML, CSS e o Chrome que você já tem. Sem dependências, sem ferramenta de design, sem etapa de build além de um comando.

```bash
npm run build          # out/catalogo.pdf, paginado
npm run build:single   # out/catalogo-pagina-unica.pdf, página longa
npm run shots          # PNG de cada página, para conferência visual
```

Os dados de exemplo são fictícios: uma loja de utensílios chamada Casa Aurora, com produtos, preços e ilustrações inventados. Troque o CSV e as imagens e o catálogo é o seu.

## Requisitos

- Node 18 ou mais novo
- Chrome, Chromium ou Edge instalado (o build procura nos caminhos usuais, ou aceita `--chrome <caminho>` / `CHROME_PATH`)

Não há nada para instalar: o projeto não tem dependências.

## Dados

`data/produtos.csv` é a fonte da verdade. A primeira linha é o cabeçalho:

| coluna | significado |
|---|---|
| `id` | identificador livre, também escolhe a variante da ilustração |
| `nome` | nome do produto |
| `categoria` | rótulo da seção, aparece acima do nome |
| `descricao` | uma ou duas linhas factuais |
| `composicao` | material |
| `medida` | tamanho ou capacidade, texto livre |
| `preco_vista` | preço em reais, ponto como separador decimal (`189.00`) |
| `parcelas` | número de parcelas, `1` ou `0` esconde a linha |
| `parcela_valor` | valor da parcela, mesmo formato |
| `cores` | amostras de cor em hexadecimal, separadas por `;` |
| `foto` | nome do arquivo dentro de `assets/`, ou vazio para o aviso de foto pendente |

`data/loja.json` guarda nome da loja, assinatura, título, introdução, contato e texto do rodapé.

Campos com vírgula dentro precisam de aspas (`"1,8 L de capacidade"`), a mesma regra de qualquer CSV.

## Imagens

Coloque fotos reais em `assets/` e referencie na coluna `foto`. Qualquer formato que o Chrome renderize serve (JPG, PNG, WebP, SVG).

`npm run images` gera uma ilustração SVG para cada linha que tem `foto` e ainda não tem arquivo. A geração é determinística: mesmo id e mesmas cores, mesmo desenho. Apague conforme for colocando as fotos reais.

## Como a paginação funciona

É a parte que justifica o projeto. O navegador não sabe o que é uma página, então o layout se mede:

1. Cada folha é uma caixa real de `210mm x 297mm`, e o CSS declara `@page { size: A4; margin: 0 }`. Sem isso o Chrome aplica a margem dele e cada folha vira **duas** páginas.
2. O render monta uma folha vazia primeiro e lê a área útil com `clientWidth` e `clientHeight`. Isso dá a altura disponível em pixels, para as fontes e margens daquele momento.
3. Cada card é medido na largura exata da coluna, e as linhas de dois são empacotadas enquanto couberem na altura restante. A medição acontece num contêiner invisível, então nada pisca na tela.
4. Os blocos usam **padding, não margin**, para o ritmo vertical: `getBoundingClientRect()` conta padding e borda, mas não conta margin. Medir com margem devolve altura menor e a linha estoura.
5. `document.fonts.ready` é aguardado antes da primeira medição. Medir com a fonte de fallback gera alturas que a fonte real não respeita.
6. Quando o número de produtos é ímpar, o último card vira destaque de largura total em vez de sobrar sozinho em meia coluna.
7. Um bloco de fechamento ocupa o fim da última página, e a página que termina com um bloco só é centralizada, para o espaço restante parecer respiro e não buraco.

O modo página única precisa de dois passos, porque a altura só existe depois que o JavaScript roda:

1. `--dump-dom` renderiza a página e o render publica a altura em `<html data-altura="...">` (milímetros).
2. O build grava uma cópia do HTML com `@page { size: 210mm <altura>mm }` no lugar do marcador `<!-- PAGINA -->` e imprime essa cópia.

## Comandos

```bash
npm run build                                  # A4 paginado
npm run build -- --single --out meu.pdf        # página única, caminho próprio
npm run build -- --shots                       # grava também out/pagina-N.png
npm run build -- --chrome "/caminho/do/chrome"
```

## Armadilhas que o kit já resolve

- **`@page` com margem zero** é obrigatório. Uma linha faltando dobra todas as páginas.
- **`--virtual-time-budget`** é necessário: sem ele o Chrome imprime antes do JavaScript montar as páginas e o PDF sai vazio ou pela metade.
- **`--allow-file-access-from-files`** deixa a página carregar CSS, dados e imagens locais por `file://`.
- **Folha com `overflow: hidden` corta em silêncio** o que não coube. O empacotamento mantém a soma corrente justamente por isso.
- **O produto sozinho na última página** pede outra composição, não meia coluna. É o destaque de largura total.
- **O Chrome limita a altura do PDF a 5080 mm.** Uma página única maior que isso é truncada, então catálogo com muitos produtos pertence ao modo paginado.

## Limitações

- Os preços são formatados com `Intl.NumberFormat("pt-BR")`. Troque o locale em `src/render.js` para outro mercado.
- Um produto por par de colunas, sem seções aninhadas nem índice com número de página.
- Sem marcas de corte e sem sangria. O PDF é para envio e impressão de escritório.
- As imagens geradas são ilustrações, não fotos. Catálogo de verdade pede fotografia de verdade.

## Estrutura

```
data/produtos.csv     os dados do catálogo
data/loja.json        nome da loja, introdução, contato
assets/               imagens dos produtos
src/catalog.html      o esqueleto da página
src/estilo.css        CSS de impressão e tokens de design
src/render.js         cards, medição e paginação
scripts/csv.mjs       leitor de CSV sem dependências
scripts/gen-images.mjs ilustrações de exemplo
scripts/build.mjs     Chrome headless e o passo duplo da página única
```

## Autor

[robertlogan.cc](https://robertlogan.cc)

## Licença

MIT
