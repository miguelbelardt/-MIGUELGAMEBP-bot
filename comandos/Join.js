const {
    EmbedBuilder
} = require("discord.js");

// =====================================================
// ⚙️ CONFIGURAÇÃO DO SISTEMA DE BOAS-VINDAS
// =====================================================

const CONFIG = {

    // =================================================
    // 📢 MENSAGEM NORMAL
    // =================================================

    content:
        "👋 Seja muito bem-vindo(a), {user}! Aproveite o servidor! 🎉",

    // =================================================
    // 🎨 EMBED
    // =================================================

    embed: {

        habilitado: true,

        titulo:
            "🎉 Bem-vindo ao {server}!",

        descricao:
            "Olá, {user}!\n\n" +
            "Esperamos que você se divirta por aqui! 💙\n\n" +
            "👤 Você é o membro **#{members}** do servidor.",

        cor:
            0x5865F2,

        // =================================================
        // 👤 AUTOR
        // =================================================

        autor: {
            habilitado: true,

            nome:
                "{username}",

            icone:
                "{avatar}"
        },

        // =================================================
        // 🖼️ THUMBNAIL
        // =================================================

        thumbnail:
            "{avatar}",

        // =================================================
        // 🖼️ IMAGEM / BANNER
        // =================================================

        imagem:
            "{banner}",

        // =================================================
        // 📌 RODAPÉ
        // =================================================

        footer: {
            habilitado: true,

            texto:
                "Massa Com Chika • Bem-vindo!",

            icone:
                "{avatar}"
        },

        // =================================================
        // ⏰ DATA
        // =================================================

        timestamp: true
    }
};

// =====================================================
// 🔄 SUBSTITUIR VARIÁVEIS
// =====================================================

function substituirVariaveis(
    texto,
    dados
) {

    if (
        texto === null ||
        texto === undefined
    ) {
        return "";
    }

    return String(texto)
        .replace(
            /\{user\}/gi,
            dados.user
        )
        .replace(
            /\{username\}/gi,
            dados.username
        )
        .replace(
            /\{userid\}/gi,
            dados.userid
        )
        .replace(
            /\{avatar\}/gi,
            dados.avatar
        )
        .replace(
            /\{banner\}/gi,
            dados.banner || ""
        )
        .replace(
            /\{members\}/gi,
            String(dados.members)
        )
        .replace(
            /\{server\}/gi,
            dados.server
        );
}

// =====================================================
// 🧹 LIMPAR URL VAZIA
// =====================================================

function urlValida(url) {

    if (
        !url ||
        typeof url !== "string"
    ) {
        return false;
    }

    return (
        url.startsWith("http://") ||
        url.startsWith("https://")
    );
}

// =====================================================
// 👋 ENVIAR BOAS-VINDAS
// =====================================================

async function enviarBoasVindas(
    membro
) {

    try {

        if (
            !membro ||
            !membro.guild
        ) {
            return;
        }

        // =================================================
        // 👤 BUSCAR DADOS ATUALIZADOS DO USUÁRIO
        // =================================================

        let usuario =
            membro.user;

        try {

            usuario =
                await usuario.fetch();

        } catch (erro) {

            console.warn(
                "⚠️ Não foi possível buscar o banner atualizado do membro:",
                erro
            );
        }

        // =================================================
        // 🖼️ AVATAR
        // =================================================

        const avatar =
            usuario.displayAvatarURL({
                extension: "png",
                size: 1024
            });

        // =================================================
        // 🖼️ BANNER
        // =================================================

        let banner =
            null;

        if (
            usuario.banner
        ) {

            banner =
                usuario.bannerURL({
                    extension: "png",
                    size: 2048
                });
        }

        // =================================================
        // 👥 MEMBROS
        // =================================================

        const membros =
            membro.guild.memberCount;

        // =================================================
        // 📦 DADOS DAS VARIÁVEIS
        // =================================================

        const dados = {

            user:
                `<@${membro.id}>`,

            username:
                membro.user.username,

            userid:
                membro.id,

            avatar:
                avatar,

            banner:
                banner || "",

            members:
                membros,

            server:
                membro.guild.name
        };

        // =================================================
        // 🔎 PROCURAR CANAL
        // =================================================

        /*
         * COLOQUE AQUI O ID DO CANAL DE BOAS-VINDAS.
         *
         * Exemplo:
         *
         * canalId: "123456789012345678"
         */

        const canalId =
            "COLOQUE_O_ID_DO_CANAL_AQUI";

        if (
            canalId ===
            "COLOQUE_O_ID_DO_CANAL_AQUI"
        ) {

            console.log(
                "⚠️ Sistema de boas-vindas: coloque o ID do canal no Join.js."
            );

            return;
        }

        const canal =
            membro.guild.channels.cache.get(
                canalId
            );

        if (
            !canal
        ) {

            console.error(
                `❌ Canal de boas-vindas não encontrado: ${canalId}`
            );

            return;
        }

        if (
            !canal.isTextBased()
        ) {

            console.error(
                "❌ O canal configurado para boas-vindas não é um canal de texto."
            );

            return;
        }

        // =================================================
        // 🎨 CRIAR EMBED
        // =================================================

        let embed = null;

        if (
            CONFIG.embed.habilitado
        ) {

            embed =
                new EmbedBuilder();

            // =================================================
            // 📝 TÍTULO
            // =================================================

            if (
                CONFIG.embed.titulo
            ) {

                embed.setTitle(
                    substituirVariaveis(
                        CONFIG.embed.titulo,
                        dados
                    )
                );
            }

            // =================================================
            // 📄 DESCRIÇÃO
            // =================================================

            if (
                CONFIG.embed.descricao
            ) {

                embed.setDescription(
                    substituirVariaveis(
                        CONFIG.embed.descricao,
                        dados
                    )
                );
            }

            // =================================================
            // 🎨 COR
            // =================================================

            if (
                CONFIG.embed.cor !==
                undefined &&
                CONFIG.embed.cor !==
                null
            ) {

                embed.setColor(
                    CONFIG.embed.cor
                );
            }

            // =================================================
            // 👤 AUTOR
            // =================================================

            if (
                CONFIG.embed.autor?.habilitado
            ) {

                const nomeAutor =
                    substituirVariaveis(
                        CONFIG.embed.autor.nome,
                        dados
                    );

                const iconeAutor =
                    substituirVariaveis(
                        CONFIG.embed.autor.icone,
                        dados
                    );

                if (
                    nomeAutor
                ) {

                    const autor = {
                        name:
                            nomeAutor
                    };

                    if (
                        urlValida(
                            iconeAutor
                        )
                    ) {

                        autor.iconURL =
                            iconeAutor;
                    }

                    embed.setAuthor(
                        autor
                    );
                }
            }

            // =================================================
            // 🖼️ THUMBNAIL
            // =================================================

            if (
                CONFIG.embed.thumbnail
            ) {

                const thumbnail =
                    substituirVariaveis(
                        CONFIG.embed.thumbnail,
                        dados
                    );

                if (
                    urlValida(
                        thumbnail
                    )
                ) {

                    embed.setThumbnail(
                        thumbnail
                    );
                }
            }

            // =================================================
            // 🖼️ IMAGEM / BANNER
            // =================================================

            if (
                CONFIG.embed.imagem
            ) {

                const imagem =
                    substituirVariaveis(
                        CONFIG.embed.imagem,
                        dados
                    );

                if (
                    urlValida(
                        imagem
                    )
                ) {

                    embed.setImage(
                        imagem
                    );
                }
            }

            // =================================================
            // 📌 RODAPÉ
            // =================================================

            if (
                CONFIG.embed.footer?.habilitado
            ) {

                const textoFooter =
                    substituirVariaveis(
                        CONFIG.embed.footer.texto,
                        dados
                    );

                const iconeFooter =
                    substituirVariaveis(
                        CONFIG.embed.footer.icone,
                        dados
                    );

                const footer = {
                    text:
                        textoFooter ||
                        "Massa Com Chika"
                };

                if (
                    urlValida(
                        iconeFooter
                    )
                ) {

                    footer.iconURL =
                        iconeFooter;
                }

                embed.setFooter(
                    footer
                );
            }

            // =================================================
            // ⏰ TIMESTAMP
            // =================================================

            if (
                CONFIG.embed.timestamp
            ) {

                embed.setTimestamp();
            }
        }

        // =================================================
        // 📤 MONTAR MENSAGEM
        // =================================================

        const mensagem = {};

        if (
            CONFIG.content
        ) {

            mensagem.content =
                substituirVariaveis(
                    CONFIG.content,
                    dados
                );
        }

        if (
            embed
        ) {

            mensagem.embeds = [
                embed
            ];
        }

        // =================================================
        // 📩 ENVIAR
        // =================================================

        await canal.send(
            mensagem
        );

        console.log(
            `👋 Boas-vindas enviadas para ${membro.user.tag} em ${membro.guild.name}`
        );

    } catch (erro) {

        console.error(
            "❌ Erro ao enviar mensagem de boas-vindas:",
            erro
        );
    }
}

// =====================================================
// 📤 EXPORTAR
// =====================================================

module.exports = {
    enviarBoasVindas
};
