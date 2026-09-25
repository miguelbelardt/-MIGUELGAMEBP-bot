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
    StringSelectMenuBuilder,
    PermissionFlagsBits
} = require("discord.js");

const { pool } = require("../database/database");

const sessoes = new Map();

// ================================
// 🗄️ BANCO
// ================================

async function prepararBanco() {
    try {
        await pool.query(`
            ALTER TABLE sorteios
            ADD COLUMN IF NOT EXISTS criador_id VARCHAR(30)
        `);

        await pool.query(`
            ALTER TABLE sorteios
            ADD COLUMN IF NOT EXISTS mensagem_id VARCHAR(30)
        `);

        await pool.query(`
            ALTER TABLE sorteios
            ADD COLUMN IF NOT EXISTS mostrar_participantes
            BOOLEAN NOT NULL DEFAULT FALSE
        `);

        console.log("💾 Banco de sorteios preparado.");
    } catch (erro) {
        console.error(
            "❌ Erro ao preparar banco de sorteios:",
            erro
        );
    }
}

// ================================
// ⚙️ CONFIG
// ================================

function criarConfig(guildId, usuarioId) {
    return {
        guildId,
        usuarioId,

        canalId: null,

        titulo: "",
        descricao: "",
        cor: "5865F2",

        imagem: null,
        thumbnail: null,

        data: null,
        horario: null,

        vencedores: 1,
        mostrarParticipantes: false,

        sorteioId: null,

        painelMensagemId: null,
        painelCanalId: null,
        sorteioEncerrado: false
    };
}

function normalizarCor(cor) {
    if (!cor) return 0x5865F2;

    const valor = String(cor)
        .trim()
        .replace("#", "");

    if (!/^[0-9A-Fa-f]{6}$/.test(valor)) {
        return 0x5865F2;
    }

    return parseInt(valor, 16);
}

// ================================
// 🛠️ PAINEL
// ================================

function criarPainelSorteio(
    usuarioId,
    enviado = false,
    encerrado = false
) {
    const botoesSegundaLinha = [
        new ButtonBuilder()
            .setCustomId(
                `sorteio_data_${usuarioId}`
            )
            .setLabel("Data e horário")
            .setEmoji("📅")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(encerrado),

        new ButtonBuilder()
            .setCustomId(
                `sorteio_participantes_${usuarioId}`
            )
            .setLabel("Participantes")
            .setEmoji("👥")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(encerrado),

        new ButtonBuilder()
            .setCustomId(
                `sorteio_preview_${usuarioId}`
            )
            .setLabel("Visualizar sorteio")
            .setEmoji("👀")
            .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
            .setCustomId(
                `sorteio_enviar_${usuarioId}`
            )
            .setLabel(
                enviado
                    ? "Editar sorteio"
                    : "Enviar sorteio"
            )
            .setEmoji(
                enviado
                    ? "✏️"
                    : "🚀"
            )
            .setStyle(ButtonStyle.Primary)
            .setDisabled(encerrado)
    ];

    if (enviado) {
        botoesSegundaLinha.push(
            new ButtonBuilder()
                .setCustomId(
                    `sorteio_encerrar_${usuarioId}`
                )
                .setLabel("Encerrar sorteio")
                .setEmoji("⏹️")
                .setStyle(ButtonStyle.Danger)
                .setDisabled(encerrado)
        );
    }

    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(
                    `sorteio_config_${usuarioId}`
                )
                .setLabel("Configurar")
                .setEmoji("⚙️")
                .setStyle(ButtonStyle.Primary)
                .setDisabled(encerrado),

            new ButtonBuilder()
                .setCustomId(
                    `sorteio_canal_${usuarioId}`
                )
                .setLabel("Escolher canal")
                .setEmoji("📢")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(enviado || encerrado),

            new ButtonBuilder()
                .setCustomId(
                    `sorteio_vencedores_${usuarioId}`
                )
                .setLabel("Vencedores")
                .setEmoji("🏆")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(encerrado)
        ),

        new ActionRowBuilder().addComponents(
            ...botoesSegundaLinha
        )
    ];
}

function criarEmbedPainel(config) {
    const encerrado = Boolean(
        config.sorteioEncerrado
    );

    return new EmbedBuilder()
        .setColor(
            encerrado
                ? 0xED4245
                : normalizarCor(config.cor)
        )
        .setTitle("🎉 Criador de Sorteio")
        .setDescription(
            encerrado
                ? "🔴 Este sorteio já foi encerrado."
                : config.sorteioId
                    ? "⚙️ Sorteio já enviado. Altere as opções e clique em **✏️ Editar sorteio** para salvar."
                    : "Configure o sorteio usando os botões abaixo."
        )
        .addFields(
            {
                name: "📝 Título",
                value:
                    config.titulo ||
                    "❌ Não definido"
            },
            {
                name: "📄 Descrição",
                value:
                    config.descricao ||
                    "❌ Não definida"
            },
            {
                name: "🎨 Cor",
                value:
                    `#${String(
                        config.cor || "5865F2"
                    ).replace("#", "")}`,
                inline: true
            },
            {
                name: "🏆 Vencedores",
                value: String(
                    config.vencedores || 1
                ),
                inline: true
            },
            {
                name: "📢 Canal",
                value:
                    config.canalId
                        ? `<#${config.canalId}>`
                        : "❌ Não escolhido",
                inline: true
            },
            {
                name: "👥 Participantes",
                value:
                    config.mostrarParticipantes
                        ? "🟢 Visíveis"
                        : "🔴 Ocultos",
                inline: true
            },
            {
                name: "📅 Encerramento",
                value:
                    config.data &&
                    config.horario
                        ? `${config.data} às ${config.horario}`
                        : "❌ Não definido"
            },
            {
                name: "📌 Status",
                value:
                    encerrado
                        ? "🔴 Sorteio encerrado"
                        : config.sorteioId
                            ? "🟢 Sorteio enviado"
                            : "🟡 Em configuração"
            }
        );
}

// ================================
// 🎉 EMBED DO SORTEIO
// ================================

function criarEmbedPreview(
    config,
    encerrado = false
) {
    const embed =
        new EmbedBuilder()
            .setColor(
                encerrado
                    ? 0xED4245
                    : normalizarCor(config.cor)
            )
            .setTitle(
                `🎉 ${
                    config.titulo ||
                    "Sorteio"
                }`
            )
            .setDescription(
                encerrado
                    ? (
                        config.descricao ||
                        "🎁 Sorteio encerrado."
                    )
                    : (
                        config.descricao ||
                        "🎁 Participe deste sorteio!"
                    )
            )
            .addFields({
                name: "🏆 Vencedores",
                value: String(
                    config.vencedores || 1
                ),
                inline: true
            });

    if (
        config.data &&
        config.horario
    ) {
        embed.addFields({
            name:
                encerrado
                    ? "🔴 Encerramento"
                    : "⏰ Encerramento",
            value:
                `${config.data} às ${config.horario}`,
            inline: true
        });
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

    embed.setFooter({
        text:
            encerrado
                ? "🔴 Este sorteio foi encerrado."
                : "🎉 Clique no botão abaixo para participar!"
    });

    return embed;
}

// ================================
// 🎟️ BOTÕES DO SORTEIO
// ================================

function criarBotoesSorteio(
    id,
    quantidade = 0,
    mostrarParticipantes = false,
    encerrado = false
) {
    const botoes = [
        new ButtonBuilder()
            .setCustomId(
                `sorteio_participar_${id}`
            )
            .setLabel(
                encerrado
                    ? "Sorteio encerrado"
                    : `Participar (${quantidade})`
            )
            .setEmoji(
                encerrado
                    ? "🔴"
                    : "🎟️"
            )
            .setStyle(
                encerrado
                    ? ButtonStyle.Secondary
                    : ButtonStyle.Success
            )
            .setDisabled(encerrado)
    ];

    if (mostrarParticipantes) {
        botoes.push(
            new ButtonBuilder()
                .setCustomId(
                    `sorteio_ver_participantes_${id}`
                )
                .setLabel(
                    "Ver participantes"
                )
                .setEmoji("👥")
                .setStyle(
                    ButtonStyle.Secondary
                )
        );
    }

    return [
        new ActionRowBuilder()
            .addComponents(
                botoes
            )
    ];
}

// ================================
// 👀 BOTÕES DA PRÉVIA
// ================================

function criarBotoesPreview(
    config
) {
    const botoes = [
        new ButtonBuilder()
            .setCustomId(
                "sorteio_participar_preview"
            )
            .setLabel(
                "Participar"
            )
            .setEmoji("🎟️")
            .setStyle(
                ButtonStyle.Success
            )
    ];

    // Mostra o botão mesmo antes do sorteio ser enviado.
    // Na prévia, o clique apenas informa que ainda não existem participantes.
    if (config.mostrarParticipantes) {
        botoes.push(
            new ButtonBuilder()
                .setCustomId(
                    config.sorteioId
                        ? `sorteio_ver_participantes_${config.sorteioId}`
                        : "sorteio_ver_participantes_preview"
                )
                .setLabel(
                    "Ver participantes"
                )
                .setEmoji("👥")
                .setStyle(
                    ButtonStyle.Secondary
                )
        );
    }

    return [
        new ActionRowBuilder()
            .addComponents(
                botoes
            )
    ];
}

// ================================
// 📅 DATA
// ================================

function converterData(
    data,
    horario
) {
    if (!data || !horario) {
        return null;
    }

    const match =
        String(data).match(
            /^(\d{2})\/(\d{2})\/(\d{4})$/
        );

    if (!match) {
        return null;
    }

    const dia = Number(match[1]);
    const mes = Number(match[2]);
    const ano = Number(match[3]);

    if (
        mes < 1 ||
        mes > 12 ||
        dia < 1
    ) {
        return null;
    }

    // Aceita HH:MM e HH.MM
    const horarioNormalizado =
        String(horario)
            .trim()
            .replace(".", ":");

    const horarioMatch =
        horarioNormalizado.match(
            /^(\d{2}):(\d{2})$/
        );

    if (!horarioMatch) {
        return null;
    }

    const hora =
        Number(horarioMatch[1]);

    const minuto =
        Number(horarioMatch[2]);

    if (
        hora < 0 ||
        hora > 23 ||
        minuto < 0 ||
        minuto > 59
    ) {
        return null;
    }

    // Verifica corretamente quantos dias existem no mês.
    const diasNoMes =
        new Date(
            Date.UTC(
                ano,
                mes,
                0
            )
        ).getUTCDate();

    if (dia > diasNoMes) {
        return null;
    }

    /*
     * O horário informado é do Brasil / America/Sao_Paulo.
     *
     * Não usamos getHours(), getDate(), etc. do servidor
     * para validar, porque a FadeHost pode estar usando UTC.
     */
    const iso =
        `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}` +
        `T${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}:00-03:00`;

    const timestamp =
        Date.parse(iso);

    if (Number.isNaN(timestamp)) {
        return null;
    }

    // Confirma usando o fuso correto do Brasil.
    const verificado =
        formatarData(timestamp);

    const dataEsperada =
        `${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}/${ano}`;

    const horarioEsperado =
        `${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}`;

    if (
        verificado.data !==
            dataEsperada ||
        verificado.horario !==
            horarioEsperado
    ) {
        return null;
    }

    return timestamp;
}

function formatarData(
    timestamp
) {
    const data =
        new Date(
            Number(timestamp)
        );

    return {
        data:
            data.toLocaleDateString(
                "pt-BR",
                {
                    timeZone:
                        "America/Sao_Paulo",
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric"
                }
            ),
        horario:
            data.toLocaleTimeString(
                "pt-BR",
                {
                    timeZone:
                        "America/Sao_Paulo",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false
                }
            )
    };
}

// ================================
// ✏️ ATUALIZAR PAINEL
// ================================

async function atualizarPainelCriacao(
    client,
    config
) {
    try {
        if (
            !config.painelMensagemId ||
            !config.painelCanalId
        ) {
            return false;
        }

        const canal =
            await client.channels
                .fetch(
                    config.painelCanalId
                )
                .catch(
                    () => null
                );

        if (!canal) {
            return false;
        }

        const mensagem =
            await canal.messages
                .fetch(
                    config.painelMensagemId
                )
                .catch(
                    () => null
                );

        if (!mensagem) {
            return false;
        }

        await mensagem.edit({
            embeds: [
                criarEmbedPainel(
                    config
                )
            ],
            components:
                criarPainelSorteio(
                    config.usuarioId,
                    Boolean(
                        config.sorteioId
                    ),
                    Boolean(
                        config.sorteioEncerrado
                    )
                )
        });

        return true;

    } catch (erro) {
        console.error(
            "❌ Erro ao atualizar painel:",
            erro
        );

        return false;
    }
}

// ================================
// 🗄️ CRIAR SORTEIO
// ================================

async function criarSorteio(
    config
) {
    const encerraEm =
        converterData(
            config.data,
            config.horario
        );

    if (!encerraEm) {
        throw new Error(
            "Data ou horário inválido."
        );
    }

    if (
        encerraEm <= Date.now()
    ) {
        throw new Error(
            "A data e o horário precisam estar no futuro."
        );
    }

    const quantidadeVencedores =
        Math.min(
            Math.max(
                Number(config.vencedores) || 1,
                1
            ),
            20
        );

    const resultado =
        await pool.query(
            `
            INSERT INTO sorteios (
                guild_id,
                canal_id,
                criador_id,
                titulo,
                descricao,
                cor,
                imagem,
                thumbnail,
                encerra_em,
                vencedores,
                mostrar_participantes
            )
            VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
            )
            RETURNING *
            `,
            [
                config.guildId,
                config.canalId,
                config.usuarioId,
                config.titulo,
                config.descricao,
                config.cor,
                config.imagem ||
                    null,
                config.thumbnail ||
                    null,
                encerraEm,
                quantidadeVencedores,
                config.mostrarParticipantes
            ]
        );

    return resultado.rows[0];
}

async function buscarSorteio(
    id
) {
    const resultado =
        await pool.query(
            `
            SELECT *
            FROM sorteios
            WHERE id = $1
            `,
            [id]
        );

    return (
        resultado.rows[0] ||
        null
    );
}

async function buscarParticipantes(
    id
) {
    const resultado =
        await pool.query(
            `
            SELECT user_id
            FROM sorteio_participantes
            WHERE sorteio_id = $1
            ORDER BY user_id
            `,
            [id]
        );

    return resultado.rows.map(
        p => p.user_id
    );
}

// ================================
// ✏️ ATUALIZAR MENSAGEM DO SORTEIO
// ================================

async function atualizarMensagemSorteio(
    client,
    id
) {
    try {
        const sorteio =
            await buscarSorteio(
                id
            );

        if (
            !sorteio ||
            !sorteio.mensagem_id
        ) {
            return false;
        }

        const canal =
            await client.channels
                .fetch(
                    sorteio.canal_id
                )
                .catch(
                    () => null
                );

        if (!canal) {
            return false;
        }

        const mensagem =
            await canal.messages
                .fetch(
                    sorteio.mensagem_id
                )
                .catch(
                    () => null
                );

        if (!mensagem) {
            return false;
        }

        const participantes =
            await buscarParticipantes(
                id
            );

        const data =
            formatarData(
                sorteio.encerra_em
            );

        const config = {
            titulo:
                sorteio.titulo,
            descricao:
                sorteio.descricao,
            cor:
                sorteio.cor,
            imagem:
                sorteio.imagem,
            thumbnail:
                sorteio.thumbnail,
            vencedores:
                sorteio.vencedores,
            mostrarParticipantes:
                sorteio.mostrar_participantes,
            data:
                data.data,
            horario:
                data.horario
        };

        await mensagem.edit({
            embeds: [
                criarEmbedPreview(
                    config,
                    sorteio.encerrado
                )
            ],
            components:
                criarBotoesSorteio(
                    id,
                    participantes.length,
                    sorteio.mostrar_participantes,
                    sorteio.encerrado
                )
        });

        return true;

    } catch (erro) {
        console.error(
            "❌ Erro ao atualizar mensagem do sorteio:",
            erro
        );

        return false;
    }
}

// ================================
// 👥 LISTA DE PARTICIPANTES
// ================================

async function mostrarParticipantes(
    interaction,
    id
) {
    try {
        const sorteio =
            await buscarSorteio(
                id
            );

        if (!sorteio) {
            return interaction.reply({
                content:
                    "❌ Esse sorteio não existe.",
                ephemeral: true
            });
        }

        if (
            !sorteio.mostrar_participantes
        ) {
            return interaction.reply({
                content:
                    "🔒 A lista de participantes está oculta neste sorteio.",
                ephemeral: true
            });
        }

        const participantes =
            await buscarParticipantes(
                id
            );

        if (!participantes.length) {
            return interaction.reply({
                content:
                    "👥 Ninguém participou deste sorteio ainda.",
                ephemeral: true
            });
        }

        const lista =
            participantes
                .slice(0, 50)
                .map(
                    (userId, index) =>
                        `**${index + 1}.** <@${userId}>`
                )
                .join("\n");

        let texto =
            `👥 **Participantes (${participantes.length})**\n\n${lista}`;

        if (
            participantes.length >
            50
        ) {
            texto +=
                `\n\n... e mais **${
                    participantes.length - 50
                }** pessoa(s).`;
        }

        return interaction.reply({
            content:
                texto.slice(
                    0,
                    2000
                ),
            ephemeral: true
        });

    } catch (erro) {
        console.error(
            "❌ Erro ao mostrar participantes:",
            erro
        );

        return interaction.reply({
            content:
                "❌ Não foi possível mostrar os participantes.",
            ephemeral: true
        });
    }
}

// ================================
// 🎟️ PARTICIPAR
// ================================

async function participarSorteio(
    id,
    userId,
    client
) {
    try {
        const sorteio =
            await buscarSorteio(id);

        if (!sorteio) {
            return {
                sucesso: false,
                jaParticipa: false,
                mensagem:
                    "❌ Esse sorteio não existe."
            };
        }

        if (sorteio.encerrado) {
            return {
                sucesso: false,
                jaParticipa: false,
                mensagem:
                    "❌ Esse sorteio já foi encerrado."
            };
        }

        if (
            Number(
                sorteio.encerra_em
            ) <= Date.now()
        ) {
            return {
                sucesso: false,
                jaParticipa: false,
                mensagem:
                    "❌ Esse sorteio já terminou."
            };
        }

        const resultado =
            await pool.query(
                `
                INSERT INTO sorteio_participantes
                (sorteio_id, user_id)
                VALUES ($1, $2)
                ON CONFLICT DO NOTHING
                RETURNING user_id
                `,
                [
                    id,
                    userId
                ]
            );

        if (
            !resultado.rows.length
        ) {
            return {
                sucesso: false,
                jaParticipa: true,
                mensagem:
                    "🎟️ Você já está participando desse sorteio."
            };
        }

        await atualizarMensagemSorteio(
            client,
            id
        );

        return {
            sucesso: true,
            jaParticipa: false,
            mensagem:
                "🎟️ Você está participando do sorteio!"
        };

    } catch (erro) {
        console.error(
            "❌ Erro ao registrar participante:",
            erro
        );

        return {
            sucesso: false,
            jaParticipa: false,
            mensagem:
                "❌ Não foi possível registrar sua participação."
        };
    }
}

// ================================
// 🚪 SAIR DO SORTEIO
// ================================

async function sairDoSorteio(
    interaction,
    id
) {
    try {
        const sorteio =
            await buscarSorteio(
                id
            );

        if (!sorteio) {
            return interaction.reply({
                content:
                    "❌ Esse sorteio não existe.",
                ephemeral: true
            });
        }

        if (sorteio.encerrado) {
            return interaction.reply({
                content:
                    "❌ Esse sorteio já foi encerrado.",
                ephemeral: true
            });
        }

        if (
            Number(
                sorteio.encerra_em
            ) <= Date.now()
        ) {
            return interaction.reply({
                content:
                    "❌ Esse sorteio já terminou.",
                ephemeral: true
            });
        }

        const resultado =
            await pool.query(
                `
                DELETE FROM sorteio_participantes
                WHERE sorteio_id = $1
                AND user_id = $2
                RETURNING user_id
                `,
                [
                    id,
                    interaction.user.id
                ]
            );

        if (!resultado.rows.length) {
            return interaction.reply({
                content:
                    "⚠️ Você não está participando desse sorteio.",
                ephemeral: true
            });
        }

        await atualizarMensagemSorteio(
            interaction.client,
            id
        );

        return interaction.update({
            content:
                "🚪 Você saiu do sorteio.",
            components: []
        });

    } catch (erro) {
        console.error(
            "❌ Erro ao sair do sorteio:",
            erro
        );

        if (!interaction.replied) {
            return interaction.reply({
                content:
                    "❌ Não foi possível sair do sorteio.",
                ephemeral: true
            });
        }
    }
}

// ================================
// 🏆 FINALIZAR
// ================================

async function finalizarSorteio(
    client,
    sorteio
) {
    try {
        if (sorteio.encerrado) {
            return;
        }

        const lista =
            await buscarParticipantes(
                sorteio.id
            );

        let vencedores = [];

        if (lista.length) {
            const embaralhados =
                [...lista];

            for (
                let i =
                    embaralhados.length -
                    1;
                i > 0;
                i--
            ) {
                const j =
                    Math.floor(
                        Math.random() *
                        (i + 1)
                    );

                [
                    embaralhados[i],
                    embaralhados[j]
                ] = [
                    embaralhados[j],
                    embaralhados[i]
                ];
            }

            const quantidade =
                Math.min(
                    Math.max(
                        Number(
                            sorteio.vencedores
                        ) || 1,
                        1
                    ),
                    20,
                    embaralhados.length
                );

            vencedores =
                embaralhados.slice(
                    0,
                    quantidade
                );
        }

        await pool.query(
            `
            UPDATE sorteios
            SET encerrado = TRUE,
                vencedores_ids = $1
            WHERE id = $2
            `,
            [
                vencedores,
                sorteio.id
            ]
        );

        await atualizarMensagemSorteio(
            client,
            sorteio.id
        );

        const canal =
            await client.channels
                .fetch(
                    sorteio.canal_id
                )
                .catch(
                    () => null
                );

        if (!canal) {
            return;
        }

        const dataEncerramento =
            formatarData(
                sorteio.encerra_em
            );

        const dataHoraEncerramento =
            `${dataEncerramento.data} às ${dataEncerramento.horario}`;

        if (!vencedores.length) {

            const embedSemVencedores =
                new EmbedBuilder()
                    .setColor(
                        normalizarCor(
                            sorteio.cor
                        )
                    )
                    .setTitle(
                        "🎉 Sorteio encerrado!"
                    )
                    .setDescription(
                        `O sorteio **${sorteio.titulo}** terminou, mas ninguém participou.`
                    )
                    .addFields({
                        name: "📅 Encerrado em",
                        value:
                            dataHoraEncerramento
                    });

            return canal.send({
                embeds: [
                    embedSemVencedores
                ]
            });
        }

        const mencoes =
            vencedores
                .map(
                    id =>
                        `<@${id}>`
                )
                .join(", ");

        const embed =
            new EmbedBuilder()
                .setColor(
                    normalizarCor(
                        sorteio.cor
                    )
                )
                .setTitle(
                    "🏆 Sorteio encerrado!"
                )
                .setDescription(
                    `🎉 O sorteio **${sorteio.titulo}** terminou!\n\n` +
                    `🏆 **Vencedores:**\n${mencoes}`
                )
                .addFields({
                    name: "📅 Encerrado em",
                    value:
                        dataHoraEncerramento
                });

        await canal.send({
            embeds: [embed]
        });

    } catch (erro) {
        console.error(
            "❌ Erro ao finalizar sorteio:",
            erro
        );
    }
}

async function verificarSorteios(
    client
) {
    try {
        const resultado =
            await pool.query(
                `
                SELECT *
                FROM sorteios
                WHERE encerrado = FALSE
                AND encerra_em <= $1
                `,
                [Date.now()]
            );

        for (
            const sorteio
            of resultado.rows
        ) {
            await finalizarSorteio(
                client,
                sorteio
            );
        }

    } catch (erro) {
        console.error(
            "❌ Erro ao verificar sorteios:",
            erro
        );
    }
}

function iniciarSistemaSorteios(
    client
) {
    prepararBanco();

    verificarSorteios(
        client
    );

    setInterval(
        () =>
            verificarSorteios(
                client
            ),
        10000
    );

    console.log(
        "🎉 Sistema de sorteios iniciado."
    );
}

// ================================
// 🔐 VERIFICAR CRIADOR
// ================================

async function verificarCriador(
    interaction,
    id
) {
    const sorteio =
        await buscarSorteio(
            id
        );

    if (!sorteio) {
        await interaction.reply({
            content:
                "❌ Esse sorteio não existe.",
            ephemeral: true
        });

        return null;
    }

    if (
        String(
            sorteio.criador_id
        ) !==
        String(
            interaction.user.id
        )
    ) {
        await interaction.reply({
            content:
                "❌ Apenas quem criou este sorteio pode editá-lo.",
            ephemeral: true
        });

        return null;
    }

    if (sorteio.encerrado) {
        await interaction.reply({
            content:
                "❌ Esse sorteio já foi encerrado e não pode mais ser editado.",
            ephemeral: true
        });

        return null;
    }

    return sorteio;
}

// ================================
// 📦 EXPORTAÇÃO
// ================================

module.exports = {

    data:
        new SlashCommandBuilder()
            .setName("sorteio")
            .setDescription(
                "Cria um novo sorteio."
            )
            .setDefaultMemberPermissions(
                PermissionFlagsBits.Administrator
            ),

    // ================================
    // /SORTEIO
    // ================================

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
                    "❌ Você precisa ser administrador para criar sorteios.",
                ephemeral: true
            });
        }

        const config =
            criarConfig(
                interaction.guildId,
                interaction.user.id
            );

        sessoes.set(
            interaction.user.id,
            config
        );

        await interaction.reply({
            embeds: [
                criarEmbedPainel(
                    config
                )
            ],
            components:
                criarPainelSorteio(
                    interaction.user.id,
                    false
                )
        });

        const mensagem =
            await interaction.fetchReply();

        config.painelMensagemId =
            mensagem.id;

        config.painelCanalId =
            interaction.channelId;
    },

    // ================================
    // 🔘 BOTÕES
    // ================================

    async handleButton(
        interaction
    ) {

        const customId =
            interaction.customId;

        const userId =
            interaction.user.id;

        // ================================
        // 🚪 SAIR DO SORTEIO
        // ================================

        if (
            customId.startsWith(
                "sorteio_sair_"
            )
        ) {
            const id =
                customId.replace(
                    "sorteio_sair_",
                    ""
                );

            return sairDoSorteio(
                interaction,
                id
            );
        }

        // ================================
        // 👥 VER PARTICIPANTES
        // ================================

        if (
            customId.startsWith(
                "sorteio_ver_participantes_"
            )
        ) {
            const id =
                customId.replace(
                    "sorteio_ver_participantes_",
                    ""
                );

            // A prévia ainda não possui um sorteio no banco.
            if (id === "preview") {
                return interaction.reply({
                    content:
                        "👥 A prévia está com a opção de participantes ativada, mas o sorteio ainda não foi enviado.\n\n🎟️ Ainda não existem participantes.",
                    ephemeral: true
                });
            }

            return mostrarParticipantes(
                interaction,
                id
            );
        }

        // ================================
        // 🔐 IDENTIFICAR DONO DO PAINEL
        // ================================

        const partes =
            customId.split("_");

        const donoId =
            partes[
                partes.length - 1
            ];

        const idsComDono = [
            "sorteio_config",
            "sorteio_canal",
            "sorteio_vencedores",
            "sorteio_data",
            "sorteio_participantes",
            "sorteio_preview",
            "sorteio_enviar",
            "sorteio_encerrar"
        ];

        const tipo =
            partes
                .slice(0, -1)
                .join("_");

        if (
            idsComDono.includes(
                tipo
            ) &&
            donoId !== userId
        ) {
            return interaction.reply({
                content:
                    "❌ Apenas quem criou este sorteio pode usar este painel.",
                ephemeral: true
            });
        }

        const config =
            sessoes.get(
                userId
            );

        if (!config) {
            return interaction.reply({
                content:
                    "❌ Sua sessão de sorteio expirou.",
                ephemeral: true
            });
        }

        // ================================
        // ⏹️ ENCERRAR SORTEIO
        // ================================

        if (
            tipo ===
            "sorteio_encerrar"
        ) {

            if (!config.sorteioId) {
                return interaction.reply({
                    content:
                        "❌ O sorteio ainda não foi enviado.",
                    ephemeral: true
                });
            }

            const sorteio =
                await verificarCriador(
                    interaction,
                    config.sorteioId
                );

            if (!sorteio) {
                return;
            }

            try {
                await finalizarSorteio(
                    interaction.client,
                    sorteio
                );

                config.sorteioEncerrado =
                    true;

                return interaction.update({
                    embeds: [
                        criarEmbedPainel(
                            config
                        )
                    ],
                    components:
                        criarPainelSorteio(
                            userId,
                            true,
                            true
                        )
                });

            } catch (erro) {
                console.error(
                    "❌ Erro ao encerrar sorteio manualmente:",
                    erro
                );

                return interaction.reply({
                    content:
                        "❌ Não foi possível encerrar o sorteio.",
                    ephemeral: true
                });
            }
        }

        // ================================
        // ⚙️ CONFIGURAR
        // ================================

        if (
            tipo ===
            "sorteio_config"
        ) {

            if (config.sorteioId) {
                const sorteio =
                    await verificarCriador(
                        interaction,
                        config.sorteioId
                    );

                if (!sorteio) {
                    return;
                }
            }

            const modal =
                new ModalBuilder()
                    .setCustomId(
                        "sorteio_modal_config"
                    )
                    .setTitle(
                        "⚙️ Configurar sorteio"
                    );

            const campos = [
                [
                    "titulo",
                    "Título",
                    TextInputStyle.Short,
                    true,
                    256
                ],
                [
                    "descricao",
                    "Descrição",
                    TextInputStyle.Paragraph,
                    true,
                    4000
                ],
                [
                    "cor",
                    "Cor hexadecimal",
                    TextInputStyle.Short,
                    false,
                    6
                ],
                [
                    "imagem",
                    "Imagem",
                    TextInputStyle.Short,
                    false,
                    1000
                ],
                [
                    "thumbnail",
                    "Thumbnail",
                    TextInputStyle.Short,
                    false,
                    1000
                ]
            ];

            modal.addComponents(
                ...campos.map(
                    ([
                        id,
                        label,
                        style,
                        required,
                        max
                    ]) =>
                        new ActionRowBuilder()
                            .addComponents(
                                new TextInputBuilder()
                                    .setCustomId(
                                        id
                                    )
                                    .setLabel(
                                        label
                                    )
                                    .setStyle(
                                        style
                                    )
                                    .setRequired(
                                        required
                                    )
                                    .setMaxLength(
                                        max
                                    )
                                    .setValue(
                                        config[id] ||
                                        (
                                            id ===
                                            "cor"
                                                ? "5865F2"
                                                : ""
                                        )
                                    )
                            )
                )
            );

            return interaction.showModal(
                modal
            );
        }

        // ================================
        // 📅 DATA
        // ================================

        if (
            tipo ===
            "sorteio_data"
        ) {

            if (config.sorteioId) {
                const sorteio =
                    await verificarCriador(
                        interaction,
                        config.sorteioId
                    );

                if (!sorteio) {
                    return;
                }
            }

            const modal =
                new ModalBuilder()
                    .setCustomId(
                        "sorteio_modal_data"
                    )
                    .setTitle(
                        "📅 Encerramento do sorteio"
                    );

            const data =
                new TextInputBuilder()
                    .setCustomId(
                        "data"
                    )
                    .setLabel(
                        "Data de encerramento"
                    )
                    .setStyle(
                        TextInputStyle.Short
                    )
                    .setRequired(
                        true
                    )
                    .setPlaceholder(
                        "25/09/2026"
                    )
                    .setValue(
                        config.data ||
                        ""
                    );

            const horario =
                new TextInputBuilder()
                    .setCustomId(
                        "horario"
                    )
                    .setLabel(
                        "Horário de encerramento"
                    )
                    .setStyle(
                        TextInputStyle.Short
                    )
                    .setRequired(
                        true
                    )
                    .setPlaceholder(
                        "23:59"
                    )
                    .setValue(
                        config.horario ||
                        ""
                    );

            modal.addComponents(
                new ActionRowBuilder()
                    .addComponents(
                        data
                    ),
                new ActionRowBuilder()
                    .addComponents(
                        horario
                    )
            );

            return interaction.showModal(
                modal
            );
        }

        // ================================
        // 👥 PARTICIPANTES
        // ================================

        if (
            tipo ===
            "sorteio_participantes"
        ) {

            if (config.sorteioId) {
                const sorteio =
                    await verificarCriador(
                        interaction,
                        config.sorteioId
                    );

                if (!sorteio) {
                    return;
                }
            }

            config.mostrarParticipantes =
                !config.mostrarParticipantes;

            return interaction.update({
                embeds: [
                    criarEmbedPainel(
                        config
                    )
                ],
                components:
                    criarPainelSorteio(
                        userId,
                        Boolean(
                            config.sorteioId
                        ),
                        Boolean(
                            config.sorteioEncerrado
                        )
                    )
            });
        }

        // ================================
        // 📢 CANAL
        // ================================

        if (
            tipo ===
            "sorteio_canal"
        ) {

            if (
                config.sorteioId
            ) {
                return interaction.reply({
                    content:
                        "❌ O canal não pode ser alterado depois que o sorteio foi enviado.",
                    ephemeral: true
                });
            }

            const menu =
                new ChannelSelectMenuBuilder()
                    .setCustomId(
                        `sorteio_selecionar_canal_${userId}`
                    )
                    .setPlaceholder(
                        "📢 Escolha o canal do sorteio"
                    )
                    .addChannelTypes(
                        ChannelType.GuildText,
                        ChannelType.GuildAnnouncement
                    );

            return interaction.update({
                embeds: [
                    new EmbedBuilder()
                        .setColor(
                            normalizarCor(
                                config.cor
                            )
                        )
                        .setTitle(
                            "📢 Escolha o canal"
                        )
                        .setDescription(
                            "Selecione abaixo o canal onde o sorteio será enviado."
                        )
                ],
                components: [
                    new ActionRowBuilder()
                        .addComponents(
                            menu
                        )
                ]
            });
        }

        // ================================
        // 🏆 VENCEDORES
        // ================================

        if (
            tipo ===
            "sorteio_vencedores"
        ) {

            if (config.sorteioId) {
                const sorteio =
                    await verificarCriador(
                        interaction,
                        config.sorteioId
                    );

                if (!sorteio) {
                    return;
                }
            }

            const opcoesVencedores =
                [];

            for (
                let i = 1;
                i <= 20;
                i++
            ) {
                opcoesVencedores.push({
                    label:
                        `${i} ${
                            i === 1
                                ? "vencedor"
                                : "vencedores"
                        }`,
                    value:
                        String(i),
                    emoji:
                        i === 1
                            ? "🥇"
                            : i === 2
                                ? "🥈"
                                : i === 3
                                    ? "🥉"
                                    : "🏆"
                });
            }

            const menu =
                new StringSelectMenuBuilder()
                    .setCustomId(
                        `sorteio_selecionar_vencedores_${userId}`
                    )
                    .setPlaceholder(
                        "🏆 Quantos vencedores?"
                    )
                    .addOptions(
                        opcoesVencedores
                    );

            return interaction.update({
                embeds: [
                    new EmbedBuilder()
                        .setColor(
                            normalizarCor(
                                config.cor
                            )
                        )
                        .setTitle(
                            "🏆 Vencedores"
                        )
                        .setDescription(
                            "Escolha de 1 a 20 pessoas para vencer o sorteio."
                        )
                ],
                components: [
                    new ActionRowBuilder()
                        .addComponents(
                            menu
                        )
                ]
            });
        }

        // ================================
        // 👀 PREVIEW
        // ================================

        if (
            tipo ===
            "sorteio_preview"
        ) {

            return interaction.reply({
                content:
                    "👀 **Prévia do sorteio:**",
                embeds: [
                    criarEmbedPreview(
                        config
                    )
                ],
                components:
                    criarBotoesPreview(
                        config
                    ),
                ephemeral: true
            });
        }

        // ================================
        // 🚀 ENVIAR / ✏️ EDITAR
        // ================================

        if (
            tipo ===
            "sorteio_enviar"
        ) {

            if (config.sorteioId) {
                const sorteio =
                    await verificarCriador(
                        interaction,
                        config.sorteioId
                    );

                if (!sorteio) {
                    return;
                }
            }

            if (!config.titulo) {
                return interaction.reply({
                    content:
                        "❌ Configure o título primeiro.",
                    ephemeral: true
                });
            }

            if (!config.descricao) {
                return interaction.reply({
                    content:
                        "❌ Configure a descrição primeiro.",
                    ephemeral: true
                });
            }

            if (!config.canalId) {
                return interaction.reply({
                    content:
                        "❌ Escolha o canal do sorteio.",
                    ephemeral: true
                });
            }

            if (
                !config.data ||
                !config.horario
            ) {
                return interaction.reply({
                    content:
                        "❌ Defina a data e o horário de encerramento.",
                    ephemeral: true
                });
            }

            const encerraEm =
                converterData(
                    config.data,
                    config.horario
                );

            if (
                !encerraEm ||
                encerraEm <= Date.now()
            ) {
                return interaction.reply({
                    content:
                        "❌ A data e o horário precisam estar no futuro.",
                    ephemeral: true
                });
            }

            const quantidadeVencedores =
                Math.min(
                    Math.max(
                        Number(
                            config.vencedores
                        ) || 1,
                        1
                    ),
                    20
                );

            config.vencedores =
                quantidadeVencedores;

            try {

                // ================================
                // ✏️ EDITANDO SORTEIO EXISTENTE
                // ================================

                if (
                    config.sorteioId
                ) {

                    await pool.query(
                        `
                        UPDATE sorteios
                        SET titulo = $1,
                            descricao = $2,
                            cor = $3,
                            imagem = $4,
                            thumbnail = $5,
                            encerra_em = $6,
                            vencedores = $7,
                            mostrar_participantes = $8
                        WHERE id = $9
                        `,
                        [
                            config.titulo,
                            config.descricao,
                            config.cor,
                            config.imagem,
                            config.thumbnail,
                            encerraEm,
                            quantidadeVencedores,
                            config.mostrarParticipantes,
                            config.sorteioId
                        ]
                    );

                    await atualizarMensagemSorteio(
                        interaction.client,
                        config.sorteioId
                    );

                    return interaction.update({
                        embeds: [
                            criarEmbedPainel(
                                config
                            )
                        ],
                        components:
                            criarPainelSorteio(
                                userId,
                                true,
                                false
                            )
                    });
                }

                // ================================
                // 🎉 CRIANDO NOVO
                // ================================

                const canal =
                    await interaction.guild.channels
                        .fetch(
                            config.canalId
                        )
                        .catch(
                            () => null
                        );

                if (!canal) {
                    return interaction.reply({
                        content:
                            "❌ Não consegui encontrar o canal escolhido.",
                        ephemeral: true
                    });
                }

                const sorteio =
                    await criarSorteio(
                        config
                    );

                const mensagem =
                    await canal.send({
                        embeds: [
                            criarEmbedPreview(
                                config
                            )
                        ],
                        components:
                            criarBotoesSorteio(
                                sorteio.id,
                                0,
                                config.mostrarParticipantes,
                                false
                            )
                    });

                await pool.query(
                    `
                    UPDATE sorteios
                    SET mensagem_id = $1
                    WHERE id = $2
                    `,
                    [
                        mensagem.id,
                        sorteio.id
                    ]
                );

                config.sorteioId =
                    sorteio.id;

                config.sorteioEncerrado =
                    false;

                return interaction.update({
                    embeds: [
                        criarEmbedPainel(
                            config
                        )
                    ],
                    components:
                        criarPainelSorteio(
                            userId,
                            true,
                            false
                        )
                });

            } catch (erro) {

                console.error(
                    "❌ Erro ao criar/enviar sorteio:",
                    erro
                );

                return interaction.reply({
                    content:
                        "❌ Não foi possível criar o sorteio.",
                    ephemeral: true
                });
            }
        }
    },

    // ================================
    // 📝 MODAIS
    // ================================

    async handleModal(
        interaction
    ) {

        const config =
            sessoes.get(
                interaction.user.id
            );

        if (!config) {
            return interaction.reply({
                content:
                    "❌ Sua sessão de sorteio expirou.",
                ephemeral: true
            });
        }

        if (
            config.sorteioId
        ) {
            const sorteio =
                await buscarSorteio(
                    config.sorteioId
                );

            if (
                !sorteio ||
                sorteio.encerrado
            ) {
                return interaction.reply({
                    content:
                        "❌ Esse sorteio já foi encerrado e não pode mais ser editado.",
                    ephemeral: true
                });
            }
        }

        // ================================
        // ⚙️ CONFIGURAÇÃO
        // ================================

        if (
            interaction.customId ===
            "sorteio_modal_config"
        ) {

            config.titulo =
                interaction.fields
                    .getTextInputValue(
                        "titulo"
                    )
                    .trim();

            config.descricao =
                interaction.fields
                    .getTextInputValue(
                        "descricao"
                    )
                    .trim();

            const cor =
                interaction.fields
                    .getTextInputValue(
                        "cor"
                    )
                    .trim()
                    .replace(
                        "#",
                        ""
                    );

            if (
                cor &&
                !/^[0-9A-Fa-f]{6}$/.test(
                    cor
                )
            ) {
                return interaction.reply({
                    content:
                        "❌ A cor precisa estar no formato hexadecimal.",
                    ephemeral: true
                });
            }

            config.cor =
                cor ||
                "5865F2";

            config.imagem =
                interaction.fields
                    .getTextInputValue(
                        "imagem"
                    )
                    .trim() ||
                null;

            config.thumbnail =
                interaction.fields
                    .getTextInputValue(
                        "thumbnail"
                    )
                    .trim() ||
                null;

            await interaction.deferUpdate();

            await atualizarPainelCriacao(
                interaction.client,
                config
            );

            return;
        }

        // ================================
        // 📅 DATA
        // ================================

        if (
            interaction.customId ===
            "sorteio_modal_data"
        ) {

            const data =
                interaction.fields
                    .getTextInputValue(
                        "data"
                    )
                    .trim();

            let horario =
                interaction.fields
                    .getTextInputValue(
                        "horario"
                    )
                    .trim();

            if (
                !/^\d{2}\/\d{2}\/\d{4}$/.test(
                    data
                )
            ) {
                return interaction.reply({
                    content:
                        "❌ A data precisa estar no formato `DD/MM/AAAA`.",
                    ephemeral: true
                });
            }

            // Aceita 18:50 ou 18.50
            horario =
                horario.replace(
                    ".",
                    ":"
                );

            if (
                !/^\d{2}:\d{2}$/.test(
                    horario
                )
            ) {
                return interaction.reply({
                    content:
                        "❌ O horário precisa estar no formato `HH:MM` ou `HH.MM`.",
                    ephemeral: true
                });
            }

            const [hora, minuto] =
                horario
                    .split(":")
                    .map(Number);

            if (
                hora > 23 ||
                minuto > 59
            ) {
                return interaction.reply({
                    content:
                        "❌ O horário informado é inválido.",
                    ephemeral: true
                });
            }

            const encerraEm =
                converterData(
                    data,
                    horario
                );

            if (
                !encerraEm ||
                encerraEm <= Date.now()
            ) {
                return interaction.reply({
                    content:
                        "❌ A data e o horário precisam estar no futuro.",
                    ephemeral: true
                });
            }

            config.data =
                data;

            config.horario =
                horario;

            await interaction.deferUpdate();

            await atualizarPainelCriacao(
                interaction.client,
                config
            );

            return;
        }
    },

    // ================================
    // 🔽 SELECTS
    // ================================

    async handleSelect(
        interaction
    ) {

        const customId =
            interaction.customId;

        const userId =
            interaction.user.id;

        const config =
            sessoes.get(
                userId
            );

        if (!config) {
            return interaction.reply({
                content:
                    "❌ Sua sessão de sorteio expirou.",
                ephemeral: true
            });
        }

        // ================================
        // 📢 CANAL
        // ================================

        if (
            customId.startsWith(
                "sorteio_selecionar_canal_"
            )
        ) {

            const donoId =
                customId.replace(
                    "sorteio_selecionar_canal_",
                    ""
                );

            if (
                donoId !== userId
            ) {
                return interaction.reply({
                    content:
                        "❌ Apenas quem criou este sorteio pode escolher o canal.",
                    ephemeral: true
                });
            }

            config.canalId =
                interaction.values[0];

            return interaction.update({
                embeds: [
                    criarEmbedPainel(
                        config
                    )
                ],
                components:
                    criarPainelSorteio(
                        userId,
                        Boolean(
                            config.sorteioId
                        ),
                        Boolean(
                            config.sorteioEncerrado
                        )
                    )
            });
        }

        // ================================
        // 🏆 VENCEDORES
        // ================================

        if (
            customId.startsWith(
                "sorteio_selecionar_vencedores_"
            )
        ) {

            const donoId =
                customId.replace(
                    "sorteio_selecionar_vencedores_",
                    ""
                );

            if (
                donoId !== userId
            ) {
                return interaction.reply({
                    content:
                        "❌ Apenas quem criou este sorteio pode escolher os vencedores.",
                    ephemeral: true
                });
            }

            const quantidade =
                Number(
                    interaction.values[0]
                );

            config.vencedores =
                Math.min(
                    Math.max(
                        quantidade || 1,
                        1
                    ),
                    20
                );

            return interaction.update({
                embeds: [
                    criarEmbedPainel(
                        config
                    )
                ],
                components:
                    criarPainelSorteio(
                        userId,
                        Boolean(
                            config.sorteioId
                        ),
                        Boolean(
                            config.sorteioEncerrado
                        )
                    )
            });
        }
    },

    // ================================
    // 🎟️ PARTICIPAÇÃO
    // ================================

    async handleParticipation(
        interaction
    ) {

        const id =
            interaction.customId.replace(
                "sorteio_participar_",
                ""
            );

        if (
            id === "preview"
        ) {
            return interaction.reply({
                content:
                    "👀 Essa é apenas uma prévia. O sorteio ainda não começou.",
                ephemeral: true
            });
        }

        const resultado =
            await participarSorteio(
                id,
                interaction.user.id,
                interaction.client
            );

        // ================================
        // 🔄 JÁ ESTÁ PARTICIPANDO
        // ================================

        if (
            resultado.jaParticipa
        ) {
            return interaction.reply({
                content:
                    "🎟️ Você já está participando deste sorteio.\n\nDeseja sair dele?",
                components: [
                    new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(
                                    `sorteio_sair_${id}`
                                )
                                .setLabel(
                                    "Sair do sorteio"
                                )
                                .setEmoji("🚪")
                                .setStyle(
                                    ButtonStyle.Danger
                                )
                        )
                ],
                ephemeral: true
            });
        }

        return interaction.reply({
            content:
                resultado.mensagem,
            ephemeral: true
        });
    },

    iniciarSistemaSorteios,

    verificarSorteios,

    finalizarSorteio,

    atualizarMensagemSorteio
};
