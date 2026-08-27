const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const comandos = [];
const comandosPath = path.join(__dirname, "comandos");

const arquivosComandos = fs
    .readdirSync(comandosPath)
    .filter(arquivo => arquivo.endsWith(".js"));

for (const arquivo of arquivosComandos) {
    const caminho = path.join(comandosPath, arquivo);
    const comando = require(caminho);

    if ("data" in comando && "execute" in comando) {
        comandos.push(comando.data.toJSON());
        console.log(`📦 Preparado: ${comando.data.name}`);
    }
}

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
    try {
        console.log(`🔄 Registrando ${comandos.length} comandos...`);

        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: comandos }
        );

        console.log("✅ Comandos registrados com sucesso!");
    } catch (erro) {
        console.error("❌ Erro ao registrar comandos:", erro);
    }
})();
