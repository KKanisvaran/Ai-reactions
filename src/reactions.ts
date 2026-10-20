import { randomUUID } from 'node:crypto';
import { z } from 'zod';

export const reactionInput = z.strictObject({
  intensity: z.number().int().min(1).max(3).default(1)
    .describe('Intensité entière : 1 = légère, 2 = moyenne, 3 = forte. Défaut : 1.'),
});

export const reactionDefinitions = {
  whip: {
    title: 'Fouet',
    description: 'Mot-clé exact « ko1 » : fouet. Déclenche un effet local de fouet symbolique. À appeler aussi pour « fouette-le », « coup de fouet » ou « whip ». Ne touche jamais au clavier ni au processus de l’IA.',
    messages: ['CLAC !', 'CLAC ! CLAC !', 'CLAC ! CLAC ! CLAC !'],
  },
  encourage: {
    title: 'Encouragement',
    description: 'Mot-clé exact « gret job » : encouragement. Ne pas confondre avec « great job dude », qui appelle reward. Déclenche une réaction locale positive. À appeler aussi pour « encourage-le », « bravo » ou « encourage ». Ne touche jamais au clavier ni au processus de l’IA.',
    messages: ['Bravo, continue !', 'Super travail, garde le cap !', 'Excellent travail ! Tu peux être fier de toi !'],
  },
  whip_hard: {
    title: 'Coup de batte de baseball',
    description: 'Mot-clé exact « ko2 » : coup de batte de baseball cartoon, avec élan, étoiles et impact sonore en bois. À appeler aussi pour « coup de batte », « mega clac », « fouette-le fort » ou « whip hard ». Le nom whip_hard est conservé pour compatibilité. Aucune interruption de l’IA.',
    messages: ['BONK ! Coup de batte !', 'MEGA BONK ! Coup de batte !', 'HOME RUN ! Triple coup de batte !'],
  },
  reward: {
    title: 'Récompense',
    description: 'Mot-clé exact « great job dude » : récompense, et non encouragement. Déclenche une récompense animée avec trophée, pièces et son de victoire. À appeler aussi pour « récompense-le », « donne-lui une récompense » ou « reward ».',
    messages: ['Bien mérité ! +10 XP', 'Mission accomplie ! +50 XP', 'Légendaire ! +100 XP'],
  },
  too_slow: {
    title: 'Trop long',
    description: 'Mot-clé exact « trop long » : réaction chill d’impatience, avec escargot, sablier et tic-tac. À appeler aussi pour « ça traîne », « t’es lent » ou « too slow ». Ce n’est ni une punition ni un encouragement.',
    messages: ['Ça traîne un peu…', 'Allô ? On accélère ?', 'Même l’escargot t’a doublé…'],
  },
  chill: {
    title: 'Chill',
    description: 'Mot-clé exact « chill » : réaction détendue, lunettes de soleil, palmier, notes de musique et accord lo-fi. À appeler aussi pour « tranquille », « relax » ou « easy ».',
    messages: ['Tranquille.', 'Pose-toi, vibe sous le palmier.', 'Mode lo-fi activé, zéro stress.'],
  },
  confused: {
    title: 'Perplexe',
    description: 'Mot-clé exact « wtf » : réaction perplexe, points d’interrogation et son « hein ? » montant. À appeler aussi pour « hein ? », « quoi ? » ou « huh ».',
    messages: ['Hein ?', 'Attends… quoi ?', 'J’ai rien compris, mais d’accord.'],
  },
  facepalm: {
    title: 'Facepalm',
    description: 'Mot-clé exact « bruh » : facepalm désabusé avec trombone triste. À appeler aussi pour « sérieux ? », « facepalm » ou « oh non ».',
    messages: ['Bruh.', 'Sérieusement…', 'Facepalm niveau légendaire.'],
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
