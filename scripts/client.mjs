import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { fileURLToPath } from 'node:url';

/** A real SDK client: the server runs as a separate Node process. */
export async function connect({ logPath, cwd, source = false, effects } = {}) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL(source ? '../src/index.ts' : '../dist/index.js', import.meta.url))],
    stderr: 'pipe',
    ...(cwd ? { cwd } : {}),
    env: {
      ...(logPath ? { AI_REACTIONS_LOG: logPath }
        : process.env.AI_REACTIONS_LOG ? { AI_REACTIONS_LOG: process.env.AI_REACTIONS_LOG } : {}),
      ...Object.fromEntries(['AI_REACTIONS_EFFECTS', 'AI_REACTIONS_SOUND', 'AI_REACTIONS_VOLUME']
        .filter((key) => process.env[key] !== undefined).map((key) => [key, process.env[key]])),
      ...(effects ? { AI_REACTIONS_EFFECTS: effects } : {}),
    },
  });
  const client = new Client({ name: 'ai-reactions-local-client', version: '1.0.0' });
  const diagnostics = [];
  const errors = [];
  transport.stderr.on('data', (chunk) => diagnostics.push(chunk.toString()));
  client.onerror = (error) => errors.push(error);
  try {
    await client.connect(transport);
    return { client, diagnostics, errors, transport };
  } catch (error) {
    await client.close();
    throw error;
  }
}
