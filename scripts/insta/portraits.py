"""AI profile portraits for the reel-imported characters, in the Techy-Tech headshot look.
python portraits.py [id ...]   -> scripts/insta/work/portraits/<id>.jpg (4 at a time)"""
import os, sys, subprocess, json
from concurrent.futures import ThreadPoolExecutor
os.chdir('C:/workspace/BoostMind')
OUT = 'scripts/insta/work/portraits'
os.makedirs(OUT, exist_ok=True)

STYLE = ("Photorealistic studio headshot for a profile page: head and shoulders, centered, looking straight into the camera, "
         "eyes open, plain seamless light-grey studio background, soft even studio light, sharp focus, natural skin texture. "
         "This is a comedy character, so keep his funny look - the hair, glasses, facial hair and the face that makes people laugh - "
         "but as a believable real person: the hair is his own natural hair and nothing looks like a costume or a disguise. "
         "The reference is a low-quality phone selfie with a face filter: ignore the filter's distortions (stretched nose or chin, "
         "huge eyes, warped mouth) and the bad framing. No text, no logos, no brand names on clothes.")

C = {  # id: (description, ref)
 'alex-daniel': ("A confident motivational relationship coach in his late 30s: short dark hair, trimmed beard, thin red-framed glasses, "
                 "light blue button-down shirt, a thin skin-coloured headset microphone along his cheek. Warm, self-assured half smile.", None),
 'alon': ("A success-tips mentor in his late 30s: short brown hair, light stubble, dark burgundy hoodie. Calm, earnest face of a man "
          "about to share 'one small thing I always do'.", None),
 'asaf': ("Asaf, the annoying friend who can't be happy for you, around 40: baseball cap (white front, black brim), thin glasses, "
          "ginger-brown beard, mustard-yellow tank top. A sceptical, unimpressed half-squint.", None),
 'avram': ("Avram, an Ashkenazi Israeli dad around 50: completely bald, thin glasses with red frames, short grey stubble, an old-fashioned dad's short-sleeved checked button-down shirt (or a faded old polo), buttoned up.  The stubborn 'I'm fine, I don't need water' smile.", None),
 'bennett': ("A politician in his early 50s giving a speech: bald, clean-shaven, crisp white shirt, a little Israeli flag pin. "
             "Statesman's confident smile.", None),
 'danny-buller': ("A popular-science explainer in his mid 30s: messy brown hair, light stubble, light mint-green t-shirt. "
                  "Curious, slightly smug 'there is a scientific explanation for this' look.", None),
 'dor-eckstein': ("A pseudo-scientific fitness guru around 40: bald head, a very long, full, bushy brown beard down to the chest, "
                  "grey hoodie. Intense, totally self-convinced stare.", None),
 'esther': ("Esther, a strict school principal around 60, a woman: short grey hair, round green-framed glasses, olive-green zip "
            "hoodie. Lips pressed, eyebrows up - the principal who demands total silence. Smooth, clean-shaven feminine face - no beard, no stubble, no beard shadow; no marks on the face.", None),
 'genz': ("A Gen Z supermarket cashier, a young woman around 20: straight black bob with bangs, plain black t-shirt, phone in hand. Blank, bored stare. Smooth, clean-shaven feminine face - no beard, no stubble, no beard shadow; no marks on the face.", None),
 'gym-guy': ("A gym guy around 40: bald, dark beard, glasses, black sleeveless gym shirt, muscular arms. Loud, excited "
             "face, mouth half open mid-sentence.", None),
 'ksp-seller': ("A cute, chatty Israeli salesman ('ars' style) in his mid 30s: red baseball cap with a blue brim, short dark beard, "
                "light grey zip-up track jacket, a gold chain. Big friendly grin - talkative and warm. IMPORTANT: the reference has a cartoon 'googly eyes' filter - give him normal, natural human eyes of normal size, a real face with no filter at all.", None),
 'lior-slime': ("A spiritual life coach in his 40s: curly ginger hair, light stubble, white t-shirt, a small clip-on microphone. "
                "Wide-eyed, enthusiastic, slightly too intense smile.", None),
 'lola': ("Lola, a Filipina caregiver in her 30s, a woman: straight black bob with bangs, black zip-up track jacket. "
          "Sweet, patient, cheerful smile. Smooth, clean-shaven feminine face - no beard, no stubble, no beard shadow; no marks on the face.", None),
 'matan': ("A futurist influencer in his mid 30s: grey knit beanie, short beard, dark sweater. Calm, very sure of his predictions "
           "about AI and Mars.", None),
 'naor-zion': ("A stand-up comedian in his 40s: beige baseball cap, glasses, short beard, white tank top, sitting in a car at night "
               "(soft dark car interior instead of the grey studio background is fine). About-to-get-annoyed face.", None),
 'neighbor': ("The annoying neighbour, around 55: bald, thick glasses, grey mustache and beard, white tank top. Furious, outraged "
              "glare - he heard someone drilling at 10:34 on a Monday.", None),
 'nephew': ("The nephew, a mischievous young kid (keep the face of the person in the reference): black baseball cap, glasses, black tank top, a jar of gummy candy. Huge silly open-mouthed laugh.", None),
 'news-anchor': ("The evening-news TV anchor: big curly ginger hair, dark suit jacket, white shirt. Grave, professional news face.", None),
 'oded': ("A basketball coach around 50: bald, light stubble, dark navy shirt. Serious post-game press-conference face.", None),
 'omer-koli': ("A food-and-feelings guy in his late 30s: round thin glasses, short hair, black hoodie. Calm, self-aware, a little "
               "emotional.", None),
 'rosenblum': ("Teacher Rosenblum, an old-school school teacher aged 55-60 (not older, not younger: some grey in the stubble, smile lines around the eyes): bushy grey hair, metal-framed glasses, short "
               "greying stubble, dark polo shirt. Standing in front of a green classroom chalkboard instead of the grey background. "
               "Looking over his glasses at the camera with a patient, slightly passive-aggressive teacher's look; his funny face stays.",
               'scripts/insta/work/17872433931225922/f1.jpg'),
 'savta': ("Grandma, an Israeli grandmother around 80, a woman: curly grey hair, thin glasses with red temples, red lipstick, "
           "grey zip jacket. A polite smile with suspicious eyes - she is sure her caregiver is up to something. Smooth, clean-shaven feminine face - no beard, no stubble, no beard shadow; no marks on the face.", None),
 'yotam-zamri': ("A right-wing TV pundit in his 40s: curly light-blond hair, clean-shaven, white shirt. Wide-eyed, passionate "
                 "'you know what the left really plans' look.", None),
 'yuval': ("A celebrated author and keynote thinker in his late 40s: bald, glasses, short dark beard, dark shirt with a small lapel microphone. Lecturing face, one eyebrow raised.", None),
 'ami': ("Ami, an Israeli poker gambler in his late 30s at a casino abroad: a white-and-black baseball cap with a basketball-team look (no readable logo), thin glasses, short brown beard, black hoodie. "
         "Background: a softly blurred casino with slot machines and warm lights instead of the grey studio. A cocky, sure-of-himself half smile - 'I was 5-6 up'.", None),
 'oren': ("Oren, Ami's friend at the casino, late 30s: black knit beanie, thin glasses with red temples, short ginger-brown beard, black hoodie. "
          "Background: a softly blurred casino with slot machines and warm lights instead of the grey studio. A sceptical grin - 'so how much did you actually lose?'", None),
 'unbearable': ("A condescending woman colleague at a high-tech company, late 30s: long curly ginger hair, white cat-eye sunglasses pushed up on her head, big silver hoop earrings, black top. Smooth, clean-shaven feminine face - no beard, no stubble, no beard shadow. A patronising, fake-patient smile with raised eyebrows.", None),
 'miriam': ("Miriam, a medical clinic secretary in her 50s, a woman: wild spiky grey hair, bright red lipstick, purple eyeshadow, mustard-yellow top under a black cardigan. Smooth, clean-shaven feminine face - no beard, no stubble, no beard shadow. A kind, confused, slightly lost look - 'it won't let me'. Background: a softly blurred clinic reception instead of the grey studio.", None),
 'yudit': ("Yudit, an Israeli grandmother around 65, a woman: short neatly styled silver-grey hair, red cat-eye glasses with a thin chain, light top. Smooth, clean-shaven feminine face - no beard, no stubble, no beard shadow. A sweet smile with a hint of judgement - the grandma who criticises her daughter through the grandson.", None),
 'ksp-russian': ("A silent Russian computer-store salesman in his late 30s: burgundy baseball cap, clear-framed glasses, full brown beard, plain grey tank top. Deadpan, unimpressed, slightly bored face. Background: a softly blurred bright computer store instead of the grey studio.", None),
 'jeweler': ("A saleswoman at a luxury jewellery shop, a woman in her late 50s: blond-grey bob haircut with a fringe, clear-framed glasses, elegant black top, a delicate gold necklace. Smooth, clean-shaven feminine face - no beard, no stubble, no beard shadow. A polite, slightly condescending saleswoman's smile. Background: a softly blurred luxury jewellery shop with glass display cases instead of the grey studio.", None),
 'dr-samer': ("Dr. Samer, a friendly Arab-Israeli doctor in his late 30s at an urgent-care clinic: bald, rectangular glasses, short dark beard, white doctor's coat, a stethoscope around his neck, holding a coffee mug. A big, relaxed, warm smile - in no hurry at all. Background: a softly blurred clinic corridor instead of the grey studio. No logos.", None),
 'omer-student': ("Omer, a cheeky Israeli high-school student about 18 working a summer job as a kayak guide: red baseball cap, glasses, short dark beard, neon-yellow safety vest over an orange tank top. A confident, cheeky grin - 'no insurance, yalla, into the water'. Background: a softly blurred green river in the north of Israel with kayaks instead of the grey studio. No logos.", None),
 'feiglin': ("A thoughtful Israeli politician in his 60s giving a situation update: glasses, short grey beard, white button-down shirt. Calm, philosophical, slightly smug expression. Background: a softly blurred wooden library with warm lamps instead of the grey studio.", None),
 'avi-shushan': ("A warm Israeli podcast interviewer in his 40s: bald head, full dark beard, colourful pink-and-yellow gradient shirt, small lapel microphone. Friendly, empathetic, curious expression. Background: a softly blurred dark podcast studio with warm light instead of the grey studio. No portraits of real people in the background.", None),
 'shuki': ("Shuki, an Israeli real-estate agent in his late 40s showing an apartment: bald, glasses with red frames, short greying beard, white shirt. A big, confident salesman's smile - 'a bonbonniere, you just need to get to know it'. Background: a softly blurred old apartment with worn kitchen cabinets instead of the grey studio.", None),
 'hatzroni': ("Professor Hatzroni, a smug Israeli academic and social-media personality in his 50s: long curly ginger hair, dark sleeveless top, a condescending half smile with raised chin and eyebrows. Background: a softly blurred book-lined university office instead of the grey studio.", None),
 'rina': ("Rina, a grumpy dental-clinic receptionist, a woman around 60: messy brown hair, glasses, slightly crooked teeth, light-blue sleeveless top. Smooth, clean-shaven feminine face - no beard, no stubble, no beard shadow. An irritated, impatient 'one second, let me see' face. Background: a softly blurred clinic reception with a blue-and-green wall and a plant instead of the grey studio.", None),
 'night-guy': ("A strange, overly friendly Israeli guy in his 40s talking to a stranger on a city street at night: bald, glasses, dark beard, black t-shirt. An innocent-looking, slightly unsettling friendly smile. IMPORTANT: the reference is warped by a face filter (a stretched, wide lower face) - give him a normal human face with natural proportions, a normal-size trimmed beard. Background: a softly blurred city street at night with lit apartment towers instead of the grey studio.", None),
 'eisenkot': ("A cautious Israeli politician in his 60s giving a statement: short grey-blond hair, short grey beard, dark polo shirt. A serious, statesmanlike, slightly blank expression. Background: a plain blue party backdrop with no text instead of the grey studio.", None),
 'yinon-magal': ("An excited Israeli TV news pundit in his 50s: curly grey-blond hair, short beard, light shirt. A dramatic, urgent 'we are heading for an event' expression. Background: a softly blurred TV studio with red and blue lights instead of the grey studio. No logos or text.", None),
 'mordechai-david': ("A loud Israeli street activist in his 40s shouting at the camera: dark baseball cap, short beard, grey tank top. A fierce, fired-up expression. Background: a softly blurred sea strait with cargo ships instead of the grey studio. No logos or text.", None),
}

def run(cid):
    desc, extra = C[cid]
    d = f'zoomcut/characters/{cid}/'
    ref = (d + 'frame.jpg' if os.path.exists(d + 'frame.jpg') else d + 'portrait.jpg') + (',' + extra if extra else '')
    p = f'{OUT}/{cid}.txt'
    open(p, 'w', encoding='utf8').write(STYLE + '\n\n' + desc)
    r = subprocess.run(['node', 'zoomcut/tools/leonardo.mjs', 'portrait', ref, p, f'{OUT}/{cid}.jpg', 'flare', 'MEDIUM', '0.6', '1024x1024'],
                       capture_output=True, text=True, encoding='utf8', errors='replace')
    line = (r.stdout + r.stderr).strip().splitlines()
    ok=[l for l in line if 'OK' in l or 'fail' in l or 'Error' in l]
    return f'{cid}: {ok[-1] if ok else line[-3:]}'

ids = sys.argv[1:] or list(C)
with ThreadPoolExecutor(4) as ex:
    for res in ex.map(run, ids):
        print(res, flush=True)
