// The animations' clock: 60 frames a second, on deadlines fixed in advance.
// A plain 16 ms interval is not enough: Windows wakes Node timers on its own
// ~15.6 ms tick, so each wait rounds up and a "30 fps" interval ran at 24 and
// a 60 fps one at 43. Aiming each wait at the next deadline keeps the average
// on 60 without spinning the CPU; a late frame is dropped, never replayed in a
// burst. Everything drawn reads the real clock, so a frame is never behind.
/** Milliseconds per frame: 60 frames a second. */
export const FRAME_MS = 1000 / 60;
/** Milliseconds to wait from `now` until the frame after `deadline`, and that frame's deadline. */
export function nextFrame(deadline, now, period = FRAME_MS) {
    let next = deadline + period;
    // Behind by more than a frame: skip the missed ones instead of catching up.
    if (next <= now)
        next = now + period;
    return { wait: Math.max(0, next - now), deadline: next };
}
/** Calls `tick` every frame until stopped; the timer never keeps the process alive. */
export function startFrames(tick, now = () => performance.now(), period = FRAME_MS) {
    let deadline = now(), timer, stopped = false;
    const schedule = () => {
        const frame = nextFrame(deadline, now(), period);
        deadline = frame.deadline;
        timer = setTimeout(run, frame.wait);
        timer.unref?.();
    };
    const run = () => {
        if (stopped)
            return;
        try {
            tick();
        }
        finally {
            if (!stopped)
                schedule();
        }
    };
    schedule();
    return () => { stopped = true; if (timer)
        clearTimeout(timer); };
}
/** Waits for the next frame of a loop; pass back the deadline it returns. */
export function waitFrame(deadline, now = performance.now(), period = FRAME_MS) {
    const frame = nextFrame(deadline, now, period);
    return new Promise((resolve) => setTimeout(() => resolve(frame.deadline), frame.wait));
}
