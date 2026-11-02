const {
    SlashCommandBuilder,
    ChannelType,
    PermissionFlagsBits
} = require("discord.js");

const mod = require("../moderacao.js");
const contadores = require("../contadores.js");

const TIPOS = [
    { name: "Membros (sem bots)", value: "membros" },
    { name: "Bots", value: "bots" },
    { name: "Total (membros + bots)", value: "total" },
    { name: "Canais de texto", value: "texto" },
    { name: "Canais de voz", value: "voz" }
];

const TIPOS_DE_CANAL = [
    ChannelType.GuildVoice,
    ChannelType.GuildStageVoice,
    ChannelType.GuildCategory
];

// "<#123>" ou "123" -> canal do servidor (ou null)
function acharCanal(guild, token) {
    const m = /^<#(\d{15,25})>$/.exec(token || "") || /^(\d{15,25})$/.exec(token || "");

    return m ? guild.channels.cache.get(m[1]) || null : null;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("contador")
        .setDescription("Canal que mostra membros, bots ou canais do servidor. 📊")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addSubcommand(s =>
            s.setName("adicionar")
                .setDescription("Transforma um canal em contador.")
                .addChannelOption(o =>
                    o.setName("canal")
                        .setDescription("Canal de voz (ou categoria) que vai mostrar o número.")
                        .addChannelTypes(...TIPOS_DE_CANAL)
                        .setRequired(true)
                )
                .addStringOption(o =>
                    o.setName("tipo")
                        .setDescription("O que contar.")
                        .setRequired(true)
                        .addChoices(...TIPOS)
                )
                .addStringOption(o =>
                    o.setName("texto")
                        .setDescription("Texto do começo. Ex.: 👤 Membros:  (o número entra depois)")
                        .setMaxLength(80)
                        .setRequired(true)
                )
        )
        .addSubcommand(s =>
            s.setName("remover")
                .setDescription("Para de atualizar um contador.")
                .addChannelOption(o =>
                    o.setName("canal")
                        .setDescription("Canal do contador.")
                        .addChannelTypes(...TIPOS_DE_CANAL)
                        .setRequired(true)
                )
        )
        .addSubcommand(s =>
            s.setName("listar").setDescription("Mostra os contadores do servidor.")
        )
        .addSubcommand(s =>
            s.setName("atualizar").setDescription("Atualiza os números agora.")
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === "listar") {
            return mod.rodarSlash(interaction, contadores.listar);
        }

        if (sub === "atualizar") {
            return mod.rodarSlash(interaction, contadores.atualizarAgora);
        }

        const canal = interaction.options.getChannel("canal");

        if (sub === "remover") {
            return mod.rodarSlash(interaction, contadores.remover, { canal });
        }

        return mod.rodarSlash(interaction, contadores.adicionar, {
            canal,
            tipo: interaction.options.getString("tipo"),
            texto: interaction.options.getString("texto")
        });
    },

    // 'contador adicionar #canal membros 👤 Membros:
    // 'contador remover #canal | 'contador listar | 'contador atualizar
    async handlePrefix(message, args) {
        if (!message.guild) return;

        const sub = (args[0] || "").toLowerCase();

        if (["listar", "lista"].includes(sub)) {
            return mod.rodarPrefixo(message, contadores.listar);
        }

        if (sub === "atualizar") {
            return mod.rodarPrefixo(message, contadores.atualizarAgora);
        }

        if (["remover", "tirar"].includes(sub)) {
            return mod.rodarPrefixo(message, contadores.remover, {
                canal: acharCanal(message.guild, args[1])
            });
        }

        if (["adicionar", "add", "criar"].includes(sub)) {
            return mod.rodarPrefixo(message, contadores.adicionar, {
                canal: acharCanal(message.guild, args[1]),
                tipo: (args[2] || "").toLowerCase(),
                texto: args.slice(3).join(" ")
            });
        }

        return message.reply(
            "📊 Use: `'contador adicionar #canal membros 👤 Membros:`\n" +
            "Tipos: `membros`, `bots`, `total`, `texto`, `voz`.\n" +
            "Também: `'contador remover #canal`, `'contador listar`, `'contador atualizar`."
        );
    }
};
