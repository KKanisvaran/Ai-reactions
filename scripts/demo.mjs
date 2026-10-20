import { connect } from './client.mjs';
import { effectOptions, playTerminalEffect } from '../dist/terminal-output.js';
import { reactionDefinitions } from '../dist/reactions.js';

let session;
try {
  const args = process.argv.slice(2);
  const available = Object.keys(reactionDefinitions);
  // Accept the chat keyword (gg, trop long…) as well as the MCP tool name.
  const byKeyword = Object.fromEntries(available.map((name) => [reactionDefinitions[name].keyword, name]));
  const names = args.filter((arg) => arg !== '--terminal').map((arg) => byKeyword[arg] ?? arg);
  if (names.some((name) => !available.includes(name)))
    throw new Error(`Réaction inconnue. Mots-clés : ${Object.keys(byKeyword).join(', ')}`);
  const options = effectOptions();
  session = await connect({ effects: 'text' });
  const { tools } = await session.client.listTools();
  console.log(`Outils MCP disponibles : ${tools.map((tool) => tool.name).join(', ')}`);
  console.log('Animations dans ce terminal, sans fenêtre. Image fixe si la sortie est capturée.');
  for (const name of names.length ? names : available) {
    console.log(`Animation : ${name}...`);
    const result = await session.client.callTool({ name, arguments: { intensity: 2 } });
    if (result.isError) throw new Error(JSON.stringify(result.content));
    await playTerminalEffect(result.structuredContent, options);
    console.log(result.structuredContent.message);
  }
  if (session.errors.length) throw session.errors[0];
  console.log('Chaîne MCP validée. Fermeture de la connexion stdio.');
} catch (error) {
  console.error(`Démo impossible : ${error.message}. Lancez npm run build si nécessaire.`);
  process.exitCode = 1;
} finally {
  await session?.client.close();
}
