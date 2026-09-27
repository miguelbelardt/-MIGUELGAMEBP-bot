const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder,
    PermissionFlagsBits
} = require("discord.js");

const {
    pool
} = require("../database/database");

// =====================================================
// 📝 SISTEMA DE REGISTRO
// =====================================================
//
// Máximo de páginas: 6
//
// Cada página possui:
// - Título
// - Descrição
// - Rodapé
// - Ícone do rodapé
// - Botões
//
// Cada botão pode:
// - Ter texto
// - Ter emoji
// - Ter estilo
// - Dar um cargo
// - Não dar cargo
//
// Também é salvo:
// - Quem criou o registro
// - Quem já fez o registro
// - Qual botão foi utilizado
// =====================================================

const MAX_PAGINAS = 6;
const MAX_BOTOES = 5;


// =====================================================
// 🎨 ESTILOS DOS BOTÕES
// =====================================================

const ESTILOS_BOTOES = {
    PRIMARY: ButtonStyle.Primary,
    SECONDARY: ButtonStyle.Secondary,
    SUCCESS: ButtonStyle.Success,
    DANGER: ButtonStyle.Danger
};


// =====================================================
// 🔎 BUSCAR REGISTRO DO SERVIDOR
// =====================================================

async function buscarRegistro(
    guildId
) {

    const resultado =
        await pool.query(
            `
            SELECT *
            FROM registros
            WHERE guild_id = $1
            LIMIT 1
            `,
            [
                guildId
            ]
        );

    return (
        resultado.rows[0] ||
        null
    );
}


// =====================================================
// 🔎 BUSCAR PÁGINAS
// =====================================================

async function buscarPaginas(
    registroId
) {

    const resultado =
        await pool.query(
            `
            SELECT *
            FROM registro_paginas
            WHERE registro_id = $1
            ORDER BY pagina ASC
            `,
            [
                registroId
            ]
        );

    return resultado.rows;
}


// =====================================================
// 🔎 BUSCAR BOTÕES
// =====================================================

async function buscarBotoes(
    paginaId
) {

    const resultado =
        await pool.query(
            `
            SELECT *
            FROM registro_botoes
            WHERE pagina_id = $1
            ORDER BY ordem ASC
            `,
            [
                paginaId
            ]
        );

    return resultado.rows;
}


// =====================================================
// 📄 BUSCAR PÁGINA
// =====================================================

async function buscarPagina(
    registroId,
    numero
) {

    const resultado =
        await pool.query(
            `
            SELECT *
            FROM registro_paginas
            WHERE
                registro_id = $1
                AND pagina = $2
            LIMIT 1
            `,
            [
                registroId,
                numero
            ]
        );

    return (
        resultado.rows[0] ||
        null
    );
}


// =====================================================
// 🧱 CRIAR REGISTRO
// =====================================================

async function criarRegistro(
    guildId,
    usuarioId
) {

    const existente =
        await buscarRegistro(
            guildId
        );

    if (existente) {
        return existente;
    }

    const criadoEm =
        Date.now();

    await pool.query(
        `
        INSERT INTO registros (
            guild_id,
            canal_id,
            mensagem_id,
            criado_por,
            criado_em
        )
        VALUES (
            $1,
            NULL,
            NULL,
            $2,
            $3
        )
        `,
        [
            guildId,
            usuarioId,
            criadoEm
        ]
    );

    const registro =
        await buscarRegistro(
            guildId
        );

    // ============================================
    // 📄 CRIAR PRIMEIRA PÁGINA
    // ============================================

    await pool.query(
        `
        INSERT INTO registro_paginas (
            registro_id,
            pagina,
            titulo,
            descricao,
            rodape,
            rodape_icone
        )
        VALUES (
            $1,
            1,
            $2,
            $3,
            NULL,
            NULL
        )
        `,
        [
            registro.id,
            "Registro",
            "Configure esta página do sistema de registro."
        ]
    );

    return registro;
}


// =====================================================
// 🧾 EMBED DA PÁGINA
// =====================================================

function criarEmbedPagina(
    pagina
) {

    const embed =
        new EmbedBuilder()
            .setColor(
                0x5865F2
            );

    if (
        pagina.titulo
    ) {

        embed.setTitle(
            pagina.titulo
        );
    }

    if (
        pagina.descricao
    ) {

        embed.setDescription(
            pagina.descricao
        );
    }

    if (
        pagina.rodape
    ) {

        if (
            pagina.rodape_icone
        ) {

            embed.setFooter({
                text:
                    pagina.rodape,
                iconURL:
                    pagina.rodape_icone
            });

        } else {

            embed.setFooter({
                text:
                    pagina.rodape
            });
        }
    }

    return embed;
}


// =====================================================
// 🔘 CRIAR BOTÕES DA PÁGINA
// =====================================================

async function criarComponentesPagina(
    pagina,
    registro,
    numeroPagina
) {

    const botoes =
        await buscarBotoes(
            pagina.id
        );

    const rows = [];

    let row =
        new ActionRowBuilder();

    for (
        let i = 0;
        i < botoes.length;
        i++
    ) {

        const botao =
            botoes[i];

        const button =
            new ButtonBuilder()
                .setCustomId(
                    `registro_botao_${registro.id}_${botao.id}`
                )
                .setLabel(
                    botao.texto
                )
                .setStyle(
                    ESTILOS_BOTOES[
                        botao.estilo
                    ] ||
                    ButtonStyle.Primary
                );

        if (
            botao.emoji
        ) {

            button.setEmoji(
                botao.emoji
            );
        }

        row.addComponents(
            button
        );

        if (
            row.components.length >= 5
        ) {

            rows.push(
                row
            );

            row =
                new ActionRowBuilder();
        }
    }

    if (
        row.components.length > 0
    ) {

        rows.push(
            row
        );
    }

    // ============================================
    // 📄 NAVEGAÇÃO ENTRE PÁGINAS
    // ============================================

    const paginas =
        await buscarPaginas(
            registro.id
        );

    if (
        paginas.length > 1
    ) {

        const navegacao =
            new ActionRowBuilder();

        const anterior =
            new ButtonBuilder()
                .setCustomId(
                    `registro_pagina_${registro.id}_${numeroPagina - 1}`
                )
                .setLabel(
                    "Anterior"
                )
                .setEmoji(
                    "◀️"
                )
                .setStyle(
                    ButtonStyle.Secondary
                )
                .setDisabled(
                    numeroPagina <= 1
                );

        const proxima =
            new ButtonBuilder()
                .setCustomId(
                    `registro_pagina_${registro.id}_${numeroPagina + 1}`
                )
                .setLabel(
                    "Próxima"
                )
                .setEmoji(
                    "▶️"
                )
                .setStyle(
                    ButtonStyle.Secondary
                )
                .setDisabled(
                    numeroPagina >= paginas.length
                );

        navegacao.addComponents(
            anterior,
            proxima
        );

        rows.push(
            navegacao
        );
    }

    return rows;
}


// =====================================================
// 📤 ATUALIZAR MENSAGEM DO REGISTRO
// =====================================================

async function atualizarMensagemRegistro(
    guild,
    registro,
    numeroPagina = 1
) {

    if (
        !registro.canal_id ||
        !registro.mensagem_id
    ) {
        return false;
    }

    try {

        const canal =
            await guild.channels.fetch(
                registro.canal_id
            );

        if (
            !canal ||
            !canal.isTextBased()
        ) {
            return false;
        }

        const mensagem =
            await canal.messages.fetch(
                registro.mensagem_id
            );

        const pagina =
            await buscarPagina(
                registro.id,
                numeroPagina
            );

        if (!pagina) {
            return false;
        }

        const embed =
            criarEmbedPagina(
                pagina
            );

        const components =
            await criarComponentesPagina(
                pagina,
                registro,
                numeroPagina
            );

        await mensagem.edit({
            embeds: [
                embed
            ],
            components
        });

        return true;

    } catch (erro) {

        console.error(
            "❌ Erro ao atualizar mensagem do registro:",
            erro
        );

        return false;
    }
}


// =====================================================
// ⚙️ PAINEL PRINCIPAL
// =====================================================

async function mostrarPainel(
    interaction
) {

    const registro =
        await criarRegistro(
            interaction.guild.id,
            interaction.user.id
        );

    const paginas =
        await buscarPaginas(
            registro.id
        );

    const embed =
        new EmbedBuilder()
            .setTitle(
                "📝 Sistema de Registro"
            )
            .setDescription(
                [
                    "Configure o sistema de registro do servidor.",
                    "",
                    `📄 Páginas: **${paginas.length}/${MAX_PAGINAS}**`,
                    "",
                    "Use os botões abaixo para configurar cada página, criar botões e publicar o registro."
                ].join("\n")
            )
            .setColor(
                0x5865F2
            );

    const menu =
        new StringSelectMenuBuilder()
            .setCustomId(
                `registro_selecionar_pagina_${registro.id}`
            )
            .setPlaceholder(
                "📄 Escolha uma página"
            );

    for (
        const pagina of paginas
    ) {

        menu.addOptions({
            label:
                `Página ${pagina.pagina}`,

            description:
                pagina.titulo ||
                "Sem título",

            value:
                String(
                    pagina.pagina
                )
        });
    }

    const rowMenu =
        new ActionRowBuilder()
            .addComponents(
                menu
            );

    const rowBotoes =
        new ActionRowBuilder()
            .addComponents(

                new ButtonBuilder()
                    .setCustomId(
                        `registro_adicionar_pagina_${registro.id}`
                    )
                    .setLabel(
                        "Adicionar página"
                    )
                    .setEmoji(
                        "➕"
                    )
                    .setStyle(
                        ButtonStyle.Success
                    )
                    .setDisabled(
                        paginas.length >= MAX_PAGINAS
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `registro_publicar_${registro.id}`
                    )
                    .setLabel(
                        "Publicar"
                    )
                    .setEmoji(
                        "📢"
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    )
            );

    const rowExtra =
        new ActionRowBuilder()
            .addComponents(

                new ButtonBuilder()
                    .setCustomId(
                        `registro_excluir_${registro.id}`
                    )
                    .setLabel(
                        "Excluir registro"
                    )
                    .setEmoji(
                        "🗑️"
                    )
                    .setStyle(
                        ButtonStyle.Danger
                    )
            );

    await interaction.reply({
        embeds: [
            embed
        ],
        components: [
            rowMenu,
            rowBotoes,
            rowExtra
        ],
        ephemeral: true
    });
}


// =====================================================
// 📄 PAINEL DA PÁGINA
// =====================================================

async function mostrarConfiguracaoPagina(
    interaction,
    registroId,
    numeroPagina
) {

    const pagina =
        await buscarPagina(
            registroId,
            numeroPagina
        );

    if (!pagina) {

        return interaction.reply({
            content:
                "❌ Essa página não existe.",
            ephemeral: true
        });
    }

    const botoes =
        await buscarBotoes(
            pagina.id
        );

    const embed =
        new EmbedBuilder()
            .setTitle(
                `📄 Configuração — Página ${numeroPagina}`
            )
            .setDescription(
                [
                    `**Título:** ${pagina.titulo || "Não definido"}`,
                    `**Descrição:** ${pagina.descricao || "Não definida"}`,
                    `**Rodapé:** ${pagina.rodape || "Não definido"}`,
                    `**Ícone do rodapé:** ${pagina.rodape_icone || "Não definido"}`,
                    "",
                    `🔘 Botões: **${botoes.length}/${MAX_BOTOES}**`
                ].join("\n")
            )
            .setColor(
                0x5865F2
            );

    const row1 =
        new ActionRowBuilder()
            .addComponents(

                new ButtonBuilder()
                    .setCustomId(
                        `registro_editar_texto_${registroId}_${numeroPagina}`
                    )
                    .setLabel(
                        "Título / Descrição"
                    )
                    .setEmoji(
                        "📝"
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `registro_editar_rodape_${registroId}_${numeroPagina}`
                    )
                    .setLabel(
                        "Rodapé"
                    )
                    .setEmoji(
                        "🔻"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    )
            );

    const row2 =
        new ActionRowBuilder()
            .addComponents(

                new ButtonBuilder()
                    .setCustomId(
                        `registro_adicionar_botao_${registroId}_${numeroPagina}`
                    )
                    .setLabel(
                        "Adicionar botão"
                    )
                    .setEmoji(
                        "🔘"
                    )
                    .setStyle(
                        ButtonStyle.Success
                    )
                    .setDisabled(
                        botoes.length >= MAX_BOTOES
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `registro_botoes_${registroId}_${numeroPagina}`
                    )
                    .setLabel(
                        "Editar botões"
                    )
                    .setEmoji(
                        "⚙️"
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    )
            );

    const row3 =
        new ActionRowBuilder()
            .addComponents(

                new ButtonBuilder()
                    .setCustomId(
                        `registro_voltar_${registroId}`
                    )
                    .setLabel(
                        "Voltar"
                    )
                    .setEmoji(
                        "◀️"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    )
            );

    await interaction.update({
        embeds: [
            embed
        ],
        components: [
            row1,
            row2,
            row3
        ]
    });
}


// =====================================================
// 📝 MODAL TÍTULO / DESCRIÇÃO
// =====================================================

async function abrirModalTexto(
    interaction,
    registroId,
    numeroPagina
) {

    const pagina =
        await buscarPagina(
            registroId,
            numeroPagina
        );

    if (!pagina) {
        return;
    }

    const modal =
        new ModalBuilder()
            .setCustomId(
                `registro_modal_texto_${registroId}_${numeroPagina}`
            )
            .setTitle(
                `Editar página ${numeroPagina}`
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
            .setRequired(
                false
            )
            .setMaxLength(
                256
            )
            .setValue(
                pagina.titulo || ""
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
            .setRequired(
                false
            )
            .setMaxLength(
                4000
            )
            .setValue(
                pagina.descricao || ""
            );

    modal.addComponents(

        new ActionRowBuilder()
            .addComponents(
                titulo
            ),

        new ActionRowBuilder()
            .addComponents(
                descricao
            )
    );

    await interaction.showModal(
        modal
    );
}


// =====================================================
// 🔻 MODAL RODAPÉ
// =====================================================

async function abrirModalRodape(
    interaction,
    registroId,
    numeroPagina
) {

    const pagina =
        await buscarPagina(
            registroId,
            numeroPagina
        );

    if (!pagina) {
        return;
    }

    const modal =
        new ModalBuilder()
            .setCustomId(
                `registro_modal_rodape_${registroId}_${numeroPagina}`
            )
            .setTitle(
                `Rodapé — Página ${numeroPagina}`
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
            .setRequired(
                false
            )
            .setMaxLength(
                2048
            )
            .setValue(
                pagina.rodape || ""
            );

    const icone =
        new TextInputBuilder()
            .setCustomId(
                "rodape_icone"
            )
            .setLabel(
                "URL do ícone do rodapé"
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(
                false
            )
            .setValue(
                pagina.rodape_icone || ""
            );

    modal.addComponents(

        new ActionRowBuilder()
            .addComponents(
                rodape
            ),

        new ActionRowBuilder()
            .addComponents(
                icone
            )
    );

    await interaction.showModal(
        modal
    );
}


// =====================================================
// 🔘 MODAL NOVO BOTÃO
// =====================================================

async function abrirModalBotao(
    interaction,
    registroId,
    numeroPagina
) {

    const pagina =
        await buscarPagina(
            registroId,
            numeroPagina
        );

    if (!pagina) {
        return;
    }

    const botoes =
        await buscarBotoes(
            pagina.id
        );

    if (
        botoes.length >= MAX_BOTOES
    ) {

        return interaction.reply({
            content:
                `❌ Cada página pode ter no máximo ${MAX_BOTOES} botões.`,
            ephemeral: true
        });
    }

    const modal =
        new ModalBuilder()
            .setCustomId(
                `registro_modal_botao_${registroId}_${numeroPagina}`
            )
            .setTitle(
                `Novo botão — Página ${numeroPagina}`
            );

    const texto =
        new TextInputBuilder()
            .setCustomId(
                "texto"
            )
            .setLabel(
                "Texto do botão"
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(
                true
            )
            .setMaxLength(
                80
            );

    const emoji =
        new TextInputBuilder()
            .setCustomId(
                "emoji"
            )
            .setLabel(
                "Emoji (opcional)"
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(
                false
            )
            .setMaxLength(
                100
            );

    const cargo =
        new TextInputBuilder()
            .setCustomId(
                "cargo"
            )
            .setLabel(
                "ID do cargo (opcional)"
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(
                false
            )
            .setMaxLength(
                30
            );

    const estilo =
        new TextInputBuilder()
            .setCustomId(
                "estilo"
            )
            .setLabel(
                "Estilo: PRIMARY, SECONDARY, SUCCESS ou DANGER"
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(
                false
            )
            .setValue(
                "PRIMARY"
            )
            .setMaxLength(
                20
            );

    modal.addComponents(

        new ActionRowBuilder()
            .addComponents(
                texto
            ),

        new ActionRowBuilder()
            .addComponents(
                emoji
            ),

        new ActionRowBuilder()
            .addComponents(
                cargo
            ),

        new ActionRowBuilder()
            .addComponents(
                estilo
            )
    );

    await interaction.showModal(
        modal
    );
}


// =====================================================
// ⚙️ EDITAR BOTÕES
// =====================================================

async function mostrarBotoes(
    interaction,
    registroId,
    numeroPagina
) {

    const pagina =
        await buscarPagina(
            registroId,
            numeroPagina
        );

    if (!pagina) {
        return;
    }

    const botoes =
        await buscarBotoes(
            pagina.id
        );

    const embed =
        new EmbedBuilder()
            .setTitle(
                `🔘 Botões — Página ${numeroPagina}`
            )
            .setDescription(
                botoes.length
                    ? botoes.map(
                        (botao, index) =>
                            [
                                `**${index + 1}. ${botao.texto}**`,
                                `🎭 Cargo: ${
                                    botao.cargo_id
                                        ? `<@&${botao.cargo_id}>`
                                        : "Nenhum"
                                }`,
                                `🎨 Estilo: ${botao.estilo}`
                            ].join("\n")
                    ).join("\n\n")
                    : "Nenhum botão configurado."
            )
            .setColor(
                0x5865F2
            );

    const components = [];

    for (
        const botao of botoes
    ) {

        components.push(
            new ActionRowBuilder()
                .addComponents(

                    new ButtonBuilder()
                        .setCustomId(
                            `registro_editar_botao_${registroId}_${botao.id}_${numeroPagina}`
                        )
                        .setLabel(
                            `Editar: ${botao.texto}`.substring(
                                0,
                                80
                            )
                        )
                        .setStyle(
                            ButtonStyle.Primary
                        ),

                    new ButtonBuilder()
                        .setCustomId(
                            `registro_excluir_botao_${registroId}_${botao.id}_${numeroPagina}`
                        )
                        .setLabel(
                            "Excluir"
                        )
                        .setEmoji(
                            "🗑️"
                        )
                        .setStyle(
                            ButtonStyle.Danger
                        )
                )
        );
    }

    components.push(
        new ActionRowBuilder()
            .addComponents(

                new ButtonBuilder()
                    .setCustomId(
                        `registro_voltar_pagina_${registroId}_${numeroPagina}`
                    )
                    .setLabel(
                        "Voltar"
                    )
                    .setEmoji(
                        "◀️"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    )
            )
    );

    await interaction.update({
        embeds: [
            embed
        ],
        components
    });
}


// =====================================================
// ✏️ MODAL EDITAR BOTÃO
// =====================================================

async function abrirModalEditarBotao(
    interaction,
    registroId,
    botaoId,
    numeroPagina
) {

    const resultado =
        await pool.query(
            `
            SELECT *
            FROM registro_botoes
            WHERE id = $1
            LIMIT 1
            `,
            [
                botaoId
            ]
        );

    const botao =
        resultado.rows[0];

    if (!botao) {

        return interaction.reply({
            content:
                "❌ Esse botão não existe.",
            ephemeral: true
        });
    }

    const modal =
        new ModalBuilder()
            .setCustomId(
                `registro_modal_editar_botao_${registroId}_${botaoId}_${numeroPagina}`
            )
            .setTitle(
                "Editar botão"
            );

    const texto =
        new TextInputBuilder()
            .setCustomId(
                "texto"
            )
            .setLabel(
                "Texto"
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(
                true
            )
            .setMaxLength(
                80
            )
            .setValue(
                botao.texto || ""
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
            .setRequired(
                false
            )
            .setValue(
                botao.emoji || ""
            );

    const cargo =
        new TextInputBuilder()
            .setCustomId(
                "cargo"
            )
            .setLabel(
                "ID do cargo — deixe vazio para nenhum"
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(
                false
            )
            .setValue(
                botao.cargo_id || ""
            );

    const estilo =
        new TextInputBuilder()
            .setCustomId(
                "estilo"
            )
            .setLabel(
                "PRIMARY / SECONDARY / SUCCESS / DANGER"
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(
                false
            )
            .setValue(
                botao.estilo || "PRIMARY"
            );

    modal.addComponents(

        new ActionRowBuilder()
            .addComponents(
                texto
            ),

        new ActionRowBuilder()
            .addComponents(
                emoji
            ),

        new ActionRowBuilder()
            .addComponents(
                cargo
            ),

        new ActionRowBuilder()
            .addComponents(
                estilo
            )
    );

    await interaction.showModal(
        modal
    );
}


// =====================================================
// 📢 PUBLICAR REGISTRO
// =====================================================

async function publicarRegistro(
    interaction,
    registroId
) {

    const registro =
        await buscarRegistro(
            interaction.guild.id
        );

    if (
        !registro ||
        Number(registro.id) !==
            Number(registroId)
    ) {

        return interaction.reply({
            content:
                "❌ Registro não encontrado.",
            ephemeral: true
        });
    }

    const pagina =
        await buscarPagina(
            registro.id,
            1
        );

    if (!pagina) {

        return interaction.reply({
            content:
                "❌ O registro não possui uma página.",
            ephemeral: true
        });
    }

    const embed =
        criarEmbedPagina(
            pagina
        );

    const components =
        await criarComponentesPagina(
            pagina,
            registro,
            1
        );

    const mensagem =
        await interaction.channel.send({
            embeds: [
                embed
            ],
            components
        });

    await pool.query(
        `
        UPDATE registros
        SET
            canal_id = $1,
            mensagem_id = $2
        WHERE
            id = $3
        `,
        [
            interaction.channel.id,
            mensagem.id,
            registro.id
        ]
    );

    await interaction.reply({
        content:
            "✅ Registro publicado com sucesso!",
        ephemeral: true
    });
}


// =====================================================
// 🆕 ADICIONAR PÁGINA
// =====================================================

async function adicionarPagina(
    interaction,
    registroId
) {

    const paginas =
        await buscarPaginas(
            registroId
        );

    if (
        paginas.length >= MAX_PAGINAS
    ) {

        return interaction.reply({
            content:
                `❌ O limite máximo é de ${MAX_PAGINAS} páginas.`,
            ephemeral: true
        });
    }

    const numero =
        paginas.length + 1;

    await pool.query(
        `
        INSERT INTO registro_paginas (
            registro_id,
            pagina,
            titulo,
            descricao,
            rodape,
            rodape_icone
        )
        VALUES (
            $1,
            $2,
            $3,
            $4,
            NULL,
            NULL
        )
        `,
        [
            registroId,
            numero,
            `Página ${numero}`,
            "Configure esta página."
        ]
    );

    await interaction.reply({
        content:
            `✅ Página ${numero} criada!`,
        ephemeral: true
    });
}


// =====================================================
// 🗑️ EXCLUIR REGISTRO
// =====================================================

async function excluirRegistro(
    interaction,
    registroId
) {

    const registro =
        await buscarRegistro(
            interaction.guild.id
        );

    if (
        !registro ||
        Number(registro.id) !==
            Number(registroId)
    ) {
        return interaction.reply({
            content:
                "❌ Registro não encontrado.",
            ephemeral: true
        });
    }

    if (
        registro.canal_id &&
        registro.mensagem_id
    ) {

        try {

            const canal =
                await interaction.guild.channels.fetch(
                    registro.canal_id
                );

            if (
                canal
            ) {

                const mensagem =
                    await canal.messages.fetch(
                        registro.mensagem_id
                    ).catch(
                        () => null
                    );

                if (
                    mensagem
                ) {

                    await mensagem.delete()
                        .catch(
                            () => {}
                        );
                }
            }

        } catch {}
    }

    await pool.query(
        `
        DELETE FROM registros
        WHERE
            id = $1
            AND guild_id = $2
        `,
        [
            registroId,
            interaction.guild.id
        ]
    );

    await interaction.reply({
        content:
            "🗑️ Registro excluído com sucesso.",
        ephemeral: true
    });
}


// =====================================================
// 🎯 CLIQUE EM BOTÃO DO REGISTRO
// =====================================================

async function processarBotaoRegistro(
    interaction,
    registroId,
    botaoId
) {

    const resultado =
        await pool.query(
            `
            SELECT
                b.*,
                r.guild_id
            FROM registro_botoes b

            INNER JOIN registro_paginas p
                ON p.id = b.pagina_id

            INNER JOIN registros r
                ON r.id = p.registro_id

            WHERE
                b.id = $1
                AND r.id = $2

            LIMIT 1
            `,
            [
                botaoId,
                registroId
            ]
        );

    const botao =
        resultado.rows[0];

    if (!botao) {

        return interaction.reply({
            content:
                "❌ Esse botão não está mais disponível.",
            ephemeral: true
        });
    }

    // ============================================
    // 👤 VERIFICAR SE JÁ ESTÁ REGISTRADO
    // ============================================

    const registrado =
        await pool.query(
            `
            SELECT *
            FROM registro_membros
            WHERE
                registro_id = $1
                AND user_id = $2
            LIMIT 1
            `,
            [
                registroId,
                interaction.user.id
            ]
        );

    if (
        registrado.rows.length > 0
    ) {

        return interaction.reply({
            content:
                "ℹ️ Você já fez este registro.",
            ephemeral: true
        });
    }

    // ============================================
    // 🎭 DAR CARGO, SE CONFIGURADO
    // ============================================

    if (
        botao.cargo_id
    ) {

        const cargo =
            interaction.guild.roles.cache.get(
                botao.cargo_id
            );

        if (
            cargo
        ) {

            try {

                await interaction.member.roles.add(
                    cargo
                );

            } catch (erro) {

                console.error(
                    "❌ Erro ao dar cargo do registro:",
                    erro
                );

                return interaction.reply({
                    content:
                        "❌ Não consegui adicionar o cargo configurado para este botão.",
                    ephemeral: true
                });
            }
        }
    }

    // ============================================
    // 💾 SALVAR REGISTRO DO MEMBRO
    // ============================================

    await pool.query(
        `
        INSERT INTO registro_membros (
            registro_id,
            user_id,
            botao_id,
            registrado_em
        )
        VALUES (
            $1,
            $2,
            $3,
            $4
        )
        `,
        [
            registroId,
            interaction.user.id,
            botaoId,
            Date.now()
        ]
    );

    await interaction.reply({
        content:
            botao.cargo_id
                ? "✅ Registro concluído! Seu cargo foi adicionado."
                : "✅ Registro concluído com sucesso!",
        ephemeral: true
    });
}


// =====================================================
// 🖱️ INTERAÇÕES
// =====================================================

async function handleInteraction(
    interaction
) {

    // =================================================
    // 🔘 BOTÃO DE REGISTRO
    // =================================================

    if (
        interaction.isButton() &&
        interaction.customId.startsWith(
            "registro_botao_"
        )
    ) {

        const partes =
            interaction.customId.split("_");

        const registroId =
            partes[2];

        const botaoId =
            partes[3];

        return processarBotaoRegistro(
            interaction,
            registroId,
            botaoId
        );
    }


    // =================================================
    // 📄 NAVEGAÇÃO
    // =================================================

    if (
        interaction.isButton() &&
        interaction.customId.startsWith(
            "registro_pagina_"
        )
    ) {

        const partes =
            interaction.customId.split("_");

        const registroId =
            partes[2];

        const numeroPagina =
            Number(
                partes[3]
            );

        const registro =
            await buscarRegistro(
                interaction.guild.id
            );

        const pagina =
            await buscarPagina(
                registroId,
                numeroPagina
            );

        if (
            !registro ||
            !pagina
        ) {
            return interaction.reply({
                content:
                    "❌ Página não encontrada.",
                ephemeral: true
            });
        }

        const embed =
            criarEmbedPagina(
                pagina
            );

        const components =
            await criarComponentesPagina(
                pagina,
                registro,
                numeroPagina
            );

        return interaction.update({
            embeds: [
                embed
            ],
            components
        });
    }


    // =================================================
    // ➕ ADICIONAR PÁGINA
    // =================================================

    if (
        interaction.isButton() &&
        interaction.customId.startsWith(
            "registro_adicionar_pagina_"
        )
    ) {

        const registroId =
            interaction.customId.replace(
                "registro_adicionar_pagina_",
                ""
            );

        return adicionarPagina(
            interaction,
            registroId
        );
    }


    // =================================================
    // 📢 PUBLICAR
    // =================================================

    if (
        interaction.isButton() &&
        interaction.customId.startsWith(
            "registro_publicar_"
        )
    ) {

        const registroId =
            interaction.customId.replace(
                "registro_publicar_",
                ""
            );

        return publicarRegistro(
            interaction,
            registroId
        );
    }


    // =================================================
    // 🗑️ EXCLUIR REGISTRO
    // =================================================

    if (
        interaction.isButton() &&
        interaction.customId.startsWith(
            "registro_excluir_"
        )
    ) {

        const registroId =
            interaction.customId.replace(
                "registro_excluir_",
                ""
            );

        return excluirRegistro(
            interaction,
            registroId
        );
    }


    // =================================================
    // 📋 SELECIONAR PÁGINA
    // =================================================

    if (
        interaction.isStringSelectMenu() &&
        interaction.customId.startsWith(
            "registro_selecionar_pagina_"
        )
    ) {

        const registroId =
            interaction.customId.replace(
                "registro_selecionar_pagina_",
                ""
            );

        const numeroPagina =
            Number(
                interaction.values[0]
            );

        return mostrarConfiguracaoPagina(
            interaction,
            registroId,
            numeroPagina
        );
    }


    // =================================================
    // 📝 EDITAR TEXTO
    // =================================================

    if (
        interaction.isButton() &&
        interaction.customId.startsWith(
            "registro_editar_texto_"
        )
    ) {

        const partes =
            interaction.customId.split("_");

        return abrirModalTexto(
            interaction,
            partes[3],
            Number(
                partes[4]
            )
        );
    }


    // =================================================
    // 🔻 EDITAR RODAPÉ
    // =================================================

    if (
        interaction.isButton() &&
        interaction.customId.startsWith(
            "registro_editar_rodape_"
        )
    ) {

        const partes =
            interaction.customId.split("_");

        return abrirModalRodape(
            interaction,
            partes[3],
            Number(
                partes[4]
            )
        );
    }


    // =================================================
    // ➕ ADICIONAR BOTÃO
    // =================================================

    if (
        interaction.isButton() &&
        interaction.customId.startsWith(
            "registro_adicionar_botao_"
        )
    ) {

        const partes =
            interaction.customId.split("_");

        return abrirModalBotao(
            interaction,
            partes[3],
            Number(
                partes[4]
            )
        );
    }


    // =================================================
    // ⚙️ EDITAR BOTÕES
    // =================================================

    if (
        interaction.isButton() &&
        interaction.customId.startsWith(
            "registro_botoes_"
        )
    ) {

        const partes =
            interaction.customId.split("_");

        return mostrarBotoes(
            interaction,
            partes[2],
            Number(
                partes[3]
            )
        );
    }


    // =================================================
    // ✏️ EDITAR BOTÃO
    // =================================================

    if (
        interaction.isButton() &&
        interaction.customId.startsWith(
            "registro_editar_botao_"
        )
    ) {

        const partes =
            interaction.customId.split("_");

        return abrirModalEditarBotao(
            interaction,
            partes[3],
            partes[4],
            Number(
                partes[5]
            )
        );
    }


    // =================================================
    // 🗑️ EXCLUIR BOTÃO
    // =================================================

    if (
        interaction.isButton() &&
        interaction.customId.startsWith(
            "registro_excluir_botao_"
        )
    ) {

        const partes =
            interaction.customId.split("_");

        const registroId =
            partes[3];

        const botaoId =
            partes[4];

        const numeroPagina =
            Number(
                partes[5]
            );

        await pool.query(
            `
            DELETE FROM registro_botoes
            WHERE id = $1
            `,
            [
                botaoId
            ]
        );

        return mostrarBotoes(
            interaction,
            registroId,
            numeroPagina
        );
    }


    // =================================================
    // ◀️ VOLTAR PARA PÁGINA
    // =================================================

    if (
        interaction.isButton() &&
        interaction.customId.startsWith(
            "registro_voltar_pagina_"
        )
    ) {

        const partes =
            interaction.customId.split("_");

        return mostrarConfiguracaoPagina(
            interaction,
            partes[3],
            Number(
                partes[4]
            )
        );
    }


    // =================================================
    // ◀️ VOLTAR PARA PAINEL
    // =================================================

    if (
        interaction.isButton() &&
        interaction.customId.startsWith(
            "registro_voltar_"
        )
    ) {

        const registroId =
            interaction.customId.replace(
                "registro_voltar_",
                ""
            );

        const registro =
            await buscarRegistro(
                interaction.guild.id
            );

        if (
            !registro ||
            Number(registro.id) !==
                Number(registroId)
        ) {

            return interaction.reply({
                content:
                    "❌ Registro não encontrado.",
                ephemeral: true
            });
        }

        const paginas =
            await buscarPaginas(
                registro.id
            );

        const embed =
            new EmbedBuilder()
                .setTitle(
                    "📝 Sistema de Registro"
                )
                .setDescription(
                    [
                        `📄 Páginas: **${paginas.length}/${MAX_PAGINAS}**`,
                        "",
                        "Selecione uma página para editar."
                    ].join("\n")
                )
                .setColor(
                    0x5865F2
                );

        const menu =
            new StringSelectMenuBuilder()
                .setCustomId(
                    `registro_selecionar_pagina_${registro.id}`
                )
                .setPlaceholder(
                    "📄 Escolha uma página"
                );

        for (
            const pagina of paginas
        ) {

            menu.addOptions({
                label:
                    `Página ${pagina.pagina}`,

                description:
                    pagina.titulo ||
                    "Sem título",

                value:
                    String(
                        pagina.pagina
                    )
            });
        }

        const row =
            new ActionRowBuilder()
                .addComponents(
                    menu
                );

        const botoes =
            new ActionRowBuilder()
                .addComponents(

                    new ButtonBuilder()
                        .setCustomId(
                            `registro_adicionar_pagina_${registro.id}`
                        )
                        .setLabel(
                            "Adicionar página"
                        )
                        .setEmoji(
                            "➕"
                        )
                        .setStyle(
                            ButtonStyle.Success
                        )
                        .setDisabled(
                            paginas.length >=
                                MAX_PAGINAS
                        ),

                    new ButtonBuilder()
                        .setCustomId(
                            `registro_publicar_${registro.id}`
                        )
                        .setLabel(
                            "Publicar"
                        )
                        .setEmoji(
                            "📢"
                        )
                        .setStyle(
                            ButtonStyle.Primary
                        )
                );

        return interaction.update({
            embeds: [
                embed
            ],
            components: [
                row,
                botoes
            ]
        });
    }


    // =================================================
    // 📝 MODAL TEXTO
    // =================================================

    if (
        interaction.isModalSubmit() &&
        interaction.customId.startsWith(
            "registro_modal_texto_"
        )
    ) {

        const partes =
            interaction.customId.split("_");

        const registroId =
            partes[3];

        const numeroPagina =
            Number(
                partes[4]
            );

        const titulo =
            interaction.fields.getTextInputValue(
                "titulo"
            );

        const descricao =
            interaction.fields.getTextInputValue(
                "descricao"
            );

        await pool.query(
            `
            UPDATE registro_paginas
            SET
                titulo = $1,
                descricao = $2
            WHERE
                registro_id = $3
                AND pagina = $4
            `,
            [
                titulo || null,
                descricao || null,
                registroId,
                numeroPagina
            ]
        );

        await interaction.reply({
            content:
                "✅ Título e descrição atualizados!",
            ephemeral: true
        });

        return;
    }


    // =================================================
    // 🔻 MODAL RODAPÉ
    // =================================================

    if (
        interaction.isModalSubmit() &&
        interaction.customId.startsWith(
            "registro_modal_rodape_"
        )
    ) {

        const partes =
            interaction.customId.split("_");

        const registroId =
            partes[3];

        const numeroPagina =
            Number(
                partes[4]
            );

        const rodape =
            interaction.fields.getTextInputValue(
                "rodape"
            );

        const icone =
            interaction.fields.getTextInputValue(
                "rodape_icone"
            );

        await pool.query(
            `
            UPDATE registro_paginas
            SET
                rodape = $1,
                rodape_icone = $2
            WHERE
                registro_id = $3
                AND pagina = $4
            `,
            [
                rodape || null,
                icone || null,
                registroId,
                numeroPagina
            ]
        );

        await interaction.reply({
            content:
                "✅ Rodapé atualizado!",
            ephemeral: true
        });

        return;
    }


    // =================================================
    // 🔘 MODAL NOVO BOTÃO
    // =================================================

    if (
        interaction.isModalSubmit() &&
        interaction.customId.startsWith(
            "registro_modal_botao_"
        )
    ) {

        const partes =
            interaction.customId.split("_");

        const registroId =
            partes[3];

        const numeroPagina =
            Number(
                partes[4]
            );

        const pagina =
            await buscarPagina(
                registroId,
                numeroPagina
            );

        if (!pagina) {

            return interaction.reply({
                content:
                    "❌ Página não encontrada.",
                ephemeral: true
            });
        }

        const botoes =
            await buscarBotoes(
                pagina.id
            );

        if (
            botoes.length >= MAX_BOTOES
        ) {

            return interaction.reply({
                content:
                    `❌ O limite é de ${MAX_BOTOES} botões por página.`,
                ephemeral: true
            });
        }

        const texto =
            interaction.fields.getTextInputValue(
                "texto"
            );

        const emoji =
            interaction.fields.getTextInputValue(
                "emoji"
            );

        const cargo =
            interaction.fields.getTextInputValue(
                "cargo"
            );

        let estilo =
            interaction.fields.getTextInputValue(
                "estilo"
            );

        estilo =
            estilo
                .toUpperCase()
                .trim();

        if (
            !ESTILOS_BOTOES[estilo]
        ) {

            estilo =
                "PRIMARY";
        }

        let cargoId =
            null;

        if (
            cargo &&
            /^\d{15,25}$/.test(
                cargo.trim()
            )
        ) {

            const cargoDiscord =
                interaction.guild.roles.cache.get(
                    cargo.trim()
                );

            if (
                cargoDiscord
            ) {

                cargoId =
                    cargo.trim();
            }
        }

        await pool.query(
            `
            INSERT INTO registro_botoes (
                pagina_id,
                ordem,
                texto,
                emoji,
                estilo,
                cargo_id
            )
            VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6
            )
            `,
            [
                pagina.id,
                botoes.length + 1,
                texto,
                emoji || null,
                estilo,
                cargoId
            ]
        );

        await interaction.reply({
            content:
                cargoId
                    ? `✅ Botão criado e configurado para dar <@&${cargoId}>.`
                    : "✅ Botão criado sem cargo.",
            ephemeral: true
        });

        return;
    }


    // =================================================
    // ✏️ MODAL EDITAR BOTÃO
    // =================================================

    if (
        interaction.isModalSubmit() &&
        interaction.customId.startsWith(
            "registro_modal_editar_botao_"
        )
    ) {

        const partes =
            interaction.customId.split("_");

        const botaoId =
            partes[4];

        const texto =
            interaction.fields.getTextInputValue(
                "texto"
            );

        const emoji =
            interaction.fields.getTextInputValue(
                "emoji"
            );

        const cargo =
            interaction.fields.getTextInputValue(
                "cargo"
            );

        let estilo =
            interaction.fields.getTextInputValue(
                "estilo"
            );

        estilo =
            estilo
                .toUpperCase()
                .trim();

        if (
            !ESTILOS_BOTOES[estilo]
        ) {

            estilo =
                "PRIMARY";
        }

        let cargoId =
            null;

        if (
            cargo &&
            /^\d{15,25}$/.test(
                cargo.trim()
            )
        ) {

            const cargoDiscord =
                interaction.guild.roles.cache.get(
                    cargo.trim()
                );

            if (
                cargoDiscord
            ) {

                cargoId =
                    cargo.trim();
            }
        }

        await pool.query(
            `
            UPDATE registro_botoes
            SET
                texto = $1,
                emoji = $2,
                estilo = $3,
                cargo_id = $4
            WHERE
                id = $5
            `,
            [
                texto,
                emoji || null,
                estilo,
                cargoId,
                botaoId
            ]
        );

        await interaction.reply({
            content:
                "✅ Botão atualizado!",
            ephemeral: true
        });

        return;
    }
}


// =====================================================
// 📦 COMANDO
// =====================================================

const data =
    new SlashCommandBuilder()
        .setName(
            "registrar"
        )
        .setDescription(
            "Cria e configura o sistema de registro do servidor."
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageGuild
        );


// =====================================================
// ▶️ EXECUTAR
// =====================================================

async function execute(
    interaction
) {

    if (
        !interaction.guild
    ) {

        return interaction.reply({
            content:
                "❌ Este comando só pode ser usado em um servidor.",
            ephemeral: true
        });
    }

    if (
        !interaction.memberPermissions.has(
            PermissionFlagsBits.ManageGuild
        )
    ) {

        return interaction.reply({
            content:
                "❌ Você precisa da permissão **Gerenciar Servidor** para usar este comando.",
            ephemeral: true
        });
    }

    await mostrarPainel(
        interaction
    );
}


// =====================================================
// 📦 EXPORTAÇÕES
// =====================================================

module.exports = {
    data,
    execute,
    handleInteraction
};
