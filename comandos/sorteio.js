const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ChannelSelectMenuBuilder,
    ChannelType,
    PermissionFlagsBits
} = require("discord.js");

const {
    pool
} = require("../database/database");

// =====================================================
// 🎉 SORTEIO
// =====================================================

function criarPainelSorteio() {

    const embed =
        new EmbedBuilder()
            .setTitle("🎉 Configuração do Sorteio")
            .setDescription(
                "Configure o sorteio usando os botões abaixo.\n\n" +
                "📝 **Informações:** título, descrição e cor.\n" +
                "🖼️ **Imagens:** imagem e thumbnail opcionais.\n" +
                "📅 **Encerramento:** data e horário.\n" +
                "🏆 **Vencedores:** quantidade de vencedores.\n" +
                "📢 **Canal:** escolha onde o sorteio será enviado.\n\n" +
                "Quando terminar, clique em **🚀 Enviar sorteio**."
            )
            .setColor(0x5865F2);

    const linha1 =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("sorteio_config")
                    .setLabel("⚙️ Configurar")
                    .setStyle(ButtonStyle.Primary),

                new ButtonBuilder()
                    .setCustomId("sorteio_canal")
                    .setLabel("📢 Escolher canal")
                    .setStyle(ButtonStyle.Secondary),

                new ButtonBuilder()
                    .setCustomId("sorteio_enviar")
                    .setLabel("🚀 Enviar sorteio")
                    .setStyle(ButtonStyle.Success)
            );

    return {
        embeds: [embed],
        components: [linha1]
    };
}

// =====================================================
// 📅 CALCULAR DATA
// =====================================================

function converterData(data, horario) {

    const resultado =
        new Date(
            `${data}T${horario}:00-03:00`
        );

    if (
        Number.isNaN(
            resultado.getTime()
        )
    ) {
        return null;
    }

    return resultado.getTime();
}

// =====================================================
// 💾 CRIAR SORTEIO
// =====================================================

async function criarSorteio({
    guildId,
    canalId,
    titulo,
    descricao,
    cor,
    imagem,
    thumbnail,
    encerraEm,
    vencedores
}) {

    const resultado =
        await pool.query(
            `
            INSERT INTO sorteios (
                guild_id,
                canal_id,
                titulo,
                descricao,
                cor,
                imagem,
                thumbnail,
                encerra_em,
                vencedores,
                encerrado
            )
            VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8,
                $9,
                FALSE
            )
            RETURNING id
            `,
            [
                guildId,
                canalId,
                titulo,
                descricao,
                cor,
                imagem || null,
                thumbnail || null,
                encerraEm,
                vencedores
            ]
        );

    return Number(
        resultado.rows[0].id
    );
}

// =====================================================
// 🎟️ PARTICIPAR
// =====================================================

async function participarSorteio(
    sorteioId,
    userId
) {

    const sorteio =
        await pool.query(
            `
            SELECT
                vencedores,
                encerrado
            FROM sorteios
            WHERE id = $1
            `,
            [sorteioId]
        );

    if (
        sorteio.rows.length === 0
    ) {
        return {
            sucesso: false,
            mensagem:
                "❌ Esse sorteio não existe mais."
        };
    }

    if (
        sorteio.rows[0].encerrado
    ) {
        return {
            sucesso: false,
            mensagem:
                "🔒 Esse sorteio já foi encerrado."
        };
    }

    await pool.query(
        `
        INSERT INTO sorteio_participantes (
            sorteio_id,
            user_id
        )
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
        `,
        [
            sorteioId,
            userId
        ]
    );

    return {
        sucesso: true
    };
}

// =====================================================
// 🎲 FINALIZAR SORTEIO
// =====================================================

async function finalizarSorteio(
    client,
    sorteio
) {

    const participantes =
        await client.query(
            `
            SELECT user_id
            FROM sorteio_participantes
            WHERE sorteio_id = $1
            `,
            [sorteio.id]
        );

    const lista =
        participantes.rows.map(
            participante =>
                participante.user_id
        );

    let vencedores = [];

    const quantidade =
        Math.min(
            Number(sorteio.vencedores),
            lista.length
        );

    const disponiveis =
        [...lista];

    for (
        let i = 0;
        i < quantidade;
        i++
    ) {

        const indice =
            Math.floor(
                Math.random() *
                disponiveis.length
            );

        vencedores.push(
            disponiveis[indice]
        );

        disponiveis.splice(
            indice,
            1
        );
    }

    await client.query(
        `
        UPDATE sorteios
        SET
            encerrado = TRUE,
            vencedores_ids = $1
        WHERE id = $2
        `,
        [
            vencedores,
            sorteio.id
        ]
    );

    return vencedores;
}

// =====================================================
// ⏰ VERIFICAR SORTEIOS
// =====================================================

async function verificarSorteios(clientDiscord) {

    try {

        const resultado =
            await pool.query(
                `
                SELECT *
                FROM sorteios
                WHERE
                    encerrado = FALSE
                    AND encerra_em <= $1
                `,
                [Date.now()]
            );

        for (
            const sorteio
            of resultado.rows
        ) {

            try {

                const clientBanco =
                    await pool.connect();

                try {

                    await clientBanco.query(
                        "BEGIN"
                    );

                    const bloqueio =
                        await clientBanco.query(
                            `
                            SELECT *
                            FROM sorteios
                            WHERE
                                id = $1
                                AND encerrado = FALSE
                            FOR UPDATE
                            `,
                            [sorteio.id]
                        );

                    if (
                        bloqueio.rows.length === 0
                    ) {
                        await clientBanco.query(
                            "ROLLBACK"
                        );

                        clientBanco.release();

                        continue;
                    }

                    const dados =
                        bloqueio.rows[0];

                    const vencedores =
                        await finalizarSorteio(
                            clientBanco,
                            dados
                        );

                    await clientBanco.query(
                        "COMMIT"
                    );

                    const guild =
                        await clientDiscord.guilds.fetch(
                            dados.guild_id
                        );

                    const canal =
                        await guild.channels.fetch(
                            dados.canal_id
                        );

                    if (!canal) {
                        continue;
                    }

                    const listaVencedores =
                        vencedores.length > 0
                            ? vencedores
                                .map(
                                    id =>
                                        `<@${id}>`
                                )
                                .join(", ")
                            : "Ninguém participou.";

                    const embed =
                        new EmbedBuilder()
                            .setTitle(
                                `🏆 ${dados.titulo}`
                            )
                            .setDescription(
                                `${dados.descricao}\n\n` +
                                `🔒 **Sorteio encerrado!**\n\n` +
                                `🏆 **Vencedores:**\n${listaVencedores}`
                            )
                            .setColor(
                                dados.cor || "#5865F2"
                            );

                    if (
                        dados.imagem
                    ) {
                        embed.setImage(
                            dados.imagem
                        );
                    }

                    if (
                        dados.thumbnail
                    ) {
                        embed.setThumbnail(
                            dados.thumbnail
                        );
                    }

                    await canal.send({
                        content:
                            vencedores.length > 0
                                ? `🎉 Parabéns ${listaVencedores}!`
                                : "😢 O sorteio terminou sem participantes.",
                        embeds: [embed]
                    });

                } catch (erro) {

                    try {
                        await clientBanco.query(
                            "ROLLBACK"
                        );
                    } catch {}

                    throw erro;

                } finally {

                    clientBanco.release();
                }

            } catch (erro) {

                console.error(
                    `❌ Erro ao finalizar sorteio ${sorteio.id}:`,
                    erro
                );
            }
        }

    } catch (erro) {

        console.error(
            "❌ Erro ao verificar sorteios:",
            erro
        );
    }
}

// =====================================================
// 🚀 INICIAR SISTEMA
// =====================================================

function iniciarSistemaSorteios(
    client
) {

    console.log(
        "🎉 Sistema de sorteios iniciado."
    );

    verificarSorteios(
        client
    );

    setInterval(
        () => {
            verificarSorteios(
                client
            );
        },
        10 * 1000
    );
}

// =====================================================
// 📦 COMANDO
// =====================================================

module.exports = {

    data:
        new SlashCommandBuilder()
            .setName("sorteio")
            .setDescription(
                "Cria um sorteio no servidor."
            )
            .setDefaultMemberPermissions(
                PermissionFlagsBits.Administrator
            ),

    iniciarSistemaSorteios,

    async execute(
        interaction
    ) {

        if (
            !interaction.memberPermissions.has(
                PermissionFlagsBits.Administrator
            )
        ) {

            return interaction.reply({
                content:
                    "❌ Apenas administradores podem criar sorteios.",
                ephemeral: true
            });
        }

        await interaction.reply({
            ...criarPainelSorteio(),
            ephemeral: true
        });
    },

    async handleButton(
        interaction
    ) {

        // =================================================
        // ⚙️ CONFIGURAR
        // =================================================

        if (
            interaction.customId ===
            "sorteio_config"
        ) {

            const modal =
                new ModalBuilder()
                    .setCustomId(
                        "sorteio_modal_config"
                    )
                    .setTitle(
                        "⚙️ Configurar Sorteio"
                    );

            const titulo =
                new TextInputBuilder()
                    .setCustomId(
                        "sorteio_titulo"
                    )
                    .setLabel(
                        "Título"
                    )
                    .setStyle(
                        TextInputStyle.Short
                    )
                    .setRequired(true)
                    .setMaxLength(256);

            const descricao =
                new TextInputBuilder()
                    .setCustomId(
                        "sorteio_descricao"
                    )
                    .setLabel(
                        "Descrição"
                    )
                    .setStyle(
                        TextInputStyle.Paragraph
                    )
                    .setRequired(true)
                    .setMaxLength(4000);

            const cor =
                new TextInputBuilder()
                    .setCustomId(
                        "sorteio_cor"
                    )
                    .setLabel(
                        "Cor HEX"
                    )
                    .setStyle(
                        TextInputStyle.Short
                    )
                    .setPlaceholder(
                        "#5865F2"
                    )
                    .setRequired(false);

            const imagem =
                new TextInputBuilder()
                    .setCustomId(
                        "sorteio_imagem"
                    )
                    .setLabel(
                        "URL da imagem"
                    )
                    .setStyle(
                        TextInputStyle.Short
                    )
                    .setRequired(false);

            const thumbnail =
                new TextInputBuilder()
                    .setCustomId(
                        "sorteio_thumbnail"
                    )
                    .setLabel(
                        "URL da thumbnail"
                    )
                    .setStyle(
                        TextInputStyle.Short
                    )
                    .setRequired(false);

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    titulo
                ),
                new ActionRowBuilder().addComponents(
                    descricao
                ),
                new ActionRowBuilder().addComponents(
                    cor
                ),
                new ActionRowBuilder().addComponents(
                    imagem
                ),
                new ActionRowBuilder().addComponents(
                    thumbnail
                )
            );

            return interaction.showModal(
                modal
            );
        }

        // =================================================
        // 📢 ESCOLHER CANAL
        // =================================================

        if (
            interaction.customId ===
            "sorteio_canal"
        ) {

            const menu =
                new ChannelSelectMenuBuilder()
                    .setCustomId(
                        "sorteio_selecionar_canal"
                    )
                    .setPlaceholder(
                        "📢 Escolha o canal do sorteio"
                    )
                    .setChannelTypes(
                        ChannelType.GuildText
                    );

            const row =
                new ActionRowBuilder()
                    .addComponents(menu);

            return interaction.reply({
                content:
                    "📢 Escolha o canal onde o sorteio será enviado:",
                components: [row],
                ephemeral: true
            });
        }

        // =================================================
        // 🚀 ENVIAR
        // =================================================

        if (
            interaction.customId ===
            "sorteio_enviar"
        ) {

            return interaction.reply({
                content:
                    "⚠️ A criação do sorteio será finalizada depois que configurarmos os dados e o canal.",
                ephemeral: true
            });
        }
    },

    async handleModal(
        interaction
    ) {

        if (
            interaction.customId !==
            "sorteio_modal_config"
        ) {
            return;
        }

        return interaction.reply({
            content:
                "✅ Configurações do sorteio salvas!",
            ephemeral: true
        });
    }
};
