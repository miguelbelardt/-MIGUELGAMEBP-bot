// =====================================================
// 🌐 API DO PAINEL (site → bot)
// =====================================================
// Login com Discord (OAuth2) e rotas para o site configurar o bot.
// Não precisa de nenhum pacote novo: usa só o que já vem no Node.
//
// Variáveis na FadeHost:
//   DISCORD_CLIENT_SECRET  (Developer Portal → OAuth2)
//   SESSION_SECRET         (texto longo e aleatório)
//   CLIENT_ID              (já existe)
// Opcionais (têm valor padrão):
//   API_URL   endereço público do bot   (https://miguelgamebp-bot.fadehost.app)
//   SITE_URL  endereço do site          (https://miguelbelardt.github.io)
//   SITE_PATH pasta do site             (/-MIGUELGAMEBP-bot/)
//
// No Developer Portal, em OAuth2 → Redirecionamentos, cadastre:
//   <API_URL>/auth/callback
//
// Segurança: quem pode mexer em um servidor é sempre conferido AQUI,
// no bot (dono, Administrador ou Gerenciar Servidor). O site nunca decide.

const crypto = require("crypto");

const { PermissionFlagsBits, ChannelType } = require("discord.js");

const configServidor = require("./configServidor.js");
const painelDaily = require("./painelDaily.js");
const painelMensagens = require("./painelMensagens.js");
const painelTickets = require("./painelTickets.js");
const painelReactRole = require("./painelReactRole.js");
const painelLogs = require("./painelLogs.js");
const painelSorteio = require("./painelSorteio.js");

const API_URL = (process.env.API_URL || "https://miguelgamebp-bot.fadehost.app").replace(/\/+$/, "");
const SITE_URL = (process.env.SITE_URL || "https://miguelbelardt.github.io").replace(/\/+$/, "");
const SITE_PATH = process.env.SITE_PATH || "/-MIGUELGAMEBP-bot/";

const REDIRECT_URI = `${API_URL}/auth/callback`;

const SESSAO_MS = 12 * 60 * 60 * 1000;
const STATE_MS = 10 * 60 * 1000;
const LIMITE_CORPO = 24 * 1024;
const LIMITE_REQ_POR_MIN = 90;

let client = null;

function segredo() {
    return process.env.SESSION_SECRET || "";
}

function ligada() {
    return !!(segredo() && process.env.DISCORD_CLIENT_SECRET && process.env.CLIENT_ID);
}

// =====================================================
// 🔏 TOKENS ASSINADOS (sem guardar nada no servidor)
// =====================================================

function b64(texto) {
    return Buffer.from(texto).toString("base64url");
}

function assinar(dados, validadeMs) {
    const corpo = b64(JSON.stringify({ ...dados, exp: Date.now() + validadeMs }));
    const sig = crypto.createHmac("sha256", segredo()).update(corpo).digest("base64url");

    return `${corpo}.${sig}`;
}

function verificar(token) {
    if (typeof token !== "string" || token.length > 2000) return null;

    const [corpo, sig] = token.split(".");

    if (!corpo || !sig) return null;

    const esperado = crypto.createHmac("sha256", segredo()).update(corpo).digest("base64url");

    const a = Buffer.from(sig);
    const b = Buffer.from(esperado);

    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

    try {
        const dados = JSON.parse(Buffer.from(corpo, "base64url").toString("utf8"));

        if (!dados.exp || dados.exp < Date.now()) return null;

        return dados;
    } catch {
        return null;
    }
}

// =====================================================
// 🧰 UTILIDADES HTTP
// =====================================================

const visitas = new Map();

function limitado(req) {
    const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "?")
        .split(",")[0]
        .trim();

    const agora = Date.now();
    const v = visitas.get(ip);

    if (!v || v.ate < agora) {
        visitas.set(ip, { n: 1, ate: agora + 60 * 1000 });

        return false;
    }

    v.n++;

    return v.n > LIMITE_REQ_POR_MIN;
}

setInterval(() => {
    const agora = Date.now();

    for (const [ip, v] of visitas) if (v.ate < agora) visitas.delete(ip);
}, 5 * 60 * 1000).unref();

function cabecalhosCors(req, res) {
    if (req.headers.origin === SITE_URL) {
        res.setHeader("Access-Control-Allow-Origin", SITE_URL);
        res.setHeader("Vary", "Origin");
        res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        res.setHeader("Access-Control-Max-Age", "600");
    }
}

function json(res, status, dados) {
    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
    });

    res.end(JSON.stringify(dados));
}

function lerCorpo(req) {
    return new Promise((resolve, reject) => {
        let tamanho = 0;
        const partes = [];

        req.on("data", pedaco => {
            tamanho += pedaco.length;

            if (tamanho > LIMITE_CORPO) {
                reject(new Error("grande"));
                req.destroy();

                return;
            }

            partes.push(pedaco);
        });

        req.on("end", () => {
            try {
                resolve(partes.length ? JSON.parse(Buffer.concat(partes).toString("utf8")) : {});
            } catch {
                reject(new Error("json"));
            }
        });

        req.on("error", reject);
    });
}

function usuarioDaRequisicao(req) {
    const auth = String(req.headers.authorization || "");

    if (!auth.startsWith("Bearer ")) return null;

    const dados = verificar(auth.slice(7));

    return dados?.tipo === "sessao" ? dados : null;
}

// =====================================================
// 🔐 PERMISSÃO (sempre conferida pelo bot)
// =====================================================

async function podeGerenciar(guild, userId) {
    if (guild.ownerId === userId) return true;

    const membro = await guild.members.fetch(userId).catch(() => null);

    if (!membro) return false;

    return (
        membro.permissions.has(PermissionFlagsBits.Administrator) ||
        membro.permissions.has(PermissionFlagsBits.ManageGuild)
    );
}

async function guildAutorizada(req, res, guildId) {
    const sessao = usuarioDaRequisicao(req);

    if (!sessao) {
        json(res, 401, { erro: "Faça login de novo." });

        return null;
    }

    if (!/^\d{15,25}$/.test(guildId)) {
        json(res, 404, { erro: "Servidor não encontrado." });

        return null;
    }

    const guild = client?.guilds?.cache?.get(guildId);

    // Mesma resposta nos dois casos: não revela em quais servidores o bot está
    if (!guild || !(await podeGerenciar(guild, sessao.id))) {
        json(res, 403, { erro: "Você não pode configurar esse servidor." });

        return null;
    }

    return guild;
}

// =====================================================
// 🔑 LOGIN COM DISCORD
// =====================================================

function rotaLogin(res) {
    const state = assinar({ tipo: "state", n: crypto.randomBytes(8).toString("hex") }, STATE_MS);

    const url = new URL("https://discord.com/oauth2/authorize");

    url.searchParams.set("client_id", process.env.CLIENT_ID);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", REDIRECT_URI);
    url.searchParams.set("scope", "identify");
    url.searchParams.set("state", state);

    res.writeHead(302, { Location: url.toString() });
    res.end();
}

function voltarAoSite(res, fragmento) {
    res.writeHead(302, { Location: `${SITE_URL}${SITE_PATH}painel.html#${fragmento}` });
    res.end();
}

async function rotaCallback(url, res) {
    const code = url.searchParams.get("code");
    const state = verificar(url.searchParams.get("state"));

    if (!code || state?.tipo !== "state") {
        return voltarAoSite(res, "erro=login");
    }

    try {
        const troca = await fetch("https://discord.com/api/v10/oauth2/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: process.env.CLIENT_ID,
                client_secret: process.env.DISCORD_CLIENT_SECRET,
                grant_type: "authorization_code",
                code,
                redirect_uri: REDIRECT_URI
            })
        });

        if (!troca.ok) throw new Error(`token ${troca.status}`);

        const { access_token: acesso } = await troca.json();

        const resposta = await fetch("https://discord.com/api/v10/users/@me", {
            headers: { Authorization: `Bearer ${acesso}` }
        });

        if (!resposta.ok) throw new Error(`usuario ${resposta.status}`);

        const u = await resposta.json();

        const sessao = assinar(
            {
                tipo: "sessao",
                id: String(u.id),
                nome: u.global_name || u.username,
                avatar: u.avatar || null
            },
            SESSAO_MS
        );

        // No fragmento (#): não vai para logs de servidor
        return voltarAoSite(res, `token=${sessao}`);
    } catch (e) {
        console.error("❌ Painel: falha no login:", e?.message || e);

        return voltarAoSite(res, "erro=login");
    }
}

// =====================================================
// 📡 ROTAS DA API
// =====================================================

function urlIcone(guild) {
    return guild.iconURL?.({ extension: "png", size: 128 }) || null;
}

async function listarServidores(req, res) {
    const sessao = usuarioDaRequisicao(req);

    if (!sessao) return json(res, 401, { erro: "Faça login de novo." });

    const lista = [];

    for (const guild of client.guilds.cache.values()) {
        if (await podeGerenciar(guild, sessao.id)) {
            lista.push({ id: guild.id, nome: guild.name, icone: urlIcone(guild) });
        }
    }

    lista.sort((a, b) => a.nome.localeCompare(b.nome));

    return json(res, 200, { servidores: lista });
}

function ehCanalDeTexto(canal) {
    return canal?.type === ChannelType.GuildText || canal?.type === ChannelType.GuildAnnouncement;
}

function canalValido(guild, id) {
    return ehCanalDeTexto(guild.channels.cache.get(String(id)));
}

function canaisDeTexto(guild) {
    return [...guild.channels.cache.values()]
        .filter(ehCanalDeTexto)
        .sort((a, b) => a.rawPosition - b.rawPosition)
        .map(c => ({ id: c.id, nome: c.name }));
}

async function lerConfig(guild) {
    const config = await configServidor.obter(guild.id);

    return {
        servidor: { id: guild.id, nome: guild.name, icone: urlIcone(guild) },
        opcoes: Object.entries(configServidor.OPCOES).map(([chave, o]) => ({
            chave,
            emoji: o.emoji,
            nome: o.nome,
            descricao: o.descricao,
            valor: !!config[chave]
        })),
        canal_nivel: config.canal_nivel,
        multiplicador_xp: config.multiplicador_xp,
        multiplicadores: [0.5, 1, 1.5, 2, 3],
        canais: canaisDeTexto(guild)
    };
}

async function salvarConfig(guild, corpo) {
    if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) {
        return { erro: "Dados inválidos." };
    }

    const opcoes = configServidor.OPCOES;
    const alteracoes = [];

    for (const [chave, valor] of Object.entries(corpo)) {
        if (opcoes[chave]) {
            if (typeof valor !== "boolean") return { erro: `Valor inválido em "${chave}".` };

            alteracoes.push([chave, valor ? 1 : 0]);
        } else if (chave === "canal_nivel") {
            if (valor !== null) {
                const canal = guild.channels.cache.get(String(valor));

                if (!ehCanalDeTexto(canal)) {
                    return { erro: "Canal inválido." };
                }

                alteracoes.push([chave, canal.id]);
            } else {
                alteracoes.push([chave, null]);
            }
        } else if (chave === "multiplicador_xp") {
            if (![0.5, 1, 1.5, 2, 3].includes(Number(valor))) {
                return { erro: "Multiplicador inválido." };
            }

            alteracoes.push([chave, Number(valor)]);
        } else {
            return { erro: `Opção desconhecida: ${String(chave).slice(0, 40)}` };
        }
    }

    if (!alteracoes.length) return { erro: "Nada para salvar." };

    for (const [coluna, valor] of alteracoes) {
        await configServidor.definir(guild.id, coluna, valor);
    }

    return { ok: true };
}

// =====================================================
// 📚 LISTA DE COMANDOS (pública, lida direto dos comandos do bot)
// =====================================================

let cacheComandos = { dados: null, ate: 0 };

function limparDescricao(texto) {
    return String(texto || "")
        .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]+/gu, "")
        .replace(/\s+/g, " ")
        .trim();
}

function listarComandos() {
    if (cacheComandos.dados && cacheComandos.ate > Date.now()) return cacheComandos.dados;

    const lista = [];

    for (const comando of client.commands?.values?.() || []) {
        try {
            const d = comando.data.toJSON();

            lista.push({
                nome: d.name,
                descricao: limparDescricao(d.description),
                adm: d.default_member_permissions != null
            });
        } catch {
            // comando sem "data": ignora
        }
    }

    lista.sort((a, b) => a.nome.localeCompare(b.nome));

    cacheComandos = { dados: lista, ate: Date.now() + 5 * 60 * 1000 };

    return lista;
}

// =====================================================
// 🚦 ENTRADA: devolve true se a requisição era da API
// =====================================================

function tratar(req, res) {
    let url;

    try {
        url = new URL(req.url, API_URL);
    } catch {
        return false;
    }

    const caminho = url.pathname;

    if (!caminho.startsWith("/auth/") && !caminho.startsWith("/api/")) return false;

    cabecalhosCors(req, res);

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();

        return true;
    }

    if (limitado(req)) {
        json(res, 429, { erro: "Muitas requisições. Espere um pouco." });

        return true;
    }

    // Lista de comandos: pública (não precisa de login)
    if (req.method === "GET" && caminho === "/api/comandos") {
        if (!client) {
            json(res, 503, { erro: "Bot iniciando." });
        } else {
            json(res, 200, { comandos: listarComandos() });
        }

        return true;
    }

    if (!ligada() || !client) {
        json(res, 503, { erro: "Painel ainda não configurado." });

        return true;
    }

    (async () => {
        if (req.method === "GET" && caminho === "/auth/login") return rotaLogin(res);
        if (req.method === "GET" && caminho === "/auth/callback") return rotaCallback(url, res);

        if (req.method === "GET" && caminho === "/api/me") {
            const s = usuarioDaRequisicao(req);

            if (!s) return json(res, 401, { erro: "Faça login de novo." });

            return json(res, 200, { id: s.id, nome: s.nome, avatar: s.avatar });
        }

        if (req.method === "GET" && caminho === "/api/guilds") return listarServidores(req, res);

        if (caminho === "/api/daily" && req.method === "GET") {
            const s = usuarioDaRequisicao(req);

            if (!s) return json(res, 401, { erro: "Faça login de novo." });

            return json(res, 200, await painelDaily.status(s.id));
        }

        if (caminho === "/api/daily/resgatar" && req.method === "POST") {
            const s = usuarioDaRequisicao(req);

            if (!s) return json(res, 401, { erro: "Faça login de novo." });

            if (require("./banbot.js")._banidos.has(s.id)) {
                return json(res, 403, { erro: "Você está proibido de usar o bot." });
            }

            const r = await painelDaily.resgatar(s.id);

            if (!r.sucesso) return json(res, 409, { erro: "Você já pegou o daily de hoje." });

            return json(res, 200, {
                resultado: { recompensa: r.recompensa, sequencia: r.sequencia },
                ...(await painelDaily.status(s.id))
            });
        }

        if (caminho === "/api/daily/notificacao" && req.method === "PUT") {
            const s = usuarioDaRequisicao(req);

            if (!s) return json(res, 401, { erro: "Faça login de novo." });

            const corpo = await lerCorpo(req);
            const r = await painelDaily.definirNotificacao(s.id, corpo?.ativa);

            if (r.erro) return json(res, 400, r);

            return json(res, 200, await painelDaily.status(s.id));
        }

        const m = caminho.match(/^\/api\/guilds\/(\d+)\/config$/);

        if (m && (req.method === "GET" || req.method === "PUT")) {
            const guild = await guildAutorizada(req, res, m[1]);

            if (!guild) return;

            if (req.method === "GET") return json(res, 200, await lerConfig(guild));

            const corpo = await lerCorpo(req);
            const r = await salvarConfig(guild, corpo);

            if (r.erro) return json(res, 400, r);

            return json(res, 200, await lerConfig(guild));
        }

        const msg = caminho.match(/^\/api\/guilds\/(\d+)\/mensagens\/(entrada|saida)$/);

        if (msg && (req.method === "GET" || req.method === "PUT")) {
            const guild = await guildAutorizada(req, res, msg[1]);

            if (!guild) return;

            const tipo = msg[2];

            if (req.method === "PUT") {
                const corpo = await lerCorpo(req);
                const r = await painelMensagens.salvar(guild, tipo, corpo, canalValido);

                if (r.erro) return json(res, 400, r);
            }

            return json(res, 200, {
                ...(await painelMensagens.ler(guild, tipo)),
                canais: canaisDeTexto(guild)
            });
        }

        const tk = caminho.match(/^\/api\/guilds\/(\d+)\/tickets(?:\/(publicar)|\/modelos(?:\/(\d+))?)?$/);

        if (tk) {
            const guild = await guildAutorizada(req, res, tk[1]);

            if (!guild) return;

            const metodo = req.method;
            const ehModelos = caminho.includes("/modelos");
            let r = null;

            if (tk[2] === "publicar") {
                if (metodo !== "POST") return json(res, 405, { erro: "Método não permitido." });

                r = await painelTickets.publicar(guild);
            } else if (ehModelos) {
                if (metodo === "POST" && !tk[3]) r = await painelTickets.criarModelo(guild, await lerCorpo(req));
                else if (metodo === "PUT" && tk[3]) r = await painelTickets.salvarModelo(guild, tk[3], await lerCorpo(req));
                else if (metodo === "DELETE" && tk[3]) r = await painelTickets.apagarModelo(guild, tk[3]);
                else return json(res, 405, { erro: "Método não permitido." });
            } else if (metodo === "PUT") {
                r = await painelTickets.salvarConfig(guild, await lerCorpo(req));
            } else if (metodo !== "GET") {
                return json(res, 405, { erro: "Método não permitido." });
            }

            if (r?.erro) return json(res, 400, r);

            return json(res, 200, { ...(await painelTickets.ler(guild)), resultado: r || undefined });
        }

        const rr = caminho.match(/^\/api\/guilds\/(\d+)\/reactroles(?:\/(\d+))?$/);

        if (rr) {
            const guild = await guildAutorizada(req, res, rr[1]);

            if (!guild) return;

            let r = null;

            if (req.method === "POST" && !rr[2]) r = await painelReactRole.criar(guild, await lerCorpo(req));
            else if (req.method === "PUT" && rr[2]) r = await painelReactRole.salvar(guild, rr[2], await lerCorpo(req));
            else if (req.method === "DELETE" && rr[2]) r = await painelReactRole.apagar(guild, rr[2]);
            else if (req.method !== "GET" || rr[2]) return json(res, 405, { erro: "Método não permitido." });

            if (r?.erro) return json(res, 400, r);

            return json(res, 200, { ...(await painelReactRole.ler(guild)), resultado: r || undefined });
        }

        const lg = caminho.match(/^\/api\/guilds\/(\d+)\/logs$/);

        if (lg) {
            const guild = await guildAutorizada(req, res, lg[1]);

            if (!guild) return;

            if (req.method === "PUT") {
                const r = await painelLogs.salvar(guild, await lerCorpo(req));

                if (r.erro) return json(res, 400, r);
            } else if (req.method !== "GET") {
                return json(res, 405, { erro: "Método não permitido." });
            }

            return json(res, 200, await painelLogs.ler(guild));
        }

        const so = caminho.match(/^\/api\/guilds\/(\d+)\/sorteios(?:\/(\d+)(?:\/(encerrar|sortear))?)?$/);

        if (so) {
            const guild = await guildAutorizada(req, res, so[1]);

            if (!guild) return;

            let r = null;

            if (req.method === "POST" && !so[2]) r = await painelSorteio.criar(guild, await lerCorpo(req), usuarioDaRequisicao(req).id);
            else if (req.method === "PUT" && so[2] && !so[3]) r = await painelSorteio.salvar(guild, so[2], await lerCorpo(req));
            else if (req.method === "POST" && so[2] && so[3] === "encerrar") r = await painelSorteio.encerrar(guild, so[2]);
            else if (req.method === "POST" && so[2] && so[3] === "sortear") r = await painelSorteio.sortearDeNovo(guild, so[2]);
            else if (req.method !== "GET" || so[2]) return json(res, 405, { erro: "Método não permitido." });

            if (r?.erro) return json(res, 400, r);

            return json(res, 200, { ...(await painelSorteio.ler(guild)), resultado: r || undefined });
        }

        return json(res, 404, { erro: "Rota não encontrada." });
    })().catch(e => {
        if (!res.headersSent) {
            json(res, e?.message === "json" || e?.message === "grande" ? 400 : 500, {
                erro: e?.message === "json" ? "JSON inválido." : e?.message === "grande" ? "Dados grandes demais." : "Erro interno."
            });
        }

        if (!["json", "grande"].includes(e?.message)) {
            console.error("❌ Painel:", e?.message || e);
        }
    });

    return true;
}

function iniciar(clienteDiscord) {
    client = clienteDiscord;

    if (!ligada()) {
        console.warn(
            "⚠️ Painel: faltam variáveis (DISCORD_CLIENT_SECRET, SESSION_SECRET ou CLIENT_ID). A API do painel está desligada."
        );

        return;
    }

    console.log(`🌐 Painel pronto. Redirecionamento OAuth2: ${REDIRECT_URI}`);
}

module.exports = { iniciar, tratar, _teste: { assinar, verificar, salvarConfig, lerConfig, podeGerenciar } };
