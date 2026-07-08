import json, re, hashlib
from collections import defaultdict, Counter
SP='/tmp/claude-1000/-home-alex/46f75a9b-6b1b-4e98-b2be-ab12cf86a018/scratchpad'
lessons=json.load(open(SP+'/all_lessons.json'))
CYR=re.compile(r'[а-яёА-ЯЁ]')
has_cyr=lambda s:bool(CYR.search(s or ''))
def is_en(s): return bool(re.search(r'[a-zA-Z]',s or '')) and not has_cyr(s)
LEVELS=['A0','A1','A2','B1','B2','C1','C2']
lvl=lambda m:(m or '').split('.')[0].upper()
def diff_of(L): return 'easy' if L in('A0','A1') else 'medium' if L in('A2','B1') else 'hard'

raw=defaultdict(lambda:{'tr':Counter(),'disp':Counter(),'mods':set(),'les':set(),'lvls':set(),'n':0})
for l in lessons:
    for t in l['tasks']:
        if t['type']!='match': continue
        for p in (t['data'].get('pairs') or []):
            left=(p.get('left') or '').strip(); right=(p.get('right') or '').strip()
            if not left or not right or not is_en(left) or not has_cyr(right): continue
            if len(left.split())>5: continue
            if not re.search(r'[a-zA-Z]',left): continue
            k=left.lower(); r=raw[k]
            r['tr'][right]+=1; r['disp'][left]+=1; r['mods'].add(l['moduleRef']); r['les'].add(l['lessonRef']); r['lvls'].add(lvl(l['moduleRef'])); r['n']+=1

# example pool: EN sentence + RU translation from listen/translate
pool=[]
for l in lessons:
    for t in l['tasks']:
        d=t['data']
        if t['type']=='listen' and d.get('transcript') and d.get('translation'):
            pool.append((d['transcript'].lower(), {'original':d['transcript'],'translation':d['translation']}))
        elif t['type']=='translate' and d.get('expected') and d.get('question'):
            q=re.sub(r'^\s*(Переведи|Переведите)[:\s]*','',d['question']).strip().strip("'\"«»")
            pool.append((d['expected'][0].lower(), {'original':d['expected'][0],'translation':q}))
def find_ex(word):
    w=re.escape(word.lower())
    for en,ex in pool:
        if re.search(r'\b'+w+r'\b', en): return ex
    return None

items=[]
for k,r in raw.items():
    disp=r['disp'].most_common(1)[0][0]; tr=r['tr'].most_common(1)[0][0]
    ls=sorted(r['lvls'],key=lambda x:LEVELS.index(x) if x in LEVELS else 99); L=ls[0] if ls else 'A1'
    ex=find_ex(disp)
    items.append({'id':'vocab_'+hashlib.sha1(k.encode()).hexdigest()[:12],'word':disp,'translation':tr,
      'difficulty':diff_of(L),'examples':[ex] if ex else [],'moduleRefs':sorted(r['mods']),
      'lessonRefs':sorted(r['les']),'audioKey':'vocab.'+hashlib.sha1(disp.encode()).hexdigest()[:16],
      'occurrenceCount':r['n'],'tags':[L]})
items.sort(key=lambda x:(-x['occurrenceCount'],x['word'].lower()))
json.dump(items,open(SP+'/vocab_items.json','w'),ensure_ascii=False,indent=1)
print('уникальных слов:',len(items))
from collections import Counter as C
print('по сложности:',dict(C(i['difficulty'] for i in items)))
print('по уровню (где введено):',dict(sorted(C(i['tags'][0] for i in items).items())))
print('с примером:',sum(1 for i in items if i['examples']),'/',len(items))
print('слов/модуль (среднее):',round(sum(len(i['moduleRefs']) for i in items)/len(items),2))
print('\n=== топ-12 по частоте ===')
for i in items[:12]: print(f"  {i['word']:<16} → {i['translation']:<20} [{i['difficulty']}] x{i['occurrenceCount']}"+(' | ex: '+i['examples'][0]['original'][:40] if i['examples'] else ''))
print('\n=== случайные 10 (проверка качества) ===')
import random; 
for i in items[len(items)//2:len(items)//2+10]: print(f"  {i['word']:<18} → {i['translation']}")
