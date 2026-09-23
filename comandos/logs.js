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
        descricao: "Exclusões e alterações de mensagens."
    },
    membros: {
        nome: "👤 Membros",
        descricao: "Entrada e saída de membros."
    },
    moderacao: {
        nome: "🔨 Moderação",
        descricao: "Banimentos e ações de moderação."
    },
    voz: {
        nome: "🎙️ Voz",
        descricao: "Entrada, saída e mudança de canal de voz."
    },
    comandos: {
        nome: "🤖 Comandos",
        descricao: "Comandos utilizados no servidor."
    },
    sorteios: {
        nome: "🎉 Sorteios",
        descricao: "Eventos relacionados aos sorteios."
    },
    economia: {
        nome: "💰 Economia",
        descricao: "Eventos relacionados à economia."
    }
};

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
            Object.entries(TIPOS_LOG).map(([id, dados]) => ({
                label: dados.nome.replace(/^.{2}/, "").trim(),
                description: dados.descricao,
                value: id,
                emoji: dados.nome.substring(0, 2)
            }))
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

async function criarMenuCanal(tipo) {
    return new ChannelSelectMenuBuilder()
        .setCustomId(`logs_canal_${tipo}`)
        .setPlaceholder("📢 Escolha o canal dos logs")
        .setChannelTypes(ChannelType.GuildText);
}

function criarBotoesConfig(tipo, configurado) {
    const botoes = [];

    if (configurado) {
        botoes.push(
            new ButtonBuilder()
                .setCustomId(`logs_alterar_${tipo}`)
                .setLabel("Alterar canal")
                .setEmoji("🔄")
                .setStyle(ButtonStyle.Primary),

            new ButtonBuilder()
                .setCustomId(`logs_remover_${tipo}`)
                .setLabel("Remover log")
                .setEmoji("🗑️")
                .setStyle(ButtonStyle.Danger)
        );
    }

    botoes.push(
        new ButtonBuilder()
            .setCustomId("logs_voltar")
            .setLabel("Voltar")
            .setEmoji("↩️")
            .setStyle(ButtonStyle.Secondary)
    );

    return new ActionRowBuilder().addComponents(botoes);
}

async function mostrarTipo(interaction, tipo) {
    const dados = TIPOS_LOG[tipo];

    if (!dados) return;

    const config = await buscarConfig(interaction.guild.id, tipo);

    const embed = new EmbedBuilder()
        .setTitle(`${dados.nome}`)
        .setDescription(
            `${dados.descricao}\n\n` +
            (
                config
                    ? `📢 **Canal atual:** <#${config.canal_id}>\n\nEscolha uma ação abaixo.`
                    : "❌ **Não configurado.**\n\nEscolha um canal para ativar este log."
            )
        )
        .setColor(config ? 0x57F287 : 0xED4245);

    const componentes = [];

    if (!config) {
        componentes.push(
            new ActionRowBuilder().addComponents(
                await criarMenuCanal(tipo)
            )
        );
    } else {
        componentes.push(
            criarBotoesConfig(tipo, true)
        );
    }

    await interaction.update({
        embeds: [embed],
        components: componentes
    });
}

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

    let descricao = "";

    for (const [tipo, dados] of Object.entries(TIPOS_LOG)) {
        const config = resultado.rows.find(row => row.tipo === tipo);

        descricao += config
            ? `${dados.nome} → <#${config.canal_id}>\n`
            : `${dados.nome} → ❌ Não configurado\n`;
    }

    const embed = new EmbedBuilder()
        .setTitle("📋 Status dos Logs")
        .setDescription(descricao)
        .setColor(0x5865F2);

    await interaction.reply({
        embeds: [embed],
        ephemeral: true
    });
}

async function registrarLog(guild, tipo, embed) {
    if (!guild) return;

    const config = await buscarConfig(guild.id, tipo);

    if (!config) return;

    const canal = guild.channels.cache.get(config.canal_id);

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

module.exports = {
    data: new SlashCommandBuilder()
        .setName("logs")
        .setDescription("Configura o sistema de logs.")
        .addSubcommand(subcommand =>
            subcommand
                .setName("configurar")
                .setDescription("Configura os canais dos logs.")
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("status")
                .setDescription("Mostra a configuração atual dos logs.")
        ),

    async execute(interaction) {
        if (!interaction.memberPermissions?.has("Administrator")) {
            return interaction.reply({
                content: "❌ Você precisa ser administrador para configurar os logs.",
                ephemeral: true
            });
        }

        const subcomando = interaction.options.getSubcommand();

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
            !interaction.memberPermissions?.has("Administrator")
        ) {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: "❌ Você precisa ser administrador.",
                    ephemeral: true
                });
            }

            return;
        }

        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === "logs_tipo") {
                const tipo = interaction.values[0];

                return mostrarTipo(interaction, tipo);
            }
        }

        if (interaction.isChannelSelectMenu()) {
            if (interaction.customId.startsWith("logs_canal_")) {
                const tipo = interaction.customId.replace(
                    "logs_canal_",
                    ""
                );

                const canalId = interaction.values[0];

                await salvarConfig(
                    interaction.guild.id,
                    tipo,
                    canalId
                );

                const dados = TIPOS_LOG[tipo];

                const embed = new EmbedBuilder()
                    .setTitle("✅ Log configurado")
                    .setDescription(
                        `${dados.nome} foi configurado com sucesso.\n\n` +
                        `📢 Canal: <#${canalId}>`
                    )
                    .setColor(0x57F287);

                return interaction.update({
                    embeds: [embed],
                    components: [
                        criarBotoesConfig(tipo, true)
                    ]
                });
            }
        }

        if (interaction.isButton()) {
            if (interaction.customId === "logs_voltar") {
                return mostrarPainel(interaction);
            }

            if (interaction.customId.startsWith("logs_alterar_")) {
                const tipo = interaction.customId.replace(
                    "logs_alterar_",
                    ""
                );

                const dados = TIPOS_LOG[tipo];

                const embed = new EmbedBuilder()
                    .setTitle(`${dados.nome}`)
                    .setDescription(
                        "📢 Escolha o novo canal para este log."
                    )
                    .setColor(0x5865F2);

                return interaction.update({
                    embeds: [embed],
                    components: [
                        new ActionRowBuilder().addComponents(
                            await criarMenuCanal(tipo)
                        ),
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId(`logs_voltar_tipo_${tipo}`)
                                .setLabel("Voltar")
                                .setEmoji("↩️")
                                .setStyle(ButtonStyle.Secondary)
                        )
                    ]
                });
            }

            if (interaction.customId.startsWith("logs_remover_")) {
                const tipo = interaction.customId.replace(
                    "logs_remover_",
                    ""
                );

                await removerConfig(
                    interaction.guild.id,
                    tipo
                );

                const dados = TIPOS_LOG[tipo];

                const embed = new EmbedBuilder()
                    .setTitle("🗑️ Log removido")
                    .setDescription(
                        `${dados.nome} foi removido da configuração.\n\n` +
                        "Você pode adicioná-lo novamente quando quiser."
                    )
                    .setColor(0xED4245);

                return interaction.update({
                    embeds: [embed],
                    components: [
                        new ActionRowBuilder().addComponents(
                            criarMenuTipos()
                        )
                    ]
                });
            }

            if (interaction.customId.startsWith("logs_voltar_tipo_")) {
                const tipo = interaction.customId.replace(
                    "logs_voltar_tipo_",
                    ""
                );

                return mostrarTipo(interaction, tipo);
            }
        }
    },

    registrarLog
};
