import { randomUUID } from 'node:crypto';
import { z } from 'zod';
export const reactionInput = z.strictObject({
    intensity: z.number().int().min(1).max(3).default(1)
        .describe('Intensité entière : 1 = légère, 2 = moyenne, 3 = forte. Défaut : 1.'),
});
export const reactionDefinitions = {
    whip: {
        keyword: 'clac',
        summary: 'fouet',
        title: 'Fouet',
        description: 'Mot-clé exact « clac » : fouet. Déclenche un effet local de fouet symbolique. À appeler aussi pour « fouette-le », « coup de fouet » ou « whip ». Ne touche jamais au clavier ni au processus de l’IA.',
        messages: ['CLAC !', 'CLAC ! CLAC !', 'CLAC ! CLAC ! CLAC !'],
    },
    encourage: {
        keyword: 'bien joué',
        summary: 'encouragement',
        title: 'Encouragement',
        description: 'Mot-clé exact « bien joué » : encouragement. Ne pas confondre avec « gg », qui appelle reward. Déclenche une réaction locale positive. À appeler aussi pour « encourage-le », « bravo » ou « encourage ». Ne touche jamais au clavier ni au processus de l’IA.',
        messages: ['Bravo, continue !', 'Super travail, garde le cap !', 'Excellent travail ! Tu peux être fier de toi !'],
    },
    whip_hard: {
        keyword: 'bonk',
        summary: 'coup de batte',
        title: 'Coup de batte de baseball',
        description: 'Mot-clé exact « bonk » : coup de batte de baseball cartoon, avec élan, étoiles et impact sonore en bois. À appeler aussi pour « coup de batte », « mega clac », « fouette-le fort » ou « whip hard ». Le nom whip_hard est conservé pour compatibilité. Aucune interruption de l’IA.',
        messages: ['BONK ! Coup de batte !', 'MEGA BONK ! Coup de batte !', 'HOME RUN ! Triple coup de batte !'],
    },
    reward: {
        keyword: 'gg',
        summary: 'trophée et XP',
        title: 'Récompense',
        description: 'Mot-clé exact « gg » : récompense, et non encouragement. Déclenche une récompense animée avec trophée, pièces et son de victoire. À appeler aussi pour « récompense-le », « donne-lui une récompense » ou « reward ».',
        messages: ['Bien mérité ! +10 XP', 'Mission accomplie ! +50 XP', 'Légendaire ! +100 XP'],
    },
    too_slow: {
        keyword: 'trop long',
        summary: 'escargot qui traîne',
        title: 'Trop long',
        description: 'Mot-clé exact « trop long » : réaction chill d’impatience, avec escargot, sablier et tic-tac. À appeler aussi pour « ça traîne », « t’es lent » ou « too slow ». Ce n’est ni une punition ni un encouragement.',
        messages: ['Ça traîne un peu…', 'Allô ? On accélère ?', 'Même l’escargot t’a doublé…'],
    },
    chill: {
        keyword: 'chill',
        summary: 'palmier lo-fi',
        title: 'Chill',
        description: 'Mot-clé exact « chill » : réaction détendue, lunettes de soleil, palmier, notes de musique et accord lo-fi. À appeler aussi pour « tranquille », « relax » ou « easy ».',
        messages: ['Tranquille.', 'Pose-toi, vibe sous le palmier.', 'Mode lo-fi activé, zéro stress.'],
    },
    confused: {
        keyword: 'wtf',
        summary: 'perplexe',
        title: 'Perplexe',
        description: 'Mot-clé exact « wtf » : réaction perplexe, points d’interrogation et son « hein ? » montant. À appeler aussi pour « hein ? », « quoi ? » ou « huh ».',
        messages: ['Hein ?', 'Attends… quoi ?', 'J’ai rien compris, mais d’accord.'],
    },
    facepalm: {
        keyword: 'bruh',
        summary: 'facepalm',
        title: 'Facepalm',
        description: 'Mot-clé exact « bruh » : facepalm désabusé avec trombone triste. À appeler aussi pour « sérieux ? », « facepalm » ou « oh non ».',
        messages: ['Bruh.', 'Sérieusement…', 'Facepalm niveau légendaire.'],
    },
    hype: {
        keyword: "let's go",
        summary: 'fusée et fanfare',
        title: 'Hype',
        description: 'Mot-clé exact « let\'s go » : hype, fusée et fanfare montante. À appeler aussi pour « letsgo », « go go go » ou « hype ».',
        messages: ['Let’s go !', 'LET’S GOOO !', 'LET’S GOOOOOOO ! Fusée lancée !'],
    },
    rip: {
        keyword: 'rip',
        summary: 'pierre tombale',
        title: 'RIP',
        description: 'Mot-clé exact « rip » : petite pierre tombale cartoon et orgue mélancolique, pour un bug ou une idée ratée. À appeler aussi pour « paix à son âme » ou « c’est mort ».',
        messages: ['RIP.', 'Paix à ce code.', 'Ci-gît ta dernière idée. Elle était jeune.'],
    },
    sus: {
        keyword: 'susp',
        summary: 'suspense',
        title: 'Suspect',
        description: 'Mot-clé exact « susp » (suspense) : regard suspicieux à gauche et à droite, avec deux notes graves de suspense. À appeler aussi pour « louche », « suspect » ou « hmm ».',
        messages: ['Hmm… louche.', 'Très suspect, tout ça.', 'Je t’ai à l’œil. Les deux yeux, même.'],
    },
    ez: {
        keyword: 'ez',
        summary: 'trop facile',
        title: 'EZ',
        description: 'Mot-clé exact « ez » : victoire trop facile, sourire tranquille et petit « ding ». À appeler aussi pour « easy », « trop facile » ou « fastoche ».',
        messages: ['EZ.', 'Trop facile.', 'Même pas transpiré. EZ GG.'],
    },
};
export class ReactionEngine {
    output;
    constructor(output) {
        this.output = output;
    }
    async react(name, input) {
        const { intensity } = reactionInput.parse(input);
        if (!Object.hasOwn(reactionDefinitions, name)) {
            throw new Error('Réaction inconnue.');
        }
        const definition = reactionDefinitions[name];
        const message = definition.messages[intensity - 1];
        const event = {
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
