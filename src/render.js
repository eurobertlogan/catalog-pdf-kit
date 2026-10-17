/**
 * Monta o catálogo no DOM.
 *
 * A paginação não é chutada: cada card é medido na largura real da coluna e as
 * linhas são empacotadas na altura útil da página, que também é medida no DOM.
 * Assim, mudar uma fonte, um texto ou uma foto não quebra o layout.
 */
(() => {
  const dados = window.CATALOGO;
  const raiz = document.getElementById("catalogo");
  const medidor = document.getElementById("medidor");

  if (!dados || !Array.isArray(dados.itens) || dados.itens.length === 0) {
    document.body.innerHTML =
      '<p style="font:14px system-ui;padding:24px">Rode <code>npm run build</code> para gerar <code>data/dados.js</code> e as imagens.</p>';
    return;
  }

  const { loja, itens } = dados;
  const params = new URLSearchParams(location.search);
  const modoUnico = params.get("modo") === "unico";
  const paginaAlvo = Number(params.get("p") || 0);

  const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const preco = (valor) => moeda.format(Number(valor));

  const el = (tag, classe, texto) => {
    const no = document.createElement(tag);
    if (classe) no.className = classe;
    if (texto !== undefined) no.textContent = texto;
    return no;
  };

  // 1 mm em px, medido uma vez. Todo cálculo de layout passa por aqui.
  const sonda = el("div");
  sonda.style.cssText = "position:absolute;left:-9999px;top:0;width:100mm;height:1mm";
  document.body.appendChild(sonda);
  const mmPx = sonda.getBoundingClientRect().width / 100;
  sonda.remove();

  function criarCard(item) {
    const card = el("article", "card");

    const foto = el("div", "foto");
    if (item.foto) {
      const img = document.createElement("img");
      img.src = `../assets/${item.foto}`;
      img.alt = "";
      foto.appendChild(img);
    } else {
      foto.classList.add("vazia");
      foto.textContent = "foto em breve";
    }

    const info = el("div", "info");
    info.appendChild(el("span", "categoria", item.categoria));
    info.appendChild(el("h3", "", item.nome));
    if (item.descricao) info.appendChild(el("p", "desc", item.descricao));

    const ficha = el("dl", "ficha");
    for (const [rotulo, valor] of [
      ["Composição", item.composicao],
      ["Medida", item.medida],
    ]) {
      if (!valor) continue;
      const bloco = el("div");
      bloco.appendChild(el("dt", "", rotulo));
      bloco.appendChild(el("dd", "", valor));
      ficha.appendChild(bloco);
    }
    if (ficha.children.length > 0) info.appendChild(ficha);

    const base = el("div", "base");
    const cores = el("div", "cores");
    for (const cor of item.cores || []) {
      const ponto = el("span");
      ponto.style.background = cor;
      cores.appendChild(ponto);
    }
    const precos = el("div", "precos");
    precos.appendChild(el("strong", "", preco(item.precoVista)));
    if (item.parcelas > 1 && item.parcelaValor) {
      precos.appendChild(el("span", "", `${item.parcelas}x de ${preco(item.parcelaValor)}`));
    }
    base.append(cores, precos);
    info.appendChild(base);

    card.append(foto, info);
    return card;
  }

  /** Mede um nó numa largura específica, sem deixar rastro no layout. */
  function medir(no, largura) {
    medidor.style.width = `${largura}px`;
    medidor.appendChild(no);
    const altura = no.getBoundingClientRect().height;
    medidor.removeChild(no);
    return altura;
  }

  function criarFolha() {
    const folha = el("section", "folha");
    const cabecalho = el("header", "cabecalho");
    cabecalho.append(el("span", "", loja.assinatura), el("span", "", loja.nome));

    const conteudo = el("div", "conteudo");

    const rodape = el("footer", "rodape");
    const numero = el("span", "numero");
    rodape.append(el("span", "", loja.rodape), numero);

    folha.append(cabecalho, conteudo, rodape);
    return folha;
  }

  function criarCapa() {
    const folha = el("section", "folha capa");

    const ornamento = el("div", "ornamento");
    ornamento.innerHTML = `
      <svg viewBox="0 0 400 400" aria-hidden="true">
        <circle cx="200" cy="200" r="188" fill="none" stroke="#9c5b3f" stroke-width="1.2"/>
        <circle cx="200" cy="200" r="128" fill="none" stroke="#9c5b3f" stroke-width="1.2"/>
        <path d="M200 12 A188 188 0 0 1 388 200 L200 200 Z" fill="#9c5b3f" opacity="0.08"/>
      </svg>`;

    const meio = el("div");
    meio.appendChild(el("h1", "", loja.titulo));
    meio.appendChild(el("h2", "", loja.assinatura));
    meio.appendChild(el("div", "traco"));

    const fim = el("div", "assinatura");
    fim.append(el("span", "", loja.site), el("span", "ano", "Edição 01"));

    folha.append(el("div", "marca", loja.nome), meio, fim, ornamento);
    return folha;
  }

  function criarAbertura() {
    const folha = el("section", "folha abertura");
    const conteudo = el("div", "conteudo");
    const texto = el("div", "texto");
    texto.appendChild(el("div", "legenda", "Coleção"));
    texto.appendChild(el("p", "", loja.intro));
    texto.appendChild(el("div", "legenda", loja.contato));
    conteudo.appendChild(texto);
    folha.append(conteudo);
    return folha;
  }

  function criarFecho() {
    const fecho = el("div", "fecho");
    const titulo = el("div", "titulo", "Encomendas e atendimento");
    const dados = el("div", "dados");
    dados.append(el("span", "", loja.contato), el("span", "", loja.site));
    fecho.append(titulo, dados);
    return fecho;
  }

  function numerar() {
    const folhas = [...raiz.querySelectorAll(".folha")];
    const inicio = folhas.findIndex((f) => f.classList.contains("abertura"));
    folhas.forEach((folha, indice) => {
      const numero = folha.querySelector(".numero");
      if (!numero) return;
      numero.textContent = String(indice - inicio + 2);
    });
  }

  function montarPaginado() {
    raiz.append(criarCapa(), criarAbertura());

    // A primeira folha interna serve de molde: a área útil é medida nela.
    const molde = criarFolha();
    raiz.appendChild(molde);
    const conteudoMolde = molde.querySelector(".conteudo");
    const larguraUtil = conteudoMolde.clientWidth;
    const alturaUtil = conteudoMolde.clientHeight;
    const vao = 8 * mmPx;
    const larguraColuna = (larguraUtil - vao) / 2;

    const cartoes = itens.map(criarCard);
    const alturas = cartoes.map((card) => medir(card, larguraColuna));

    let conteudoAtual = conteudoMolde;
    let usado = 0;

    for (let i = 0; i < cartoes.length; ) {
      const temPar = i + 1 < cartoes.length;
      let alturaLinha;
      let linha;

      if (temPar) {
        alturaLinha = Math.max(alturas[i], alturas[i + 1]);
        linha = el("div", "linha");
        linha.append(cartoes[i], cartoes[i + 1]);
        i += 2;
      } else {
        const card = cartoes[i];
        card.classList.add("largo");
        alturaLinha = medir(card, larguraUtil);
        linha = el("div", "linha unica");
        linha.append(card);
        i += 1;
      }

      // Só abre página nova se a linha não couber e a página já tiver conteúdo.
      if (usado + alturaLinha > alturaUtil && conteudoAtual.children.length > 0) {
        const nova = criarFolha();
        raiz.appendChild(nova);
        conteudoAtual = nova.querySelector(".conteudo");
        usado = 0;
      }

      conteudoAtual.appendChild(linha);
      usado += alturaLinha + vao;
    }

    // Fecho: ocupa o fim da última página quando há espaço, senão ganha a sua.
    const fecho = criarFecho();
    const alturaFecho = medir(fecho, larguraUtil) + 8 * mmPx;
    let destinoFecho = conteudoAtual;
    if (usado + alturaFecho > alturaUtil && conteudoAtual.children.length > 0) {
      const nova = criarFolha();
      raiz.appendChild(nova);
      destinoFecho = nova.querySelector(".conteudo");
    }

    // Página que termina com um bloco só fica centralizada: o vazio vira respiro.
    if (destinoFecho.children.length === 1) destinoFecho.classList.add("centralizado");
    destinoFecho.appendChild(fecho);

    numerar();
  }

  function montarUnico() {
    const folha = el("section", "folha unica");
    const conteudo = el("div", "conteudo");

    const abertura = el("div", "abertura-unica");
    abertura.appendChild(el("div", "marca", loja.nome));
    abertura.appendChild(el("h1", "", loja.titulo));
    abertura.appendChild(el("h2", "", loja.assinatura));
    abertura.appendChild(el("div", "traco"));
    abertura.appendChild(el("p", "intro", loja.intro));

    const grade = el("div", "grade");
    for (const item of itens) grade.appendChild(criarCard(item));

    conteudo.append(abertura, grade);
    folha.appendChild(conteudo);
    raiz.appendChild(folha);

    const alturaPx = folha.getBoundingClientRect().height;
    document.documentElement.dataset.altura = (alturaPx / mmPx).toFixed(1);
  }

  async function iniciar() {
    await document.fonts.ready;
    if (modoUnico) {
      montarUnico();
    } else {
      montarPaginado();
      if (paginaAlvo > 0) {
        document.body.classList.add("pagina-unica");
        const folhas = [...raiz.querySelectorAll(".folha")];
        const alvo = folhas[paginaAlvo - 1];
        if (alvo) alvo.classList.add("visivel");
      }
    }
    document.documentElement.dataset.pronto = "1";
  }

  iniciar();
})();
