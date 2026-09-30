import pymupdf
import re
import json
import os
import shutil

doc = pymupdf.open("catalog.pdf")

code_re = re.compile(r"^[A-Z][0-9]{0,3}(\.[0-9]+){1,2}$")
qcode_re = re.compile(r"^([A-Z][0-9]{0,3})\.([0-9]+)\.([0-9]+)$")

OUT_IMG = "public/images"
if os.path.isdir(OUT_IMG):
    shutil.rmtree(OUT_IMG)
os.makedirs(OUT_IMG, exist_ok=True)


def is_f3(font):
    return "F3" in font


section_titles = {}
headings = {}
questions = []


def merge_boxes(boxes, tol=2):
    boxes = [list(b) for b in boxes]
    changed = True
    while changed:
        changed = False
        out = []
        while boxes:
            a = boxes.pop()
            merged = False
            for i, b in enumerate(out):
                if not (
                    a[2] < b[0] - tol
                    or b[2] < a[0] - tol
                    or a[3] < b[1] - tol
                    or b[3] < a[1] - tol
                ):
                    out[i] = [
                        min(a[0], b[0]),
                        min(a[1], b[1]),
                        max(a[2], b[2]),
                        max(a[3], b[3]),
                    ]
                    merged = True
                    changed = True
                    break
            if not merged:
                out.append(a)
        boxes = out
    return boxes


img_seq = 0

for page_index in range(doc.page_count):
    page = doc[page_index]
    d = page.get_text("dict")
    lines = []
    img_boxes = []
    for b in d["blocks"]:
        if b.get("type") != 0:
            continue
        for l in b["lines"]:
            spans = [s for s in l["spans"] if s["text"].strip()]
            if not spans:
                continue
            font = spans[0]["font"]
            text = "".join(s["text"] for s in l["spans"])
            x0, y0, x1, y1 = l["bbox"]
            s = text.strip()
            if "F4" in font:
                continue
            if s.startswith("Seite:"):
                continue
            if re.match(r"^[0-9]$", s) and x0 < 45:
                continue
            if re.match(r"^[0-9]{1,3}$", s) and y0 > 700:
                continue
            lines.append(
                {
                    "y0": y0,
                    "y1": y1,
                    "x0": x0,
                    "x1": x1,
                    "font": font,
                    "stripped": s,
                }
            )

    for ii in page.get_image_info(xrefs=False):
        img_boxes.append(list(ii["bbox"]))
    img_boxes = [b for b in merge_boxes(img_boxes) if (b[2] - b[0]) > 6 and (b[3] - b[1]) > 6]

    def is_heading(ln):
        s = ln["stripped"]
        if "F2" in ln["font"]:
            return True
        if re.match(r"^[A-Z]$", s):
            return True
        if code_re.match(s) and len(s.split(".")) == 2:
            return True
        return False

    # capture section titles like "A"
    for i, ln in enumerate(lines):
        if re.match(r"^[A-Z]$", ln["stripped"]):
            for j in range(i + 1, min(i + 3, len(lines))):
                if "F2" in lines[j]["font"]:
                    section_titles[ln["stripped"]] = lines[j]["stripped"]
                    break
        if code_re.match(ln["stripped"]) and len(ln["stripped"].split(".")) == 2:
            for j in range(i, min(i + 3, len(lines))):
                if "F2" in lines[j]["font"]:
                    headings[ln["stripped"]] = lines[j]["stripped"]
                    break

    qidx = [i for i, ln in enumerate(lines) if qcode_re.match(ln["stripped"])]

    page_questions = []
    for k, i in enumerate(qidx):
        code = lines[i]["stripped"]
        end = qidx[k + 1] if k + 1 < len(qidx) else len(lines)
        # stop at heading
        stop = end
        for j in range(i + 1, end):
            if is_heading(lines[j]):
                stop = j
                break
        body = lines[i + 1 : stop]
        if not body:
            continue
        qparts = [body[0]]
        j = 1
        while j < len(body):
            gap = body[j]["y0"] - body[j - 1]["y1"]
            if gap > 6:
                break
            qparts.append(body[j])
            j += 1
        rest = body[j:]
        question_text = " ".join(p["stripped"] for p in qparts).strip()

        correct_lines = []
        wrong_lines = []
        state = "correct"
        for ln in rest:
            if state == "correct" and is_f3(ln["font"]):
                correct_lines.append(ln)
            else:
                state = "wrong"
                wrong_lines.append(ln)
        correct = " ".join(l["stripped"] for l in correct_lines).strip()

        groups = []
        cur = []
        for ln in wrong_lines:
            cont = ln["x0"] > 100.5
            if cur and not cont:
                groups.append(cur)
                cur = [ln]
            else:
                cur.append(ln)
        if cur:
            groups.append(cur)
        wrong = [" ".join(l["stripped"] for l in g).strip() for g in groups]

        page_questions.append(
            {
                "code": code,
                "page": page_index,
                "q_y": lines[i]["y0"],
                "question": question_text,
                "correct": correct,
                "wrong": wrong,
                "answers_count": (1 if correct else 0) + len(wrong),
                "images": [],
            }
        )
    questions.extend(page_questions)

    # assign images on this page
    if page_questions and img_boxes:
        page_questions_sorted = sorted(page_questions, key=lambda q: q["q_y"])
        for bbox in img_boxes:
            iy = bbox[1]
            owner = None
            for q in page_questions_sorted:
                if q["q_y"] <= iy + 6:
                    owner = q
                else:
                    break
            if owner is None:
                owner = page_questions_sorted[0]
            img_seq += 1
            name = "%s_%d.png" % (owner["code"].replace(".", "-"), len(owner["images"]) + 1)
            clip = pymupdf.Rect(bbox)
            pix = page.get_pixmap(clip=clip, matrix=pymupdf.Matrix(2, 2), alpha=False)
            pix.save(os.path.join(OUT_IMG, name))
            owner["images"].append(name)

print("questions", len(questions))
bad = [q for q in questions if q["answers_count"] != 4 or not q["correct"] or len(q["wrong"]) != 3]
print("bad", len(bad))
for q in bad[:40]:
    print(q["code"], q["answers_count"], "|C:", q["correct"][:40], "|W:", [w[:30] for w in q["wrong"]])

data = {
    "meta": {
        "title": "MSVÖ Gesamt-Fragenkatalog Fahrtbereich 2",
        "source": "https://www.crew-tauern.at/fileadmin/user_upload/MSVOE_FB2_MS_Gesamtfragenkatalog_V01.PDF",
        "sections": section_titles,
        "chapters": headings,
    },
    "questions": questions,
}
json.dump(data, open("parsed.json", "w"), ensure_ascii=False, indent=1)
print("images", img_seq)
