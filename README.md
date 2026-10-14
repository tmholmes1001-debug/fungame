# are you awake?

A horror game for the browser that lasts under five minutes. Your mum died last week. It's 3:03 a.m., you're in your old bedroom, and you can't stop scrolling. Then her phone texts you: *are you awake?*

You never leave the bed. The whole game is one fixed view of a dark bedroom, plus the phone in your hands. The phone is your light, your only source of information, and the thing that gives you away.

## Play

Open `index.html` in a desktop browser (Chrome, Edge, Firefox or Safari). There's no build step and no server; it works straight from the file. Play with **headphones, the lights off, and the volume at a normal level**. It has loud jump scares.

| Control | Desktop | Phone / tablet |
| --- | --- | --- |
| Use the phone (apps, texts, feed, calls) | Mouse: click, scroll | Tap, swipe |
| Lower / raise the phone to see the room | `SPACE` | **lower phone** button |
| Power button (screen off / on) | `L` | **screen off** button |
| Silent switch | `M` | **silent** button |
| Scroll the feed | Mouse wheel, `↑` `↓` | Swipe |

A night lasts 3 to 4½ minutes, depending on whether it finds you.

Content warning: grief, the death of a parent, jump scares, flashing images, loud sounds.

---

## Design notes (spoilers: play it first)

### What you do with the phone

Something with her number is in the house, moving from the kitchen to the stairs, to your door, into the room, and to the side of your bed. It can't see you. It finds you through your phone.

| Rule (from the film in the feed) | What it means in the game |
| --- | --- |
| 1. Do not answer it. It learns her from your answers. | Replying to her texts or accepting her calls makes it notice you, permanently. |
| 2. Do not let it hear your phone. | Ringtones, message pings and the feed's sound all draw it. Decline calls; flip the silent switch. |
| 3. When it is in the room, go dark. | Screen light counts, even under the door. Her texts keep lighting your screen, so you have to turn it off again every time. The torch is fatal. |
| 4. Do not look at it. | Lowering the phone lets your eyes adjust and see the room, and it sees you looking. The camera app's night mode shows what's behind the phone, and that counts as looking too. |
| 5. At 3:33 it must leave. | Survive until then. |

The rules are hidden in **forU**, the fake TikTok. Scroll past "You're all caught up" and you reach **the farlands**: TikTok slang, borrowed from Minecraft's glitched Far Lands, for the strange, ominous content past the end of the algorithm. You'll find the Far Lands themselves, a bee playing the violin, an almost-human face with 3 likes, rows of blinking eyes, and a 1987 public information film. Her account, `mum_♥`, also starts posting: two mugs of tea in the dark kitchen, the stairs up to your door, and finally a LIVE video filmed through her eyes, showing you in bed.

Her attention (hidden) drives everything. As it rises, her voice escalates from a whisper chorus behind the door, to yelling ("Let me see you!", "Open the door!", "I'm your mother!"), to fists on the door, until she bursts in. Even a perfect player gets the scripted escalation: hammering, a sudden silence, the door opening, and "Look at me!" yelled beside your ear at 3:32.

### Why it's built this way

- **The reveal is withheld.** She's never shown clearly. You get a silhouette in the door gap, a shape at the foot of the bed (exactly where the phone blocks your view), a grainy night-vision image, and her live stream. The face appears once, if she catches you.
- **A real phenomenon, used as a mechanic.** Holding a bright screen in a dark room makes the room invisible. Put the phone down and your eyes slowly adjust. The game models this with an exposure that adapts over a few seconds.
- **The almost-human face.** Google's MediaPipe face mesh, pushed slightly past human: eyes a little too big and too far apart, one lower than the other, a grin too wide, then a jaw that keeps opening. It's lit from below by the phone.
- **Grief.** Her thread is full of real-feeling history: Sunday roasts, "hospital say I might come home tuesday 🙂", and a saved voicemail from March you can still play. The thing reuses her phrases ("it's only me", "are you awake?"), because that's what it learned from.

### How it's built

- `js/world.js`: the bedroom in **three.js** (r128, in `vendor/`), with physically based lighting. The phone screen is a point light, so it only lights what's near you. There's moonlight through the curtain gap, a landing light under the door, the torch and the camera flash. A post-processing shader handles eye adaptation, focus blur, sensor grain and glitches. It also renders the camera app's night vision and her LIVE view straight into the phone screen.
- `js/phone.js`: lock screen, home screen, Messages (with voice notes and reply chips), forU, Camera, Phone and calls, plus the power button and silent switch.
- `js/feed.js`: every forU video, drawn procedurally on a canvas.
- `js/audio.js`: Web Audio. The house (footsteps placed downstairs, on the stairs and in the hall; creaks, knocks, the kettle), the phone's sounds, heartbeat, breathing, and her voice, placed in space.
- `js/voices.js`: her voice, Danny's voicemail, and the 999 operator: 23 lines generated offline with the **Kokoro** neural TTS model, then processed in `tools/gen_voices.py`. Whispers use STFT phase randomization, which keeps the shape of the words but removes the voiced pitch. Yells layer the line pitched up, down a fifth, and down an octave, with distortion and a reversed-reverb swell. Phone audio is band-limited.
- `js/game.js`: the director. A screenplay from 3:03 to 3:33 written with `async`/`await`, plus the attention system and the two endings.

For testing, `index.html#speed4` runs the clock faster.

### Credits and licences

- three.js r128 (MIT), `vendor/three.LICENSE`
- MediaPipe canonical face model (Apache 2.0, Google), `vendor/mediapipe.LICENSE`
- Voices generated with Kokoro-82M via `kokoro-onnx` (Apache 2.0)

### Research

- [TikTok Farlands, explained – Fast Company Brasil](https://fastcompanybrasil.com/tech/tiktok-farlands-ha-tras-misterioso-submundo-rede/)
- [What goes on in TikTok's farlands – The Interface](https://poderato.com/shows/the-interface/what-goes-on-in-tiktok-s-farlands-)
- [Uncanny behaviour in survival horror games – Tinwell & Grimshaw](https://vbn.aau.dk/ws/files/63140720/Uncanny_behaviour_in_survival_horror_games.pdf)
- [The audio uncanny valley: sound, fear and the horror game – Grimshaw](https://vbn.aau.dk/en/publications/the-audio-uncanny-valley-sound-fear-and-the-horror-game)
- [Horror sound design's secrets – LBB Online](https://lbbonline.com/news/horror-sound-designs-secrets-how-audio-experts-craft-bone-chilling-scares/)
- [The Psychology of Horror Games – Psychology of Games](https://www.psychologyofgames.com/2015/10/the-psychology-of-horror-games/)
- [Designing Digital Uncanny – Dales, University of York](https://etheses.whiterose.ac.uk/31625/1/DalesTaniaMScThesis.pdf)
