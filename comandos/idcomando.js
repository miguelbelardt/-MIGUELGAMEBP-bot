const {
    SlashCommandBuilder
} = require("discord.js");

const DONO_ID = "1124140396516225044";

module.exports = {
    data:
        new SlashCommandBuilder()
            .setName("idcomando")
            .setDescription(
                "Mostra o ID de um Slash Command."
            )
            .addStringOption(option =>
                option
                    .setName("comando")
                    .setDescription(
                        "Escolha o comando."
                    )
                    .setRequired(true)
                    .setAutocomplete(true)
            ),

    async autocomplete(interaction) {
        if (
            interaction.user.id !==
            DONO_ID
        ) {
            return interaction.respond([]);
        }

        const digitado =
            interaction.options
                .getString("comando")
                ?.toLowerCase()
                .replace(/^\/+/, "") || "";

        // Pega somente os comandos carregados atualmente pelo bot
        const comandosCarregados =
            [...interaction.client.commands.values()]
                .filter(comando =>
                    comando.data?.name
                );

        const resultados =
            comandosCarregados
                .filter(comando =>
                    comando.data.name
                        .toLowerCase()
                        .includes(digitado)
                )
                .slice(0, 25);

        await interaction.respond(
            resultados.map(comando => ({
                name: `/${comando.data.name}`,
                value: comando.data.name
            }))
        );
    },

    async execute(interaction) {
        if (
            interaction.user.id !==
            DONO_ID
        ) {
            return interaction.reply({
                content:
                    "❌ Você não tem permissão para usar este comando.",
                ephemeral: true
            });
        }

        const nome =
            interaction.options
                .getString("comando")
                ?.toLowerCase()
                .replace(/^\/+/, "");

        // Confere se o comando existe nos arquivos carregados pelo bot
        const comandoCarregado =
            interaction.client.commands.get(nome);

        if (!comandoCarregado) {
            return interaction.reply({
                content:
                    `❌ O comando \`/${nome}\` não está carregado pelo bot.`,
                ephemeral: true
            });
        }

        // Busca os comandos registrados no Discord
        const comandosRegistrados =
            await interaction.client.application.commands.fetch();

        const comandoRegistrado =
            comandosRegistrados.find(
                comando =>
                    comando.name === nome
            );

        if (!comandoRegistrado) {
            return interaction.reply({
                content:
                    `❌ O comando \`/${nome}\` está carregado no bot, mas ainda não está registrado no Discord.`,
                ephemeral: true
            });
        }

        await interaction.reply({
            content:
                `🆔 **ID do comando \`/${comandoRegistrado.name}\`:**\n` +
                `\`${comandoRegistrado.id}\`\n\n` +
                `📋 **Atalho:**\n` +
                `\`</${comandoRegistrado.name}:${comandoRegistrado.id}>\``,
            ephemeral: true
        });
    }
};
