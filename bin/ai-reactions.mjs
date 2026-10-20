#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { introKeywords, playIntro } from '../dist/intro.js';

const [command, ...rest] = process.argv.slice(2);
const server = fileURLToPath(new URL('../dist/index.js', import.meta.url));
const run = (script, args) => {
  // The scripts read their own arguments from process.argv.
  process.argv = [process.argv[0], script, ...args];
  return import(new URL(`../scripts/${script}`, import.meta.url));
};

const help = `ai-reactions : réactions animées et sonores pour les IA en terminal.

Usage :
  ai-reactions setup [codex|claude|gemini]   Enregistre le serveur MCP (tous par défaut)
  ai-reactions codex [arguments]             Lance Codex avec les animations
  ai-reactions claude [arguments]            Lance Claude Code avec les animations
  ai-reactions gemini [arguments]            Lance Gemini CLI avec les animations
  ai-reactions intro                         Présentation KK LAB et mots-clés
  ai-reactions demo [réactions...]           Joue les animations sans IA
  ai-reactions watch                         Visualiseur séparé
  ai-reactions serve                         Serveur MCP sur stdio (pour les clients)
  ai-reactions --version

Mots-clés à taper dans le chat de l'IA :
${introKeywords.map(({ keyword, summary }) => `  ${keyword.padEnd(11)}${summary}`).join('\n')}`;

// Each client registers the same stdio server, globally for the user.
const registrations = {
  codex: ['mcp', 'add', 'ai-reactions', '--', process.execPath, server],
  claude: ['mcp', 'add', '--transport', 'stdio', '--scope', 'user', 'ai-reactions', '--', process.execPath, server],
  gemini: ['mcp', 'add', '--transport', 'stdio', '--scope', 'user', 'ai-reactions', process.execPath, server],
};

async function setup(clients) {
  const unknown = clients.filter((client) => !Object.hasOwn(registrations, client));
  if (unknown.length) throw new Error(`Client inconnu : ${unknown.join(', ')}. Choix : codex, claude, gemini.`);
  const windows = process.platform === 'win32';
  let configured = 0;
  for (const client of clients.length ? clients : Object.keys(registrations)) {
    if (spawnSync(windows ? 'where' : 'which', [client], { stdio: 'ignore' }).status !== 0) {
      console.log(`- ${client} : non installé, ignoré.`);
      continue;
    }
    // npm shims are .cmd files on Windows and need a shell; quote paths with spaces.
    const args = windows ? registrations[client].map((arg) => `"${arg}"`) : registrations[client];
    const result = spawnSync(client, args, { stdio: 'inherit', shell: windows });
    if (result.status === 0) {
      console.log(`- ${client} : serveur ai-reactions enregistré.`);
      configured++;
    } else {
      console.log(`- ${client} : échec (code ${result.status}). Il est peut-être déjà enregistré : ${client} mcp remove ai-reactions, puis relancer.`);
    }
  }
  if (!configured) process.exitCode = 1;
  else {
    await playIntro();
    console.log('Prêt. Lance par exemple : ai-reactions codex');
  }
}

try {
  if (!command || command === '--help' || command === '-h' || command === 'help') console.log(help);
  else if (command === '--version' || command === '-v') {
    console.log(JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version);
  } else if (command === 'setup') await setup(rest);
  else if (command === 'intro') await playIntro();
  else if (command === 'serve') await import(new URL('../dist/index.js', import.meta.url));
  else if (command === 'demo') await run('demo.mjs', ['--terminal', ...rest]);
  else if (command === 'watch') await run('watch.mjs', rest);
  else await run('session.mjs', [command, ...rest]);
} catch (error) {
  console.error(`ai-reactions : ${error.message}`);
  process.exitCode = 1;
}
