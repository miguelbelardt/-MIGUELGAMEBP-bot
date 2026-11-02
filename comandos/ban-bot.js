const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const economia = require("../economia.js");
const banbot = require("../banbot.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setName("ban-bot")
        .setDescription("Proíbe alguém de usar o bot (só dono e ADMs do bot). 🚫")
        .addSubcommand(s =>
            s.setName("adicionar")
                .setDescription("Bane alguém de usar o bot.")
                .addUserOption(o =>
                    o.setName("usuario").setDescription("Quem será banido.").setRequired(true)
                )
                .addStringOption(o =>
                    o.setName("motivo").setDescription("Motivo (opcional).").setMaxLength(200).setRequired(false)
                )
        )
        .addSubcommand(s =>
            s.setName("remover")
                .setDescription("Libera alguém para usar o bot de novo.")
                .addUserOption(o =>
                    o.setName("usuario").setDescription("Quem será liberado.").setRequired(true)
                )
        )
        .addSubcommand(s =>
            s.setName("listar").setDescription("Mostra quem está banido do bot.")
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === "listar") {
            return economia.rodarSlash(interaction, banbot.listar);
        }

        const alvo = interaction.options.getUser("usuario");

        if (sub === "remover") {
            return economia.rodarSlash(interaction, banbot.desbanir, { alvoId: alvo.id });
        }

        return economia.rodarSlash(interaction, banbot.banir, {
            alvo,
            motivo: interaction.options.getString("motivo")
        });
    },

    // 'ban-bot adicionar @fulano motivo | 'ban-bot remover @fulano | 'ban-bot listar
    async handlePrefix(message, args) {
        const sub = (args[0] || "").toLowerCase();
        const alvo = message.mentions.users.first() || null;
        const idTexto = (args[1] || "").replace(/[<@!>]/g, "");

        if (["listar", "lista"].includes(sub)) {
            return economia.rodarPrefixo(message, banbot.listar);
        }

        if (["remover", "tirar", "liberar"].includes(sub)) {
            return economia.rodarPrefixo(message, banbot.desbanir, {
                alvoId: alvo ? alvo.id : (/^\d{15,25}$/.test(idTexto) ? idTexto : null)
            });
        }

        if (["adicionar", "add", "banir"].includes(sub)) {
            return economia.rodarPrefixo(message, banbot.banir, {
                alvo,
                motivo: args.slice(2).join(" ")
            });
        }

        return message.reply("🚫 Use: `'ban-bot adicionar @fulano motivo`, `'ban-bot remover @fulano` ou `'ban-bot listar`.");
    }
};
