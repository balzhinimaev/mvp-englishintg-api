import json,re,hashlib
from collections import defaultdict
SP='/tmp/claude-1000/-home-alex/46f75a9b-6b1b-4e98-b2be-ab12cf86a018/scratchpad'
d=json.load(open(SP+'/gram_src.json'))
modByRef={m['moduleRef']:m for m in d['modules']}
LEVELS=['A0','A1','A2','B1','B2','C1','C2']
diff_of=lambda L:'easy' if L in('A0','A1') else 'medium' if L in('A2','B1') else 'hard'

# --- связывание со справочником: латинские грам-термины из описания модуля ↔ title.en статьи ---
STOP={'this','that','with','from','your','their','used','uses','form','forms','some','more','less','than','word','words','when','what','have','test','into'}
def eng_tokens(s): return set(w.lower() for w in re.findall(r'[A-Za-z]{4,}', s or '') if w.lower() not in STOP)
hb=[a for a in d['handbook'] if a.get('cat') in ('grammar','cheatsheet') and a.get('ref')]
for a in hb: a['_tok']=eng_tokens(a['en'])|eng_tokens(a['ref'].replace('.',' ').replace('-',' '))
def match_handbook(desc,title):
    toks=eng_tokens(desc)|eng_tokens(title)
    if not toks: return None
    best=None;bestn=0
    for a in hb:
        n=len(toks & a['_tok'])
        if n>bestn: bestn=n;best=a
    return best.get('ref') if best and bestn>=1 else None

# --- является ли choice-задание грам-пробой ---
def is_grammar(q):
    ql=(q or '').lower()
    return ('___' in (q or '')) or ('correct' in ql) or ('правильн' in ql)

# сгруппировать choice-задания по модулю
byMod=defaultdict(list)
for l in d['lessons']:
    for t in l['tasks']:
        if not t.get('q') or not t.get('options') or t.get('ci') is None: continue
        if not is_grammar(t['q']): continue
        byMod[l['moduleRef']].append({'q':t['q'],'options':t['options'],'ci':t['ci'],'expl':t.get('expl') or '','lessonRef':l['lessonRef']})

CAP=6  # атомов на модуль
atoms=[]; seenPrompt=set()
for mref,tasks in byMod.items():
    m=modByRef.get(mref,{})
    level=m.get('level','A1'); title=m.get('desc') or m.get('title') or 'Грамматика'
    hbslug=match_handbook(m.get('desc',''),m.get('title',''))
    # разнообразие: сначала по одному из разных уроков, потом добор
    picked=[]; usedLessons=set()
    for t in tasks:
        if len(picked)>=CAP: break
        if t['lessonRef'] in usedLessons: continue
        picked.append(t); usedLessons.add(t['lessonRef'])
    for t in tasks:
        if len(picked)>=CAP: break
        if t in picked: continue
        picked.append(t)
    for t in picked:
        key=re.sub(r'\s+',' ',t['q'].strip().lower())
        if key in seenPrompt: continue
        seenPrompt.add(key)
        atoms.append({
            'id':'gram_'+hashlib.sha1((mref+'|'+key).encode()).hexdigest()[:12],
            'kind':'grammar','title':title.strip()[:80],'prompt':t['q'].strip(),
            'options':t['options'],'correctIndex':t['ci'],'explanation':(t['expl'] or '').strip(),
            'handbookRef':hbslug,'difficulty':diff_of(level),'level':level,
            'moduleRefs':[mref],'lessonRefs':[t['lessonRef']],
        })
json.dump(atoms,open(SP+'/grammar_atoms.json','w'),ensure_ascii=False,indent=1)
from collections import Counter
print('грам-атомов:',len(atoms))
print('по уровню:',dict(sorted(Counter(a['level'] for a in atoms).items())))
print('со ссылкой на справочник:',sum(1 for a in atoms if a['handbookRef']),'/',len(atoms))
print('модулей охвачено:',len(byMod))
print('\n=== примеры ===')
for a in atoms[:5]: print(f"  [{a['level']}] «{a['title'][:40]}» → {a['prompt'][:50]} | {a['options']} ci={a['correctIndex']} hb={a['handbookRef']}")
