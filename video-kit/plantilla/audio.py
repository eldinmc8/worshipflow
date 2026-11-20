import numpy as np, json, wave
from scipy.signal import butter, lfilter
SR = 48000
T = {'DUR':35.4,'V':0.4}
DUR = T['DUR']; N = int(SR * DUR)
rng = np.random.default_rng(7)
def midi(n): return 440 * 2 ** ((n - 69) / 12)
def tt(d): return np.arange(int(d * SR)) / SR
def lp(x, f): b, a = butter(2, f / (SR / 2)); return lfilter(b, a, x)
def hp(x, f): b, a = butter(2, f / (SR / 2), 'high'); return lfilter(b, a, x)
mus = np.zeros(N); sfx = np.zeros(N)
def add(buf, sig, t0, g=1.0):
    i = int(t0 * SR)
    if i >= N or i + len(sig) <= 0: return
    if i < 0: sig = sig[-i:]; i = 0
    j = min(N, i + len(sig)); buf[i:j] += sig[:j - i] * g

BPM = 112; beat = 60 / BPM; bar = 4 * beat
DROP = 14.3
# I V vi IV en G
CH = [[55, 59, 62, 67], [50, 57, 62, 66], [52, 59, 64, 67], [48, 55, 60, 64]]
BASS = [43, 38, 40, 36]

def saw(f, d):
    t = tt(d); s = np.zeros_like(t)
    for k in range(1, 12): s += np.sin(2 * np.pi * f * k * t) / k * (-1) ** (k + 1)
    return s
def kick():
    t = tt(0.35); f = 50 + 110 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9) * 1.0
def clap():
    t = tt(0.25); n = hp(rng.standard_normal(len(t)), 900)
    return n * np.exp(-t * 18) * 0.45
def hat(d=0.06):
    t = tt(d); return hp(rng.standard_normal(len(t)), 7000) * np.exp(-t * 60) * 0.18
def pluck(f, d=0.35):
    t = tt(d); s = np.sign(np.sin(2 * np.pi * f * t)) * 0.3 + np.sin(2 * np.pi * f * t)
    return lp(s * np.exp(-t * 9), 3500) * 0.22

# --- Intro tenso (0 → 12.2): pad grave filtrado + pulso
t = 0.0
while t < 13.0:
    k = int(t / bar) % 2
    notes = [52, 59, 64] if k == 0 else [48, 55, 64]
    d = bar + 0.4
    s = sum(lp(saw(midi(n), d), 700) for n in notes) / 3
    env = np.minimum(1, tt(d) / 0.5) * np.minimum(1, (d - tt(d)) / 0.4)
    add(mus, s * env * 0.16, t)
    for e in range(8):
        add(mus, hat(0.04), t + e * beat / 2, 0.6 if e % 2 else 0.3)
    add(mus, lp(np.sin(2 * np.pi * midi(40) * tt(0.3)) * np.exp(-tt(0.3) * 8), 300) * 0.5, t)
    add(mus, lp(np.sin(2 * np.pi * midi(40) * tt(0.3)) * np.exp(-tt(0.3) * 8), 300) * 0.5, t + 2 * beat)
    t += bar
# tensión extra durante la alarma
fade = np.ones(N); i0, i1 = int(13.0 * SR), int(13.3 * SR); fade[i0:i1] = np.linspace(1, 0, i1 - i0); fade[i1:] = 0
mus *= fade
# riser 12.3 → drop
d = DROP - 13.1; tr = tt(d)
riser = hp(rng.standard_normal(len(tr)), 1500) * (tr / d) ** 2 * 0.35
sweep = np.sin(2 * np.pi * np.cumsum(200 + 1400 * (tr / d) ** 2) / SR) * (tr / d) ** 2 * 0.08
add(mus, riser + sweep, 13.1)
# impacto del drop
ti = tt(2.0); add(mus, (np.sin(2 * np.pi * np.cumsum(60 * np.exp(-ti * 2) + 30) / SR) * np.exp(-ti * 2.5)) * 0.9, DROP)
add(mus, lp(rng.standard_normal(len(ti)), 4000) * np.exp(-ti * 3) * 0.25, DROP)

# --- Drop pop (13.61 → final)
END = 33.6
t = DROP; b = 0
while t < END:
    ci = b % 4
    for e in range(4):
        tb = t + e * beat
        if tb >= END: break
        add(mus, kick(), tb, 0.85)
        if e in (1, 3): add(mus, clap(), tb)
        add(mus, hat(), tb + beat / 2); add(mus, hat(0.03), tb, 0.5)
        # bajo en corcheas con pump
        for h in range(2):
            bt = tt(beat / 2); f = midi(BASS[ci])
            bs = lp(saw(f, beat / 2), 500) * np.minimum(1, bt / 0.04) * np.exp(-bt * 3) * 0.32
            add(mus, bs, tb + h * beat / 2)
    # acordes con sidechain
    s = sum(lp(saw(midi(n), bar), 2400) for n in CH[ci]) / 4
    ph = (tt(bar) % beat) / beat
    pump = np.clip(ph / 0.35, 0, 1) ** 1.5
    add(mus, s * pump * 0.14, t)
    # arpegio pluck en 16avos
    arp = CH[ci] + [CH[ci][1] + 12]
    for e in range(16):
        n = arp[[0, 1, 2, 3, 4, 3, 2, 1][e % 8]] + 12
        add(mus, pluck(midi(n), 0.3), t + e * beat / 4, 0.55 if e % 4 == 0 else 0.35)
    t += bar; b += 1
# acorde final que queda sonando
d = 2.4; s = sum(lp(saw(midi(n), d), 2200) for n in CH[0] + [43]) / 5
add(mus, s * np.exp(-tt(d) * 1.4) * 0.22, END)
add(mus, kick(), END, 0.8)
# fade final
fo = np.ones(N); a = int((DUR - 1.2) * SR); fo[a:] = np.linspace(1, 0, N - a); mus *= fo

# --- Efectos
def whoosh(d=0.55):
    tr = tt(d); n = rng.standard_normal(len(tr)); env = np.sin(np.pi * tr / d) ** 2
    out = np.zeros_like(n); f0 = 400
    seg = 256
    for i in range(0, len(n), seg):
        fc = f0 + 4000 * np.sin(np.pi * (i / len(n)))
        out[i:i + seg] = lp(n[i:i + seg], min(fc, 20000))
    return out * env * 0.5
def pop():
    tr = tt(0.12); f = 500 + 900 * np.exp(-tr * 40)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tr * 30) * 0.4
def click():
    tr = tt(0.05); return (hp(rng.standard_normal(len(tr)), 2000) * np.exp(-tr * 140) * 0.6 + np.sin(2 * np.pi * 1800 * tr) * np.exp(-tr * 90) * 0.3)
def key():
    tr = tt(0.04); return hp(rng.standard_normal(len(tr)), 3000) * np.exp(-tr * 160) * 0.3
def sparkle():
    out = np.zeros(int(1.0 * SR))
    for i, n in enumerate([84, 88, 91, 96, 100]):
        tr = tt(0.6); s = np.sin(2 * np.pi * midi(n) * tr) * np.exp(-tr * 7) * 0.12
        j = int(i * 0.05 * SR); out[j:j + len(s)] += s
    return out
def alarm(d):
    tr = tt(d); f = np.where((tr % 0.5) < 0.25, 880, 660)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.07 * np.minimum(1, (d - tr) / 0.3)
def ding():
    tr = tt(1.2); return (np.sin(2 * np.pi * 1318 * tr) + 0.5 * np.sin(2 * np.pi * 1975 * tr)) * np.exp(-tr * 4) * 0.12

for ts in [8.3, 13.0, 16.3, 21.7, 25.3, 29.7]: add(sfx, whoosh(), ts - 0.25)
for ts in [0.15, 3.3, 4.6, 6.2, 8.4, 8.75, 9.1, 9.45, 9.8, 11.4, 31.8]: add(sfx, pop(), ts)
add(sfx, alarm(4.2), 8.4)
for ts in [17.5, 18.9, 22.3]: add(sfx, click(), ts)
add(sfx, sparkle(), 22.4)
add(sfx, ding(), 31.8)
# --- Voz + ducking
w = wave.open('narr.wav'); vo = np.frombuffer(w.readframes(w.getnframes()), np.int16) / 32768.0
voice = np.zeros(N); add(voice, vo, T['V'])
env = np.convolve(np.abs(voice), np.ones(int(0.15 * SR)) / int(0.15 * SR), 'same')
duck = 1 - 0.6 * np.clip(env / 0.03, 0, 1)
mix = voice * 1.0 + mus * duck * 0.3 + sfx * 0.6
mix /= max(1.0, np.abs(mix).max() / 0.95)
st = np.stack([mix, mix], 1)
w = wave.open('mix.wav', 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((st * 32767).astype(np.int16).tobytes()); w.close()
print('ok', DUR)
