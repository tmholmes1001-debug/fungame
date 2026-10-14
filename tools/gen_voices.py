# Generates every spoken line in the game with Kokoro TTS, then processes
# them into whispers, phone audio, and layered yells. Output: mono MP3s.
import numpy as np, soundfile as sf, subprocess, os, sys
from scipy.signal import butter, sosfilt, stft, istft, resample_poly, fftconvolve
from kokoro_onnx import Kokoro

SR = 24000
rng = np.random.default_rng(3)
k = Kokoro("kokoro.onnx", "voices.bin")

def tts(text, voice="bf_emma", speed=0.92):
    s, sr = k.create(text, voice=voice, speed=speed, lang="en-gb")
    assert sr == SR
    return s.astype(np.float64)

def bp(x, lo=None, hi=None, order=4):
    if lo and hi: sos = butter(order, [lo, hi], 'bandpass', fs=SR, output='sos')
    elif lo: sos = butter(order, lo, 'highpass', fs=SR, output='sos')
    else: sos = butter(order, hi, 'lowpass', fs=SR, output='sos')
    return sosfilt(sos, x)

def norm(x, peak=0.9):
    m = np.max(np.abs(x)) or 1
    return x / m * peak

def whisper(x, breath=0.12):
    # keep the spectral envelope, throw away the pitch: random phase
    f, t, Z = stft(x, SR, nperseg=512, noverlap=384)
    mag = np.abs(Z)
    ph = rng.uniform(-np.pi, np.pi, Z.shape)
    _, y = istft(mag * np.exp(1j * ph), SR, nperseg=512, noverlap=384)
    y = bp(y, 250, 9000)
    env = np.convolve(np.abs(y), np.ones(160) / 160, 'same')
    y = y + rng.normal(0, 1, len(y)) * env * breath
    return norm(y)

def stretch(x, r):
    # phase vocoder time-stretch (r > 1 = longer)
    n, h = 2048, 512
    f, t, Z = stft(x, SR, nperseg=n, noverlap=n - h)
    steps = np.arange(0, Z.shape[1] - 1, 1 / r)
    phase = np.angle(Z[:, 0]); out = np.zeros((Z.shape[0], len(steps)), complex)
    omega = 2 * np.pi * h * np.arange(Z.shape[0]) / n
    for i, s in enumerate(steps):
        a = int(s); fr = s - a
        m = (1 - fr) * np.abs(Z[:, a]) + fr * np.abs(Z[:, a + 1])
        out[:, i] = m * np.exp(1j * phase)
        dp = np.angle(Z[:, a + 1]) - np.angle(Z[:, a]) - omega
        dp -= 2 * np.pi * np.round(dp / (2 * np.pi))
        phase += omega + dp
    _, y = istft(out, SR, nperseg=n, noverlap=n - h)
    return y

def pitch(x, semis):
    r = 2 ** (semis / 12)
    y = stretch(x, r)
    # resample back to the original length: shifts pitch by `semis`
    up, down = 1000, int(round(1000 * r))
    return resample_poly(y, up, down)

def reverb(x, secs=1.6, wet=0.35, damp=4.0):
    n = int(SR * secs); ir = rng.normal(0, 1, n) * np.exp(-damp * np.arange(n) / n * 3)
    ir = bp(ir, 200, 5000); ir /= np.sqrt(np.sum(ir ** 2))
    y = fftconvolve(x, ir)
    dry = np.concatenate([x, np.zeros(len(y) - len(x))])
    return dry * (1 - wet) + norm(y, np.max(np.abs(x))) * wet

def swell(x, secs=1.2):
    # reversed reverb: the sound arrives before itself
    r = reverb(x[::-1], secs, wet=1.0)[::-1]
    pad = len(r) - len(x)
    return norm(r[: pad + int(SR * 0.15)], 0.5), pad

def phone(x):
    y = bp(x, 320, 3400, order=6)
    return norm(np.tanh(y * 2.2) * 0.8)

def drive(x, amt):
    return np.tanh(x * amt) / np.tanh(amt)

def pad(x, pre=0.05, post=0.25):
    return np.concatenate([np.zeros(int(SR * pre)), x, np.zeros(int(SR * post))])

def mix(*parts):
    n = max(int(off * SR) + len(p) for p, off in parts)
    out = np.zeros(n)
    for p, off in parts:
        o = int(off * SR); out[o:o + len(p)] += p
    return out

def yell(text, extra=0.0):
    base = tts(text, speed=0.88)
    hi = norm(pitch(base, 2))
    mid = norm(pitch(base, -5)) * 0.45
    lo = norm(pitch(base, -12)) * (0.45 + extra * 0.3)
    y = mix((hi, 0), (mid, 0.012), (lo, 0.028))
    y = drive(norm(y), 2.5 + extra * 2)
    y = bp(y, 90, 7000)
    sw, _ = swell(norm(base), 0.9)
    y = mix((sw * 0.6, 0), (y, len(sw) / SR - 0.15))
    return norm(reverb(y, 1.1, 0.25))

def scream():
    base = tts("Aaaaaaaaaaaaah!", speed=0.7)
    layers = [norm(pitch(base, s)) * a for s, a in [(5, 1), (0, 0.8), (-7, 0.7), (-12, 0.9)]]
    y = mix(*[(l, i * 0.01) for i, l in enumerate(layers)])
    y = drive(norm(y), 4.5)
    noise = bp(rng.normal(0, 1, len(y)), 1500, 6000) * np.linspace(1, 0.2, len(y)) * 0.35
    return norm(y + noise)

def close_whisper(text, speed=0.85):
    w = whisper(tts(text, speed=speed))
    # very close: low end boost (proximity), dry, mouth noise
    lowboost = bp(w, hi=500) * 1.4
    return norm(w + lowboost)

LINES = {}
LINES['vm_real']   = lambda: phone(pad(tts("Hi love, it's only me. Nothing important. I just wanted to hear your voice. You sounded tired last time. Are you sleeping? ... Anyway. Call me back when you can. Love you. Bye. Bye. Bye bye.", speed=0.95)))
def _vn1():
    v = tts("Hi love. It's only me. Are you awake? I've made you a cup of tea. Come downstairs.", speed=0.9)
    v = norm(pitch(v, -1.3))
    v = norm(resample_poly(v, 100, 96))  # a touch slow, like tape
    tail = whisper(tts("come downstairs", speed=0.8))[::-1] * 0.5
    return phone(pad(mix((v, 0), (tail, len(v) / SR - 0.4))))
LINES['vn1'] = _vn1
LINES['vn2']   = lambda: phone(pad(close_whisper("Why won't you come down? I can see your light under the door.")))
LINES['call1'] = lambda: phone(pad(mix((close_whisper("I can hear you breathing."), 0), (close_whisper("I'm coming up now, love.", 0.8), 2.4))))
LINES['w_awake']  = lambda: pad(close_whisper("Are you awake?"))
LINES['w_onlyme'] = lambda: pad(close_whisper("It's only me."))
LINES['w_letmein']= lambda: pad(close_whisper("Let me in."))
LINES['w_iknow']  = lambda: pad(close_whisper("I know you're awake."))
LINES['w_look']   = lambda: pad(close_whisper("Look at me.", 0.75))
LINES['w_here']   = lambda: pad(close_whisper("I'm right here.", 0.8))
LINES['w_night']  = lambda: pad(close_whisper("Goodnight, love.", 0.7), 0.05, 0.6)
LINES['w_hiding'] = lambda: pad(close_whisper("Why are you hiding from me?"))
LINES['s_sweet']  = lambda: pad(norm(reverb(tts("Sweetheart?", speed=0.85), 1.8, 0.45)))
LINES['s_comedown']= lambda: pad(norm(reverb(tts("Come downstairs, love!", speed=0.95), 1.8, 0.45)))
LINES['y_door']   = lambda: pad(yell("Open the door!"))
LINES['y_see']    = lambda: pad(yell("Let me see you!", 0.3))
LINES['y_hiding'] = lambda: pad(yell("Why are you hiding from me?", 0.4))
LINES['y_mother'] = lambda: pad(yell("I'm your mother!", 0.6))
LINES['y_look']   = lambda: pad(yell("Look at me!", 1.0))
LINES['scream']   = lambda: pad(scream(), 0, 0.1)
LINES['op_999']   = lambda: phone(pad(mix((tts("Emergency. Which service?", voice="bf_alice", speed=1.0), 0), (close_whisper("It's only me, love."), 2.6))))
LINES['danny_vm'] = lambda: phone(pad(tts("Hey, it's Danny. Can't get to the phone. Leave a message.", voice="bm_lewis", speed=1.0)))
LINES['danny_vn'] = lambda: phone(pad(tts("Hey. Are you okay? Listen, mum's phone is here. At mine. It's switched off, I'm literally looking at it. So who's texting you?", voice="bm_lewis", speed=1.0)))

only = sys.argv[1:]
os.makedirs('out', exist_ok=True)
for name, fn in LINES.items():
    if only and name not in only: continue
    y = np.clip(fn(), -1, 1).astype(np.float32)
    sf.write(f'out/{name}.wav', y, SR)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', f'out/{name}.wav', '-ac', '1', '-ar', '24000', '-b:a', '56k', f'out/{name}.mp3'], check=True)
    print(f'{name:12s} {len(y)/SR:5.2f}s  {os.path.getsize(f"out/{name}.mp3")//1024}KB', flush=True)
