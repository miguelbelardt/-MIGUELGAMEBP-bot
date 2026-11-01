// =====================================================
// 🛡️ MODERAÇÃO (ban, unban, kick, timeout, warn, warns, delwarn)
// =====================================================
// Cada ação confere:
//   - se quem usou tem a permissão do Discord para aquilo
//   - se o bot consegue fazer (cargo mais alto que o alvo etc.)
//   - se quem usou tem cargo mais alto que o alvo
// As advertências ficam na tabela "advertencias" (criada sozinha).

const {
    EmbedBuilder,
    MessageFlags,
    PermissionFlagsBits
} = require("discord.js");

const { mysqlPool } = require("./database/database.js");
const emojis = require("./emojis.js");

const EMOJIS = {
    erro: emojis.erro,
    sucesso: emojis.sucesso
};

const COR = 0xE67E22;
const MAX_MOTIVO = 400;
const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000;

// =====================================================
// 🔧 AUXILIARES
// =====================================================

function motivoLimpo(texto) {
    const t = String(texto || "").trim().slice(0, MAX_MOTIVO);
    return t || "Sem motivo informado.";
}

// "30s", "10m", "2h", "1d" -> milissegundos (null se inválido)
function lerDuracao(texto) {
    const m = /^(\d{1,6})\s*([smhd])$/i.exec(String(texto || "").trim());

    if (!m) return null;

    const unidade = { s: 1000, m: 60000, h: 3600000, d: 86400000 };

    return Number(m[1]) * unidade[m[2].toLowerCase()];
}

function textoDuracao(ms) {
    const dias = Math.floor(ms / 86400000);
    const horas = Math.floor((ms % 86400000) / 3600000);
    const minutos = Math.floor((ms % 3600000) / 60000);
    const segundos = Math.floor((ms % 60000) / 1000);

    const partes = [];

    if (dias) partes.push(`${dias}d`);
    if (horas) partes.push(`${horas}h`);
    if (minutos) partes.push(`${minutos}min`);
    if (segundos && !dias && !horas) partes.push(`${segundos}s`);

    return partes.join(" ") || "0s";
}

function erro(texto) {
    return { erro: `${EMOJIS.erro} ${texto}` };
}

function exigirPermissao(executor, permissao, nome) {
    if (!executor?.permissions?.has(permissao)) {
        return erro(`Você precisa da permissão **${nome}** para isso.`);
    }

    return null;
}

// Quem usou o comando pode agir sobre esse membro?
function conferirHierarquia(guild, executor, alvo, podeNoBot) {
    if (alvo.id === executor.id) {
        return erro("Você não pode fazer isso com você mesmo.");
    }

    if (alvo.id === guild.client.user.id) {
        return erro("Não posso fazer isso comigo mesmo.");
    }

    if (alvo.id === guild.ownerId) {
        return erro("Ninguém pode fazer isso com o dono do servidor.");
    }

    if (
        executor.id !== guild.ownerId &&
        executor.roles.highest.comparePositionTo(alvo.roles.highest) <= 0
    ) {
        return erro("Esse membro tem um cargo igual ou maior que o seu.");
    }

    if (!podeNoBot) {
        return erro("Não consigo fazer isso: o cargo desse membro é maior ou igual ao meu, ou me falta permissão.");
    }

    return null;
}

async function buscarMembro(guild, id) {
    try {
        return await guild.members.fetch(id);
    } catch {
        return null;
    }
}

async function avisarPorDM(usuario, texto) {
    try {
        await usuario.send(texto);
    } catch {
        // DM fechada: sem problema
    }
}

function embedAcao(titulo, linhas) {
    return new EmbedBuilder()
        .setColor(COR)
        .setTitle(titulo)
        .setDescription(linhas.join("\n"))
        .setTimestamp();
}

// =====================================================
// 🗃️ BANCO (advertências)
// =====================================================

let tabelaPronta = false;

async function prepararTabela() {
    if (tabelaPronta) return;

    await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS advertencias (
            id INT AUTO_INCREMENT PRIMARY KEY,
            guild_id VARCHAR(30) NOT NULL,
            user_id VARCHAR(30) NOT NULL,
            moderador_id VARCHAR(30) NOT NULL,
            motivo TEXT NOT NULL,
            criado_em BIGINT NOT NULL,
            INDEX idx_adv_usuario (guild_id, user_id)
        )
    `);

    tabelaPronta = true;
}

// =====================================================
// 🔨 AÇÕES
// =====================================================

async function banir({ guild, executor, alvoId, motivo }) {
    const faltou = exigirPermissao(executor, PermissionFlagsBits.BanMembers, "Banir Membros");
    if (faltou) return faltou;

    const razao = motivoLimpo(motivo);
    const membro = await buscarMembro(guild, alvoId);

    if (membro) {
        const problema = conferirHierarquia(guild, executor, membro, membro.bannable);
        if (problema) return problema;

        await avisarPorDM(
            membro.user,
            `🔨 Você foi banido de **${guild.name}**.\nMotivo: ${razao}`
        );
    } else if (alvoId === executor.id || alvoId === guild.ownerId) {
        return erro("Esse usuário não pode ser banido.");
    }

    try {
        await guild.members.ban(alvoId, {
            reason: `${razao} (por ${executor.user.tag})`
        });
    } catch (e) {
        return erro("Não consegui banir. Confira o ID e as minhas permissões.");
    }

    return {
        resposta: {
            embeds: [
                embedAcao("🔨 Membro banido", [
                    `**Usuário:** <@${alvoId}> (\`${alvoId}\`)`,
                    `**Moderador:** ${executor}`,
                    `**Motivo:** ${razao}`
                ])
            ]
        }
    };
}

async function desbanir({ guild, executor, alvoId, motivo }) {
    const faltou = exigirPermissao(executor, PermissionFlagsBits.BanMembers, "Banir Membros");
    if (faltou) return faltou;

    const razao = motivoLimpo(motivo);

    try {
        await guild.bans.fetch(alvoId);
    } catch {
        return erro("Esse usuário não está banido.");
    }

    try {
        await guild.bans.remove(alvoId, `${razao} (por ${executor.user.tag})`);
    } catch {
        return erro("Não consegui desbanir esse usuário.");
    }

    return {
        resposta: {
            embeds: [
                embedAcao("♻️ Membro desbanido", [
                    `**Usuário:** <@${alvoId}> (\`${alvoId}\`)`,
                    `**Moderador:** ${executor}`,
                    `**Motivo:** ${razao}`
                ])
            ]
        }
    };
}

async function expulsar({ guild, executor, alvoId, motivo }) {
    const faltou = exigirPermissao(executor, PermissionFlagsBits.KickMembers, "Expulsar Membros");
    if (faltou) return faltou;

    const membro = await buscarMembro(guild, alvoId);

    if (!membro) return erro("Esse membro não está no servidor.");

    const problema = conferirHierarquia(guild, executor, membro, membro.kickable);
    if (problema) return problema;

    const razao = motivoLimpo(motivo);

    await avisarPorDM(
        membro.user,
        `👢 Você foi expulso de **${guild.name}**.\nMotivo: ${razao}`
    );

    try {
        await membro.kick(`${razao} (por ${executor.user.tag})`);
    } catch {
        return erro("Não consegui expulsar esse membro.");
    }

    return {
        resposta: {
            embeds: [
                embedAcao("👢 Membro expulso", [
                    `**Usuário:** ${membro.user} (\`${membro.id}\`)`,
                    `**Moderador:** ${executor}`,
                    `**Motivo:** ${razao}`
                ])
            ]
        }
    };
}

async function silenciar({ guild, executor, alvoId, duracao, motivo }) {
    const faltou = exigirPermissao(executor, PermissionFlagsBits.ModerateMembers, "Silenciar Membros");
    if (faltou) return faltou;

    const membro = await buscarMembro(guild, alvoId);

    if (!membro) return erro("Esse membro não está no servidor.");

    const problema = conferirHierarquia(guild, executor, membro, membro.moderatable);
    if (problema) return problema;

    const razao = motivoLimpo(motivo);
    const remover = String(duracao || "").toLowerCase() === "off";

    if (remover) {
        try {
            await membro.timeout(null, `${razao} (por ${executor.user.tag})`);
        } catch {
            return erro("Não consegui remover o silêncio.");
        }

        return {
            resposta: {
                embeds: [
                    embedAcao("🔊 Silêncio removido", [
                        `**Usuário:** ${membro.user}`,
                        `**Moderador:** ${executor}`
                    ])
                ]
            }
        };
    }

    const ms = lerDuracao(duracao);

    if (!ms) {
        return erro("Duração inválida. Use por exemplo `30s`, `10m`, `2h` ou `1d` (ou `off` para remover).");
    }

    if (ms > MAX_TIMEOUT_MS) {
        return erro("O máximo é **28 dias** (`28d`).");
    }

    try {
        await membro.timeout(ms, `${razao} (por ${executor.user.tag})`);
    } catch {
        return erro("Não consegui silenciar esse membro.");
    }

    await avisarPorDM(
        membro.user,
        `🔇 Você foi silenciado em **${guild.name}** por ${textoDuracao(ms)}.\nMotivo: ${razao}`
    );

    return {
        resposta: {
            embeds: [
                embedAcao("🔇 Membro silenciado", [
                    `**Usuário:** ${membro.user}`,
                    `**Duração:** ${textoDuracao(ms)}`,
                    `**Moderador:** ${executor}`,
                    `**Motivo:** ${razao}`
                ])
            ]
        }
    };
}

async function advertir({ guild, executor, alvoId, motivo }) {
    const faltou = exigirPermissao(executor, PermissionFlagsBits.ModerateMembers, "Silenciar Membros");
    if (faltou) return faltou;

    const membro = await buscarMembro(guild, alvoId);

    if (!membro) return erro("Esse membro não está no servidor.");

    if (membro.user.bot) return erro("Não dá para advertir um bot.");

    // Advertir não depende do bot ter cargo alto, só de quem usou.
    const problema = conferirHierarquia(guild, executor, membro, true);
    if (problema) return problema;

    await prepararTabela();

    const razao = motivoLimpo(motivo);

    const [resultado] = await mysqlPool.query(
        `INSERT INTO advertencias (guild_id, user_id, moderador_id, motivo, criado_em)
         VALUES (?, ?, ?, ?, ?)`,
        [guild.id, alvoId, executor.id, razao, Date.now()]
    );

    const [[contagem]] = await mysqlPool.query(
        "SELECT COUNT(*) AS total FROM advertencias WHERE guild_id = ? AND user_id = ?",
        [guild.id, alvoId]
    );

    await avisarPorDM(
        membro.user,
        `⚠️ Você recebeu uma advertência em **${guild.name}**.\nMotivo: ${razao}`
    );

    return {
        resposta: {
            embeds: [
                embedAcao("⚠️ Advertência aplicada", [
                    `**Usuário:** ${membro.user}`,
                    `**Moderador:** ${executor}`,
                    `**Motivo:** ${razao}`,
                    `**Total de advertências:** ${contagem.total}  •  **ID:** ${resultado.insertId}`
                ])
            ]
        }
    };
}

async function verAdvertencias({ guild, executor, alvoId }) {
    // Qualquer um vê as próprias; ver as dos outros exige permissão.
    if (alvoId !== executor.id) {
        const faltou = exigirPermissao(executor, PermissionFlagsBits.ModerateMembers, "Silenciar Membros");
        if (faltou) return faltou;
    }

    await prepararTabela();

    const [linhas] = await mysqlPool.query(
        `SELECT id, moderador_id, motivo, criado_em
         FROM advertencias
         WHERE guild_id = ? AND user_id = ?
         ORDER BY id DESC
         LIMIT 10`,
        [guild.id, alvoId]
    );

    const [[contagem]] = await mysqlPool.query(
        "SELECT COUNT(*) AS total FROM advertencias WHERE guild_id = ? AND user_id = ?",
        [guild.id, alvoId]
    );

    if (!contagem.total) {
        return {
            resposta: { content: `${EMOJIS.sucesso} <@${alvoId}> não tem advertências.`, allowedMentions: { parse: [] } }
        };
    }

    const texto = linhas
        .map(l =>
            `**#${l.id}** • <t:${Math.floor(Number(l.criado_em) / 1000)}:d> • por <@${l.moderador_id}>\n┗ ${String(l.motivo).replace(/@/g, "@​")}`
        )
        .join("\n\n");

    return {
        resposta: {
            embeds: [
                new EmbedBuilder()
                    .setColor(COR)
                    .setTitle(`⚠️ Advertências (${contagem.total})`)
                    .setDescription(`<@${alvoId}>\n\n${texto}`.slice(0, 4000))
                    .setFooter({ text: contagem.total > 10 ? "Mostrando as 10 mais recentes." : "Use /delwarn id para remover." })
            ],
            allowedMentions: { parse: [] }
        }
    };
}

async function removerAdvertencia({ guild, executor, id }) {
    const faltou = exigirPermissao(executor, PermissionFlagsBits.ModerateMembers, "Silenciar Membros");
    if (faltou) return faltou;

    const numero = Number(id);

    if (!Number.isInteger(numero) || numero < 1) {
        return erro("Informe o número da advertência (aparece em `/warns`).");
    }

    await prepararTabela();

    const [resultado] = await mysqlPool.query(
        "DELETE FROM advertencias WHERE id = ? AND guild_id = ?",
        [numero, guild.id]
    );

    if (!resultado.affectedRows) {
        return erro("Não achei essa advertência neste servidor.");
    }

    return { resposta: `${EMOJIS.sucesso} Advertência **#${numero}** removida.` };
}

// =====================================================
// 💬 RESPONDER (slash e prefixo)
// =====================================================

async function rodarSlash(interaction, acao, extra = {}) {
    try {
        if (!interaction.guild) {
            return interaction.reply({
                content: `${EMOJIS.erro} Este comando só funciona dentro de um servidor.`,
                flags: MessageFlags.Ephemeral
            });
        }

        await interaction.deferReply();

        const resultado = await acao({
            guild: interaction.guild,
            executor: interaction.member,
            ...extra
        });

        if (resultado.erro) {
            await interaction.deleteReply().catch(() => { });

            return interaction.followUp({
                content: resultado.erro,
                flags: MessageFlags.Ephemeral
            });
        }

        const payload =
            typeof resultado.resposta === "string"
                ? { content: resultado.resposta, allowedMentions: { parse: [] } }
                : { allowedMentions: { parse: [] }, ...resultado.resposta };

        return interaction.editReply(payload);

    } catch (e) {
        console.error("❌ Erro em um comando de moderação:", e);

        const aviso = `${EMOJIS.erro} Não foi possível concluir o comando.`;

        if (interaction.deferred || interaction.replied) {
            await interaction.followUp({ content: aviso, flags: MessageFlags.Ephemeral }).catch(() => { });
        } else {
            await interaction.reply({ content: aviso, flags: MessageFlags.Ephemeral }).catch(() => { });
        }
    }
}

async function rodarPrefixo(message, acao, extra = {}) {
    try {
        if (!message.guild) return;

        const resultado = await acao({
            guild: message.guild,
            executor: message.member,
            ...extra
        });

        if (resultado.erro) {
            return message.reply({ content: resultado.erro, allowedMentions: { parse: [] } });
        }

        return message.reply(
            typeof resultado.resposta === "string"
                ? { content: resultado.resposta, allowedMentions: { parse: [] } }
                : { allowedMentions: { parse: [] }, ...resultado.resposta }
        );

    } catch (e) {
        console.error("❌ Erro em um comando de moderação (prefixo):", e);

        await message.reply(`${EMOJIS.erro} Não foi possível concluir o comando.`).catch(() => { });
    }
}

// "'ban @fulano motivo..." -> { alvoId, resto: ["motivo", ...] }
function alvoDoPrefixo(args) {
    const primeiro = args[0] || "";
    const m = /^<@!?(\d{15,25})>$/.exec(primeiro) || /^(\d{15,25})$/.exec(primeiro);

    if (!m) return { alvoId: null, resto: args };

    return { alvoId: m[1], resto: args.slice(1) };
}

const AJUDA_ALVO = `${EMOJIS.erro} Marque o usuário ou informe o ID.`;

module.exports = {
    banir,
    desbanir,
    expulsar,
    silenciar,
    advertir,
    verAdvertencias,
    removerAdvertencia,
    rodarSlash,
    rodarPrefixo,
    alvoDoPrefixo,
    AJUDA_ALVO,
    lerDuracao,
    textoDuracao
};
