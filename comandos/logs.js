const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    ChannelType,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

const { pool } = require("../database/database");

const TIPOS_LOG = {
    mensagens: {
        nome: "💬 Mensagens",
        descricao: "Configure separadamente mensagens editadas e apagadas."
    },

    mensagens_editadas: {
        nome: "✏️ Mensagens editadas",
        descricao: "Registra quando uma mensagem é editada."
    },

    mensagens_apagadas: {
        nome: "🗑️ Mensagens apagadas",
        descricao: "Registra quando uma mensagem é apagada."
    },

    membros: {
        nome: "👤 Membros",
        descricao: "Configure alterações no perfil e cargos dos membros."
    },

    membros_nickname: {
        nome: "🏷️ Nickname alterado",
        descricao: "Registra quando o nickname de um membro é alterado."
    },

    membros_avatar: {
        nome: "🖼️ Avatar alterado",
        descricao: "Registra quando o avatar de um membro é alterado."
    },

    membros_banner: {
        nome: "🎨 Banner alterado",
        descricao: "Registra quando o banner de um membro é alterado."
    },

    membros_cargos: {
        nome: "🛡️ Cargos alterados",
        descricao: "Registra quando os cargos de um membro são adicionados ou removidos."
    },

    moderacao: {
        nome: "🔨 Moderação",
        descricao: "Configure separadamente as ações de moderação."
    },

    moderacao_ban: {
        nome: "🔨 Banimentos",
        descricao: "Registra quando um membro é banido."
    },

    moderacao_kick: {
        nome: "👢 Expulsões",
        descricao: "Registra quando um membro é expulso."
    },

    moderacao_timeout: {
        nome: "🔇 Timeouts",
        descricao: "Registra quando um membro recebe ou perde um timeout."
    },

    moderacao_clear: {
        nome: "🧹 Mensagens limpas",
        descricao: "Registra quando mensagens são apagadas usando o comando clear."
    },

    // =====================================================
    // 🎙️ VOZ
    // =====================================================

    voz: {
        nome: "🎙️ Voz",
        descricao: "Configure separadamente os eventos de voz."
    },

    voz_entrada: {
        nome: "🟢 Entrada na call",
        descricao: "Registra quando um membro entra em um canal de voz."
    },

    voz_saida: {
        nome: "🔴 Saída da call",
        descricao: "Registra quando um membro sai de um canal de voz."
    },

    voz_mudanca: {
        nome: "🔄 Mudança de canal",
        descricao: "Registra quando um membro muda de um canal de voz para outro."
    }
};

const TIPOS_PRINCIPAIS = {
    mensagens: TIPOS_LOG.mensagens,
    membros: TIPOS_LOG.membros,
    moderacao: TIPOS_LOG.moderacao,
    voz: TIPOS_LOG.voz
};

const SUBTIPOS_MENSAGENS = [
    "mensagens_editadas",
    "mensagens_apagadas"
];

const SUBTIPOS_MEMBROS = [
    "membros_nickname",
    "membros_avatar",
    "membros_banner",
    "membros_cargos"
];

const SUBTIPOS_MODERACAO = [
    "moderacao_ban",
    "moderacao_kick",
    "moderacao_timeout",
    "moderacao_clear"
];

const SUBTIPOS_VOZ = [
    "voz_entrada",
    "voz_saida",
    "voz_mudanca"
];

const SUBTIPOS = [
    ...SUBTIPOS_MENSAGENS,
    ...SUBTIPOS_MEMBROS,
    ...SUBTIPOS_MODERACAO,
    ...SUBTIPOS_VOZ
];

function criarEmbedConfig() {
    return new EmbedBuilder()
        .setTitle("⚙️ Configuração de Logs")
        .setDescription(
            "Escolha abaixo o tipo de log que deseja configurar.\n\n" +
            "Cada tipo pode ter um canal diferente, e vários tipos podem usar o mesmo canal."
        )
        .setColor(0x5865F2);
}

function criarMenuTipos() {
    return new StringSelectMenuBuilder()
        .setCustomId("logs_tipo")
        .setPlaceholder("📋 Escolha o tipo de log")
        .addOptions(
            Object.entries(TIPOS_PRINCIPAIS).map(
                ([id, dados]) => ({
                    label: dados.nome
                        .replace(/^.{2}/, "")
                        .trim(),
                    description: dados.descricao,
                    value: id,
                    emoji: dados.nome.substring(0, 2)
                })
            )
        );
}

async function buscarConfig(guildId, tipo) {
    const resultado = await pool.query(
        `
        SELECT canal_id
        FROM logs_config
        WHERE guild_id = $1
          AND tipo = $2
        `,
        [guildId, tipo]
    );

    return resultado.rows[0] || null;
}

async function salvarConfig(guildId, tipo, canalId) {
    await pool.query(
        `
        INSERT INTO logs_config (guild_id, tipo, canal_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (guild_id, tipo)
        DO UPDATE SET canal_id = EXCLUDED.canal_id
        `,
        [guildId, tipo, canalId]
    );
}

async function removerConfig(guildId, tipo) {
    await pool.query(
        `
        DELETE FROM logs_config
        WHERE guild_id = $1
          AND tipo = $2
        `,
        [guildId, tipo]
    );
}

function criarMenuCanal(tipo) {
    return new ChannelSelectMenuBuilder()
        .setCustomId(`logs_canal_${tipo}`)
        .setPlaceholder("📢 Escolha o canal dos logs")
        .setChannelTypes(ChannelType.GuildText);
}

function criarBotaoVoltar(customId) {
    return new ButtonBuilder()
        .setCustomId(customId)
        .setLabel("Voltar")
        .setEmoji("↩️")
        .setStyle(ButtonStyle.Secondary);
}

function ehSubtipo(tipo) {
    return (
        SUBTIPOS_MENSAGENS.includes(tipo) ||
        SUBTIPOS_MEMBROS.includes(tipo) ||
        SUBTIPOS_MODERACAO.includes(tipo) ||
        SUBTIPOS_VOZ.includes(tipo)
    );
}

function criarBotoesConfig(tipo) {
    let voltarId = "logs_voltar";

    if (ehSubtipo(tipo)) {
        voltarId = "logs_voltar_subtipo";
    }

    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`logs_alterar_${tipo}`)
            .setLabel("Alterar canal")
            .setEmoji("🔄")
            .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
            .setCustomId(`logs_remover_${tipo}`)
            .setLabel("Desativar")
            .setEmoji("🔴")
            .setStyle(ButtonStyle.Danger),

        criarBotaoVoltar(voltarId)
    );
}

// =====================================================
// 💬 MENSAGENS
// =====================================================

async function mostrarMensagens(interaction) {
    const editadas = await buscarConfig(
        interaction.guild.id,
        "mensagens_editadas"
    );

    const apagadas = await buscarConfig(
        interaction.guild.id,
        "mensagens_apagadas"
    );

    const embed = new EmbedBuilder()
        .setTitle("💬 Mensagens")
        .setDescription(
            "Configure separadamente os logs de mensagens editadas e apagadas.\n\n" +

            `✏️ **Mensagens editadas:** ${
                editadas
                    ? `🟢 Ativado → <#${editadas.canal_id}>`
                    : "🔴 Desativado"
            }\n\n` +

            `🗑️ **Mensagens apagadas:** ${
                apagadas
                    ? `🟢 Ativado → <#${apagadas.canal_id}>`
                    : "🔴 Desativado"
            }`
        )
        .setColor(0x5865F2);

    await interaction.update({
        embeds: [embed],
        components: [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("logs_mensagens_editadas")
                    .setLabel("Editadas")
                    .setEmoji("✏️")
                    .setStyle(
                        editadas
                            ? ButtonStyle.Success
                            : ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId("logs_mensagens_apagadas")
                    .setLabel("Apagadas")
                    .setEmoji("🗑️")
                    .setStyle(
                        apagadas
                            ? ButtonStyle.Success
                            : ButtonStyle.Secondary
                    ),

                criarBotaoVoltar("logs_voltar")
            )
        ]
    });
}

// =====================================================
// 👤 MEMBROS
// =====================================================

async function mostrarMembros(interaction) {
    const nickname = await buscarConfig(
        interaction.guild.id,
        "membros_nickname"
    );

    const avatar = await buscarConfig(
        interaction.guild.id,
        "membros_avatar"
    );

    const banner = await buscarConfig(
        interaction.guild.id,
        "membros_banner"
    );

    const cargos = await buscarConfig(
        interaction.guild.id,
        "membros_cargos"
    );

    const embed = new EmbedBuilder()
        .setTitle("👤 Membros")
        .setDescription(
            "Configure separadamente os logs de alterações nos membros.\n\n" +

            `🏷️ **Nickname:** ${
                nickname
                    ? `🟢 Ativado → <#${nickname.canal_id}>`
                    : "🔴 Desativado"
            }\n\n` +

            `🖼️ **Avatar:** ${
                avatar
                    ? `🟢 Ativado → <#${avatar.canal_id}>`
                    : "🔴 Desativado"
            }\n\n` +

            `🎨 **Banner:** ${
                banner
                    ? `🟢 Ativado → <#${banner.canal_id}>`
                    : "🔴 Desativado"
            }\n\n` +

            `🛡️ **Cargos:** ${
                cargos
                    ? `🟢 Ativado → <#${cargos.canal_id}>`
                    : "🔴 Desativado"
            }`
        )
        .setColor(0x5865F2);

    await interaction.update({
        embeds: [embed],
        components: [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("logs_membros_nickname")
                    .setLabel("Nickname")
                    .setEmoji("🏷️")
                    .setStyle(
                        nickname
                            ? ButtonStyle.Success
                            : ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId("logs_membros_avatar")
                    .setLabel("Avatar")
                    .setEmoji("🖼️")
                    .setStyle(
                        avatar
                            ? ButtonStyle.Success
                            : ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId("logs_membros_banner")
                    .setLabel("Banner")
                    .setEmoji("🎨")
                    .setStyle(
                        banner
                            ? ButtonStyle.Success
                            : ButtonStyle.Secondary
                    )
            ),

            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("logs_membros_cargos")
                    .setLabel("Cargos")
                    .setEmoji("🛡️")
                    .setStyle(
                        cargos
                            ? ButtonStyle.Success
                            : ButtonStyle.Secondary
                    ),

                criarBotaoVoltar("logs_voltar")
            )
        ]
    });
}

// =====================================================
// 🔨 MODERAÇÃO
// =====================================================

async function mostrarModeracao(interaction) {
    const ban = await buscarConfig(
        interaction.guild.id,
        "moderacao_ban"
    );

    const kick = await buscarConfig(
        interaction.guild.id,
        "moderacao_kick"
    );

    const timeout = await buscarConfig(
        interaction.guild.id,
        "moderacao_timeout"
    );

    const clear = await buscarConfig(
        interaction.guild.id,
        "moderacao_clear"
    );

    const embed = new EmbedBuilder()
        .setTitle("🔨 Moderação")
        .setDescription(
            "Configure separadamente os logs das ações de moderação.\n\n" +

            `🔨 **Banimentos:** ${
                ban
                    ? `🟢 Ativado → <#${ban.canal_id}>`
                    : "🔴 Desativado"
            }\n\n` +

            `👢 **Expulsões:** ${
                kick
                    ? `🟢 Ativado → <#${kick.canal_id}>`
                    : "🔴 Desativado"
            }\n\n` +

            `🔇 **Timeouts:** ${
                timeout
                    ? `🟢 Ativado → <#${timeout.canal_id}>`
                    : "🔴 Desativado"
            }\n\n` +

            `🧹 **Mensagens limpas:** ${
                clear
                    ? `🟢 Ativado → <#${clear.canal_id}>`
                    : "🔴 Desativado"
            }`
        )
        .setColor(0x5865F2);

    await interaction.update({
        embeds: [embed],
        components: [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("logs_moderacao_ban")
                    .setLabel("Banimentos")
                    .setEmoji("🔨")
                    .setStyle(
                        ban
                            ? ButtonStyle.Success
                            : ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId("logs_moderacao_kick")
                    .setLabel("Expulsões")
                    .setEmoji("👢")
                    .setStyle(
                        kick
                            ? ButtonStyle.Success
                            : ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId("logs_moderacao_timeout")
                    .setLabel("Timeouts")
                    .setEmoji("🔇")
                    .setStyle(
                        timeout
                            ? ButtonStyle.Success
                            : ButtonStyle.Secondary
                    )
            ),

            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("logs_moderacao_clear")
                    .setLabel("Mensagens limpas")
                    .setEmoji("🧹")
                    .setStyle(
                        clear
                            ? ButtonStyle.Success
                            : ButtonStyle.Secondary
                    ),

                criarBotaoVoltar("logs_voltar")
            )
        ]
    });
}

// =====================================================
// 🎙️ VOZ
// =====================================================

async function mostrarVoz(interaction) {
    const entrada = await buscarConfig(
        interaction.guild.id,
        "voz_entrada"
    );

    const saida = await buscarConfig(
        interaction.guild.id,
        "voz_saida"
    );

    const mudanca = await buscarConfig(
        interaction.guild.id,
        "voz_mudanca"
    );

    const embed = new EmbedBuilder()
        .setTitle("🎙️ Voz")
        .setDescription(
            "Configure separadamente os logs dos eventos de voz.\n\n" +

            `🟢 **Entrada na call:** ${
                entrada
                    ? `Ativado → <#${entrada.canal_id}>`
                    : "🔴 Desativado"
            }\n\n` +

            `🔴 **Saída da call:** ${
                saida
                    ? `Ativado → <#${saida.canal_id}>`
                    : "🔴 Desativado"
            }\n\n` +

            `🔄 **Mudança de canal:** ${
                mudanca
                    ? `Ativado → <#${mudanca.canal_id}>`
                    : "🔴 Desativado"
            }`
        )
        .setColor(0x5865F2);

    await interaction.update({
        embeds: [embed],
        components: [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("logs_voz_entrada")
                    .setLabel("Entrada")
                    .setEmoji("🟢")
                    .setStyle(
                        entrada
                            ? ButtonStyle.Success
                            : ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId("logs_voz_saida")
                    .setLabel("Saída")
                    .setEmoji("🔴")
                    .setStyle(
                        saida
                            ? ButtonStyle.Success
                            : ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId("logs_voz_mudanca")
                    .setLabel("Mudança")
                    .setEmoji("🔄")
                    .setStyle(
                        mudanca
                            ? ButtonStyle.Success
                            : ButtonStyle.Secondary
                    )
            ),

            new ActionRowBuilder().addComponents(
                criarBotaoVoltar("logs_voltar")
            )
        ]
    });
}

// =====================================================
// ⚙️ CONFIGURAÇÃO DE SUBTIPO
// =====================================================

async function mostrarConfiguracaoSubtipo(
    interaction,
    tipo
) {
    const dados = TIPOS_LOG[tipo];

    if (!dados) return;

    const config = await buscarConfig(
        interaction.guild.id,
        tipo
    );

    const embed = new EmbedBuilder()
        .setTitle(dados.nome)
        .setDescription(
            `${dados.descricao}\n\n` +

            (
                config
                    ? `🟢 **Ativado**\n\n📢 **Canal atual:** <#${config.canal_id}>\n\nEscolha uma ação abaixo.`
                    : "🔴 **Desativado**\n\nEscolha um canal para ativar este log."
            )
        )
        .setColor(
            config
                ? 0x57F287
                : 0xED4245
        );

    const componentes = [];

    if (!config) {
        componentes.push(
            new ActionRowBuilder().addComponents(
                criarMenuCanal(tipo)
            )
        );

        componentes.push(
            new ActionRowBuilder().addComponents(
                criarBotaoVoltar("logs_voltar_subtipo")
            )
        );
    } else {
        componentes.push(
            criarBotoesConfig(tipo)
        );
    }

    await interaction.update({
        embeds: [embed],
        components: componentes
    });
}

// =====================================================
// 📋 MOSTRAR TIPO
// =====================================================

async function mostrarTipo(interaction, tipo) {
    if (tipo === "mensagens") {
        return mostrarMensagens(interaction);
    }

    if (tipo === "membros") {
        return mostrarMembros(interaction);
    }

    if (tipo === "moderacao") {
        return mostrarModeracao(interaction);
    }

    if (tipo === "voz") {
        return mostrarVoz(interaction);
    }

    const dados = TIPOS_LOG[tipo];

    if (!dados) return;

    const config = await buscarConfig(
        interaction.guild.id,
        tipo
    );

    const embed = new EmbedBuilder()
        .setTitle(dados.nome)
        .setDescription(
            `${dados.descricao}\n\n` +

            (
                config
                    ? `🟢 **Ativado**\n\n📢 **Canal atual:** <#${config.canal_id}>\n\nEscolha uma ação abaixo.`
                    : "🔴 **Desativado**\n\nEscolha um canal para ativar este log."
            )
        )
        .setColor(
            config
                ? 0x57F287
                : 0xED4245
        );

    const componentes = [];

    if (!config) {
        componentes.push(
            new ActionRowBuilder().addComponents(
                criarMenuCanal(tipo)
            )
        );
    } else {
        componentes.push(
            criarBotoesConfig(tipo)
        );
    }

    await interaction.update({
        embeds: [embed],
        components: componentes
    });
}

// =====================================================
// 📋 PAINEL
// =====================================================

async function mostrarPainel(interaction) {
    await interaction.update({
        embeds: [criarEmbedConfig()],
        components: [
            new ActionRowBuilder().addComponents(
                criarMenuTipos()
            )
        ]
    });
}

// =====================================================
// 📊 STATUS
// =====================================================

async function mostrarStatus(interaction) {
    const resultado = await pool.query(
        `
        SELECT tipo, canal_id
        FROM logs_config
        WHERE guild_id = $1
        ORDER BY tipo
        `,
        [interaction.guild.id]
    );

    const buscarCanal = tipo =>
        resultado.rows.find(
            row => row.tipo === tipo
        );

    const editadas =
        buscarCanal("mensagens_editadas");

    const apagadas =
        buscarCanal("mensagens_apagadas");

    const nickname =
        buscarCanal("membros_nickname");

    const avatar =
        buscarCanal("membros_avatar");

    const banner =
        buscarCanal("membros_banner");

    const cargos =
        buscarCanal("membros_cargos");

    const ban =
        buscarCanal("moderacao_ban");

    const kick =
        buscarCanal("moderacao_kick");

    const timeout =
        buscarCanal("moderacao_timeout");

    const clear =
        buscarCanal("moderacao_clear");

    const vozEntrada =
        buscarCanal("voz_entrada");

    const vozSaida =
        buscarCanal("voz_saida");

    const vozMudanca =
        buscarCanal("voz_mudanca");

    let descricao =
        `💬 **Mensagens**\n` +
        `✏️ Editadas → ${
            editadas
                ? `<#${editadas.canal_id}>`
                : "❌ Desativado"
        }\n` +
        `🗑️ Apagadas → ${
            apagadas
                ? `<#${apagadas.canal_id}>`
                : "❌ Desativado"
        }\n\n` +

        `👤 **Membros**\n` +
        `🏷️ Nickname → ${
            nickname
                ? `<#${nickname.canal_id}>`
                : "❌ Desativado"
        }\n` +
        `🖼️ Avatar → ${
            avatar
                ? `<#${avatar.canal_id}>`
                : "❌ Desativado"
        }\n` +
        `🎨 Banner → ${
            banner
                ? `<#${banner.canal_id}>`
                : "❌ Desativado"
        }\n` +
        `🛡️ Cargos → ${
            cargos
                ? `<#${cargos.canal_id}>`
                : "❌ Desativado"
        }\n\n` +

        `🔨 **Moderação**\n` +
        `🔨 Banimentos → ${
            ban
                ? `<#${ban.canal_id}>`
                : "❌ Desativado"
        }\n` +
        `👢 Expulsões → ${
            kick
                ? `<#${kick.canal_id}>`
                : "❌ Desativado"
        }\n` +
        `🔇 Timeouts → ${
            timeout
                ? `<#${timeout.canal_id}>`
                : "❌ Desativado"
        }\n` +
        `🧹 Mensagens limpas → ${
            clear
                ? `<#${clear.canal_id}>`
                : "❌ Desativado"
        }\n\n` +

        `🎙️ **Voz**\n` +
        `🟢 Entrada → ${
            vozEntrada
                ? `<#${vozEntrada.canal_id}>`
                : "❌ Desativado"
        }\n` +
        `🔴 Saída → ${
            vozSaida
                ? `<#${vozSaida.canal_id}>`
                : "❌ Desativado"
        }\n` +
        `🔄 Mudança → ${
            vozMudanca
                ? `<#${vozMudanca.canal_id}>`
                : "❌ Desativado"
        }`;

    const embed = new EmbedBuilder()
        .setTitle("📋 Status dos Logs")
        .setDescription(descricao)
        .setColor(0x5865F2);

    await interaction.reply({
        embeds: [embed],
        ephemeral: true
    });
}

// =====================================================
// 📝 REGISTRAR LOG
// =====================================================

async function registrarLog(guild, tipo, embed) {
    if (!guild) return;

    const config = await buscarConfig(
        guild.id,
        tipo
    );

    if (!config) return;

    const canal = guild.channels.cache.get(
        config.canal_id
    );

    if (!canal || !canal.isTextBased()) return;

    try {
        await canal.send({
            embeds: [embed]
        });
    } catch (erro) {
        console.error(
            `❌ Não foi possível enviar log de ${tipo}:`,
            erro
        );
    }
}

// =====================================================
// 🗑️ REGISTRAR MENSAGENS APAGADAS
// =====================================================

async function registrarMensagensApagadas(
    guild,
    mensagens
) {
    if (
        !guild ||
        !Array.isArray(mensagens) ||
        mensagens.length === 0
    ) {
        return;
    }

    const config = await buscarConfig(
        guild.id,
        "mensagens_apagadas"
    );

    if (!config) return;

    const canal = guild.channels.cache.get(
        config.canal_id
    );

    if (!canal || !canal.isTextBased()) return;

    try {
        if (mensagens.length === 1) {
            const mensagem = mensagens[0];

            const embed = new EmbedBuilder()
                .setTitle("🗑️ Mensagem apagada")
                .setColor(0xED4245)
                .setDescription(
                    `👤 **Autor:** ${
                        mensagem.authorId
                            ? `<@${mensagem.authorId}>`
                            : "Desconhecido"
                    }\n` +

                    `📢 **Canal:** ${
                        mensagem.channelId
                            ? `<#${mensagem.channelId}>`
                            : "Desconhecido"
                    }\n\n` +

                    `💬 **Mensagem:**\n` +
                    `${
                        mensagem.content?.trim() ||
                        "*Sem conteúdo de texto*"
                    }`
                )
                .setTimestamp();

            if (mensagem.messageId) {
                embed.setFooter({
                    text: `ID: ${mensagem.messageId}`
                });
            }

            return await canal.send({
                embeds: [embed]
            });
        }

        let texto = "";

        texto += "========================================\n";
        texto += "        MENSAGENS APAGADAS\n";
        texto += "========================================\n\n";

        texto += `Servidor: ${guild.name}\n`;
        texto += `Servidor ID: ${guild.id}\n`;
        texto += `Quantidade: ${mensagens.length}\n`;
        texto += `Data: ${new Date().toLocaleString("pt-BR")}\n\n`;

        mensagens.forEach((mensagem, index) => {
            texto += "----------------------------------------\n";
            texto += `Mensagem ${index + 1}\n`;
            texto += "----------------------------------------\n";

            texto += `Autor: ${
                mensagem.authorTag ||
                (
                    mensagem.authorId
                        ? `<@${mensagem.authorId}>`
                        : "Desconhecido"
                )
            }\n`;

            texto += `Autor ID: ${
                mensagem.authorId ||
                "Desconhecido"
            }\n`;

            texto += `Canal: ${
                mensagem.channelId
                    ? `<#${mensagem.channelId}>`
                    : "Desconhecido"
            }\n`;

            texto += `Mensagem ID: ${
                mensagem.messageId ||
                "Desconhecido"
            }\n`;

            texto += `Data: ${
                mensagem.createdTimestamp
                    ? new Date(
                          mensagem.createdTimestamp
                      ).toLocaleString("pt-BR")
                    : "Desconhecida"
            }\n\n`;

            texto += "Conteúdo:\n";

            texto += `${
                mensagem.content?.trim() ||
                "[Sem conteúdo de texto]"
            }\n\n`;

            if (
                Array.isArray(mensagem.attachments) &&
                mensagem.attachments.length > 0
            ) {
                texto += "Anexos:\n";

                mensagem.attachments.forEach(
                    (anexo, anexoIndex) => {
                        texto += `${
                            anexoIndex + 1
                        }. ${
                            anexo.name ||
                            anexo.url ||
                            "Anexo"
                        }\n`;

                        if (anexo.url) {
                            texto += `   ${anexo.url}\n`;
                        }
                    }
                );

                texto += "\n";
            }
        });

        const arquivo = Buffer.from(
            texto,
            "utf8"
        );

        const embed = new EmbedBuilder()
            .setTitle("🗑️ Mensagens apagadas")
            .setDescription(
                `Foram apagadas **${mensagens.length} mensagens** em sequência.\n\n` +
                "📄 O conteúdo completo foi enviado no arquivo `.txt`."
            )
            .setColor(0xED4245)
            .setTimestamp();

        await canal.send({
            embeds: [embed],
            files: [
                {
                    attachment: arquivo,
                    name: `mensagens-apagadas-${Date.now()}.txt`
                }
            ]
        });

    } catch (erro) {
        console.error(
            "❌ Não foi possível registrar mensagens apagadas:",
            erro
        );
    }
}

// =====================================================
// 📦 EXPORTAÇÃO
// =====================================================

module.exports = {
    data: new SlashCommandBuilder()
        .setName("logs")
        .setDescription(
            "Configura o sistema de logs."
        )

        .addSubcommand(subcommand =>
            subcommand
                .setName("configurar")
                .setDescription(
                    "Configura os canais dos logs."
                )
        )

        .addSubcommand(subcommand =>
            subcommand
                .setName("status")
                .setDescription(
                    "Mostra a configuração atual dos logs."
                )
        ),

    async execute(interaction) {
        if (
            !interaction.memberPermissions?.has(
                "Administrator"
            )
        ) {
            return interaction.reply({
                content:
                    "❌ Você precisa ser administrador para configurar os logs.",
                ephemeral: true
            });
        }

        const subcomando =
            interaction.options.getSubcommand();

        if (subcomando === "status") {
            return mostrarStatus(interaction);
        }

        await interaction.reply({
            embeds: [criarEmbedConfig()],
            components: [
                new ActionRowBuilder().addComponents(
                    criarMenuTipos()
                )
            ],
            ephemeral: true
        });
    },

    async handleInteraction(interaction) {
        if (!interaction.guild) return;

        if (
            !interaction.memberPermissions?.has(
                "Administrator"
            )
        ) {
            if (
                !interaction.replied &&
                !interaction.deferred
            ) {
                await interaction.reply({
                    content:
                        "❌ Você precisa ser administrador.",
                    ephemeral: true
                });
            }

            return;
        }

        // =================================================
        // 📋 SELECT DO TIPO PRINCIPAL
        // =================================================

        if (interaction.isStringSelectMenu()) {
            if (
                interaction.customId ===
                "logs_tipo"
            ) {
                const tipo =
                    interaction.values[0];

                return mostrarTipo(
                    interaction,
                    tipo
                );
            }
        }

        // =================================================
        // 📢 SELECT DE CANAL
        // =================================================

        if (interaction.isChannelSelectMenu()) {
            if (
                interaction.customId.startsWith(
                    "logs_canal_"
                )
            ) {
                const tipo =
                    interaction.customId.replace(
                        "logs_canal_",
                        ""
                    );

                const canalId =
                    interaction.values[0];

                if (!TIPOS_LOG[tipo]) {
                    return interaction.reply({
                        content:
                            "❌ Tipo de log inválido.",
                        ephemeral: true
                    });
                }

                await salvarConfig(
                    interaction.guild.id,
                    tipo,
                    canalId
                );

                const dados =
                    TIPOS_LOG[tipo];

                const embed =
                    new EmbedBuilder()
                        .setTitle(
                            "✅ Log ativado"
                        )
                        .setDescription(
                            `${dados.nome} foi ativado com sucesso.\n\n` +
                            `📢 **Canal:** <#${canalId}>`
                        )
                        .setColor(0x57F287);

                const voltarId =
                    ehSubtipo(tipo)
                        ? "logs_voltar_subtipo"
                        : "logs_voltar";

                return interaction.update({
                    embeds: [embed],
                    components: [
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId(
                                    `logs_alterar_${tipo}`
                                )
                                .setLabel(
                                    "Alterar canal"
                                )
                                .setEmoji("🔄")
                                .setStyle(
                                    ButtonStyle.Primary
                                ),

                            new ButtonBuilder()
                                .setCustomId(
                                    `logs_remover_${tipo}`
                                )
                                .setLabel(
                                    "Desativar"
                                )
                                .setEmoji("🔴")
                                .setStyle(
                                    ButtonStyle.Danger
                                ),

                            criarBotaoVoltar(
                                voltarId
                            )
                        )
                    ]
                });
            }
        }

        // =================================================
        // 🔘 BOTÕES
        // =================================================

        if (interaction.isButton()) {

            // ---------------------------------------------
            // ↩️ VOLTAR AO PAINEL
            // ---------------------------------------------

            if (
                interaction.customId ===
                "logs_voltar"
            ) {
                return mostrarPainel(
                    interaction
                );
            }

            // ---------------------------------------------
            // 💬 MENSAGENS
            // ---------------------------------------------

            if (
                interaction.customId ===
                "logs_mensagens_editadas"
            ) {
                return mostrarConfiguracaoSubtipo(
                    interaction,
                    "mensagens_editadas"
                );
            }

            if (
                interaction.customId ===
                "logs_mensagens_apagadas"
            ) {
                return mostrarConfiguracaoSubtipo(
                    interaction,
                    "mensagens_apagadas"
                );
            }

            // ---------------------------------------------
            // 👤 MEMBROS
            // ---------------------------------------------

            if (
                interaction.customId ===
                "logs_membros_nickname"
            ) {
                return mostrarConfiguracaoSubtipo(
                    interaction,
                    "membros_nickname"
                );
            }

            if (
                interaction.customId ===
                "logs_membros_avatar"
            ) {
                return mostrarConfiguracaoSubtipo(
                    interaction,
                    "membros_avatar"
                );
            }

            if (
                interaction.customId ===
                "logs_membros_banner"
            ) {
                return mostrarConfiguracaoSubtipo(
                    interaction,
                    "membros_banner"
                );
            }

            if (
                interaction.customId ===
                "logs_membros_cargos"
            ) {
                return mostrarConfiguracaoSubtipo(
                    interaction,
                    "membros_cargos"
                );
            }

            // ---------------------------------------------
            // 🔨 MODERAÇÃO
            // ---------------------------------------------

            if (
                interaction.customId ===
                "logs_moderacao_ban"
            ) {
                return mostrarConfiguracaoSubtipo(
                    interaction,
                    "moderacao_ban"
                );
            }

            if (
                interaction.customId ===
                "logs_moderacao_kick"
            ) {
                return mostrarConfiguracaoSubtipo(
                    interaction,
                    "moderacao_kick"
                );
            }

            if (
                interaction.customId ===
                "logs_moderacao_timeout"
            ) {
                return mostrarConfiguracaoSubtipo(
                    interaction,
                    "moderacao_timeout"
                );
            }

            if (
                interaction.customId ===
                "logs_moderacao_clear"
            ) {
                return mostrarConfiguracaoSubtipo(
                    interaction,
                    "moderacao_clear"
                );
            }

            // ---------------------------------------------
            // 🎙️ VOZ
            // ---------------------------------------------

            if (
                interaction.customId ===
                "logs_voz_entrada"
            ) {
                return mostrarConfiguracaoSubtipo(
                    interaction,
                    "voz_entrada"
                );
            }

            if (
                interaction.customId ===
                "logs_voz_saida"
            ) {
                return mostrarConfiguracaoSubtipo(
                    interaction,
                    "voz_saida"
                );
            }

            if (
                interaction.customId ===
                "logs_voz_mudanca"
            ) {
                return mostrarConfiguracaoSubtipo(
                    interaction,
                    "voz_mudanca"
                );
            }

            // ---------------------------------------------
            // ↩️ VOLTAR DO SUBTIPO
            // ---------------------------------------------

            if (
                interaction.customId ===
                "logs_voltar_subtipo"
            ) {
                const ultimaMensagem =
                    interaction.message.embeds?.[0]?.title;

                if (
                    ultimaMensagem ===
                    "🏷️ Nickname alterado" ||
                    ultimaMensagem ===
                    "🖼️ Avatar alterado" ||
                    ultimaMensagem ===
                    "🎨 Banner alterado" ||
                    ultimaMensagem ===
                    "🛡️ Cargos alterados"
                ) {
                    return mostrarMembros(
                        interaction
                    );
                }

                if (
                    ultimaMensagem ===
                    "🔨 Banimentos" ||
                    ultimaMensagem ===
                    "👢 Expulsões" ||
                    ultimaMensagem ===
                    "🔇 Timeouts" ||
                    ultimaMensagem ===
                    "🧹 Mensagens limpas"
                ) {
                    return mostrarModeracao(
                        interaction
                    );
                }

                if (
                    ultimaMensagem ===
                    "🟢 Entrada na call" ||
                    ultimaMensagem ===
                    "🔴 Saída da call" ||
                    ultimaMensagem ===
                    "🔄 Mudança de canal"
                ) {
                    return mostrarVoz(
                        interaction
                    );
                }

                return mostrarMensagens(
                    interaction
                );
            }

            // ---------------------------------------------
            // 🔄 ALTERAR CANAL
            // ---------------------------------------------

            if (
                interaction.customId.startsWith(
                    "logs_alterar_"
                )
            ) {
                const tipo =
                    interaction.customId.replace(
                        "logs_alterar_",
                        ""
                    );

                const dados =
                    TIPOS_LOG[tipo];

                if (!dados) return;

                const voltarId =
                    ehSubtipo(tipo)
                        ? "logs_voltar_subtipo"
                        : `logs_voltar_tipo_${tipo}`;

                const embed =
                    new EmbedBuilder()
                        .setTitle(dados.nome)
                        .setDescription(
                            "📢 Escolha o novo canal para este log."
                        )
                        .setColor(0x5865F2);

                return interaction.update({
                    embeds: [embed],
                    components: [
                        new ActionRowBuilder().addComponents(
                            criarMenuCanal(tipo)
                        ),

                        new ActionRowBuilder().addComponents(
                            criarBotaoVoltar(
                                voltarId
                            )
                        )
                    ]
                });
            }

            // ---------------------------------------------
            // 🔴 REMOVER / DESATIVAR
            // ---------------------------------------------

            if (
                interaction.customId.startsWith(
                    "logs_remover_"
                )
            ) {
                const tipo =
                    interaction.customId.replace(
                        "logs_remover_",
                        ""
                    );

                await removerConfig(
                    interaction.guild.id,
                    tipo
                );

                const dados =
                    TIPOS_LOG[tipo];

                const embed =
                    new EmbedBuilder()
                        .setTitle(
                            "🔴 Log desativado"
                        )
                        .setDescription(
                            `${dados.nome} foi desativado.\n\n` +
                            "Você pode ativá-lo novamente quando quiser."
                        )
                        .setColor(0xED4245);

                if (ehSubtipo(tipo)) {
                    return interaction.update({
                        embeds: [embed],
                        components: [
                            new ActionRowBuilder().addComponents(
                                criarBotaoVoltar(
                                    "logs_voltar_subtipo"
                                )
                            )
                        ]
                    });
                }

                return interaction.update({
                    embeds: [embed],
                    components: [
                        new ActionRowBuilder().addComponents(
                            criarMenuTipos()
                        )
                    ]
                });
            }

            // ---------------------------------------------
            // ↩️ VOLTAR PARA TIPO PRINCIPAL
            // ---------------------------------------------

            if (
                interaction.customId.startsWith(
                    "logs_voltar_tipo_"
                )
            ) {
                const tipo =
                    interaction.customId.replace(
                        "logs_voltar_tipo_",
                        ""
                    );

                return mostrarTipo(
                    interaction,
                    tipo
                );
            }
        }
    },

    registrarLog,
    registrarMensagensApagadas
};
