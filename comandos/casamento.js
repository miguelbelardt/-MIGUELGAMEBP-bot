const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const economia = require("../economia.js");
const casamento = require("../casamento.js");

async function acao({ usuario, alvo }) {
    const dono = alvo || usuario;
    const e = await casamento.estado(dono.id);

    if (!e) {
        return {
            resposta: {
                content: dono.id === usuario.id
                    ? "💍 Você não está casado(a). Compre um anel na `/loja` e use `/casar`!"
                    : `💍 **${dono.username}** não está casado(a).`,
                allowedMentions: { parse: [] }
            }
        };
    }

    const dias = Math.max(0, Math.floor((Date.now() - e.desde) / 86400000));

    return {
        resposta: {
            embeds: [
                new EmbedBuilder()
                    .setColor(0xFF69B4)
                    .setTitle("💞 Casamento")
                    .setDescription(
                        `**${dono.username}** é casado(a) com <@${e.parceiroId}>\n` +
                        `Desde <t:${Math.floor(e.desde / 1000)}:D> (${dias} dia${dias === 1 ? "" : "s"})`
                    )
            ],
            allowedMentions: { parse: [] }
        }
    };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("casamento")
        .setDescription("Veja com quem alguém está casado. 💞")
        .addUserOption(o =>
            o.setName("usuario").setDescription("Usuário (padrão: você).").setRequired(false)
        ),

    async execute(interaction) {
        return economia.rodarSlash(interaction, acao, {
            alvo: interaction.options.getUser("usuario")
        });
    },

    async handlePrefix(message) {
        return economia.rodarPrefixo(message, acao, {
            alvo: message.mentions.users.first() || null
        });
    }
};
