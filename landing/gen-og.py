from PIL import Image, ImageDraw, ImageFont
W,H=1200,630
paper=(243,245,244); surface=(255,255,255); ink=(28,35,33); ink2=(70,81,77); ink3=(92,104,100)
accent=(199,67,29); line=(223,228,226)
cefr=[("A0",(14,124,110)),("A1",(46,158,107)),("A2",(124,162,60)),("B1",(184,129,31)),("B2",(220,106,38)),("C1",(199,67,29)),("C2",(162,47,75))]
F="/usr/share/fonts/truetype/dejavu/"
serifB=lambda s: ImageFont.truetype(F+"DejaVuSerif-Bold.ttf", s)
sansB=lambda s: ImageFont.truetype(F+"DejaVuSans-Bold.ttf", s)
sans=lambda s: ImageFont.truetype(F+"DejaVuSans.ttf", s)
monoB=lambda s: ImageFont.truetype(F+"DejaVuSansMono-Bold.ttf", s)

img=Image.new("RGB",(W,H),paper); d=ImageDraw.Draw(img)
# верхняя тонкая акцентная полоса
d.rectangle([0,0,W,8],fill=accent)
PAD=72
# логотип
d.rounded_rectangle([PAD,56,PAD+60,116],radius=14,fill=accent)
lf=serifB(38); tb=d.textbbox((0,0),"И",font=lf); d.text((PAD+30-(tb[2]-tb[0])/2,86-(tb[3]-tb[1])/2-tb[1]),"И",font=lf,fill=(255,255,255))
d.text((PAD+78,72),"Инглиш в ТГ",font=sansB(30),fill=ink)
# бейдж справа
bt="TELEGRAM MINI APP"; bf=monoB(20); bw=d.textbbox((0,0),bt,font=bf)[2]
d.rounded_rectangle([W-PAD-bw-32,70,W-PAD,110],radius=20,outline=line,width=2)
d.text((W-PAD-bw-16,80),bt,font=bf,fill=ink3)
# заголовок (serif)
hf=serifB(66)
d.text((PAD,190),"Английский от A0 до C2",font=hf,fill=ink)
# вторая строка с акцентом на Telegram
y2=272
pre="прямо в "; d.text((PAD,y2),pre,font=hf,fill=ink)
pw=d.textbbox((0,0),pre,font=hf)[2]
d.text((PAD+pw,y2),"Telegram",font=hf,fill=accent)
# подзаголовок
sf=sans(28)
d.text((PAD,378),"554 урока · аудирование · справочник и словарь с озвучкой",font=sf,fill=ink2)
# CEFR-полоска
bx=PAD; by=470; seg=(W-2*PAD)/7; bh=64
for i,(nm,col) in enumerate(cefr):
    x0=bx+i*seg
    r=[x0+3,by,x0+seg-3,by+bh]
    d.rounded_rectangle(r,radius=12,fill=col)
    cf=monoB(26); cb=d.textbbox((0,0),nm,font=cf)
    d.text((x0+seg/2-(cb[2]-cb[0])/2,by+bh/2-(cb[3]-cb[1])/2-cb[1]),nm,font=cf,fill=(255,255,255))
# низ: домен + бесплатно
d.text((PAD,566),"englishintg.ru",font=monoB(24),fill=ink3)
fr="Начни бесплатно"; ff=sansB(24); fw=d.textbbox((0,0),fr,font=ff)[2]
d.rounded_rectangle([W-PAD-fw-40,558,W-PAD,600],radius=21,fill=accent)
d.text((W-PAD-fw-20,566),fr,font=ff,fill=(255,255,255))
img.save("/tmp/claude-1000/-home-alex/46f75a9b-6b1b-4e98-b2be-ab12cf86a018/scratchpad/og.png","PNG")
print("OG сгенерирован:", img.size)
