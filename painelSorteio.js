// =====================================================
// 🎉 SORTEIOS NO PAINEL
// =====================================================
// Usa as mesmas tabelas e funções do sorteio (sorteios e sorteio_participantes),
// então a mensagem, o botão de participar e o encerramento automático são os mesmos.

const { ChannelType, PermissionFlagsBits } = require("discord.js");

const { mysqlPool } = require("./database/database.js");
const sorteio = require("./comandos/sorteio.js");

const TEXTOS = {
    titulo: { max: 256, obrigatorio: true, nome: "título" },
    descricao: { max: 4000, obrigatorio: true, nome: "descrição" },
    premio: { max: 1024 },
    autor_nome: { max: 256 },
    rodape: { max: 2048 }
};

const LINKS = ["imagem", "thumbnail", "autor_icone", "rodape_icone"];

function ehTexto(canal) {
    return canal?.type === ChannelType.GuildText || canal?.type === ChannelType.GuildAnnouncement;
}

function linkValido(valor) {
    if (valor === "") return true;
    if (valor.length > 1000) return false;

    try {
        const u = new URL(valor);

        return u.protocol === "https:" || u.protocol === "http:";
    } catch {
        return false;
    }
}

function descrever(s, inscritos) {
    const { data, horario } = sorteio._painel.formatarData(s.encerra_em);

    return {
        id: String(s.id),
        canal_id: s.canal_id,
        mensagem_id: s.mensagem_id || null,
        titulo: s.titulo || "",
        descricao: s.descricao || "",
        cor: /^[0-9a-f]{6}$/i.test(s.cor || "") ? "#" + s.cor.toUpperCase() : "#5865F2",
        imagem: s.imagem || "",
        thumbnail: s.thumbnail || "",
        autor_nome: s.autor_nome || "",
        autor_icone: s.autor_icone || "",
        rodape: s.rodape || "",
        rodape_icone: s.rodape_icone || "",
        premio: s.premio || "",
        vencedores: Number(s.vencedores) || 1,
        mostrar_participantes: !!Number(s.mostrar_participantes),
        data,
        horario,
        encerra_em: Number(s.encerra_em),
        encerrado: !!Number(s.encerrado),
        vencedores_ids: sorteio._painel.lerVencedoresIds(s),
        inscritos
    };
}

async function ler(guild) {
    const [linhas] = await mysqlPool.query(
        `SELECT * FROM sorteios WHERE guild_id = ? AND mensagem_id IS NOT NULL
         ORDER BY encerrado ASC, CASE WHEN encerrado = FALSE THEN encerra_em END ASC, id DESC
         LIMIT 40`,
        [String(guild.id)]
    );

    const lista = [];

    for (const s of linhas) {
        lista.push(descrever(s, (await sorteio._painel.buscarParticipantes(s.id)).length));
    }

    return {
        lista,
        canais: [...guild.channels.cache.values()]
            .filter(ehTexto)
            .sort((a, b) => a.rawPosition - b.rawPosition)
            .map(c => ({ id: c.id, nome: c.name }))
    };
}

// Valida os campos. `completo` = criação (título, descrição, canal e data são obrigatórios).
function validar(guild, corpo, completo) {
    if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) return { erro: "Dados inválidos." };

    const novo = {};

    for (const [chave, valor] of Object.entries(corpo)) {
        if (chave in TEXTOS) {
            if (typeof valor !== "string") return { erro: `Texto inválido em "${chave}".` };

            const v = valor.trim();

            if (v.length > TEXTOS[chave].max) return { erro: `Texto grande demais em "${chave}" (máximo ${TEXTOS[chave].max}).` };
            if (TEXTOS[chave].obrigatorio && !v) return { erro: `Preencha o ${TEXTOS[chave].nome}.` };

            novo[chave] = v || null;
        } else if (LINKS.includes(chave)) {
            if (typeof valor !== "string" || !linkValido(valor.trim())) return { erro: `"${chave}" precisa ser vazio ou um link http(s).` };

            novo[chave] = valor.trim() || null;
        } else if (chave === "cor") {
            if (typeof valor !== "string" || !/^#[0-9a-fA-F]{6}$/.test(valor)) return { erro: "Cor inválida. Use o formato #RRGGBB." };

            novo.cor = valor.slice(1).toUpperCase();
        } else if (chave === "vencedores") {
            if (!Number.isInteger(valor) || valor < 1 || valor > 20) return { erro: "O número de vencedores precisa ser de 1 a 20." };

            novo.vencedores = valor;
        } else if (chave === "mostrar_participantes" || chave === "marcar_everyone") {
            if (typeof valor !== "boolean") return { erro: `Valor inválido em "${chave}".` };

            novo[chave] = valor;
        } else if (chave === "canal_id") {
            if (typeof valor !== "string" || !ehTexto(guild.channels.cache.get(valor))) return { erro: "Escolha um canal válido." };

            novo.canal_id = valor;
        } else if (chave === "data" || chave === "horario") {
            if (typeof valor !== "string") return { erro: "Data ou horário inválido." };

            novo[chave] = valor.trim();
        } else {
            return { erro: `Opção desconhecida: ${String(chave).slice(0, 40)}` };
        }
    }

    if ("data" in novo || "horario" in novo || completo) {
        const encerraEm = sorteio._painel.converterData(novo.data, novo.horario);

        if (!encerraEm) return { erro: "Informe a data e o horário de encerramento." };
        if (encerraEm <= Date.now()) return { erro: "A data e o horário precisam estar no futuro." };

        novo.encerra_em = encerraEm;
    }

    if (completo) {
        for (const k of ["titulo", "descricao", "canal_id"]) {
            if (!novo[k]) return { erro: k === "canal_id" ? "Escolha o canal do sorteio." : `Preencha o ${TEXTOS[k].nome}.` };
        }
    }

    if (!Object.keys(novo).length) return { erro: "Nada para salvar." };

    return { novo };
}

// Monta o "config" que o código do sorteio usa para desenhar a mensagem
function paraConfig(guild, usuarioId, d) {
    const c = sorteio._painel.criarConfig(guild.id, usuarioId);
    const { data, horario } = sorteio._painel.formatarData(d.encerra_em);

    Object.assign(c, {
        canalId: d.canal_id,
        titulo: d.titulo || "",
        descricao: d.descricao || "",
        cor: d.cor || "5865F2",
        imagem: d.imagem || null,
        thumbnail: d.thumbnail || null,
        autor: d.autor_nome || null,
        autorIcone: d.autor_icone || null,
        rodape: d.rodape || null,
        rodapeIcone: d.rodape_icone || null,
        premio: d.premio || null,
        vencedores: Number(d.vencedores) || 1,
        mostrarParticipantes: !!d.mostrar_participantes,
        marcarEveryone: !!d.marcar_everyone,
        data,
        horario
    });

    return c;
}

async function criar(guild, corpo, usuarioId) {
    const v = validar(guild, corpo, true);

    if (v.erro) return v;

    const d = { vencedores: 1, cor: "5865F2", mostrar_participantes: false, ...v.novo };
    const canal = guild.channels.cache.get(d.canal_id);
    const config = paraConfig(guild, usuarioId, d);

    let aviso = null;
    let marcarEveryone = false;

    if (d.marcar_everyone) {
        const eu = guild.members.me;

        if (eu && canal.permissionsFor(eu)?.has(PermissionFlagsBits.MentionEveryone)) marcarEveryone = true;
        else aviso = "O sorteio foi enviado, mas sem marcar @everyone: o bot precisa da permissão Mencionar @everyone nesse canal.";
    }

    const criado = await sorteio._painel.criarSorteio(config);

    if (!criado) return { erro: "Não foi possível criar o sorteio no banco de dados." };

    config.sorteioId = criado.id;

    try {
        await sorteio._painel.salvarExtrasSorteio(criado.id, String(guild.id), config);

        const mensagem = await canal.send({
            content: marcarEveryone ? "@everyone 🎁 **Novo sorteio!** Entre no botão abaixo." : undefined,
            embeds: [sorteio._painel.criarEmbedPreview(config)],
            components: sorteio._painel.criarBotoesSorteio(criado.id, 0, config.mostrarParticipantes, false),
            allowedMentions: marcarEveryone ? { parse: ["everyone"] } : { parse: [] }
        });

        await mysqlPool.query("UPDATE sorteios SET mensagem_id = ? WHERE id = ?", [mensagem.id, criado.id]);

        await sorteio._painel.atualizarMensagemSorteio(guild.client, criado.id);
    } catch {
        // não deixa um sorteio sem mensagem
        await mysqlPool.query("DELETE FROM sorteios WHERE id = ?", [criado.id]).catch(() => {});

        return { erro: "Não consegui enviar o sorteio. Confira se o bot pode ver e enviar mensagens nesse canal." };
    }

    return { ok: true, id: String(criado.id), aviso };
}

async function buscar(guild, id) {
    if (!/^\d+$/.test(String(id))) return null;

    const s = await sorteio._painel.buscarSorteio(String(id));

    return s && String(s.guild_id) === String(guild.id) && s.mensagem_id ? s : null;
}

async function salvar(guild, id, corpo) {
    const s = await buscar(guild, id);

    if (!s) return { erro: "Esse sorteio não existe." };
    if (Number(s.encerrado)) return { erro: "Esse sorteio já terminou e não pode ser editado." };

    if (corpo && typeof corpo === "object" && ("canal_id" in corpo || "marcar_everyone" in corpo)) {
        if (corpo.canal_id !== undefined && corpo.canal_id !== s.canal_id) return { erro: "Não dá para trocar o canal de um sorteio já enviado." };

        delete corpo.canal_id;
        delete corpo.marcar_everyone;
    }

    const v = validar(guild, corpo, false);

    if (v.erro) return v;

    // data e horário vêm juntos
    if ((("data" in corpo) !== ("horario" in corpo))) return { erro: "Informe a data e o horário juntos." };

    const mapa = {
        titulo: "titulo", descricao: "descricao", cor: "cor", imagem: "imagem", thumbnail: "thumbnail",
        vencedores: "vencedores", mostrar_participantes: "mostrar_participantes", encerra_em: "encerra_em",
        autor_nome: "autor_nome", autor_icone: "autor_icone", rodape: "rodape", rodape_icone: "rodape_icone", premio: "premio"
    };

    const colunas = Object.keys(v.novo).filter(k => k in mapa);

    if (colunas.length) {
        await mysqlPool.query(
            `UPDATE sorteios SET ${colunas.map(c => `${mapa[c]} = ?`).join(", ")} WHERE id = ? AND guild_id = ?`,
            [...colunas.map(c => v.novo[c]), String(s.id), String(guild.id)]
        );
    }

    await sorteio._painel.atualizarMensagemSorteio(guild.client, s.id);

    return { ok: true };
}

async function encerrar(guild, id) {
    const s = await buscar(guild, id);

    if (!s) return { erro: "Esse sorteio não existe." };
    if (Number(s.encerrado)) return { erro: "Esse sorteio já terminou." };

    await sorteio._painel.finalizarSorteio(guild.client, s);

    return { ok: true };
}

async function sortearDeNovo(guild, id) {
    const s = await buscar(guild, id);

    if (!s) return { erro: "Esse sorteio não existe." };
    if (!Number(s.encerrado)) return { erro: "Esse sorteio ainda não terminou." };

    const p = sorteio._painel;
    const lista = await p.buscarParticipantes(s.id);
    const anteriores = p.lerVencedoresIds(s);
    const restantes = lista.filter(u => !anteriores.includes(String(u)));

    if (!restantes.length) return { erro: "Não sobrou ninguém para sortear: todos os inscritos já foram ganhadores." };

    const novos = p.sortearVencedores(restantes, s.vencedores);

    await mysqlPool.query("UPDATE sorteios SET vencedores_ids = ? WHERE id = ?", [JSON.stringify(novos), s.id]);

    s.vencedores_ids = JSON.stringify(novos);

    await p.atualizarMensagemSorteio(guild.client, s.id);

    const canal = guild.channels.cache.get(s.canal_id);

    if (canal) {
        await canal.send({
            content: `🎉 Parabéns ${novos.map(u => `<@${u}>`).join(", ")}!`,
            embeds: [p.criarEmbedResultado(s, novos, lista.length, true)],
            components: p.criarBotoesResultado(s),
            allowedMentions: { users: novos }
        }).catch(() => {});
    }

    return { ok: true };
}

module.exports = { ler, criar, salvar, encerrar, sortearDeNovo, _teste: { validar, descrever } };
