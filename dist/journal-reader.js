import { open } from 'node:fs/promises';
import { z } from 'zod';
import { reactionDefinitions } from "./reactions.js";
const eventSchema = z.object({
    id: z.string().uuid(), timestamp: z.string().datetime(),
    reaction: z.enum(Object.keys(reactionDefinitions)),
    intensity: z.number().int().min(1).max(3),
    message: z.string().max(300).regex(/^[^\u0000-\u001f\u007f]*$/),
});
/** Bounded incremental reads; partial UTF-8/JSON lines wait for their newline. */
export class JournalReader {
    path;
    position = 0;
    identity;
    remainder = Buffer.alloc(0);
    discarding = false;
    constructor(path) { this.path = path; }
    async start() { await this.read(true); }
    async next() { return this.read(false); }
    async read(skipExisting) {
        let handle;
        try {
            handle = await open(this.path, 'r');
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                this.identity = undefined;
                this.position = 0;
                this.remainder = Buffer.alloc(0);
                this.discarding = false;
                return [];
            }
            throw error;
        }
        try {
            const stat = await handle.stat();
            const identity = `${stat.dev}:${stat.ino}:${stat.birthtimeMs}`;
            if ((this.identity !== undefined && identity !== this.identity) || stat.size < this.position) {
                this.position = 0;
                this.remainder = Buffer.alloc(0);
                this.discarding = false;
            }
            this.identity = identity;
            if (skipExisting) {
                this.position = stat.size;
                return [];
            }
            const length = Math.min(64 * 1024, stat.size - this.position);
            if (length === 0)
                return [];
            const chunk = Buffer.alloc(length);
            const { bytesRead } = await handle.read(chunk, 0, length, this.position);
            this.position += bytesRead;
            const data = Buffer.concat([this.remainder, chunk.subarray(0, bytesRead)]);
            const events = [];
            let start = 0;
            for (let end = data.indexOf(10); end !== -1; end = data.indexOf(10, start)) {
                if (!this.discarding) {
                    try {
                        const event = eventSchema.safeParse(JSON.parse(data.subarray(start, end).toString('utf8')));
                        if (event.success)
                            events.push(event.data);
                    }
                    catch { /* Ignore malformed journal lines, never execute them. */ }
                }
                this.discarding = false;
                start = end + 1;
            }
            this.remainder = data.subarray(start);
            if (this.remainder.length > 64 * 1024) {
                this.remainder = Buffer.alloc(0);
                this.discarding = true;
            }
            return events;
        }
        finally {
            await handle.close();
        }
    }
}
