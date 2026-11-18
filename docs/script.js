// =====================================================
// ⚙️ CONFIGURAÇÃO — só isto precisa ser preenchido
// =====================================================
// ID do bot (Discord Developer Portal → seu app → General Information → Application ID)
const CLIENT_ID = "1367651687636144169";

// Permissão pedida no convite (8 = Administrador)
const PERMISSOES = "8";

// =====================================================

const conviteOk = /^\d{15,25}$/.test(CLIENT_ID);
const urlConvite =
  `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&permissions=${PERMISSOES}&scope=bot%20applications.commands`;

document.querySelectorAll("[data-convite]").forEach(a => {
  if (conviteOk) {
    a.href = urlConvite;
    a.target = "_blank";
    a.rel = "noopener";
  } else {
    a.setAttribute("aria-disabled", "true");
    a.title = "Falta colocar o CLIENT_ID no script.js";
    a.addEventListener("click", e => e.preventDefault());
  }
});

// A lista de comandos é lida do bot (API vem do auth.js), sempre atualizada.
// Se o bot estiver fora do ar, o site usa a lista salva em comandos.js.
let categorias = window.CATEGORIAS || [];
const abas = document.getElementById("abas");
const lista = document.getElementById("lista");
const vazio = document.getElementById("vazio");
const busca = document.getElementById("busca");
const soLivres = document.getElementById("so-livres");

function atualizarNumeros() {
  const total = categorias.reduce((s, c) => s + c.comandos.length, 0);
  document.getElementById("n-comandos").textContent = total;
  document.getElementById("n-categorias").textContent = categorias.length;
}

atualizarNumeros();

let atual = "todos";

function criarAba(id, texto) {
  const b = document.createElement("button");
  b.className = "aba";
  b.type = "button";
  b.role = "tab";
  b.dataset.id = id;
  b.textContent = texto;
  b.addEventListener("click", () => { atual = id; desenhar(); });
  abas.appendChild(b);
}

function montarAbas() {
  abas.replaceChildren();
  criarAba("todos", "Todos");
  categorias.forEach((c, i) => criarAba(String(i), `${c.icone} ${c.nome}`));
}

montarAbas();

function normalizar(t) {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function desenhar() {
  abas.querySelectorAll(".aba").forEach(b =>
    b.setAttribute("aria-selected", String(b.dataset.id === atual)));

  const termo = normalizar(busca.value.trim());
  lista.replaceChildren();
  let achou = 0;

  categorias.forEach((c, i) => {
    if (atual !== "todos" && atual !== String(i)) return;

    c.comandos.forEach(([nome, desc, adm]) => {
      if (soLivres.checked && adm) return;
      if (termo && !normalizar(`${nome} ${desc}`).includes(termo)) return;

      const el = document.createElement("button");
      el.type = "button";
      el.className = "cmd";
      el.title = "Clique para copiar";

      const b = document.createElement("b");
      b.textContent = "/" + nome;
      if (adm) {
        const e = document.createElement("small");
        e.className = "etiqueta";
        e.textContent = "ADM";
        b.appendChild(e);
      }

      const s = document.createElement("span");
      s.textContent = desc;

      el.append(b, s);
      el.addEventListener("click", () => {
        navigator.clipboard?.writeText("/" + nome).then(() => {
          el.classList.add("copiado");
          setTimeout(() => el.classList.remove("copiado"), 900);
        }).catch(() => {});
      });

      lista.appendChild(el);
      achou++;
    });
  });

  vazio.hidden = achou > 0;
}

busca.addEventListener("input", desenhar);
soLivres.addEventListener("change", desenhar);
desenhar();

// Junta a lista real do bot com as categorias do comandos.js:
// o nome, a descrição e o "ADM" vêm do bot; comando novo cai em "Outros".
function mesclar(base, doBot) {
  const porNome = new Map(doBot.map(c => [c.nome, c]));
  const usados = new Set();

  const resultado = base
    .map(cat => ({
      icone: cat.icone,
      nome: cat.nome,
      comandos: cat.comandos
        .filter(([nome]) => porNome.has(nome))
        .map(([nome]) => {
          const c = porNome.get(nome);
          usados.add(nome);
          return [nome, c.descricao, c.adm ? 1 : 0];
        })
    }))
    .filter(cat => cat.comandos.length);

  const novos = doBot
    .filter(c => !usados.has(c.nome))
    .map(c => [c.nome, c.descricao, c.adm ? 1 : 0]);

  if (novos.length) resultado.push({ icone: "✨", nome: "Outros", comandos: novos });

  return resultado;
}

fetch(API + "/api/comandos")
  .then(r => (r.ok ? r.json() : null))
  .then(dados => {
    if (!dados?.comandos?.length) return;

    categorias = mesclar(window.CATEGORIAS || [], dados.comandos);
    if (atual !== "todos" && !categorias[Number(atual)]) atual = "todos";
    atualizarNumeros();
    montarAbas();
    desenhar();
  })
  .catch(() => { /* fica com a lista do comandos.js */ });
