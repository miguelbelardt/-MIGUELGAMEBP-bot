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
                ?.toLowerCase() || "";

        const comandos =
            await interaction.client.application.commands.fetch();

        const resultados =
            comandos
                .filter(comando =>
                    comando.name
                        .toLowerCase()
                        .includes(digitado)
                )
                .first(25);

        await interaction.respond(
            resultados.map(comando => ({
                name: `/${comando.name}`,
                value: comando.name
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
            interaction.options.getString(
                "comando"
            );

        const comandos =
            await interaction.client.application.commands.fetch();

        const comando =
            comandos.find(
                comando =>
                    comando.name === nome
            );

        if (!comando) {
            return interaction.reply({
                content:
                    `❌ Não encontrei o comando \`/${nome}\`.`,
                ephemeral: true
            });
        }

        await interaction.reply({
            content:
                `🆔 **ID do comando \`/${comando.name}\`:**\n` +
                `\`${comando.id}\`\n\n` +
                `📋 **Atalho:**\n` +
                `\`</${comando.name}:${comando.id}>\``,
            ephemeral: true
        });
    }
};
