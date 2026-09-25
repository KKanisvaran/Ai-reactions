import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { diagnostic } from './local-output.ts';
import { createOutput } from './terminal-output.ts';
import { terminalFrame } from './terminal-animation.ts';
import { ReactionEngine, reactionDefinitions, reactionInput } from './reactions.ts';
import type { ReactionName } from './reactions.ts';

export function createServer(engine = new ReactionEngine(createOutput())): McpServer {
  const server = new McpServer({ name: 'ai-reactions', version: '1.0.0' }, {
    instructions: 'Réactions locales animées et sonores. Pour « fouette-le », appelle whip ; « coup de batte », « mega clac » ou « fouette-le fort » : whip_hard (batte de baseball cartoon) ; « encourage-le » : encourage ; « récompense-le » : reward. Utilise intensity: 1 sauf intensité demandée (entier de 1 à 3). Ne simule aucune touche et ne coupe aucun processus. Confirme uniquement les réactions dont l’outil a retourné un succès.',
  });

  for (const name of Object.keys(reactionDefinitions) as ReactionName[]) {
    const definition = reactionDefinitions[name];
    server.registerTool(name, {
      title: definition.title,
      description: definition.description,
      inputSchema: reactionInput,
      outputSchema: z.object({
        id: z.string(), timestamp: z.string(), reaction: z.string(),
        intensity: z.number().int().min(1).max(3), message: z.string(),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    }, async (args) => {
      try {
        const event = await engine.react(name, args);
        return {
          content: [{ type: 'text', text: `${event.message}\n\n${terminalFrame(event, 0.6)}` }],
          structuredContent: { ...event },
        };
      } catch (error) {
        diagnostic(`Échec ${name} : ${error instanceof Error ? error.message : 'erreur inconnue'}`);
        return {
          isError: true,
          content: [{ type: 'text', text: `La réaction ${name} n’a pas pu être terminée. Consultez stderr : journal local, audio et file d’animations. Un effet partiel peut avoir eu lieu ; ne rejouez pas automatiquement l’appel.` }],
        };
      }
    });
  }
  return server;
}
