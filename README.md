# are you awake?

A five-minute horror game that runs in the browser. It has no assets: every image is drawn in code and every sound, including the voice, is synthesized live with Web Audio.

> They buried her on Tuesday. Tonight you're sleeping in your old room.

## Play

Open `index.html` in a desktop browser (Chrome, Edge, Firefox or Safari). No build step, no server needed.

Play it with **headphones, the lights off, and the volume at a normal level**. It has loud jump scares.

| Control | Desktop | Phone / tablet |
| --- | --- | --- |
| Look around / aim the torch | Move the mouse | Drag |
| Examine what's lit | Click | Tap |
| Hide under the blanket | Hold `SPACE` | Hold the on-screen button |
| Torch on/off | `F` or right-click | — |

A full night lasts about 3½ to 4½ minutes. There's a hard cap, so it never runs past five.

Content warning: grief, the death of a parent, jump scares, flashing images.

---

## Design notes (spoilers: play it first)

### The idea

The scariest thing a horror game can do is take something that should comfort you and make it wrong. Here that thing is your mum. She has just died. It's 3 a.m. Her phone, which you put in the kitchen drawer yourself, texts you: *are you awake?*

The game is about grief more than about a monster. The thing in the house has learned her voice from the one saved voicemail you have played 214 times. It uses her phrases, and her rule from when you were six: *monsters can't get you under the blanket.* The game teaches you that rule, lets you trust it, and then breaks it.

### How it's built to scare

| Technique | Where it happens |
| --- | --- |
| **Dread first, startle second.** Long tension and short shocks act on different brain systems, so the game holds back the big scare for four minutes. | 0:00–1:00 is quiet and sad. Only two full-screen scares, both late. |
| **The familiar made strange** (Freud's *unheimlich*). | Your childhood bedroom, her cardigan, your crayon drawing, her birthday photo. Each one changes while you're looking elsewhere. |
| **The almost-right voice.** Research on the uncanny in games finds that characters with not-quite-human voices are rated the most frightening. | Her voice comes from a home-made formant whisper synth. It sounds like speech, but not quite. It repeats itself: *it's mum. it's mum. it's your mum.* |
| **Silence as a cue.** | The clock stops ticking and the rain stops just before she climbs the stairs. |
| **Low drones and binaural placement.** | Two sine waves beat against each other at 49 Hz under everything. Footsteps move from downstairs to the stairs to the hall to the left of your head, and the last whisper is hard-panned into your right ear. |
| **Weeping-angel rule.** You choose where to look, and wherever you don't look is where things move. | She only advances while your torch is off her. The phone, the wardrobe and the window all try to pull your eyes away. |
| **Stop-motion approach.** | The torch batteries die one flicker at a time, and with each flicker she is closer. The last flicker shows the foot of the bed empty. |
| **The safe place violated.** | You hide under the blanket because the game told you to. That's where the last scare happens. |
| **A sad ending that recolours the scares.** | Morning. You hear her real voicemail, the same phrases the thing used. Then, in the dark: *Mum ♥ is typing…* |
| **Small touches.** | Subliminal one-frame faces at the edge of the torch beam. The tab title changes to your name if you switch away. Your own breath and heartbeat speed up. |

### Code map

- `js/audio.js` – Web Audio engine. Rain, house drone, creaks (a stick-slip pulse train through resonant filters), footsteps placed in the house, the phone, heartbeat, breathing, the formant voice synth, a music box playing an original lullaby, and the scream.
- `js/render.js` – a 480×270 canvas. A one-point-perspective room, the figure, the faces and the view from under the blanket, lit by multiplying with a light map, then grained and dithered (4×4 Bayer).
- `js/game.js` – the director. The night is written as an `async` screenplay (`await wait()`, `await until()`), plus a small per-frame simulation for the torch, hiding, the mirror and window events, and the approach.

For testing, `index.html#act3` starts at a given act (0–5) and `#speed6` runs the clock faster. The two can be combined: `#act3speed4`.

### Research sources

- [Psychology of Horror Games – Psychology of Games](https://www.psychologyofgames.com/2015/10/the-psychology-of-horror-games/)
- [Horror movies trigger the brain's fight-or-flight response (anticipatory vs. acute fear) – SYFY](https://www.syfy.com/syfy-wire/horror-movies-trigger-brain-fight-or-flight)
- [Horror sound design's secrets – LBB Online](https://lbbonline.com/news/horror-sound-designs-secrets-how-audio-experts-craft-bone-chilling-scares/)
- [Audio Horror – UCLA](https://www.audiohorror.humspace.ucla.edu/)
- [Uncanny behaviour in survival horror games – Tinwell & Grimshaw (Aalborg)](https://vbn.aau.dk/ws/files/63140720/Uncanny_behaviour_in_survival_horror_games.pdf)
- [The audio uncanny valley: sound, fear and the horror game – Grimshaw](https://vbn.aau.dk/en/publications/the-audio-uncanny-valley-sound-fear-and-the-horror-game)
- [Designing Digital Uncanny – Dales, University of York](https://etheses.whiterose.ac.uk/31625/1/DalesTaniaMScThesis.pdf)
- [Games and Bereavement – Sabine Harrer](https://library.mumbai.bristol.ac.uk/Record/doab-20.500.12854ir-33769)
