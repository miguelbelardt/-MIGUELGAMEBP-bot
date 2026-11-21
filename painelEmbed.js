// =====================================================
// 🧩 EMBEDS NO PAINEL
// =====================================================
// Usa a mesma tabela (embeds_personalizados) e o mesmo visual do antigo /embed.

const { ChannelType } = require("discord.js");

const { mysqlPool } = require("./database/database.js");
const embedCmd = require("./comandos/embed.js");

const E = embedCmd._painel;

const MAX_EMBEDS = 50;

const LIMITES = {
    nome: 100,
    mensagem: 2000,
    titulo: 256,
    descricao: 4096,
    autor: 256,
    rodape: 2048
};

const LINKS = ["titulo_url", "imagem", "thumbnail", "autor_icone", "autor_url", "rodape_icone"];

const CHAVES = [
    "modo", "nome", "mensagem", "titulo", "descricao", "autor", "rodape",
    ...LINKS, "cor", "timestamp", "campos", "botoes", "canal_id"
];

function ehTexto(canal) {
    return canal?.type === ChannelType.GuildText || canal?.type === ChannelType.GuildAnnouncement;
}

function lerV2(l) {
    try {
        const v = JSON.parse(l.v2);

        return v && Array.isArray(v.blocos) ? v : null;
    } catch {
        return null;
    }
}

function linhaParaApi(l) {
    const v2 = l.v2 ? lerV2(l) : null;

    return {
        modo: v2 ? "v2" : "classico",
        v2: v2 ? { cor: v2.cor, spoiler: !!v2.spoiler, blocos: v2.blocos } : null,
        id: String(l.id),
        nome: l.nome || "Embed",
        mensagem: l.mensagem_texto || "",
        titulo: l.titulo || "",
        titulo_url: l.titulo_url || "",
        descricao: l.descricao || "",
        cor: /^#[0-9a-f]{6}$/i.test(l.cor || "") ? l.cor.toUpperCase() : "#5865F2",
        imagem: l.imagem || "",
        thumbnail: l.thumbnail || "",
        autor: l.autor_nome || "",
        autor_icone: l.autor_icone || "",
        autor_url: l.autor_url || "",
        rodape: l.rodape || "",
        rodape_icone: l.rodape_icone || "",
        timestamp: !!l.timestamp,
        campos: E.textoParaCampos(l.campos).map(c => ({ nome: c.name, valor: c.value, inline: c.inline })),
        botoes: E.textoParaBotoes(l.botoes).map(b => ({ texto: b.label, url: b.url, emoji: b.emoji })),
        canal_id: l.canal_id || null,
        enviado: !!(l.canal_id && l.mensagem_id),
        link: l.canal_id && l.mensagem_id ? `https://discord.com/channels/${l.guild_id}/${l.canal_id}/${l.mensagem_id}` : null
    };
}

async function ler(guild) {
    await E.garantirColunasExtras();

    const [linhas] = await mysqlPool.query(
        "SELECT * FROM embeds_personalizados WHERE guild_id = ? ORDER BY id DESC LIMIT ?",
        [guild.id, MAX_EMBEDS + 1]
    );

    return {
        max: MAX_EMBEDS,
        maxCampos: E.MAX_CAMPOS,
        maxBotoes: E.MAX_BOTOES,
        embeds: linhas.slice(0, MAX_EMBEDS).map(linhaParaApi),
        canais: [...guild.channels.cache.values()]
            .filter(ehTexto)
            .sort((a, b) => a.rawPosition - b.rawPosition)
            .map(c => ({ id: c.id, nome: c.name }))
    };
}

// ---------- Componentes V2 ----------

const FLAG_V2 = 1 << 15;
const MAX_BLOCOS = 20;
const MAX_COMPONENTES = 40;
const MAX_TEXTO_V2 = 4000;

function emojiBotao(emoji) {
    const m = /^<(a?):(\w{2,32}):(\d{15,25})>$/.exec(emoji || "");

    if (m) return { id: m[3], name: m[2], animated: m[1] === "a" };

    return emoji ? { name: emoji } : undefined;
}

function botaoLink(b) {
    const o = { type: 2, style: 5, label: b.texto, url: b.url };
    const e = emojiBotao(b.emoji);

    if (e) o.emoji = e;

    return o;
}

// Monta o JSON cru do Discord (funciona em qualquer versão do discord.js)
function montarV2(v2) {
    const filhos = v2.blocos.map(b => {
        if (b.tipo === "texto") return { type: 10, content: b.texto };
        if (b.tipo === "separador") return { type: 14, divider: !!b.linha, spacing: b.grande ? 2 : 1 };

        if (b.tipo === "imagens") {
            return { type: 12, items: b.imagens.map(i => ({ media: { url: i.url }, ...(i.descricao ? { description: i.descricao } : {}) })) };
        }

        if (b.tipo === "secao") {
            return {
                type: 9,
                components: [{ type: 10, content: b.texto }],
                accessory: b.acessorio.tipo === "imagem" ? { type: 11, media: { url: b.acessorio.url } } : botaoLink(b.acessorio)
            };
        }

        return { type: 1, components: b.botoes.map(botaoLink) };
    });

    return [{
        type: 17,
        accent_color: parseInt(v2.cor.slice(1), 16),
        ...(v2.spoiler ? { spoiler: true } : {}),
        components: filhos
    }];
}

function urlCurta(v, nome) {
    if (typeof v !== "string") return { erro: `Link inválido em "${nome}".` };

    const s = v.trim();

    if (!s || s.length > 1000 || !E.validarURL(s)) return { erro: `"${nome}" precisa de um link começando com http:// ou https://` };

    return { v: s };
}

function validarBotaoV2(b) {
    if (!b || typeof b !== "object" || typeof b.texto !== "string") return { erro: "Botão inválido." };

    const texto = b.texto.trim();

    if (!texto || texto.length > 80) return { erro: "O texto de um botão precisa ter de 1 a 80 caracteres." };

    const u = urlCurta(b.url, "Link do botão");

    if (u.erro) return u;

    const emoji = typeof b.emoji === "string" ? b.emoji.trim() : "";

    if (emoji && !E.emojiValido(emoji)) return { erro: "Um dos emojis dos botões é inválido." };

    return { v: { texto, url: u.v, emoji } };
}

function validarV2(guild, corpo) {
    for (const k of Object.keys(corpo)) {
        if (!["modo", "nome", "canal_id", "cor", "spoiler", "blocos"].includes(k)) return { erro: `Opção desconhecida: ${String(k).slice(0, 40)}` };
    }

    const nome = typeof corpo.nome === "string" && corpo.nome.trim() ? corpo.nome.trim() : "Embed";

    if (nome.length > LIMITES.nome) return { erro: `"Nome" passou do limite de ${LIMITES.nome} caracteres.` };

    const cor = typeof corpo.cor === "string" ? corpo.cor.trim() : "#5865F2";

    if (!/^#[0-9a-f]{6}$/i.test(cor)) return { erro: "Cor inválida. Use o formato #RRGGBB." };

    if (corpo.spoiler !== undefined && typeof corpo.spoiler !== "boolean") return { erro: "Opção de spoiler inválida." };

    if (typeof corpo.canal_id !== "string" || !ehTexto(guild.channels.cache.get(corpo.canal_id))) return { erro: "Escolha um canal de texto válido." };

    if (!Array.isArray(corpo.blocos) || !corpo.blocos.length) return { erro: "Adicione pelo menos um bloco." };
    if (corpo.blocos.length > MAX_BLOCOS) return { erro: `O máximo é ${MAX_BLOCOS} blocos.` };

    let textoTotal = 0;
    let componentes = 1; // o container

    const blocos = [];

    for (const b of corpo.blocos) {
        if (!b || typeof b !== "object") return { erro: "Bloco inválido." };

        if (b.tipo === "texto") {
            const texto = typeof b.texto === "string" ? b.texto.trim() : "";

            if (!texto) return { erro: "Há um bloco de texto vazio (preencha ou remova)." };

            textoTotal += texto.length;
            componentes += 1;
            blocos.push({ tipo: "texto", texto });
        } else if (b.tipo === "separador") {
            componentes += 1;
            blocos.push({ tipo: "separador", linha: b.linha !== false, grande: b.grande === true });
        } else if (b.tipo === "imagens") {
            if (!Array.isArray(b.imagens) || !b.imagens.length) return { erro: "Um bloco de imagens está sem imagem." };
            if (b.imagens.length > 10) return { erro: "Cada bloco de imagens aceita no máximo 10 imagens." };

            const imagens = [];

            for (const i of b.imagens) {
                const u = urlCurta(i?.url, "Link da imagem");

                if (u.erro) return u;

                const descricao = typeof i.descricao === "string" ? i.descricao.trim() : "";

                if (descricao.length > 1024) return { erro: "A descrição de uma imagem passou de 1024 caracteres." };

                imagens.push({ url: u.v, descricao });
            }

            componentes += 1;
            blocos.push({ tipo: "imagens", imagens });
        } else if (b.tipo === "secao") {
            const texto = typeof b.texto === "string" ? b.texto.trim() : "";

            if (!texto) return { erro: "Há uma seção sem texto." };

            const a = b.acessorio;

            if (!a || typeof a !== "object") return { erro: "Toda seção precisa de uma imagem ou de um botão ao lado." };

            let acessorio;

            if (a.tipo === "imagem") {
                const u = urlCurta(a.url, "Imagem da seção");

                if (u.erro) return u;

                acessorio = { tipo: "imagem", url: u.v };
            } else if (a.tipo === "botao") {
                const bt = validarBotaoV2(a);

                if (bt.erro) return bt;

                acessorio = { tipo: "botao", ...bt.v };
            } else return { erro: "Acessório de seção inválido." };

            textoTotal += texto.length;
            componentes += 3;
            blocos.push({ tipo: "secao", texto, acessorio });
        } else if (b.tipo === "botoes") {
            if (!Array.isArray(b.botoes) || !b.botoes.length) return { erro: "Há uma linha de botões vazia." };
            if (b.botoes.length > 5) return { erro: "Cada linha aceita no máximo 5 botões." };

            const botoes = [];

            for (const x of b.botoes) {
                const bt = validarBotaoV2(x);

                if (bt.erro) return bt;

                botoes.push(bt.v);
            }

            componentes += 1 + botoes.length;
            blocos.push({ tipo: "botoes", botoes });
        } else return { erro: "Tipo de bloco desconhecido." };
    }

    if (textoTotal > MAX_TEXTO_V2) return { erro: `Os textos passaram do limite de ${MAX_TEXTO_V2} caracteres somados (estão com ${textoTotal}).` };
    if (componentes > MAX_COMPONENTES) return { erro: `Muitos itens: o Discord aceita no máximo ${MAX_COMPONENTES} componentes por mensagem (está com ${componentes}). Remova alguns botões ou blocos.` };

    const v2 = { cor: cor.toUpperCase(), spoiler: corpo.spoiler === true, blocos };

    return { canalId: corpo.canal_id, nome, v2 };
}

// Valida o corpo inteiro. Devolve { erro } ou { cfg, canalId } (clássico) / { v2, canalId } (V2)
function validar(guild, corpo) {
    if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) return { erro: "Dados inválidos." };

    if (corpo.modo === "v2") return validarV2(guild, corpo);

    for (const k of Object.keys(corpo)) {
        if (!CHAVES.includes(k)) return { erro: `Opção desconhecida: ${String(k).slice(0, 40)}` };
    }

    const texto = (k, nomeBonito) => {
        const v = corpo[k] ?? "";

        if (typeof v !== "string") return { erro: `Texto inválido em "${nomeBonito}".` };
        if (v.length > LIMITES[k]) return { erro: `"${nomeBonito}" passou do limite de ${LIMITES[k]} caracteres.` };

        return { v: v.trim() };
    };

    const t = {};

    for (const [k, bonito] of [["nome", "Nome"], ["mensagem", "Texto acima do embed"], ["titulo", "Título"], ["descricao", "Descrição"], ["autor", "Autor"], ["rodape", "Rodapé"]]) {
        const r = texto(k, bonito);

        if (r.erro) return r;

        t[k] = r.v;
    }

    if (!t.nome) t.nome = "Embed";

    const l = {};

    for (const k of LINKS) {
        const v = corpo[k] ?? "";

        if (typeof v !== "string") return { erro: "Link inválido." };

        const s = v.trim();

        if (s.length > 1000) return { erro: "Link grande demais." };
        if (s && !E.validarURL(s)) return { erro: "Os links precisam começar com http:// ou https://" };

        l[k] = s;
    }

    const cor = typeof corpo.cor === "string" ? corpo.cor.trim() : "#5865F2";

    if (!/^#[0-9a-f]{6}$/i.test(cor)) return { erro: "Cor inválida. Use o formato #RRGGBB." };

    if (corpo.timestamp !== undefined && typeof corpo.timestamp !== "boolean") return { erro: "Opção de horário inválida." };

    // ---- campos ----
    const camposIn = corpo.campos ?? [];

    if (!Array.isArray(camposIn)) return { erro: "Campos inválidos." };
    if (camposIn.length > E.MAX_CAMPOS) return { erro: `O máximo é ${E.MAX_CAMPOS} campos.` };

    const campos = [];

    for (const c of camposIn) {
        if (!c || typeof c !== "object" || typeof c.nome !== "string" || typeof c.valor !== "string") return { erro: "Campo inválido." };

        const nome = c.nome.trim();
        const valor = c.valor.trim();

        if (!nome || !valor) return { erro: "Todo campo precisa de nome e valor (ou remova o campo vazio)." };
        if (nome.length > 256) return { erro: "O nome de um campo passou de 256 caracteres." };
        if (valor.length > 1024) return { erro: "O valor de um campo passou de 1024 caracteres." };
        if (/[|\n\r]/.test(nome) || valor.includes("|")) return { erro: "Nos campos não pode usar o caractere | (e o nome não pode ter quebra de linha)." };

        campos.push({ name: nome, value: valor.replace(/\r/g, ""), inline: c.inline === true });
    }

    // ---- botões de link ----
    const botoesIn = corpo.botoes ?? [];

    if (!Array.isArray(botoesIn)) return { erro: "Botões inválidos." };
    if (botoesIn.length > E.MAX_BOTOES) return { erro: `O máximo é ${E.MAX_BOTOES} botões.` };

    const botoes = [];

    for (const b of botoesIn) {
        if (!b || typeof b !== "object" || typeof b.texto !== "string" || typeof b.url !== "string") return { erro: "Botão inválido." };

        const texto = b.texto.trim();
        const url = b.url.trim();
        const emoji = typeof b.emoji === "string" ? b.emoji.trim() : "";

        if (!texto || !url) return { erro: "Todo botão precisa de texto e link (ou remova o botão vazio)." };
        if (texto.length > 80) return { erro: "O texto de um botão passou de 80 caracteres." };
        if (url.length > 512 || url.includes("|") || !E.validarURL(url)) return { erro: "O link de um botão é inválido (precisa começar com http:// ou https://)." };
        if (texto.includes("|") || /[\n\r]/.test(texto)) return { erro: "No texto do botão não pode usar | nem quebra de linha." };
        if (emoji && !E.emojiValido(emoji)) return { erro: "Um dos emojis dos botões é inválido." };

        botoes.push({ label: texto, url, emoji });
    }

    // ---- canal ----
    const canalId = corpo.canal_id;

    if (typeof canalId !== "string" || !ehTexto(guild.channels.cache.get(canalId))) return { erro: "Escolha um canal de texto válido." };

    // ---- conteúdo mínimo e limite total do Discord ----
    if (!t.titulo && !t.descricao && !l.imagem && !l.thumbnail && !t.autor && !t.rodape && !campos.length) {
        return { erro: "Preencha pelo menos um campo do embed (título, descrição, imagem, etc.)." };
    }

    const total = t.titulo.length + t.descricao.length + t.autor.length + t.rodape.length
        + campos.reduce((s, c) => s + c.name.length + c.value.length, 0);

    if (total > 6000) return { erro: `O embed passou do limite de 6000 caracteres do Discord (está com ${total}).` };

    return {
        canalId,
        nome: t.nome,
        cfg: {
            nome: t.nome,
            titulo: t.titulo,
            tituloUrl: l.titulo_url,
            descricao: t.descricao,
            cor,
            imagem: l.imagem,
            thumbnail: l.thumbnail,
            autor: t.autor,
            autorIcone: l.autor_icone,
            autorUrl: l.autor_url,
            footer: t.rodape,
            footerIcone: l.rodape_icone,
            timestamp: corpo.timestamp === true,
            campos: E.camposParaTexto(campos),
            mensagem: t.mensagem,
            botoes: E.botoesParaTexto(botoes)
        }
    };
}

// Envia, edita ou move a mensagem. `conteudo` é { cfg } (clássico) ou { v2 } (Componentes V2).
// Devolve { mensagem } ou { erro }
async function publicar(guild, linhaAntiga, canalId, conteudo, nomeUsuario) {
    const canal = await guild.channels.fetch(canalId).catch(() => null);

    if (!canal || !ehTexto(canal)) return { erro: "O canal escolhido não existe ou não é um canal de texto." };

    const ehV2 = !!conteudo.v2;
    let payload;
    let edicao;

    if (ehV2) {
        payload = { flags: FLAG_V2, components: montarV2(conteudo.v2) };
        edicao = payload;
    } else {
        const cfg = conteudo.cfg;
        const resultado = E.criarEmbed(cfg, nomeUsuario ? { username: nomeUsuario } : null);

        if (!resultado.sucesso) return { erro: "Preencha pelo menos um campo do embed." };

        payload = { content: cfg.mensagem || undefined, embeds: [resultado.embed], components: E.criarComponentesBotoes(cfg) };
        edicao = { ...payload, content: cfg.mensagem || null };
    }

    try {
        let mensagem = null;

        if (linhaAntiga?.canal_id && linhaAntiga?.mensagem_id) {
            const antigo = await guild.channels.fetch(linhaAntiga.canal_id).catch(() => null);

            if (antigo?.isTextBased?.()) mensagem = await antigo.messages.fetch(linhaAntiga.mensagem_id).catch(() => null);
        }

        // mudou de canal ou de tipo (clássico <-> V2): o Discord não deixa converter, então apaga e reenvia
        const eraV2 = !!linhaAntiga?.v2;

        if (mensagem && (mensagem.channel.id !== canal.id || eraV2 !== ehV2)) {
            await mensagem.delete().catch(() => {});
            mensagem = null;
        }

        if (mensagem) {
            await mensagem.edit(edicao);

            return { mensagem, editado: true };
        }

        return { mensagem: await canal.send(payload), editado: false };
    } catch (e) {
        console.error("❌ Painel (embed) ao enviar:", e?.message || e);

        return { erro: ehV2
            ? "Não consegui enviar a mensagem V2. Confira as permissões do bot no canal e se o discord.js do bot é a versão 14.19 ou mais nova."
            : "Não consegui enviar o embed. Confira se o bot pode ver, enviar mensagens e inserir links nesse canal." };
    }
}

async function criar(guild, corpo, usuarioId, nomeUsuario) {
    const v = validar(guild, corpo);

    if (v.erro) return v;

    await E.garantirColunasExtras();

    const [[{ total }]] = await mysqlPool.query(
        "SELECT COUNT(*) AS total FROM embeds_personalizados WHERE guild_id = ?",
        [guild.id]
    );

    if (Number(total) >= MAX_EMBEDS) return { erro: `Limite de ${MAX_EMBEDS} embeds por servidor. Apague algum antes.` };

    const env = await publicar(guild, null, v.canalId, v, nomeUsuario);

    if (env.erro) return env;

    const c = v.cfg || {};
    const v2 = v.v2 ? JSON.stringify(v.v2) : null;
    const nome = v.v2 ? v.nome : c.nome;
    const cor = v.v2 ? v.v2.cor : c.cor;
    const agora = Date.now();

    try {
        const [r] = await mysqlPool.query(
            `INSERT INTO embeds_personalizados
                (guild_id, nome, autor_nome, autor_icone, titulo, descricao, cor, imagem, thumbnail,
                 rodape, rodape_icone, timestamp, canal_id, mensagem_id, criado_por, criado_em, atualizado_em,
                 titulo_url, autor_url, campos, mensagem_texto, botoes, v2)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                guild.id, nome, c.autor || null, c.autorIcone || null, c.titulo || null, c.descricao || null,
                cor, c.imagem || null, c.thumbnail || null, c.footer || null, c.footerIcone || null,
                c.timestamp ? 1 : 0, env.mensagem.channel.id, env.mensagem.id, usuarioId || null, agora, agora,
                c.tituloUrl || null, c.autorUrl || null, c.campos || null, c.mensagem || null, c.botoes || null, v2
            ]
        );

        return { ok: true, id: String(r.insertId) };
    } catch (e) {
        await env.mensagem.delete().catch(() => {});
        console.error("❌ Painel (embed):", e?.message || e);

        return { erro: "Não consegui salvar o embed no banco." };
    }
}

async function carregar(guild, id) {
    if (!/^\d{1,20}$/.test(String(id))) return null;

    await E.garantirColunasExtras();

    const [linhas] = await mysqlPool.query(
        "SELECT * FROM embeds_personalizados WHERE id = ? AND guild_id = ?",
        [id, guild.id]
    );

    return linhas[0] || null;
}

async function salvar(guild, id, corpo, nomeUsuario) {
    const antiga = await carregar(guild, id);

    if (!antiga) return { erro: "Embed não encontrado." };

    const v = validar(guild, corpo);

    if (v.erro) return v;

    const env = await publicar(guild, antiga, v.canalId, v, nomeUsuario);

    if (env.erro) return env;

    const c = v.cfg || {};
    const v2 = v.v2 ? JSON.stringify(v.v2) : null;
    const nome = v.v2 ? v.nome : c.nome;
    const cor = v.v2 ? v.v2.cor : c.cor;

    await mysqlPool.query(
        `UPDATE embeds_personalizados SET
            nome = ?, autor_nome = ?, autor_icone = ?, titulo = ?, descricao = ?, cor = ?, imagem = ?, thumbnail = ?,
            rodape = ?, rodape_icone = ?, timestamp = ?, canal_id = ?, mensagem_id = ?, atualizado_em = ?,
            titulo_url = ?, autor_url = ?, campos = ?, mensagem_texto = ?, botoes = ?, v2 = ?
         WHERE id = ? AND guild_id = ?`,
        [
            nome, c.autor || null, c.autorIcone || null, c.titulo || null, c.descricao || null, cor,
            c.imagem || null, c.thumbnail || null, c.footer || null, c.footerIcone || null, c.timestamp ? 1 : 0,
            env.mensagem.channel.id, env.mensagem.id, Date.now(),
            c.tituloUrl || null, c.autorUrl || null, c.campos || null, c.mensagem || null, c.botoes || null, v2,
            id, guild.id
        ]
    );

    return { ok: true, id: String(id), editado: env.editado };
}

async function excluir(guild, id) {
    const linha = await carregar(guild, id);

    if (!linha) return { erro: "Embed não encontrado." };

    if (linha.canal_id && linha.mensagem_id) {
        const canal = await guild.channels.fetch(linha.canal_id).catch(() => null);

        if (canal?.isTextBased?.()) {
            const m = await canal.messages.fetch(linha.mensagem_id).catch(() => null);

            if (m) await m.delete().catch(() => {});
        }
    }

    await mysqlPool.query("DELETE FROM embeds_personalizados WHERE id = ? AND guild_id = ?", [id, guild.id]);

    return { ok: true };
}

module.exports = { ler, criar, salvar, excluir, _teste: { validar, linhaParaApi, montarV2 } };
