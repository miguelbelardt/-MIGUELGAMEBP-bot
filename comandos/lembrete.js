const { SlashCommandBuilder } = require("discord.js");
const economia = require("../economia.js");
const utilidade = require("../utilidade.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("lembrete")
        .setDescription("Cria lembretes: o bot te avisa depois. ⏰")
        .addSubcommand(s =>
            s.setName("criar")
                .setDescription("Cria um lembrete.")
                .addStringOption(o =>
                    o.setName("tempo")
                        .setDescription("Daqui a quanto tempo. Ex.: 10m, 2h, 1d, 1h30m.")
                        .setRequired(true)
                )
                .addStringOption(o =>
                    o.setName("texto")
                        .setDescription("Do que devo te lembrar.")
                        .setMaxLength(300)
                        .setRequired(true)
                )
        )
        .addSubcommand(s =>
            s.setName("listar").setDescription("Mostra os seus lembretes.")
        )
        .addSubcommand(s =>
            s.setName("remover")
                .setDescription("Apaga um lembrete.")
                .addIntegerOption(o =>
                    o.setName("id")
                        .setDescription("Número do lembrete (veja em /lembrete listar).")
                        .setMinValue(1)
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === "listar") {
            return economia.rodarSlash(interaction, utilidade.listarLembretes);
        }

        if (sub === "remover") {
            return economia.rodarSlash(interaction, utilidade.removerLembrete, {
                id: interaction.options.getInteger("id")
            });
        }

        return economia.rodarSlash(interaction, utilidade.criarLembrete, {
            canalId: interaction.channelId,
            tempo: interaction.options.getString("tempo"),
            texto: interaction.options.getString("texto")
        });
    },

    // 'lembrete 10m tirar o lixo | 'lembrete listar | 'lembrete remover 3
    async handlePrefix(message, args) {
        const primeiro = (args[0] || "").toLowerCase();

        if (["listar", "lista"].includes(primeiro)) {
            return economia.rodarPrefixo(message, utilidade.listarLembretes);
        }

        if (["remover", "apagar"].includes(primeiro)) {
            return economia.rodarPrefixo(message, utilidade.removerLembrete, { id: args[1] });
        }

        if (!args[0]) {
            return message.reply("⏰ Use: `'lembrete 10m tirar o lixo`, `'lembrete listar` ou `'lembrete remover 3`.");
        }

        return economia.rodarPrefixo(message, utilidade.criarLembrete, {
            canalId: message.channelId,
            tempo: args[0],
            texto: args.slice(1).join(" ")
        });
    }
};
