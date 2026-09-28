const {
    EmbedBuilder
} = require("discord.js");

const {
    getJoinConfig
} = require("../database/database");

// =====================================================
// ⚙️ CONFIGURAÇÃO PADRÃO DO SISTEMA DE BOAS-VINDAS
// =====================================================

const CONFIG_PADRAO = {

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
        // ⏰ DATA E HORA DA ENTRADA
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
// 🧹 VERIFICAR URL
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
// 🔢 CONVERTER COR
// =====================================================

function converterCor(cor) {

    if (
        typeof cor === "number"
    ) {
        return cor;
    }

    if (
        typeof cor === "string"
    ) {

        const valor =
            cor.trim();

        if (
            valor.startsWith("0x")
        ) {

            const numero =
                Number.parseInt(
                    valor,
                    16
                );

            if (
                !Number.isNaN(numero)
            ) {
                return numero;
            }
        }

        if (
            valor.startsWith("#")
        ) {

            const numero =
                Number.parseInt(
                    valor.slice(1),
                    16
                );

            if (
                !Number.isNaN(numero)
            ) {
                return numero;
            }
        }

        const numero =
            Number(valor);

        if (
            !Number.isNaN(numero)
        ) {
            return numero;
        }
    }

    return 0x5865F2;
}

// =====================================================
// 👋 ENVIAR BOAS-VINDAS
// =====================================================

async function enviarBoasVindas(
    membro
) {

    try {

        // =================================================
        // 🛡️ VERIFICAÇÕES
        // =================================================

        if (
            !membro ||
            !membro.guild
        ) {
            return;
        }

        // =================================================
        // 🗄️ BUSCAR CONFIGURAÇÃO DO BANCO
        // =================================================

        let configBanco = null;

        try {

            configBanco =
                await getJoinConfig(
                    membro.guild.id
                );

        } catch (erro) {

            console.error(
                "❌ Erro ao buscar configuração de boas-vindas no banco:",
                erro
            );

            return;
        }

        // =================================================
        // ⚙️ CONFIGURAÇÃO FINAL
        // =================================================

        if (
            !configBanco
        ) {

            console.log(
                `⚠️ Sistema de boas-vindas não configurado para ${membro.guild.name}.`
            );

            return;
        }

        // =================================================
        // 🔴 SISTEMA DESATIVADO
        // =================================================

        if (
            configBanco.habilitado === false ||
            configBanco.habilitado === 0 ||
            configBanco.habilitado === "0"
        ) {

            return;
        }

        // =================================================
        // 📢 CANAL
        // =================================================

        const canalId =
            configBanco.canal_id;

        if (
            !canalId
        ) {

            console.log(
                `⚠️ Canal de boas-vindas não configurado em ${membro.guild.name}.`
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
        // 👥 QUANTIDADE DE MEMBROS
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
        // 🎨 CONFIGURAÇÃO DO EMBED
        // =================================================

        let embed = null;

        if (
            configBanco.embed_habilitado === true ||
            configBanco.embed_habilitado === 1 ||
            configBanco.embed_habilitado === "1"
        ) {

            embed =
                new EmbedBuilder();

            // =================================================
            // 📝 TÍTULO
            // =================================================

            if (
                configBanco.embed_titulo
            ) {

                embed.setTitle(
                    substituirVariaveis(
                        configBanco.embed_titulo,
                        dados
                    )
                );
            }

            // =================================================
            // 📄 DESCRIÇÃO
            // =================================================

            if (
                configBanco.embed_descricao
            ) {

                embed.setDescription(
                    substituirVariaveis(
                        configBanco.embed_descricao,
                        dados
                    )
                );
            }

            // =================================================
            // 🎨 COR
            // =================================================

            if (
                configBanco.embed_cor !==
                null &&
                configBanco.embed_cor !==
                undefined
            ) {

                embed.setColor(
                    converterCor(
                        configBanco.embed_cor
                    )
                );
            }

            // =================================================
            // 👤 AUTOR
            // =================================================

            if (
                configBanco.autor_habilitado === true ||
                configBanco.autor_habilitado === 1 ||
                configBanco.autor_habilitado === "1"
            ) {

                const nomeAutor =
                    substituirVariaveis(
                        configBanco.autor_nome,
                        dados
                    );

                const iconeAutor =
                    substituirVariaveis(
                        configBanco.autor_icone,
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
                configBanco.thumbnail
            ) {

                const thumbnail =
                    substituirVariaveis(
                        configBanco.thumbnail,
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
                configBanco.imagem
            ) {

                const imagem =
                    substituirVariaveis(
                        configBanco.imagem,
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
                configBanco.footer_habilitado === true ||
                configBanco.footer_habilitado === 1 ||
                configBanco.footer_habilitado === "1"
            ) {

                const textoFooter =
                    substituirVariaveis(
                        configBanco.footer_texto,
                        dados
                    );

                const iconeFooter =
                    substituirVariaveis(
                        configBanco.footer_icone,
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
                configBanco.timestamp === true ||
                configBanco.timestamp === 1 ||
                configBanco.timestamp === "1"
            ) {

                // Mostra a data/hora em que esta
                // mensagem de boas-vindas foi criada.
                embed.setTimestamp();
            }
        }

        // =================================================
        // 📤 MONTAR MENSAGEM
        // =================================================

        const mensagem = {};

        if (
            configBanco.content
        ) {

            mensagem.content =
                substituirVariaveis(
                    configBanco.content,
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

        if (
            !mensagem.content &&
            !mensagem.embeds
        ) {

            console.warn(
                `⚠️ A configuração de boas-vindas de ${membro.guild.name} não possui conteúdo para enviar.`
            );

            return;
        }

        await canal.send(
            mensagem
        );

        // =================================================
        // 📋 LOG
        // =================================================

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
