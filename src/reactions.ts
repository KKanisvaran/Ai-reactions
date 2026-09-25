import { randomUUID } from 'node:crypto';
import { z } from 'zod';

export const reactionInput = z.strictObject({
  intensity: z.number().int().min(1).max(3).default(1)
    .describe('Intensité entière : 1 = légère, 2 = moyenne, 3 = forte. Défaut : 1.'),
});

export const reactionDefinitions = {
  whip: {
    title: 'Fouet',
    description: 'Déclenche un effet local de fouet symbolique. À appeler pour « fouette-le », « coup de fouet » ou « whip ». Ne touche jamais au clavier ni au processus de l’IA.',
    messages: ['CLAC !', 'CLAC ! CLAC !', 'CLAC ! CLAC ! CLAC !'],
  },
  encourage: {
    title: 'Encouragement',
    description: 'Déclenche une réaction locale positive. À appeler pour « encourage-le », « bravo » ou « encourage ». Ne touche jamais au clavier ni au processus de l’IA.',
    messages: ['Bravo, continue !', 'Super travail, garde le cap !', 'Excellent travail ! Tu peux être fier de toi !'],
  },
  whip_hard: {
    title: 'Coup de batte de baseball',
    description: 'Coup de batte de baseball cartoon, avec élan, étoiles et impact sonore en bois. À appeler pour « coup de batte », « mega clac », « fouette-le fort » ou « whip hard ». Le nom whip_hard est conservé pour compatibilité. Aucune interruption de l’IA.',
    messages: ['BONK ! Coup de batte !', 'MEGA BONK ! Coup de batte !', 'HOME RUN ! Triple coup de batte !'],
  },
  reward: {
    title: 'Récompense',
    description: 'Déclenche une récompense animée avec trophée, pièces et son de victoire. À appeler pour « récompense-le », « donne-lui une récompense » ou « reward ».',
    messages: ['Bien mérité ! +10 XP', 'Mission accomplie ! +50 XP', 'Légendaire ! +100 XP'],
  },
} as const;

export type ReactionName = keyof typeof reactionDefinitions;

export interface ReactionEvent {
  id: string;
  timestamp: string;
  reaction: ReactionName;
  intensity: number;
  message: string;
}

/** Implement this interface to replace the local text output with sound or an overlay. */
export interface ReactionOutput {
  emit(event: ReactionEvent): Promise<void>;
}

export class ReactionEngine {
  private readonly output: ReactionOutput;

  constructor(output: ReactionOutput) {
    this.output = output;
  }

  async react(name: ReactionName, input: unknown): Promise<ReactionEvent> {
    const { intensity } = reactionInput.parse(input);
    if (!Object.hasOwn(reactionDefinitions, name)) {
      throw new Error('Réaction inconnue.');
    }
    const definition = reactionDefinitions[name];
    const message = definition.messages[intensity - 1]!;
    const event: ReactionEvent = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      reaction: name,
      intensity,
      message: `[${name.toUpperCase()} ${intensity}/3] ${message}`,
    };
    await this.output.emit(event);
    return event;
  }
}
