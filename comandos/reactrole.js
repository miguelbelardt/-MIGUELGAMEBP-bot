const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ChannelSelectMenuBuilder,
    ChannelType
} = require("discord.js");

const { mysqlPool } = require("../database/database");

// =====================================================
// ⚙️ COMANDO REACT ROLE
// =====================================================

const data = new SlashCommandBuilder()
    .setName("reactrole")
    .setDescription(
        "Sistema de configuração de Reaction Role."
    )
    .setDefaultMemberPermissions(
        PermissionFlagsBits.ManageGuild
    )

    .addSubcommand(subcommand =>
        subcommand
            .setName("adicionar")
            .setDescription(
                "Abre o painel para criar um novo Reaction Role."
            )
    )

    .addSubcommand(subcommand =>
        subcommand
            .setName("editar")
            .setDescription(
                "Abre o painel de uma mensagem existente."
            )
            .addStringOption(option =>
                option
                    .setName("mensagem")
                    .setDescription(
                        "ID da mensagem existente."
                    )
                    .setRequired(true)
            )
    );

// =====================================================
// 🛠️ GARANTIR TABELA
// =====================================================

// Colunas adicionadas depois da criação original da tabela.
// São criadas automaticamente se ainda não existirem.
const COLUNAS_EXTRAS = [
    ["somente_reacoes", "BOOLEAN NOT NULL DEFAULT FALSE"],
    ["embed_url", "TEXT NULL"],
    ["embed_autor_nome", "VARCHAR(256) NULL"],
    ["embed_autor_icone", "TEXT NULL"],
    ["footer_icone", "TEXT NULL"],
    ["embed_timestamp", "BOOLEAN NOT NULL DEFAULT FALSE"],
    ["embed_campos", "TEXT NULL"]
];

let tabelaGarantida = false;

async function garantirTabela() {
    if (tabelaGarantida) return;

    await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS react_role_configs (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            guild_id VARCHAR(30) NOT NULL,
            canal_id VARCHAR(30),
            mensagem_id VARCHAR(30),
            content TEXT,

            embed_habilitado BOOLEAN NOT NULL DEFAULT TRUE,
            embed_titulo VARCHAR(256),
            embed_descricao TEXT,
            embed_cor VARCHAR(20),

            footer_habilitado BOOLEAN NOT NULL DEFAULT FALSE,
            footer_texto VARCHAR(2048),

            imagem TEXT,
            thumbnail TEXT,

            habilitado BOOLEAN NOT NULL DEFAULT TRUE,
            somente_reacoes BOOLEAN NOT NULL DEFAULT FALSE,

            criado_em BIGINT NOT NULL DEFAULT (
                UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000
            ),

            atualizado_em BIGINT NOT NULL DEFAULT (
                UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000
            ),

            INDEX idx_react_role_configs_guild (guild_id),
            INDEX idx_react_role_configs_mensagem (
                guild_id,
                mensagem_id
            )
        )
    `);

    for (const [coluna, definicao] of COLUNAS_EXTRAS) {
        try {
            const [existe] =
                await mysqlPool.query(
                    "SHOW COLUMNS FROM react_role_configs LIKE ?",
                    [coluna]
                );

            if (!existe.length) {
                await mysqlPool.query(
                    `ALTER TABLE react_role_configs ADD COLUMN ${coluna} ${definicao}`
                );
            }
        } catch (erro) {
            console.error(
                `❌ Erro ao verificar a coluna ${coluna}:`,
                erro
            );
        }
    }

    tabelaGarantida = true;
}

// =====================================================
// 🎨 NORMALIZAR COR
// =====================================================

function normalizarCor(cor) {
    if (!cor) return null;

    const texto = String(cor)
        .trim()
        .replace(/^#/, "");

    if (!/^[0-9A-Fa-f]{6}$/.test(texto)) {
        return null;
    }

    return `#${texto.toUpperCase()}`;
}

// =====================================================
// 🔢 BOOLEAN DO MYSQL
// =====================================================

// O MySQL devolve BOOLEAN como 0/1 (número), não true/false.
// Por isso nunca se compara com === true / === false.

function sim(valor) {
    return Boolean(Number(valor));
}

const REGEX_SIM = /^(s|sim|y|yes|1|true|on)/i;

// =====================================================
// 🎭 NORMALIZAR EMOJI
// =====================================================

function normalizarEmoji(emoji) {
    if (!emoji) return null;

    if (typeof emoji === "object") {
        if (emoji.id) {
            return `${emoji.name}:${emoji.id}`;
        }

        return emoji.name
            ? String(emoji.name).trim()
            : null;
    }

    const texto =
        String(emoji).trim();

    const customEmoji =
        texto.match(
            /^<?a?:([^:>\s]+):(\d+)>?$/
        );

    if (customEmoji) {
        return `${customEmoji[1]}:${customEmoji[2]}`;
    }

    return texto;
}

// =====================================================
// 🔑 CHAVE DE COMPARAÇÃO DE EMOJI
// =====================================================

// Usada para COMPARAR emojis. Ignora o seletor de variação (FE0F),
// que faz o mesmo emoji chegar com "bytes" diferentes (ex.: ❤ e ❤️),
// e compara emojis customizados pelo ID.

function chaveEmoji(emoji) {
    const base =
        normalizarEmoji(emoji);

    if (!base) return "";

    const custom =
        base.match(/^[^:]+:(\d+)$/);

    if (custom) {
        return `custom:${custom[1]}`;
    }

    return base.replace(
        /[\uFE0E\uFE0F]/g,
        ""
    );
}

// =====================================================
// 📋 CAMPOS DO EMBED
// =====================================================

function parseCampos(texto) {
    if (!texto) return [];

    try {
        const lista = JSON.parse(texto);

        return Array.isArray(lista)
            ? lista
            : [];
    } catch {
        return [];
    }
}

function camposParaTexto(texto) {
    return parseCampos(texto)
        .map(
            campo =>
                `${campo.nome} | ${campo.valor} | ${
                    campo.inline ? "sim" : "não"
                }`
        )
        .join("\n");
}

// Cada linha: Nome | Valor | sim/não (lado a lado)
function textoParaCampos(texto) {
    const campos = [];

    for (const linha of String(texto || "").split("\n")) {
        const partes =
            linha
                .split("|")
                .map(parte => parte.trim());

        if (
            partes.length < 2 ||
            !partes[0] ||
            !partes[1]
        ) {
            continue;
        }

        campos.push({
            nome: partes[0].slice(0, 256),
            valor: partes[1].slice(0, 1024),
            inline: partes[2]
                ? REGEX_SIM.test(partes[2])
                : false
        });

        if (campos.length >= 10) break;
    }

    return campos;
}

// =====================================================
// 🔗 VALIDAR URL
// =====================================================

function urlValida(url) {
    if (!url) return true;

    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

// =====================================================
// 🔎 VALIDAR ID DISCORD
// =====================================================

function idDiscordValido(id) {
    return /^\d{17,20}$/.test(
        String(id || "").trim()
    );
}

// =====================================================
// 💾 CRIAR CONFIGURAÇÃO
// =====================================================

async function criarConfig(
    guildId,
    somenteReacoes = false
) {
    await garantirTabela();

    const [resultado] =
        await mysqlPool.query(
            `
            INSERT INTO react_role_configs (
                guild_id,
                habilitado,
                embed_habilitado,
                somente_reacoes
            )
            VALUES (?, TRUE, TRUE, ?)
            `,
            [
                guildId,
                somenteReacoes
            ]
        );

    return resultado.insertId;
}

// =====================================================
// 🔎 BUSCAR CONFIGURAÇÃO
// =====================================================

async function buscarConfig(
    id,
    guildId
) {
    await garantirTabela();

    const [rows] =
        await mysqlPool.query(
            `
            SELECT *
            FROM react_role_configs
            WHERE id = ?
              AND guild_id = ?
            LIMIT 1
            `,
            [
                id,
                guildId
            ]
        );

    return rows[0] || null;
}

// =====================================================
// 🔎 BUSCAR CONFIG POR MENSAGEM
// =====================================================

async function buscarConfigMensagem(
    guildId,
    mensagemId
) {
    await garantirTabela();

    const [rows] =
        await mysqlPool.query(
            `
            SELECT *
            FROM react_role_configs
            WHERE guild_id = ?
              AND mensagem_id = ?
            ORDER BY id DESC
            LIMIT 1
            `,
            [
                guildId,
                mensagemId
            ]
        );

    return rows[0] || null;
}

// =====================================================
// 🎭 BUSCAR CARGOS
// =====================================================

async function buscarCargos(
    guildId,
    mensagemId
) {
    if (!mensagemId) return [];

    const [rows] =
        await mysqlPool.query(
            `
            SELECT *
            FROM react_roles
            WHERE guild_id = ?
              AND mensagem_id = ?
            ORDER BY id ASC
            `,
            [
                guildId,
                mensagemId
            ]
        );

    return rows;
}

// =====================================================
// ✏️ ATUALIZAR CONFIGURAÇÃO
// =====================================================

async function atualizarConfig(
    configId,
    guildId,
    colunas
) {
    const nomes =
        Object.keys(colunas);

    const sets =
        nomes
            .map(nome => `${nome} = ?`)
            .join(", ");

    await mysqlPool.query(
        `
        UPDATE react_role_configs
        SET
            ${sets},
            atualizado_em =
                UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000
        WHERE id = ?
          AND guild_id = ?
        `,
        [
            ...nomes.map(nome => colunas[nome]),
            configId,
            guildId
        ]
    );
}

// =====================================================
// 🗑️ EXCLUIR CONFIGURAÇÃO DO BANCO
// =====================================================

async function excluirConfigDoBanco(
    config,
    guildId
) {
    if (config.mensagem_id) {
        await mysqlPool.query(
            `
            DELETE FROM react_roles
            WHERE guild_id = ?
              AND mensagem_id = ?
            `,
            [
                guildId,
                config.mensagem_id
            ]
        );
    }

    await mysqlPool.query(
        `
        DELETE FROM react_role_configs
        WHERE id = ?
          AND guild_id = ?
        `,
        [
            config.id,
            guildId
        ]
    );
}

// =====================================================
// 🎭 SALVAR CARGO
// =====================================================

async function salvarCargo({
    guildId,
    mensagemId,
    emoji,
    cargoId,
    config
}) {
    const emojiNormalizado =
        normalizarEmoji(emoji);

    // Evita duplicar o mesmo emoji escrito de formas diferentes.
    const existentes =
        await buscarCargos(
            guildId,
            mensagemId
        );

    for (const item of existentes) {
        if (
            chaveEmoji(item.emoji) ===
                chaveEmoji(emojiNormalizado) &&
            item.emoji !== emojiNormalizado
        ) {
            await mysqlPool.query(
                "DELETE FROM react_roles WHERE id = ?",
                [item.id]
            );
        }
    }

    await mysqlPool.query(
        `
        INSERT INTO react_roles (
            guild_id,
            mensagem_id,
            emoji,
            cargo_id,
            content,

            embed_habilitado,
            embed_titulo,
            embed_descricao,
            embed_cor,

            footer_habilitado,
            footer_texto,

            imagem,
            thumbnail,

            criado_em,
            atualizado_em
        )

        VALUES (
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?,
            ?, ?,
            UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000,
            UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000
        )

        ON DUPLICATE KEY UPDATE

            cargo_id = VALUES(cargo_id),

            content = VALUES(content),

            embed_habilitado =
                VALUES(embed_habilitado),

            embed_titulo =
                VALUES(embed_titulo),

            embed_descricao =
                VALUES(embed_descricao),

            embed_cor =
                VALUES(embed_cor),

            footer_habilitado =
                VALUES(footer_habilitado),

            footer_texto =
                VALUES(footer_texto),

            imagem =
                VALUES(imagem),

            thumbnail =
                VALUES(thumbnail),

            atualizado_em =
                UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000
        `,
        [
            guildId,
            mensagemId,
            emojiNormalizado,
            cargoId,

            config.content || null,

            sim(config.embed_habilitado),
            config.embed_titulo || null,
            config.embed_descricao || null,
            config.embed_cor || null,

            sim(config.footer_habilitado),
            config.footer_texto || null,

            config.imagem || null,
            config.thumbnail || null
        ]
    );
}

// =====================================================
// 🗑️ REMOVER CARGO / REAÇÃO
// =====================================================

async function removerCargoReacao(
    guildId,
    mensagemId,
    emoji
) {
    const chave =
        chaveEmoji(emoji);

    if (!chave) {
        return false;
    }

    const cargos =
        await buscarCargos(
            guildId,
            mensagemId
        );

    const alvos =
        cargos.filter(
            cargo =>
                chaveEmoji(cargo.emoji) === chave
        );

    if (!alvos.length) {
        return false;
    }

    await mysqlPool.query(
        "DELETE FROM react_roles WHERE id IN (?)",
        [alvos.map(alvo => alvo.id)]
    );

    return true;
}

// =====================================================
// 🧹 SINCRONIZAR CONFIGURAÇÃO NOS CARGOS
// =====================================================

async function sincronizarCargos(
    guildId,
    mensagemId,
    config
) {
    if (!mensagemId) return;

    await mysqlPool.query(
        `
        UPDATE react_roles
        SET

            content = ?,

            embed_habilitado = ?,
            embed_titulo = ?,
            embed_descricao = ?,
            embed_cor = ?,

            footer_habilitado = ?,
            footer_texto = ?,

            imagem = ?,
            thumbnail = ?,

            atualizado_em =
                UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000

        WHERE guild_id = ?
          AND mensagem_id = ?
        `,
        [
            config.content || null,

            sim(config.embed_habilitado),
            config.embed_titulo || null,
            config.embed_descricao || null,
            config.embed_cor || null,

            sim(config.footer_habilitado),
            config.footer_texto || null,

            config.imagem || null,
            config.thumbnail || null,

            guildId,
            mensagemId
        ]
    );
}

// =====================================================
// 🎨 CRIAR EMBED
// =====================================================

function criarEmbed(config) {
    if (!sim(config.embed_habilitado)) {
        return null;
    }

    const campos =
        parseCampos(config.embed_campos);

    const rodapeAtivo =
        sim(config.footer_habilitado) &&
        config.footer_texto;

    if (
        !config.embed_titulo &&
        !config.embed_descricao &&
        !config.embed_autor_nome &&
        !campos.length &&
        !config.imagem &&
        !config.thumbnail &&
        !rodapeAtivo
    ) {
        return null;
    }

    const embed =
        new EmbedBuilder();

    if (config.embed_titulo) {
        embed.setTitle(
            config.embed_titulo
        );
    }

    if (
        config.embed_titulo &&
        config.embed_url
    ) {
        embed.setURL(
            config.embed_url
        );
    }

    if (config.embed_descricao) {
        embed.setDescription(
            config.embed_descricao
        );
    }

    if (config.embed_cor) {
        embed.setColor(
            config.embed_cor
        );
    }

    if (config.embed_autor_nome) {
        embed.setAuthor({
            name:
                config.embed_autor_nome,

            iconURL:
                config.embed_autor_icone ||
                undefined
        });
    }

    if (campos.length) {
        embed.addFields(
            campos
                .slice(0, 25)
                .map(campo => ({
                    name: campo.nome,
                    value: campo.valor,
                    inline: Boolean(campo.inline)
                }))
        );
    }

    if (config.imagem) {
        embed.setImage(
            config.imagem
        );
    }

    if (config.thumbnail) {
        embed.setThumbnail(
            config.thumbnail
        );
    }

    if (rodapeAtivo) {
        embed.setFooter({
            text:
                config.footer_texto,

            iconURL:
                config.footer_icone ||
                undefined
        });
    }

    if (sim(config.embed_timestamp)) {
        embed.setTimestamp();
    }

    return embed;
}

// =====================================================
// 📨 APLICAR CONFIG NA MENSAGEM
// =====================================================

async function aplicarMensagem(
    mensagem,
    config
) {
    const embed =
        criarEmbed(config);

    const content =
        config.content || null;

    if (!content && !embed) {
        throw new Error(
            "A mensagem não possui conteúdo nem embed."
        );
    }

    await mensagem.edit({
        content,

        embeds:
            embed
                ? [embed]
                : []
    });
}

// =====================================================
// 🎭 ADICIONAR REAÇÕES SALVAS
// =====================================================

async function adicionarReacoes(
    mensagem,
    cargos
) {
    for (const item of cargos) {
        try {
            const jaExiste =
                mensagem.reactions.cache.find(
                    reaction =>
                        chaveEmoji(
                            reaction.emoji
                        ) === chaveEmoji(
                            item.emoji
                        )
                );

            if (!jaExiste) {
                await mensagem.react(
                    item.emoji
                );
            }

        } catch (erro) {
            console.error(
                `❌ Não consegui adicionar o emoji ${item.emoji}:`,
                erro
            );
        }
    }
}

// =====================================================
// 🗑️ REMOVER REAÇÃO DA MENSAGEM
// =====================================================

async function removerReacaoDaMensagem(
    mensagem,
    emoji
) {
    try {
        const chave =
            chaveEmoji(emoji);

        const reaction =
            mensagem.reactions.cache.find(
                item =>
                    chaveEmoji(
                        item.emoji
                    ) === chave
            );

        if (reaction) {
            await reaction.remove();
        }

    } catch (erro) {
        console.error(
            "❌ Não consegui remover a reação da mensagem:",
            erro
        );
    }
}

// =====================================================
// 🔎 LOCALIZAR MENSAGEM
// =====================================================

async function localizarMensagem(
    guild,
    mensagemId
) {
    const canais =
        guild.channels.cache.filter(
            canal =>
                canal.isTextBased() &&
                (
                    canal.type ===
                        ChannelType.GuildText ||
                    canal.type ===
                        ChannelType.GuildAnnouncement
                )
        );

    for (const [, canal] of canais) {
        try {
            const mensagem =
                await canal.messages.fetch(
                    mensagemId
                );

            if (mensagem) {
                return {
                    mensagem,
                    canal
                };
            }

        } catch {
            // Continua procurando.
        }
    }

    return null;
}

// =====================================================
// 🧱 AUXILIARES DOS PAINÉIS
// =====================================================

function botao(
    customId,
    label,
    emoji,
    estilo,
    desabilitado = false
) {
    return new ButtonBuilder()
        .setCustomId(customId)
        .setLabel(label)
        .setEmoji(emoji)
        .setStyle(estilo)
        .setDisabled(desabilitado);
}

function linhaCargos(cargos) {
    return cargos
        .map(
            cargo =>
                `${cargo.emoji} → <@&${cargo.cargo_id}>`
        )
        .join("\n")
        .slice(0, 1024);
}

// =====================================================
// 📋 PAINEL DE ADICIONAR
// =====================================================

async function criarPainelAdicionar(
    config,
    cargos = []
) {
    const ativo =
        sim(config.habilitado);

    const embedLigado =
        sim(config.embed_habilitado);

    const painelEmbed =
        new EmbedBuilder()
            .setTitle(
                "🎭 CONFIGURAÇÃO DO REACTION ROLE"
            )
            .setColor(
                config.embed_cor ||
                "#00A8FF"
            )
            .setDescription(
                [
                    `📢 **Canal:** ${
                        config.canal_id
                            ? `<#${config.canal_id}>`
                            : "Não configurado"
                    }`,

                    `📨 **Mensagem:** ${
                        config.mensagem_id
                            ? `\`${config.mensagem_id}\``
                            : "Ainda não enviada"
                    }`,

                    `🎭 **Cargos:** ${
                        cargos.length
                    } configurado(s)`,

                    `🎨 **Embed:** ${
                        embedLigado
                            ? "Ativado"
                            : "Desativado"
                    }`,

                    `${
                        ativo ? "🟢" : "🔴"
                    } **Sistema:** ${
                        ativo
                            ? "Ativado"
                            : "Desativado"
                    }`
                ].join("\n")
            );

    if (cargos.length) {
        painelEmbed.addFields({
            name:
                "🎭 Cargos configurados",

            value:
                linhaCargos(cargos)
        });
    }

    const id = config.id;

    const canalRow =
        new ActionRowBuilder()
            .addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId(
                        `rr_canal_${id}`
                    )
                    .setPlaceholder(
                        "📢 Selecionar canal"
                    )
                    .setChannelTypes(
                        ChannelType.GuildText,
                        ChannelType.GuildAnnouncement
                    )
                    .setMinValues(1)
                    .setMaxValues(1)
            );

    const row1 =
        new ActionRowBuilder()
            .addComponents(
                botao(
                    `rr_mensagem_${id}`,
                    "Mensagem",
                    "📨",
                    ButtonStyle.Primary
                ),

                botao(
                    `rr_embed_${id}`,
                    "Embed",
                    "🎨",
                    ButtonStyle.Primary
                ),

                botao(
                    `rr_autor_${id}`,
                    "Autor",
                    "👤",
                    ButtonStyle.Primary
                ),

                botao(
                    `rr_campos_${id}`,
                    "Campos",
                    "📋",
                    ButtonStyle.Primary
                ),

                botao(
                    `rr_imagens_${id}`,
                    "Imagens",
                    "🖼️",
                    ButtonStyle.Secondary
                )
            );

    const row2 =
        new ActionRowBuilder()
            .addComponents(
                botao(
                    `rr_rodape_${id}`,
                    "Rodapé",
                    "📌",
                    ButtonStyle.Secondary
                ),

                botao(
                    `rr_cargos_${id}`,
                    "Cargos",
                    "🎭",
                    ButtonStyle.Primary
                ),

                botao(
                    `rr_remover_${id}`,
                    "Remover reação",
                    "➖",
                    ButtonStyle.Danger
                ),

                botao(
                    `rr_enviar_${id}`,
                    config.mensagem_id
                        ? "Salvar"
                        : "Enviar",
                    config.mensagem_id
                        ? "💾"
                        : "📤",
                    ButtonStyle.Success
                ),

                botao(
                    `rr_excluir_${id}`,
                    "Excluir msg",
                    "🗑️",
                    ButtonStyle.Danger,
                    !config.mensagem_id
                )
            );

    const row3 =
        new ActionRowBuilder()
            .addComponents(
                botao(
                    `rr_ativar_${id}`,
                    "Ativar",
                    "🟢",
                    ButtonStyle.Success,
                    ativo
                ),

                botao(
                    `rr_desativar_${id}`,
                    "Desativar",
                    "🔴",
                    ButtonStyle.Danger,
                    !ativo
                ),

                botao(
                    `rr_embedtoggle_${id}`,
                    embedLigado
                        ? "Embed ON"
                        : "Embed OFF",
                    "🎨",
                    embedLigado
                        ? ButtonStyle.Success
                        : ButtonStyle.Secondary
                ),

                botao(
                    `rr_testar_${id}`,
                    "Testar",
                    "🧪",
                    ButtonStyle.Secondary
                ),

                botao(
                    `rr_fechar_${id}`,
                    "Fechar",
                    "❌",
                    ButtonStyle.Danger
                )
            );

    return {
        embeds: [painelEmbed],

        components: [
            canalRow,
            row1,
            row2,
            row3
        ]
    };
}

// =====================================================
// 📋 PAINEL DE EDITAR
// =====================================================

async function criarPainelEditar(
    config,
    cargos = []
) {
    const ativo =
        sim(config.habilitado);

    const painelEmbed =
        new EmbedBuilder()
            .setTitle(
                "🎭 REACTION ROLE — MENSAGEM EXISTENTE"
            )
            .setColor(
                "#00A8FF"
            )
            .setDescription(
                [
                    `📢 **Canal:** ${
                        config.canal_id
                            ? `<#${config.canal_id}>`
                            : "Desconhecido"
                    }`,

                    `📨 **Mensagem:** \`${config.mensagem_id}\``,

                    `🎭 **Cargos:** ${
                        cargos.length
                    } configurado(s)`,

                    "🔒 **Modo:** somente emojis/reações",

                    `${
                        ativo ? "🟢" : "🔴"
                    } **Sistema:** ${
                        ativo
                            ? "Ativado"
                            : "Desativado"
                    }`
                ].join("\n")
            );

    if (cargos.length) {
        painelEmbed.addFields({
            name:
                "🎭 Cargos configurados",

            value:
                linhaCargos(cargos)
        });
    }

    const id = config.id;

    const row1 =
        new ActionRowBuilder()
            .addComponents(
                botao(
                    `rr_cargos_${id}`,
                    "Cargos",
                    "🎭",
                    ButtonStyle.Primary
                ),

                botao(
                    `rr_remover_${id}`,
                    "Remover reação",
                    "➖",
                    ButtonStyle.Danger
                ),

                botao(
                    `rr_testar_${id}`,
                    "Aplicar",
                    "🧪",
                    ButtonStyle.Secondary
                ),

                botao(
                    `rr_excluir_${id}`,
                    "Excluir msg",
                    "🗑️",
                    ButtonStyle.Danger
                ),

                botao(
                    `rr_fechar_${id}`,
                    "Fechar",
                    "❌",
                    ButtonStyle.Danger
                )
            );

    const row2 =
        new ActionRowBuilder()
            .addComponents(
                botao(
                    `rr_ativar_${id}`,
                    "Ativar",
                    "🟢",
                    ButtonStyle.Success,
                    ativo
                ),

                botao(
                    `rr_desativar_${id}`,
                    "Desativar",
                    "🔴",
                    ButtonStyle.Danger,
                    !ativo
                )
            );

    return {
        embeds: [painelEmbed],

        components: [
            row1,
            row2
        ]
    };
}

// =====================================================
// 📋 CRIAR PAINEL
// =====================================================

async function criarPainel(
    config,
    cargos = []
) {
    const somenteReacoes =
        config.somente_reacoes === true ||
        config.somente_reacoes === 1;

    if (somenteReacoes) {
        return criarPainelEditar(
            config,
            cargos
        );
    }

    return criarPainelAdicionar(
        config,
        cargos
    );
}

// =====================================================
// 🗑️ PAINEL DE CONFIRMAÇÃO DE EXCLUSÃO
// =====================================================

function criarPainelExclusao(config) {
    const embed =
        new EmbedBuilder()
            .setTitle(
                "🗑️ EXCLUIR MENSAGEM?"
            )
            .setColor(
                "#FF4D4D"
            )
            .setDescription(
                [
                    `Isso vai **apagar a mensagem** \`${config.mensagem_id}\` ${
                        config.canal_id
                            ? `do canal <#${config.canal_id}>`
                            : ""
                    } e remover toda a configuração deste Reaction Role.`,

                    "",

                    "**Essa ação não pode ser desfeita.**"
                ].join("\n")
            );

    const row =
        new ActionRowBuilder()
            .addComponents(
                botao(
                    `rr_confirmarexcluir_${config.id}`,
                    "Excluir",
                    "🗑️",
                    ButtonStyle.Danger
                ),

                botao(
                    `rr_cancelarexcluir_${config.id}`,
                    "Cancelar",
                    "↩️",
                    ButtonStyle.Secondary
                )
            );

    return {
        embeds: [embed],
        components: [row]
    };
}

// =====================================================
// 🔄 ATUALIZAR PAINEL NO LUGAR
// =====================================================

// Edita a MESMA mensagem do painel (não empilha mensagens novas).
async function atualizarPainel(
    interaction,
    configId
) {
    const config =
        await buscarConfig(
            configId,
            interaction.guild.id
        );

    if (!config) {
        return interaction.update({
            content:
                "❌ Essa configuração não existe mais.",

            embeds: [],

            components: []
        });
    }

    const cargos =
        await buscarCargos(
            interaction.guild.id,
            config.mensagem_id
        );

    const painel =
        await criarPainel(
            config,
            cargos
        );

    return interaction.update({
        content: null,
        ...painel
    });
}

// =====================================================
// 📨 MODAL MENSAGEM
// =====================================================

function modalMensagem(config) {
    const modal =
        new ModalBuilder()
            .setCustomId(
                `rr_modal_mensagem_${config.id}`
            )
            .setTitle(
                "📨 Mensagem"
            );

    const content =
        new TextInputBuilder()
            .setCustomId(
                "content"
            )
            .setLabel(
                "Conteúdo da mensagem"
            )
            .setStyle(
                TextInputStyle.Paragraph
            )
            .setRequired(false)
            .setPlaceholder(
                "Texto que aparecerá acima do Embed..."
            )
            .setValue(
                config.content || ""
            );

    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(
                content
            )
    );

    return modal;
}

// =====================================================
// 🎨 MODAL EMBED
// =====================================================

function modalEmbed(config) {
    const modal =
        new ModalBuilder()
            .setCustomId(
                `rr_modal_embed_${config.id}`
            )
            .setTitle(
                "🎨 Configuração do Embed"
            );

    const titulo =
        new TextInputBuilder()
            .setCustomId(
                "titulo"
            )
            .setLabel(
                "Título"
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(false)
            .setValue(
                config.embed_titulo || ""
            );

    const descricao =
        new TextInputBuilder()
            .setCustomId(
                "descricao"
            )
            .setLabel(
                "Descrição"
            )
            .setStyle(
                TextInputStyle.Paragraph
            )
            .setRequired(false)
            .setValue(
                config.embed_descricao || ""
            );

    const cor =
        new TextInputBuilder()
            .setCustomId(
                "cor"
            )
            .setLabel(
                "Cor hexadecimal"
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(false)
            .setPlaceholder(
                "#00A8FF"
            )
            .setValue(
                config.embed_cor || ""
            );

    const url =
        new TextInputBuilder()
            .setCustomId(
                "url"
            )
            .setLabel(
                "Link do título (opcional)"
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(false)
            .setPlaceholder(
                "https://..."
            )
            .setValue(
                config.embed_url || ""
            );

    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(titulo),

        new ActionRowBuilder()
            .addComponents(descricao),

        new ActionRowBuilder()
            .addComponents(cor),

        new ActionRowBuilder()
            .addComponents(url)
    );

    return modal;
}

// =====================================================
// 🖼️ MODAL IMAGENS
// =====================================================

function modalImagens(config) {
    const modal =
        new ModalBuilder()
            .setCustomId(
                `rr_modal_imagens_${config.id}`
            )
            .setTitle(
                "🖼️ Imagens"
            );

    const imagem =
        new TextInputBuilder()
            .setCustomId(
                "imagem"
            )
            .setLabel(
                "Imagem"
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(false)
            .setValue(
                config.imagem || ""
            );

    const thumbnail =
        new TextInputBuilder()
            .setCustomId(
                "thumbnail"
            )
            .setLabel(
                "Thumbnail"
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(false)
            .setValue(
                config.thumbnail || ""
            );

    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(imagem),

        new ActionRowBuilder()
            .addComponents(thumbnail)
    );

    return modal;
}

// =====================================================
// 📌 MODAL RODAPÉ
// =====================================================

function modalRodape(config) {
    const modal =
        new ModalBuilder()
            .setCustomId(
                `rr_modal_rodape_${config.id}`
            )
            .setTitle(
                "📌 Rodapé"
            );

    const rodape =
        new TextInputBuilder()
            .setCustomId(
                "rodape"
            )
            .setLabel(
                "Texto do rodapé"
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(false)
            .setValue(
                config.footer_texto || ""
            );

    const icone =
        new TextInputBuilder()
            .setCustomId(
                "icone"
            )
            .setLabel(
                "Ícone do rodapé (URL)"
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(false)
            .setPlaceholder(
                "https://..."
            )
            .setValue(
                config.footer_icone || ""
            );

    const timestamp =
        new TextInputBuilder()
            .setCustomId(
                "timestamp"
            )
            .setLabel(
                "Mostrar data/hora? (sim/não)"
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(false)
            .setMaxLength(3)
            .setValue(
                sim(config.embed_timestamp)
                    ? "sim"
                    : "não"
            );

    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(rodape),

        new ActionRowBuilder()
            .addComponents(icone),

        new ActionRowBuilder()
            .addComponents(timestamp)
    );

    return modal;
}

// =====================================================
// 🎭 MODAL CARGO
// =====================================================

function modalCargo(config) {
    const modal =
        new ModalBuilder()
            .setCustomId(
                `rr_modal_cargo_${config.id}`
            )
            .setTitle(
                "🎭 Adicionar Cargo / Emoji"
            );

    const emoji =
        new TextInputBuilder()
            .setCustomId(
                "emoji"
            )
            .setLabel(
                "Emoji"
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(true)
            .setPlaceholder(
                "😀 ou <:nome:123456789>"
            );

    const cargo =
        new TextInputBuilder()
            .setCustomId(
                "cargo"
            )
            .setLabel(
                "ID do cargo"
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(true)
            .setPlaceholder(
                "123456789012345678"
            );

    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(emoji),

        new ActionRowBuilder()
            .addComponents(cargo)
    );

    return modal;
}

// =====================================================
// 👤 MODAL AUTOR
// =====================================================

function modalAutor(config) {
    const modal =
        new ModalBuilder()
            .setCustomId(
                `rr_modal_autor_${config.id}`
            )
            .setTitle(
                "👤 Autor do Embed"
            );

    const nome =
        new TextInputBuilder()
            .setCustomId(
                "nome"
            )
            .setLabel(
                "Nome do autor"
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(false)
            .setMaxLength(256)
            .setValue(
                config.embed_autor_nome || ""
            );

    const icone =
        new TextInputBuilder()
            .setCustomId(
                "icone"
            )
            .setLabel(
                "Ícone do autor (URL)"
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(false)
            .setPlaceholder(
                "https://..."
            )
            .setValue(
                config.embed_autor_icone || ""
            );

    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(nome),

        new ActionRowBuilder()
            .addComponents(icone)
    );

    return modal;
}

// =====================================================
// 📋 MODAL CAMPOS
// =====================================================

function modalCampos(config) {
    const modal =
        new ModalBuilder()
            .setCustomId(
                `rr_modal_campos_${config.id}`
            )
            .setTitle(
                "📋 Campos do Embed"
            );

    const campos =
        new TextInputBuilder()
            .setCustomId(
                "campos"
            )
            .setLabel(
                "Um campo por linha (máx. 10)"
            )
            .setStyle(
                TextInputStyle.Paragraph
            )
            .setRequired(false)
            .setMaxLength(3000)
            .setPlaceholder(
                "Nome | Valor | sim (lado a lado) ou não"
            )
            .setValue(
                camposParaTexto(
                    config.embed_campos
                )
            );

    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(campos)
    );

    return modal;
}

// =====================================================
// 🗑️ MODAL REMOVER REAÇÃO
// =====================================================

function modalRemoverReacao(config) {
    const modal =
        new ModalBuilder()
            .setCustomId(
                `rr_modal_remover_${config.id}`
            )
            .setTitle(
                "🗑️ Remover Reação"
            );

    const emoji =
        new TextInputBuilder()
            .setCustomId(
                "emoji"
            )
            .setLabel(
                "Emoji da reação"
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(true)
            .setPlaceholder(
                "😀 ou <:nome:123456789>"
            );

    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(
                emoji
            )
    );

    return modal;
}

// =====================================================
// 📨 ENVIAR / EDITAR MENSAGEM
// =====================================================

async function enviarOuEditar(
    interaction,
    config
) {
    if (
        config.somente_reacoes === true ||
        config.somente_reacoes === 1
    ) {
        if (!config.canal_id) {
            return {
                erro:
                    "❌ Não encontrei o canal da mensagem."
            };
        }

        try {
            const canal =
                await interaction.guild.channels.fetch(
                    config.canal_id
                );

            if (
                !canal ||
                !canal.isTextBased()
            ) {
                return {
                    erro:
                        "❌ O canal da mensagem é inválido."
                };
            }

            const mensagem =
                await canal.messages.fetch(
                    config.mensagem_id
                );

            const cargos =
                await buscarCargos(
                    interaction.guild.id,
                    config.mensagem_id
                );

            await adicionarReacoes(
                mensagem,
                cargos
            );

            return {
                mensagem
            };

        } catch (erro) {
            console.error(
                "❌ Erro ao aplicar reações:",
                erro
            );

            return {
                erro:
                    "❌ Não consegui acessar a mensagem existente."
            };
        }
    }

    if (!config.canal_id) {
        return {
            erro:
                "❌ Primeiro selecione o canal onde a mensagem será enviada."
        };
    }

    const embed =
        criarEmbed(config);

    if (
        !config.content &&
        !embed
    ) {
        return {
            erro:
                "❌ Configure pelo menos uma **Mensagem** ou um **Embed** antes de enviar."
        };
    }

    const canal =
        await interaction.guild.channels.fetch(
            config.canal_id
        );

    if (
        !canal ||
        !canal.isTextBased()
    ) {
        return {
            erro:
                "❌ O canal configurado não é válido."
        };
    }

    let mensagem;

    if (config.mensagem_id) {
        try {
            mensagem =
                await canal.messages.fetch(
                    config.mensagem_id
                );

            await aplicarMensagem(
                mensagem,
                config
            );

        } catch (erro) {
            console.error(
                "❌ Erro ao editar mensagem:",
                erro
            );

            return {
                erro:
                    "❌ Não consegui encontrar ou editar a mensagem configurada."
            };
        }

    } else {
        try {
            mensagem =
                await canal.send({
                    content:
                        config.content || null,

                    embeds:
                        embed
                            ? [embed]
                            : []
                });

        } catch (erro) {
            console.error(
                "❌ Erro ao enviar mensagem:",
                erro
            );

            return {
                erro:
                    "❌ Não consegui enviar a mensagem. Verifique as permissões do bot."
            };
        }

        await mysqlPool.query(
            `
            UPDATE react_role_configs
            SET
                mensagem_id = ?,
                atualizado_em =
                    UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000
            WHERE id = ?
              AND guild_id = ?
            `,
            [
                mensagem.id,
                config.id,
                interaction.guild.id
            ]
        );

        config.mensagem_id =
            mensagem.id;
    }

    const cargos =
        await buscarCargos(
            interaction.guild.id,
            config.mensagem_id
        );

    await adicionarReacoes(
        mensagem,
        cargos
    );

    await sincronizarCargos(
        interaction.guild.id,
        config.mensagem_id,
        config
    );

    return {
        mensagem
    };
}

// =====================================================
// 🎭 PROCESSAR REAÇÃO
// =====================================================

async function handleReaction(
    reaction,
    user,
    adicionar
) {
    try {
        /*
         * O sistema funciona somente quando o usuário
         * ADICIONA uma reação. Remover a reação (inclusive
         * pelo próprio bot) não mexe no cargo.
         */
        if (!adicionar) return;

        if (user.bot) return;

        if (reaction.partial) {
            await reaction.fetch();
        }

        if (reaction.message.partial) {
            await reaction.message.fetch();
        }

        // MessageReaction NÃO tem .guild — o servidor vem da mensagem.
        const guild =
            reaction.message.guild;

        if (!guild) return;

        const mensagemId =
            reaction.message.id;

        const config =
            await buscarConfigMensagem(
                guild.id,
                mensagemId
            );

        if (
            !config ||
            !sim(config.habilitado)
        ) {
            return;
        }

        const cargos =
            await buscarCargos(
                guild.id,
                mensagemId
            );

        const chave =
            chaveEmoji(
                reaction.emoji
            );

        const item =
            cargos.find(
                cargo =>
                    chaveEmoji(cargo.emoji) === chave
            );

        // Emoji que não é do Reaction Role: não mexe em nada.
        if (!item) return;

        // =================================================
        // 🔄 TOGGLE DO CARGO
        // =================================================

        try {
            const membro =
                await guild.members.fetch(
                    user.id
                );

            const cargo =
                await guild.roles.fetch(
                    item.cargo_id
                );

            if (!cargo) {
                console.error(
                    `❌ O cargo ${item.cargo_id} não existe mais.`
                );

            } else if (!cargo.editable) {
                console.error(
                    `❌ Não posso gerenciar o cargo ${cargo.name}. Coloque o cargo do bot acima dele.`
                );

            } else if (
                membro.roles.cache.has(
                    cargo.id
                )
            ) {
                await membro.roles.remove(
                    cargo,
                    "Reaction Role - Toggle"
                );

                console.log(
                    `🎭 Cargo ${cargo.name} removido de ${user.tag || user.id}.`
                );

            } else {
                await membro.roles.add(
                    cargo,
                    "Reaction Role - Toggle"
                );

                console.log(
                    `🎭 Cargo ${cargo.name} dado para ${user.tag || user.id}.`
                );
            }

        } catch (erro) {
            console.error(
                "❌ Erro ao alternar o cargo:",
                erro
            );
        }

        // =================================================
        // 🧹 REMOVER A REAÇÃO DO USUÁRIO
        // =================================================

        try {
            await reaction.users.remove(
                user.id
            );
        } catch (erro) {
            console.error(
                "❌ Não consegui remover a reação do usuário (o bot tem Gerenciar Mensagens?):",
                erro
            );
        }

    } catch (erro) {
        console.error(
            "❌ Erro ao processar Reaction Role:",
            erro
        );
    }
}

// =====================================================
// 🖱️ TRATAR INTERAÇÕES
// =====================================================

async function tratarInteracao(
    interaction
) {
    if (
        !interaction.isButton() &&
        !interaction.isModalSubmit() &&
        !interaction.isChannelSelectMenu()
    ) {
        return false;
    }

    const customId =
        interaction.customId;

    if (
        !customId.startsWith("rr_")
    ) {
        return false;
    }

    if (
        !interaction.memberPermissions ||
        !interaction.memberPermissions.has(
            PermissionFlagsBits.ManageGuild
        )
    ) {
        await interaction.reply({
            content:
                "❌ Você precisa da permissão **Gerenciar Servidor**.",

            flags:
                MessageFlags.Ephemeral
        });

        return true;
    }

    const partes =
        customId.split("_");

    const acao =
        partes[1];

    const configId =
        partes[partes.length - 1];

    const config =
        await buscarConfig(
            configId,
            interaction.guild.id
        );

    if (!config) {
        await interaction.reply({
            content:
                "❌ Essa configuração não existe mais.",

            flags:
                MessageFlags.Ephemeral
        });

        return true;
    }

    const somenteReacoes =
        config.somente_reacoes === true ||
        config.somente_reacoes === 1;

    // =================================================
    // 📢 CANAL
    // =================================================

    if (
        interaction.isChannelSelectMenu() &&
        acao === "canal"
    ) {
        if (somenteReacoes) {
            await interaction.reply({
                content:
                    "❌ O canal de uma mensagem existente não pode ser alterado aqui.",

                flags:
                    MessageFlags.Ephemeral
            });

            return true;
        }

        if (config.mensagem_id) {
            await interaction.reply({
                content:
                    "❌ A mensagem já foi enviada. Para mudar de canal, exclua a mensagem e crie outra.",

                flags:
                    MessageFlags.Ephemeral
            });

            return true;
        }

        const canalId =
            interaction.values[0];

        await mysqlPool.query(
            `
            UPDATE react_role_configs
            SET
                canal_id = ?,
                atualizado_em =
                    UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000
            WHERE id = ?
              AND guild_id = ?
            `,
            [
                canalId,
                config.id,
                interaction.guild.id
            ]
        );

        config.canal_id =
            canalId;

        const cargos =
            await buscarCargos(
                interaction.guild.id,
                config.mensagem_id
            );

        const painel =
            await criarPainel(
                config,
                cargos
            );

        await interaction.update(
            painel
        );

        return true;
    }

    // =================================================
    // 📨 MENSAGEM
    // =================================================

    if (
        interaction.isButton() &&
        acao === "mensagem"
    ) {
        if (somenteReacoes) {
            await interaction.reply({
                content:
                    "❌ Essa é uma mensagem existente. O conteúdo dela não pode ser alterado por este painel.",

                flags:
                    MessageFlags.Ephemeral
            });

            return true;
        }

        await interaction.showModal(
            modalMensagem(config)
        );

        return true;
    }

    // =================================================
    // 🎨 EMBED
    // =================================================

    if (
        interaction.isButton() &&
        acao === "embed"
    ) {
        if (somenteReacoes) {
            await interaction.reply({
                content:
                    "❌ O Embed dessa mensagem não pode ser alterado por este painel.",

                flags:
                    MessageFlags.Ephemeral
            });

            return true;
        }

        await interaction.showModal(
            modalEmbed(config)
        );

        return true;
    }

    // =================================================
    // 🖼️ IMAGENS
    // =================================================

    if (
        interaction.isButton() &&
        acao === "imagens"
    ) {
        if (somenteReacoes) {
            await interaction.reply({
                content:
                    "❌ As imagens dessa mensagem não podem ser alteradas por este painel.",

                flags:
                    MessageFlags.Ephemeral
            });

            return true;
        }

        await interaction.showModal(
            modalImagens(config)
        );

        return true;
    }

    // =================================================
    // 📌 RODAPÉ
    // =================================================

    if (
        interaction.isButton() &&
        acao === "rodape"
    ) {
        if (somenteReacoes) {
            await interaction.reply({
                content:
                    "❌ O rodapé dessa mensagem não pode ser alterado por este painel.",

                flags:
                    MessageFlags.Ephemeral
            });

            return true;
        }

        await interaction.showModal(
            modalRodape(config)
        );

        return true;
    }

    // =================================================
    // 👤 AUTOR / 📋 CAMPOS
    // =================================================

    if (
        interaction.isButton() &&
        (
            acao === "autor" ||
            acao === "campos"
        )
    ) {
        if (somenteReacoes) {
            await interaction.reply({
                content:
                    "❌ O Embed dessa mensagem não pode ser alterado por este painel.",

                flags:
                    MessageFlags.Ephemeral
            });

            return true;
        }

        await interaction.showModal(
            acao === "autor"
                ? modalAutor(config)
                : modalCampos(config)
        );

        return true;
    }

    // =================================================
    // 🎨 EMBED ON / OFF
    // =================================================

    if (
        interaction.isButton() &&
        acao === "embedtoggle"
    ) {
        if (somenteReacoes) {
            await interaction.reply({
                content:
                    "❌ O Embed dessa mensagem não pode ser alterado por este painel.",

                flags:
                    MessageFlags.Ephemeral
            });

            return true;
        }

        await atualizarConfig(
            config.id,
            interaction.guild.id,
            {
                embed_habilitado:
                    !sim(config.embed_habilitado)
            }
        );

        await atualizarPainel(
            interaction,
            config.id
        );

        return true;
    }

    // =================================================
    // 🗑️ EXCLUIR MENSAGEM DO CANAL
    // =================================================

    if (
        interaction.isButton() &&
        acao === "excluir"
    ) {
        if (!config.mensagem_id) {
            await interaction.reply({
                content:
                    "❌ Ainda não existe uma mensagem para excluir.",

                flags:
                    MessageFlags.Ephemeral
            });

            return true;
        }

        await interaction.update({
            content: null,
            ...criarPainelExclusao(config)
        });

        return true;
    }

    if (
        interaction.isButton() &&
        acao === "cancelarexcluir"
    ) {
        await atualizarPainel(
            interaction,
            config.id
        );

        return true;
    }

    if (
        interaction.isButton() &&
        acao === "confirmarexcluir"
    ) {
        await interaction.deferUpdate();

        try {
            if (
                config.canal_id &&
                config.mensagem_id
            ) {
                try {
                    const canal =
                        await interaction.guild.channels.fetch(
                            config.canal_id
                        );

                    if (
                        canal &&
                        canal.isTextBased()
                    ) {
                        const mensagem =
                            await canal.messages.fetch(
                                config.mensagem_id
                            );

                        await mensagem.delete();
                    }

                } catch (erro) {
                    // 10008 = a mensagem já não existe (tudo bem).
                    // 10003 = o canal já não existe (tudo bem).
                    if (
                        erro.code !== 10008 &&
                        erro.code !== 10003
                    ) {
                        throw erro;
                    }
                }
            }

            await excluirConfigDoBanco(
                config,
                interaction.guild.id
            );

            await interaction.editReply({
                content:
                    "🗑️ **Mensagem excluída e configuração removida.**",

                embeds: [],

                components: []
            });

        } catch (erro) {
            console.error(
                "❌ Erro ao excluir a mensagem:",
                erro
            );

            await interaction.followUp({
                content:
                    "❌ Não consegui excluir a mensagem. Verifique se o bot tem a permissão **Gerenciar Mensagens** no canal.",

                flags:
                    MessageFlags.Ephemeral
            });
        }

        return true;
    }

    // =================================================
    // 🎭 CARGOS
    // =================================================

    if (
        interaction.isButton() &&
        acao === "cargos"
    ) {
        if (!config.mensagem_id) {
            await interaction.reply({
                content:
                    "❌ Primeiro envie a mensagem.",

                flags:
                    MessageFlags.Ephemeral
            });

            return true;
        }

        await interaction.showModal(
            modalCargo(config)
        );

        return true;
    }

    // =================================================
    // 🗑️ REMOVER REAÇÃO
    // =================================================

    if (
        interaction.isButton() &&
        acao === "remover"
    ) {
        if (!config.mensagem_id) {
            await interaction.reply({
                content:
                    "❌ Ainda não existe uma mensagem configurada.",

                flags:
                    MessageFlags.Ephemeral
            });

            return true;
        }

        await interaction.showModal(
            modalRemoverReacao(config)
        );

        return true;
    }

    // =================================================
    // 🟢 ATIVAR
    // =================================================

    if (
        interaction.isButton() &&
        acao === "ativar"
    ) {
        await mysqlPool.query(
            `
            UPDATE react_role_configs
            SET
                habilitado = TRUE,
                atualizado_em =
                    UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000
            WHERE id = ?
              AND guild_id = ?
            `,
            [
                config.id,
                interaction.guild.id
            ]
        );

        config.habilitado = 1;

        const cargos =
            await buscarCargos(
                interaction.guild.id,
                config.mensagem_id
            );

        const painel =
            await criarPainel(
                config,
                cargos
            );

        await interaction.update(
            painel
        );

        return true;
    }

    // =================================================
    // 🔴 DESATIVAR
    // =================================================

    if (
        interaction.isButton() &&
        acao === "desativar"
    ) {
        await mysqlPool.query(
            `
            UPDATE react_role_configs
            SET
                habilitado = FALSE,
                atualizado_em =
                    UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000
            WHERE id = ?
              AND guild_id = ?
            `,
            [
                config.id,
                interaction.guild.id
            ]
        );

        config.habilitado = 0;

        const cargos =
            await buscarCargos(
                interaction.guild.id,
                config.mensagem_id
            );

        const painel =
            await criarPainel(
                config,
                cargos
            );

        await interaction.update(
            painel
        );

        return true;
    }

    // =================================================
    // 🧪 TESTAR
    // =================================================

    if (
        interaction.isButton() &&
        acao === "testar"
    ) {
        if (!config.mensagem_id) {
            await interaction.reply({
                content:
                    "❌ Ainda não existe uma mensagem para testar.",

                flags:
                    MessageFlags.Ephemeral
            });

            return true;
        }

        await interaction.deferReply({
            flags:
                MessageFlags.Ephemeral
        });

        try {
            const canal =
                await interaction.guild.channels.fetch(
                    config.canal_id
                );

            if (
                !canal ||
                !canal.isTextBased()
            ) {
                throw new Error(
                    "Canal inválido."
                );
            }

            const mensagem =
                await canal.messages.fetch(
                    config.mensagem_id
                );

            const cargos =
                await buscarCargos(
                    interaction.guild.id,
                    config.mensagem_id
                );

            if (somenteReacoes) {
                await adicionarReacoes(
                    mensagem,
                    cargos
                );

                await interaction.editReply({
                    content:
                        "🧪 **Reações aplicadas à mensagem existente com sucesso!**"
                });

                return true;
            }

            await aplicarMensagem(
                mensagem,
                config
            );

            await adicionarReacoes(
                mensagem,
                cargos
            );

            await interaction.editReply({
                content:
                    "🧪 **Reaction Role atualizado com sucesso!**"
            });

        } catch (erro) {
            console.error(
                "❌ Erro ao testar Reaction Role:",
                erro
            );

            await interaction.editReply({
                content:
                    "❌ Não consegui testar o Reaction Role. Verifique se a mensagem ainda existe."
            });
        }

        return true;
    }

    // =================================================
    // 📤 ENVIAR / 💾 SALVAR
    // =================================================

    if (
        interaction.isButton() &&
        acao === "enviar"
    ) {
        // Enviar a mensagem e reagir pode passar de 3s.
        await interaction.deferUpdate();

        try {
            const resultado =
                await enviarOuEditar(
                    interaction,
                    config
                );

            if (resultado.erro) {
                await interaction.followUp({
                    content:
                        resultado.erro,

                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            const novaConfig =
                await buscarConfig(
                    config.id,
                    interaction.guild.id
                );

            const cargos =
                await buscarCargos(
                    interaction.guild.id,
                    novaConfig.mensagem_id
                );

            const painel =
                await criarPainel(
                    novaConfig,
                    cargos
                );

            await interaction.editReply({
                content: null,
                ...painel
            });

        } catch (erro) {
            console.error(
                "❌ Erro ao salvar Reaction Role:",
                erro
            );

            await interaction.followUp({
                content:
                    "❌ Não consegui salvar o Reaction Role.",

                flags:
                    MessageFlags.Ephemeral
            });
        }

        return true;
    }

    // =================================================
    // ❌ FECHAR
    // =================================================

    if (
        interaction.isButton() &&
        acao === "fechar"
    ) {
        await interaction.update({
            content:
                "✅ Painel fechado.",

            embeds: [],

            components: []
        });

        return true;
    }

    // =================================================
    // 📝 MODAIS
    // =================================================

    if (
        interaction.isModalSubmit() &&
        acao === "modal"
    ) {
        const tipo =
            partes[2];

        // =============================================
        // 📨 MENSAGEM
        // =============================================

        if (tipo === "mensagem") {
            if (somenteReacoes) {
                await interaction.reply({
                    content:
                        "❌ Essa mensagem está no modo somente reações.",

                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            const content =
                interaction.fields.getTextInputValue(
                    "content"
                );

            await mysqlPool.query(
                `
                UPDATE react_role_configs
                SET
                    content = ?,
                    atualizado_em =
                        UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000
                WHERE id = ?
                  AND guild_id = ?
                `,
                [
                    content || null,
                    config.id,
                    interaction.guild.id
                ]
            );
        }

        // =============================================
        // 🎨 EMBED
        // =============================================

        if (tipo === "embed") {
            if (somenteReacoes) {
                await interaction.reply({
                    content:
                        "❌ Essa mensagem está no modo somente reações.",

                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            const titulo =
                interaction.fields.getTextInputValue(
                    "titulo"
                );

            const descricao =
                interaction.fields.getTextInputValue(
                    "descricao"
                );

            const corInformada =
                interaction.fields.getTextInputValue(
                    "cor"
                ).trim();

            const cor =
                normalizarCor(
                    corInformada
                );

            if (
                corInformada &&
                !cor
            ) {
                await interaction.reply({
                    content:
                        "❌ Cor inválida. Use algo como `#00A8FF`.",

                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            const url =
                interaction.fields.getTextInputValue(
                    "url"
                ).trim();

            if (!urlValida(url)) {
                await interaction.reply({
                    content:
                        "❌ O link do título é inválido.",

                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            await mysqlPool.query(
                `
                UPDATE react_role_configs
                SET
                    embed_titulo = ?,
                    embed_descricao = ?,
                    embed_cor = ?,
                    embed_url = ?,
                    embed_habilitado = TRUE,

                    atualizado_em =
                        UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000

                WHERE id = ?
                  AND guild_id = ?
                `,
                [
                    titulo || null,
                    descricao || null,
                    cor,
                    url || null,
                    config.id,
                    interaction.guild.id
                ]
            );
        }

        // =============================================
        // 🖼️ IMAGENS
        // =============================================

        if (tipo === "imagens") {
            if (somenteReacoes) {
                await interaction.reply({
                    content:
                        "❌ Essa mensagem está no modo somente reações.",

                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            const imagem =
                interaction.fields.getTextInputValue(
                    "imagem"
                ).trim();

            const thumbnail =
                interaction.fields.getTextInputValue(
                    "thumbnail"
                ).trim();

            if (
                !urlValida(imagem) ||
                !urlValida(thumbnail)
            ) {
                await interaction.reply({
                    content:
                        "❌ Uma das URLs informadas é inválida.",

                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            await mysqlPool.query(
                `
                UPDATE react_role_configs
                SET
                    imagem = ?,
                    thumbnail = ?,

                    atualizado_em =
                        UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000

                WHERE id = ?
                  AND guild_id = ?
                `,
                [
                    imagem || null,
                    thumbnail || null,
                    config.id,
                    interaction.guild.id
                ]
            );
        }

        // =============================================
        // 📌 RODAPÉ
        // =============================================

        if (tipo === "rodape") {
            if (somenteReacoes) {
                await interaction.reply({
                    content:
                        "❌ Essa mensagem está no modo somente reações.",

                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            const rodape =
                interaction.fields.getTextInputValue(
                    "rodape"
                ).trim();

            const icone =
                interaction.fields.getTextInputValue(
                    "icone"
                ).trim();

            if (!urlValida(icone)) {
                await interaction.reply({
                    content:
                        "❌ A URL do ícone do rodapé é inválida.",

                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            const timestamp =
                REGEX_SIM.test(
                    interaction.fields.getTextInputValue(
                        "timestamp"
                    ).trim()
                );

            await mysqlPool.query(
                `
                UPDATE react_role_configs
                SET
                    footer_texto = ?,
                    footer_habilitado = ?,
                    footer_icone = ?,
                    embed_timestamp = ?,

                    atualizado_em =
                        UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000

                WHERE id = ?
                  AND guild_id = ?
                `,
                [
                    rodape || null,
                    rodape ? true : false,
                    icone || null,
                    timestamp,
                    config.id,
                    interaction.guild.id
                ]
            );
        }

        // =============================================
        // 👤 AUTOR
        // =============================================

        if (tipo === "autor") {
            if (somenteReacoes) {
                await interaction.reply({
                    content:
                        "❌ Essa mensagem está no modo somente reações.",

                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            const nome =
                interaction.fields.getTextInputValue(
                    "nome"
                ).trim();

            const icone =
                interaction.fields.getTextInputValue(
                    "icone"
                ).trim();

            if (!urlValida(icone)) {
                await interaction.reply({
                    content:
                        "❌ A URL do ícone do autor é inválida.",

                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            await atualizarConfig(
                config.id,
                interaction.guild.id,
                {
                    embed_autor_nome: nome || null,
                    embed_autor_icone: icone || null,
                    embed_habilitado: true
                }
            );
        }

        // =============================================
        // 📋 CAMPOS
        // =============================================

        if (tipo === "campos") {
            if (somenteReacoes) {
                await interaction.reply({
                    content:
                        "❌ Essa mensagem está no modo somente reações.",

                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            const campos =
                textoParaCampos(
                    interaction.fields.getTextInputValue(
                        "campos"
                    )
                );

            await atualizarConfig(
                config.id,
                interaction.guild.id,
                {
                    embed_campos:
                        campos.length
                            ? JSON.stringify(campos)
                            : null,

                    embed_habilitado: true
                }
            );
        }

        // =============================================
        // 🎭 CARGO
        // =============================================

        if (tipo === "cargo") {
            if (!config.mensagem_id) {
                await interaction.reply({
                    content:
                        "❌ Primeiro envie ou selecione uma mensagem.",

                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            const emoji =
                interaction.fields.getTextInputValue(
                    "emoji"
                ).trim();

            const cargoId =
                interaction.fields.getTextInputValue(
                    "cargo"
                ).trim();

            if (!idDiscordValido(cargoId)) {
                await interaction.reply({
                    content:
                        "❌ O ID do cargo não é válido.",

                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            const cargo =
                await interaction.guild.roles.fetch(
                    cargoId
                );

            if (!cargo) {
                await interaction.reply({
                    content:
                        "❌ Não encontrei esse cargo.",

                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            if (!cargo.editable) {
                await interaction.reply({
                    content:
                        "❌ Não consigo gerenciar esse cargo. Coloque meu cargo acima dele.",

                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            const emojiNormalizado =
                normalizarEmoji(
                    emoji
                );

            if (!emojiNormalizado) {
                await interaction.reply({
                    content:
                        "❌ Emoji inválido.",

                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            try {
                const canal =
                    await interaction.guild.channels.fetch(
                        config.canal_id
                    );

                if (
                    !canal ||
                    !canal.isTextBased()
                ) {
                    throw new Error(
                        "Canal inválido."
                    );
                }

                const mensagem =
                    await canal.messages.fetch(
                        config.mensagem_id
                    );

                try {
                    await mensagem.react(
                        emojiNormalizado
                    );

                } catch (erro) {
                    console.error(
                        "❌ Erro ao adicionar reação:",
                        erro
                    );

                    await interaction.reply({
                        content:
                            "❌ Não consegui adicionar esse emoji à mensagem. Verifique se o emoji é válido e se o bot consegue usá-lo.",

                        flags:
                            MessageFlags.Ephemeral
                    });

                    return true;
                }

                await salvarCargo({
                    guildId:
                        interaction.guild.id,

                    mensagemId:
                        config.mensagem_id,

                    emoji:
                        emojiNormalizado,

                    cargoId:
                        cargo.id,

                    config
                });

            } catch (erro) {
                console.error(
                    "❌ Erro ao adicionar cargo:",
                    erro
                );

                await interaction.reply({
                    content:
                        "❌ Não consegui adicionar essa reação à mensagem.",

                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }
        }

        // =============================================
        // 🗑️ REMOVER REAÇÃO
        // =============================================

        if (tipo === "remover") {
            if (!config.mensagem_id) {
                await interaction.reply({
                    content:
                        "❌ Essa configuração ainda não possui uma mensagem.",

                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            const emoji =
                interaction.fields.getTextInputValue(
                    "emoji"
                ).trim();

            const emojiNormalizado =
                normalizarEmoji(
                    emoji
                );

            if (!emojiNormalizado) {
                await interaction.reply({
                    content:
                        "❌ Emoji inválido.",

                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            const removido =
                await removerCargoReacao(
                    interaction.guild.id,
                    config.mensagem_id,
                    emojiNormalizado
                );

            if (!removido) {
                await interaction.reply({
                    content:
                        `❌ Não encontrei a reação **${emojiNormalizado}** configurada neste painel.`,

                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            try {
                const canal =
                    await interaction.guild.channels.fetch(
                        config.canal_id
                    );

                if (
                    canal &&
                    canal.isTextBased()
                ) {
                    const mensagem =
                        await canal.messages.fetch(
                            config.mensagem_id
                        );

                    await removerReacaoDaMensagem(
                        mensagem,
                        emojiNormalizado
                    );
                }
            } catch (erro) {
                console.error(
                    "❌ Não consegui remover a reação da mensagem:",
                    erro
                );
            }

            console.log(
                `🗑️ Reação ${emojiNormalizado} removida do Reaction Role ${config.mensagem_id}.`
            );
        }

        // =============================================
        // 🔄 ATUALIZAR PAINEL
        // =============================================

        const novaConfig =
            await buscarConfig(
                config.id,
                interaction.guild.id
            );

        const cargos =
            await buscarCargos(
                interaction.guild.id,
                novaConfig.mensagem_id
            );

        const painel =
            await criarPainel(
                novaConfig,
                cargos
            );

        // O modal veio de um botão do painel: edita o painel NO LUGAR
        // (em vez de mandar outra mensagem e deixar a antiga).
        if (
            interaction.isFromMessage &&
            interaction.isFromMessage()
        ) {
            await interaction.update({
                content: null,
                ...painel
            });

        } else {
            await interaction.reply({
                ...painel,

                flags:
                    MessageFlags.Ephemeral
            });
        }

        return true;
    }

    return true;
}

// =====================================================
// ▶️ EXECUTE
// =====================================================

async function execute(interaction) {
    if (
        !interaction.memberPermissions ||
        !interaction.memberPermissions.has(
            PermissionFlagsBits.ManageGuild
        )
    ) {
        return interaction.reply({
            content:
                "❌ Você precisa da permissão **Gerenciar Servidor** para usar este comando.",

            flags:
                MessageFlags.Ephemeral
        });
    }

    try {
        await garantirTabela();

        const subcomando =
            interaction.options.getSubcommand();

        // =================================================
        // ➕ ADICIONAR
        // =================================================

        if (
            subcomando === "adicionar"
        ) {
            const configId =
                await criarConfig(
                    interaction.guild.id,
                    false
                );

            const config =
                await buscarConfig(
                    configId,
                    interaction.guild.id
                );

            const painel =
                await criarPainelAdicionar(
                    config,
                    []
                );

            return interaction.reply({
                ...painel,

                flags:
                    MessageFlags.Ephemeral
            });
        }

        // =================================================
        // ✏️ EDITAR
        // =================================================

        if (
            subcomando === "editar"
        ) {
            const mensagemId =
                interaction.options
                    .getString(
                        "mensagem"
                    )
                    .trim();

            if (
                !idDiscordValido(
                    mensagemId
                )
            ) {
                return interaction.reply({
                    content:
                        "❌ O ID da mensagem não é válido.",

                    flags:
                        MessageFlags.Ephemeral
                });
            }

            let config =
                await buscarConfigMensagem(
                    interaction.guild.id,
                    mensagemId
                );

            let encontrada = null;

            if (config && config.canal_id) {
                try {
                    const canal =
                        await interaction.guild.channels.fetch(
                            config.canal_id
                        );

                    if (
                        canal &&
                        canal.isTextBased()
                    ) {
                        const mensagem =
                            await canal.messages.fetch(
                                mensagemId
                            );

                        encontrada = {
                            mensagem,
                            canal
                        };
                    }
                } catch {
                    encontrada = null;
                }
            }

            if (!encontrada) {
                encontrada =
                    await localizarMensagem(
                        interaction.guild,
                        mensagemId
                    );
            }

            if (!encontrada) {
                return interaction.reply({
                    content:
                        "❌ Não consegui encontrar essa mensagem em nenhum canal acessível ao bot.",

                    flags:
                        MessageFlags.Ephemeral
                });
            }

            const mensagemDoBot =
                encontrada.mensagem.author &&
                encontrada.mensagem.author.id ===
                    interaction.client.user.id;

            if (!config) {
                const configId =
                    await criarConfig(
                        interaction.guild.id,
                        !mensagemDoBot
                    );

                await mysqlPool.query(
                    `
                    UPDATE react_role_configs
                    SET
                        canal_id = ?,
                        mensagem_id = ?,
                        somente_reacoes = ?,
                        atualizado_em =
                            UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000
                    WHERE id = ?
                      AND guild_id = ?
                    `,
                    [
                        encontrada.canal.id,
                        mensagemId,
                        mensagemDoBot ? false : true,
                        configId,
                        interaction.guild.id
                    ]
                );

                config =
                    await buscarConfig(
                        configId,
                        interaction.guild.id
                    );
            }

            // =================================================
            // 🤖 MENSAGEM DO BOT
            // =================================================

            if (mensagemDoBot) {
                await mysqlPool.query(
                    `
                    UPDATE react_role_configs
                    SET
                        canal_id = ?,
                        mensagem_id = ?,
                        somente_reacoes = FALSE,
                        atualizado_em =
                            UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000
                    WHERE id = ?
                      AND guild_id = ?
                    `,
                    [
                        encontrada.canal.id,
                        mensagemId,
                        config.id,
                        interaction.guild.id
                    ]
                );

                config.canal_id =
                    encontrada.canal.id;

                config.mensagem_id =
                    mensagemId;

                config.somente_reacoes = 0;

                const cargos =
                    await buscarCargos(
                        interaction.guild.id,
                        mensagemId
                    );

                const painel =
                    await criarPainelAdicionar(
                        config,
                        cargos
                    );

                return interaction.reply({
                    ...painel,

                    flags:
                        MessageFlags.Ephemeral
                });
            }

            // =================================================
            // 👤 OUTRA PESSOA / OUTRO BOT
            // =================================================

            await mysqlPool.query(
                `
                UPDATE react_role_configs
                SET
                    canal_id = ?,
                    mensagem_id = ?,
                    somente_reacoes = TRUE,
                    atualizado_em =
                        UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000
                WHERE id = ?
                  AND guild_id = ?
                `,
                [
                    encontrada.canal.id,
                    mensagemId,
                    config.id,
                    interaction.guild.id
                ]
            );

            config.canal_id =
                encontrada.canal.id;

            config.mensagem_id =
                mensagemId;

            config.somente_reacoes = 1;

            const cargos =
                await buscarCargos(
                    interaction.guild.id,
                    mensagemId
                );

            const painel =
                await criarPainelEditar(
                    config,
                    cargos
                );

            return interaction.reply({
                ...painel,

                flags:
                    MessageFlags.Ephemeral
            });
        }

        return interaction.reply({
            content:
                "❌ Subcomando inválido.",

            flags:
                MessageFlags.Ephemeral
        });

    } catch (erro) {
        console.error(
            "❌ Erro ao abrir painel do Reaction Role:",
            erro
        );

        if (!interaction.replied) {
            return interaction.reply({
                content:
                    "❌ Não consegui abrir o painel de configuração do Reaction Role.",

                flags:
                    MessageFlags.Ephemeral
            });
        }
    }
}

// =====================================================
// 📦 EXPORT
// =====================================================

module.exports = {
    data,
    execute,
    handleReaction,
    tratarInteracao
};
