import { setTimeout as delay } from 'node:timers/promises';
import { effectDuration } from "./sound.js";
const WIDTH = 58;
const HEIGHT = 11;
const labels = { whip: 'FOUET / CLAC !', whip_hard: 'BATTE DE BASEBALL / BONK !',
    encourage: 'ENCOURAGEMENT / BRAVO !', reward: 'RECOMPENSE / LEVEL UP !',
    too_slow: 'TROP LONG / ZZZ...', chill: 'CHILL / LO-FI', confused: 'WTF / HEIN ?', facepalm: 'BRUH / FACEPALM',
    hype: 'HYPE / LET\'S GOOO !', rip: 'RIP / PAIX A SON CODE', sus: 'SUS / HMM...', ez: 'EZ / TROP FACILE' };
const particles = { too_slow: 'z', chill: '♪', confused: '?', facepalm: '.', hype: '*', rip: '+', sus: '.', ez: '`' };
const faces = { too_slow: ' | u_u |', chill: ' | B-) |', confused: ' | o_O |', facepalm: ' | -_- |',
    hype: ' | ^o^ |', rip: ' | x_x |', sus: ' | ¬_¬ |', ez: ' | -u- |' };
/** Frames belong to this CLI only; never write ANSI into the MCP protocol stream. */
export function terminalFrame(event, seconds) {
    if (!Object.hasOwn(labels, event.reaction))
        throw new Error('Réaction inconnue.');
    const grid = Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(' '));
    function put(x, y, text) {
        if (y < 0 || y >= HEIGHT)
            return;
        for (const [i, char] of [...text].entries()) {
            if (x + i >= 0 && x + i < WIDTH)
                grid[y][x + i] = char;
        }
    }
    const striking = event.reaction === 'whip' || event.reaction === 'whip_hard';
    let impact = false;
    let winding = false;
    for (let hit = 0; hit < event.intensity; hit++) {
        const local = seconds - (0.55 + hit * 0.5);
        impact ||= striking && local >= 0 && local < 0.22;
        winding ||= local >= -0.24 && local < 0;
    }
    if (!striking) {
        for (let i = 0; i < 8 + event.intensity * 4; i++) {
            put(3 + i * 13 % 52, 2 + Math.floor(seconds * 4 + i * 3.7) % 7, particles[event.reaction] ?? (i % 3 ? '+' : '*'));
        }
    }
    put(1, 0, `${labels[event.reaction]}  [${event.intensity}/3]`);
    const x = 30 + (impact ? Math.floor(seconds * 30) % 2 : 0);
    const y = !striking && Math.sin(seconds * 6) > 0 ? 2 : 3;
    put(x, y, '    o    ');
    put(x, y + 1, ' .-----.');
    put(x, y + 2, impact ? ' | >.< |' : striking ? ' | o_o |' : faces[event.reaction] ?? ' | ^_^ |');
    put(x, y + 3, ' +-----+');
    put(x, y + 4, !striking ? '\\| AI |/' : '/| AI |\\');
    put(x, y + 5, '  /   \\');
    if (event.reaction === 'whip_hard') {
        if (winding) {
            put(19, 2, '/===)');
            put(17, 3, '//');
            put(15, 4, '//');
            put(13, 5, 'o/');
        }
        else {
            put(9, 5, 'o==/////====[=======)');
        }
        if (impact) {
            put(41, 3, '* BONK! *');
            put(28, 4, '*');
        }
    }
    else if (event.reaction === 'whip') {
        put(8, 5, winding ? 'o==)~~\\__' : 'o==)~~~~~----~>');
        if (impact)
            put(41, 3, '* CLAC! *');
    }
    else if (event.reaction === 'reward') {
        put(10, 3, '\\===/');
        put(10, 4, ' \\_/');
        put(10, 5, '  |');
        put(10, 6, ' _|_');
        put(43, 6, `+${event.intensity === 1 ? 10 : event.intensity === 2 ? 50 : 100} XP`);
    }
    else if (event.reaction === 'too_slow') {
        put(10, 3, '[===]');
        put(10, 4, seconds % 1 < 0.5 ? ' \\:/' : ' \\./');
        put(10, 5, ' /.\\');
        put(10, 6, '[===]');
        put(2 + Math.floor(seconds * 2), 8, '__@)');
        put(43, 6, 'ZZZ...');
    }
    else if (event.reaction === 'chill') {
        const sway = Math.floor(seconds * 2) % 2;
        put(9, 3, sway ? '\\|//' : '//|\\');
        put(11, 4, '|');
        put(11, 5, '|');
        put(10, 6, '_|_');
        put(18, 2 + Math.floor(seconds * 3) % 3, sway ? '♪  ♫' : '♫  ♪');
        put(43, 6, 'CHILL...');
    }
    else if (event.reaction === 'confused') {
        put(10, 3, ' __ ');
        put(10, 4, '   )');
        put(10, 5, '  / ');
        put(10, 7, '  o ');
        put(43, 6, 'HEIN ?');
    }
    else if (event.reaction === 'facepalm') {
        put(x + 6, y + 2, '<m');
        put(10, 5, 'wah... wah...');
        put(43, 6, 'BRUH.');
    }
    else if (event.reaction === 'hype') {
        const lift = Math.floor(seconds * 4) % 7;
        put(10, 7 - lift, '/\\');
        put(10, 8 - lift, '||');
        put(10, 9 - lift, seconds * 8 % 2 < 1 ? '^^' : '**');
        put(43, 6, 'LET\'S GO !');
    }
    else if (event.reaction === 'rip') {
        put(9, 3, ' .---.');
        put(9, 4, '|     |');
        put(9, 5, '| RIP |');
        put(9, 6, '|     |');
        put(8, 7, '\"\"\"\"\"\"\"\"\"');
        put(43, 6, 'R.I.P.');
    }
    else if (event.reaction === 'sus') {
        put(10, 4, Math.floor(seconds * 2) % 2 ? '<-- ?' : '? -->');
        put(10, 6, '...');
        put(43, 6, 'SUS.');
    }
    else if (event.reaction === 'ez') {
        put(10, 4, 'GG EZ');
        if (Math.floor(seconds * 3) % 2)
            put(9, 6, '*ding*');
        put(43, 6, 'EZ.');
    }
    else {
        put(11, 4, '\\  |  /');
        put(11, 5, '-- * --');
        put(11, 6, '/  |  \\');
        put(43, 6, 'BRAVO !');
    }
    const progress = Math.max(0, 1 - seconds * 1000 / effectDuration(event.reaction, event.intensity));
    put(1, 10, '='.repeat(Math.round(56 * progress)));
    const border = `+${'-'.repeat(WIDTH)}+`;
    return [border, ...grid.map((line) => `|${line.join('')}|`), border].join('\n');
}
export function canAnimate(stream) {
    return Boolean(stream.isTTY && (stream.columns ?? 80) >= WIDTH + 3 && (stream.rows ?? 24) >= HEIGHT + 5);
}
export async function animateTerminal(event, stream = process.stdout) {
    // Redirected output (including most AI tool consoles) gets one clean static frame.
    if (!canAnimate(stream)) {
        stream.write(`${terminalFrame(event, 0.6)}\n`);
        return;
    }
    const start = performance.now();
    const duration = effectDuration(event.reaction, event.intensity);
    let drawn = false;
    while (performance.now() - start < duration) {
        if (!canAnimate(stream))
            break;
        if (drawn)
            stream.write(`\x1b[${HEIGHT + 2}F`);
        const frame = terminalFrame(event, (performance.now() - start) / 1000);
        stream.write(`${frame.split('\n').map((line) => `${line}\x1b[K`).join('\n')}\n`);
        drawn = true;
        await delay(50);
    }
}
