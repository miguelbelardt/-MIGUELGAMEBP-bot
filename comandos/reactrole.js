const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");

const { mysqlPool } = require("../database/database");

// =====================================================
// ⚙️ COMANDO REACT ROLE
// =====================================================

const data = new SlashCommandBuilder()
    .setName("reactrole")
    .setDescription("Configura um sistema de cargos por reação.")
    .setDefaultMemberPermissions(
        PermissionFlagsBits.ManageGuild
    )

    // =================================================
    // 📨 CONFIGURAR
    // =================================================

    .addSubcommand(subcommand =>
        subcommand
            .setName("configurar")
            .setDescription("Configura uma mensagem de React Role.")

            .addStringOption(option =>
                option
                    .setName("mensagem")
                    .setDescription(
                        "ID da mensagem que receberá os reacts."
                    )
                    .setRequired(true)
            )

            .addStringOption(option =>
                option
                    .setName("emoji")
                    .setDescription(
                        "Emoji que será usado para dar o cargo."
                    )
                    .setRequired(true)
            )

            .addRoleOption(option =>
                option
                    .setName("cargo")
                    .setDescription(
                        "Cargo que será dado ao reagir."
                    )
                    .setRequired(true)
            )

            .addStringOption(option =>
                option
                    .setName("titulo")
                    .setDescription(
                        "Título do Embed."
                    )
                    .setRequired(false)
            )

            .addStringOption(option =>
                option
                    .setName("descricao")
                    .setDescription(
                        "Descrição do Embed."
                    )
                    .setRequired(false)
            )

            .addStringOption(option =>
                option
                    .setName("cor")
                    .setDescription(
                        "Cor do Embed em hexadecimal. Ex: #00A8FF"
                    )
                    .setRequired(false)
            )

            .addStringOption(option =>
                option
                    .setName("rodape")
                    .setDescription(
                        "Texto do rodapé do Embed."
                    )
                    .setRequired(false)
            )

            .addStringOption(option =>
                option
                    .setName("imagem")
                    .setDescription(
                        "URL da imagem do Embed."
                    )
                    .setRequired(false)
            )

            .addStringOption(option =>
                option
                    .setName("thumbnail")
                    .setDescription(
                        "URL da thumbnail do Embed."
                    )
                    .setRequired(false)
            )

            .addStringOption(option =>
                option
                    .setName("content")
                    .setDescription(
                        "Mensagem enviada acima do Embed."
                    )
                    .setRequired(false)
            )
    )

    // =================================================
    // ➕ ADICIONAR
    // =================================================

    .addSubcommand(subcommand =>
        subcommand
            .setName("adicionar")
            .setDescription(
                "Adiciona outro emoji e cargo à mensagem."
            )

            .addStringOption(option =>
                option
                    .setName("mensagem")
                    .setDescription(
                        "ID da mensagem."
                    )
                    .setRequired(true)
            )

            .addStringOption(option =>
                option
                    .setName("emoji")
                    .setDescription(
                        "Emoji que será usado."
                    )
                    .setRequired(true)
            )

            .addRoleOption(option =>
                option
                    .setName("cargo")
                    .setDescription(
                        "Cargo dado ao reagir."
                    )
                    .setRequired(true)
            )
    )

    // =================================================
    // ➖ REMOVER
    // =================================================

    .addSubcommand(subcommand =>
        subcommand
            .setName("remover")
            .setDescription(
                "Remove um emoji/cargo da mensagem."
            )

            .addStringOption(option =>
                option
                    .setName("mensagem")
                    .setDescription(
                        "ID da mensagem."
                    )
                    .setRequired(true)
            )

            .addStringOption(option =>
                option
                    .setName("emoji")
                    .setDescription(
                        "Emoji que será removido."
                    )
                    .setRequired(true)
            )
    )

    // =================================================
    // 📋 STATUS
    // =================================================

    .addSubcommand(subcommand =>
        subcommand
            .setName("status")
            .setDescription(
                "Mostra a configuração do React Role."
            )

            .addStringOption(option =>
                option
                    .setName("mensagem")
                    .setDescription(
                        "ID da mensagem."
                    )
                    .setRequired(true)
            )
    )

    // =================================================
    // ❌ LIMPAR
    // =================================================

    .addSubcommand(subcommand =>
        subcommand
            .setName("limpar")
            .setDescription(
                "Remove toda a configuração de uma mensagem."
            )

            .addStringOption(option =>
                option
                    .setName("mensagem")
                    .setDescription(
                        "ID da mensagem."
                    )
                    .setRequired(true)
            )
    );

// =====================================================
// 🔧 NORMALIZAR EMOJI
// =====================================================

function normalizarEmoji(emoji) {
    if (!emoji) return null;

    if (
        typeof emoji === "object" &&
        emoji.id
    ) {
        return `${emoji.name}:${emoji.id}`;
    }

    const texto = String(emoji).trim();

    const customEmoji =
        texto.match(
            /^<a?:([^:>]+):(\d+)>$/
        );

    if (customEmoji) {
        return `${customEmoji[1]}:${customEmoji[2]}`;
    }

    return texto;
}

// =====================================================
// 🎨 NORMALIZAR COR
// =====================================================

function normalizarCor(cor) {
    if (!cor) return null;

    let texto =
        String(cor)
            .trim()
            .replace(/^#/, "");

    if (
        !/^[0-9A-Fa-f]{6}$/.test(texto)
    ) {
        return null;
    }

    return `#${texto.toUpperCase()}`;
}

// =====================================================
// 📨 BUSCAR CONFIGURAÇÕES
// =====================================================

async function buscarReactRoles(
    guildId,
    mensagemId
) {
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
// 💾 SALVAR REACT ROLE
// =====================================================

async function salvarReactRole({
    guildId,
    mensagemId,
    emoji,
    cargoId,
    content,
    titulo,
    descricao,
    cor,
    rodape,
    imagem,
    thumbnail
}) {

    const emojiNormalizado =
        normalizarEmoji(emoji);

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
            TRUE,
            ?, ?, ?,
            ?, ?,
            ?, ?,
            UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000,
            UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000
        )
        ON DUPLICATE KEY UPDATE
            cargo_id = VALUES(cargo_id),
            content = VALUES(content),
            embed_habilitado = TRUE,
            embed_titulo = VALUES(embed_titulo),
            embed_descricao = VALUES(embed_descricao),
            embed_cor = VALUES(embed_cor),
            footer_habilitado = VALUES(footer_habilitado),
            footer_texto = VALUES(footer_texto),
            imagem = VALUES(imagem),
            thumbnail = VALUES(thumbnail),
            atualizado_em =
                UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000
        `,
        [
            guildId,
            mensagemId,
            emojiNormalizado,
            cargoId,
            content,
            titulo,
            descricao,
            cor,
            rodape ? true : false,
            rodape || null,
            imagem,
            thumbnail
        ]
    );
}

// =====================================================
// 🗑️ REMOVER REACT ROLE
// =====================================================

async function removerReactRole(
    guildId,
    mensagemId,
    emoji
) {
    const emojiNormalizado =
        normalizarEmoji(emoji);

    const [resultado] =
        await mysqlPool.query(
            `
            DELETE FROM react_roles
            WHERE guild_id = ?
              AND mensagem_id = ?
              AND emoji = ?
            `,
            [
                guildId,
                mensagemId,
                emojiNormalizado
            ]
        );

    return resultado.affectedRows > 0;
}

// =====================================================
// 🧹 LIMPAR MENSAGEM
// =====================================================

async function limparReactRoles(
    guildId,
    mensagemId
) {
    const [resultado] =
        await mysqlPool.query(
            `
            DELETE FROM react_roles
            WHERE guild_id = ?
              AND mensagem_id = ?
            `,
            [
                guildId,
                mensagemId
            ]
        );

    return resultado.affectedRows;
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

        if (!reaction.guild) return;
        if (user.bot) return;

        const guildId =
            reaction.guild.id;

        const mensagemId =
            reaction.message.id;

        const emoji =
            normalizarEmoji(
                reaction.emoji
            );

        const [rows] =
            await mysqlPool.query(
                `
                SELECT *
                FROM react_roles
                WHERE guild_id = ?
                  AND mensagem_id = ?
                  AND emoji = ?
                LIMIT 1
                `,
                [
                    guildId,
                    mensagemId,
                    emoji
                ]
            );

        if (!rows.length) {
            return;
        }

        const config =
            rows[0];

        const guild =
            reaction.guild;

        const membro =
            await guild.members.fetch(
                user.id
            );

        const cargo =
            await guild.roles.fetch(
                config.cargo_id
            );

        if (!cargo) {
            console.error(
                `❌ Cargo ${config.cargo_id} não encontrado.`
            );
            return;
        }

        const me =
            guild.members.me;

        if (!me) {
            console.error(
                "❌ Não consegui encontrar o membro do bot."
            );
            return;
        }

        if (
            !cargo.editable
        ) {
            console.error(
                `❌ Não posso gerenciar o cargo ${cargo.name}. Verifique a hierarquia de cargos.`
            );
            return;
        }

        if (adicionar) {

            if (
                !membro.roles.cache.has(
                    cargo.id
                )
            ) {
                await membro.roles.add(
                    cargo,
                    "Reaction Role"
                );

                console.log(
                    `🎭 Cargo ${cargo.name} dado para ${user.tag}.`
                );
            }

        } else {

            if (
                membro.roles.cache.has(
                    cargo.id
                )
            ) {
                await membro.roles.remove(
                    cargo,
                    "Reaction Role"
                );

                console.log(
                    `🎭 Cargo ${cargo.name} removido de ${user.tag}.`
                );
            }
        }

    } catch (erro) {

        console.error(
            "❌ Erro ao processar Reaction Role:",
            erro
        );
    }
}

// =====================================================
// ▶️ EXECUTE
// =====================================================

async function execute(interaction) {

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

    const subcomando =
        interaction.options.getSubcommand();

    const mensagemId =
        interaction.options.getString(
            "mensagem"
        );

    // =================================================
    // 📨 CONFIGURAR
    // =================================================

    if (
        subcomando === "configurar"
    ) {

        const emoji =
            interaction.options.getString(
                "emoji"
            );

        const cargo =
            interaction.options.getRole(
                "cargo"
            );

        const titulo =
            interaction.options.getString(
                "titulo"
            );

        const descricao =
            interaction.options.getString(
                "descricao"
            );

        const corInformada =
            interaction.options.getString(
                "cor"
            );

        const cor =
            normalizarCor(
                corInformada
            );

        if (
            corInformada &&
            !cor
        ) {
            return interaction.reply({
                content:
                    "❌ Cor inválida.\n\nUse uma cor hexadecimal com 6 caracteres, por exemplo:\n`#00A8FF`\n`00A8FF`\n`#FF0000`",
                ephemeral: true
            });
        }

        const rodape =
            interaction.options.getString(
                "rodape"
            );

        const imagem =
            interaction.options.getString(
                "imagem"
            );

        const thumbnail =
            interaction.options.getString(
                "thumbnail"
            );

        const content =
            interaction.options.getString(
                "content"
            );

        // =================================================
        // 🔍 VERIFICAR MENSAGEM
        // =================================================

        let mensagem;

        try {

            mensagem =
                await interaction.channel.messages.fetch(
                    mensagemId
                );

        } catch (erro) {

            return interaction.reply({
                content:
                    "❌ Não consegui encontrar essa mensagem neste canal.",
                ephemeral: true
            });
        }

        // =================================================
        // 🔐 VERIFICAR CARGO
        // =================================================

        const botMember =
            interaction.guild.members.me;

        if (!botMember) {
            return interaction.reply({
                content:
                    "❌ Não consegui identificar o membro do bot.",
                ephemeral: true
            });
        }

        if (
            !cargo.editable
        ) {
            return interaction.reply({
                content:
                    "❌ Não consigo gerenciar esse cargo. Coloque o meu cargo acima dele na hierarquia.",
                ephemeral: true
            });
        }

        // =================================================
        // ➕ ADICIONAR REAÇÃO
        // =================================================

        try {

            await mensagem.react(
                emoji
            );

        } catch (erro) {

            console.error(
                "❌ Erro ao adicionar reação:",
                erro
            );

            return interaction.reply({
                content:
                    "❌ Não consegui adicionar esse emoji à mensagem. Verifique se o emoji é válido e se eu tenho permissão para reagir.",
                ephemeral: true
            });
        }

        // =================================================
        // 💾 SALVAR NO BANCO
        // =================================================

        try {

            await salvarReactRole({
                guildId:
                    interaction.guild.id,

                mensagemId,

                emoji,

                cargoId:
                    cargo.id,

                content,

                titulo,

                descricao,

                cor,

                rodape,

                imagem,

                thumbnail
            });

        } catch (erro) {

            console.error(
                "❌ Erro ao salvar Reaction Role:",
                erro
            );

            return interaction.reply({
                content:
                    "❌ A reação foi adicionada, mas não consegui salvar a configuração no banco de dados.",
                ephemeral: true
            });
        }

        // =================================================
        // 📝 EMBED DE VISUALIZAÇÃO
        // =================================================

        const embed =
            new EmbedBuilder();

        if (titulo) {
            embed.setTitle(
                titulo
            );
        }

        if (descricao) {
            embed.setDescription(
                descricao
            );
        }

        if (cor) {
            embed.setColor(
                cor
            );
        }

        if (rodape) {
            embed.setFooter({
                text: rodape
            });
        }

        if (imagem) {
            try {
                embed.setImage(
                    imagem
                );
            } catch {}
        }

        if (thumbnail) {
            try {
                embed.setThumbnail(
                    thumbnail
                );
            } catch {}
        }

        // =================================================
        // ✅ RESPOSTA
        // =================================================

        return interaction.reply({
            content:
                `✅ **Reaction Role configurado!**\n\n` +
                `📨 Mensagem: \`${mensagemId}\`\n` +
                `😀 Emoji: ${emoji}\n` +
                `🎭 Cargo: ${cargo}\n` +
                `📝 Título: ${titulo || "Não definido"}\n` +
                `📄 Descrição: ${descricao || "Não definida"}\n` +
                `🎨 Cor: ${cor || "Padrão"}\n` +
                `🔻 Rodapé: ${rodape || "Não definido"}\n` +
                `🖼️ Imagem: ${imagem || "Não definida"}\n` +
                `🔳 Thumbnail: ${thumbnail || "Não definida"}\n` +
                `💬 Content: ${content || "Não definido"}`,
            ephemeral: true
        });
    }

    // =================================================
    // ➕ ADICIONAR
    // =================================================

    if (
        subcomando === "adicionar"
    ) {

        const emoji =
            interaction.options.getString(
                "emoji"
            );

        const cargo =
            interaction.options.getRole(
                "cargo"
            );

        let mensagem;

        try {

            mensagem =
                await interaction.channel.messages.fetch(
                    mensagemId
                );

        } catch {

            return interaction.reply({
                content:
                    "❌ Não consegui encontrar essa mensagem neste canal.",
                ephemeral: true
            });
        }

        const botMember =
            interaction.guild.members.me;

        if (
            !botMember ||
            !cargo.editable
        ) {
            return interaction.reply({
                content:
                    "❌ Não consigo gerenciar esse cargo. Coloque o meu cargo acima dele na hierarquia.",
                ephemeral: true
            });
        }

        try {

            await mensagem.react(
                emoji
            );

        } catch {

            return interaction.reply({
                content:
                    "❌ Não consegui adicionar esse emoji à mensagem.",
                ephemeral: true
            });
        }

        try {

            await salvarReactRole({
                guildId:
                    interaction.guild.id,

                mensagemId,

                emoji,

                cargoId:
                    cargo.id,

                content: null,
                titulo: null,
                descricao: null,
                cor: null,
                rodape: null,
                imagem: null,
                thumbnail: null
            });

        } catch (erro) {

            console.error(
                "❌ Erro ao salvar Reaction Role:",
                erro
            );

            return interaction.reply({
                content:
                    "❌ Não consegui salvar essa configuração no banco de dados.",
                ephemeral: true
            });
        }

        return interaction.reply({
            content:
                `✅ Emoji ${emoji} adicionado para o cargo ${cargo}.`,
            ephemeral: true
        });
    }

    // =================================================
    // ➖ REMOVER
    // =================================================

    if (
        subcomando === "remover"
    ) {

        const emoji =
            interaction.options.getString(
                "emoji"
            );

        const removido =
            await removerReactRole(
                interaction.guild.id,
                mensagemId,
                emoji
            );

        if (!removido) {
            return interaction.reply({
                content:
                    "❌ Não encontrei essa configuração no banco de dados.",
                ephemeral: true
            });
        }

        return interaction.reply({
            content:
                `🗑️ A configuração do emoji ${emoji} foi removida.`,
            ephemeral: true
        });
    }

    // =================================================
    // 📋 STATUS
    // =================================================

    if (
        subcomando === "status"
    ) {

        const configs =
            await buscarReactRoles(
                interaction.guild.id,
                mensagemId
            );

        if (!configs.length) {
            return interaction.reply({
                content:
                    `📋 Nenhum Reaction Role configurado para a mensagem \`${mensagemId}\`.`,
                ephemeral: true
            });
        }

        let texto =
            `📋 **Reaction Roles da mensagem \`${mensagemId}\`**\n\n`;

        for (
            const config of configs
        ) {

            texto +=
                `😀 ${config.emoji} → <@&${config.cargo_id}>` +
                `${config.embed_cor ? ` • 🎨 ${config.embed_cor}` : ""}\n`;
        }

        return interaction.reply({
            content: texto,
            ephemeral: true
        });
    }

    // =================================================
    // ❌ LIMPAR
    // =================================================

    if (
        subcomando === "limpar"
    ) {

        const quantidade =
            await limparReactRoles(
                interaction.guild.id,
                mensagemId
            );

        if (!quantidade) {
            return interaction.reply({
                content:
                    "❌ Não havia configurações para remover nessa mensagem.",
                ephemeral: true
            });
        }

        return interaction.reply({
            content:
                `🗑️ Removi **${quantidade}** configuração(ões) de Reaction Role da mensagem \`${mensagemId}\`.`,
            ephemeral: true
        });
    }
}

// =====================================================
// 📦 EXPORT
// =====================================================

module.exports = {
    data,
    execute,
    handleReaction
};
