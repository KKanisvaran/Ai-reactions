import { connect } from './client.mjs';
import { effectOptions, playTerminalEffect } from '../dist/terminal-output.js';

let session;
try {
  const args = process.argv.slice(2);
  const names = args.filter((arg) => arg !== '--terminal');
  const available = ['whip', 'encourage', 'whip_hard', 'reward', 'too_slow', 'chill', 'confused', 'facepalm', 'hype', 'rip', 'sus', 'ez'];
  if (names.some((name) => !available.includes(name))) throw new Error('Réaction inconnue. Utilisez ' + available.join(', ') + '.');
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
