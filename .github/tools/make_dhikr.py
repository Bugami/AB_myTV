#!/usr/bin/env python3
"""assets/shared/dhikr.json: short adhkar for the screensaver's middle panel and the home screen, each cut word for
word (harakat included) out of the hadith that teaches it, in Sahih al-Bukhari or Sahih Muslim. Nothing is typed
by hand: below is only where to look (book, number) and, without harakat, the words to cut out.

  python3 .github/tools/make_dhikr.py            downloads the two books from fawazahmed0/hadith-api
  python3 .github/tools/make_dhikr.py DIR        or reads ara-bukhari.json / ara-muslim.json from DIR
"""
import json
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
URL = "https://raw.githubusercontent.com/fawazahmed0/hadith-api/1/editions/{}.min.json"
HARAKAT = re.compile("[ً-ْٰـ]")
BOOKS = {"ara-bukhari": "صحيح البخاري", "ara-muslim": "صحيح مسلم"}

# (edition, hadith number in that edition, the words without harakat)
PICKS = [
    ("ara-bukhari", 6406, "سبحان الله العظيم، سبحان الله وبحمده"),
    ("ara-bukhari", 6405, "سبحان الله وبحمده"),
    ("ara-bukhari", 6384, "لا حول ولا قوة إلا بالله"),
    ("ara-muslim", 5601, "سبحان الله والحمد لله ولا إله إلا الله والله أكبر"),
    ("ara-bukhari", 6307, "أستغفر الله وأتوب إليه"),
    ("ara-bukhari", 6403, "لا إله إلا الله، وحده لا شريك له، له الملك وله الحمد، وهو على كل شىء قدير"),
    ("ara-bukhari", 4563, "حسبنا الله ونعم الوكيل"),
]


def load(ed, folder):
    if folder:
        return json.loads((Path(folder) / f"{ed}.json").read_text(encoding="utf-8"))
    with urllib.request.urlopen(URL.format(ed), timeout=120) as r:
        return json.loads(r.read().decode("utf-8"))


def cut(text, words):
    """The words as the book writes them: matched without harakat, returned with them."""
    keep = [i for i, c in enumerate(text) if not HARAKAT.match(c)]
    bare = "".join(text[i] for i in keep)
    k = bare.find(HARAKAT.sub("", words))
    if k < 0:
        return None
    start, end = keep[k], keep[k + len(HARAKAT.sub("", words)) - 1] + 1
    while end < len(text) and HARAKAT.match(text[end]):
        end += 1
    return text[start:end]


def main():
    folder = sys.argv[1] if len(sys.argv) > 1 else None
    books = {}
    out = []
    digits = str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩")
    for ed, num, words in PICKS:
        if ed not in books:
            books[ed] = {h["hadithnumber"]: h for h in load(ed, folder)["hadiths"]}
        h = books[ed][num]
        text = cut(h["text"], words)
        if not text:
            sys.exit(f"!! «{words}» is not in {ed} {num}")
        # Muslim is cited by its Arabic numbering (2137), Bukhari's numbers are the same in both
        shown = str(h.get("arabicnumber") or num).split(".")[0]
        out.append({"text": text, "source": f"{BOOKS[ed]} · {shown.translate(digits)}"})
    path = ROOT / "assets/shared/dhikr.json"
    path.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {path.relative_to(ROOT)}: {len(out)} adhkar")


if __name__ == "__main__":
    main()
