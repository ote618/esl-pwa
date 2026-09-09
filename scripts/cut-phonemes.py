"""Cut the final utterance — the phoneme — out of each narrated letter-sound clip.

The letter-sound recordings say a whole Spanish line ("sonido de A — corta,
suena «a»") and end with the sound itself after a clear pause. The game needs
the sound, not the lesson. This takes the last speech run and writes it to
public/audio/phonemes/<ENTRY-ID>.mp3, leaving every original untouched so the
lesson screens keep the narration they were recorded for.
"""
import glob, json, os, re, subprocess

OUT = 'public/audio/phonemes'
os.makedirs(OUT, exist_ok=True)
PAD_IN, PAD_OUT, MIN, MAX = 0.04, 0.10, 0.10, 0.95

def dur(p):
    r = subprocess.run(['ffprobe','-v','error','-show_entries','format=duration',
                        '-of','default=nw=1:nk=1',p], capture_output=True, text=True)
    return float(r.stdout.strip() or 0)

made, flagged = {}, []
for f in sorted(glob.glob('public/audio/group*/*_sound__*.mp3')):
    d = dur(f)
    if d <= 1.5:                       # already just the sound
        continue
    eid = os.path.basename(f).split('_')[0]
    r = subprocess.run(['ffmpeg','-hide_banner','-nostats','-i',f,'-af',
                        'silencedetect=noise=-30dB:d=0.10','-f','null','-'],
                       capture_output=True, text=True)
    log = r.stderr
    # events in order, so we can tell a clip that ends in silence from one that
    # ends mid-word — LTR-Z-S1 does the latter and the first cut missed it.
    ev = sorted([(float(t), k) for k, t in
                 re.findall(r'silence_(start|end): ([\d.]+)', log)])
    if not ev:
        flagged.append((eid, 'no silence found')); continue
    if ev[-1][1] == 'end' and ev[-1][0] < d - 0.05:
        st_raw, en_raw = ev[-1][0], d                  # ends on the phoneme
    else:
        last_start = ev[-1][0]
        before = [t for t, k in ev if k == 'end' and t < last_start]
        if not before:
            flagged.append((eid, 'no run before the trailing silence')); continue
        st_raw, en_raw = before[-1], last_start
    st, en = max(0.0, st_raw - PAD_IN), min(d, en_raw + PAD_OUT)
    length = en - st
    if not (MIN < length < MAX):
        flagged.append((eid, f'final run {length:.2f}s')); continue
    dst = f'{OUT}/{eid}.mp3'
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',f,
                    '-ss',f'{st:.4f}','-t',f'{length:.4f}',
                    '-c:a','libmp3lame','-q:a','4',dst], check=True)
    made[eid] = f'/audio/phonemes/{eid}.mp3'
    print(f'  {eid:<12} {d:5.2f}s -> {dur(dst):5.2f}s')

json.dump(made, open('src/games/super-sonidos/phonemes.json','w'),
          indent=2, ensure_ascii=False, sort_keys=True)
print(f'\ncut {len(made)} phonemes; flagged {len(flagged)}')
for eid, why in flagged:
    print(f'  FLAG {eid}: {why}')
