from app.extraction.text_layer import normalize_digits, parse_voter_page

# Excerpts of the raw text layer from SAMER-Ward No-005.pdf (garbled Hindi is expected).
PAGE_3 = """\
 पपचरजत चचनरर ननरररचक नरमररलल, 2026
हररतररलल कक ढरणल ,भगररनपचरर
नरम:
ललग:
मकरन सपखजर:
नपतर कर नरम:
आजच: 73 पचरष
41
मकघररज
लचचर
RJ/05/034/282246
Photo is
Available
 1
नरम:
ललग:
मकरन सपखजर:
पनत कर नरम:
आजच: 63 सल
41
बनररसल
खबबचनद
RJ/05/034/282249
Photo is
Available
 2
नरम:
ललग:
मकरन सपखजर:
नपतर कर नरम:
आजच: 37 पचरष
41
नपददकशयर हररतररल
खबबचनद
BZR1795418
Photo is
Available
 5
आजच 1 जनररल 2026 कक अनचसरर पतष सपखजर : 3 / 11
"""

PAGE_4_DELETED = """\
नरम:
ललग:
मकरन सपखजर:
नपतर कर नरम:
आजच: 74 पचरष
47
अमरदरन
भपरर दरन
RJM0898007
Photo is
Available
E 28
"""

PAGE_6_DEVANAGARI_HOUSE = """\
नरम:
ललग:
मकरन सपखजर:
नपतर कर नरम:
आजच: 18 सल
५१
नबमलर गचजरर
इपद लसह गचजरर
RJM2144079
Photo is
Available
 87
"""


def test_parses_old_and_new_epic_formats():
    records = parse_voter_page(PAGE_3)
    assert sorted(records) == [1, 2, 5]
    assert records[1].epic_no == "RJ/05/034/282246"
    assert records[5].epic_no == "BZR1795418"


def test_parses_age_gender_relation_house():
    records = parse_voter_page(PAGE_3)
    first, second = records[1], records[2]
    assert (first.age, first.gender, first.relation_type, first.house_no) == (73, "male", "father", "41")
    assert (second.age, second.gender, second.relation_type, second.house_no) == (63, "female", "husband", "41")


def test_detects_deletion_mark():
    record = parse_voter_page(PAGE_4_DELETED)[28]
    assert record.deletion_mark == "E"
    assert record.epic_no == "RJM0898007"


def test_normalizes_devanagari_house_number():
    record = parse_voter_page(PAGE_6_DEVANAGARI_HOUSE)[87]
    assert record.house_no == "51"
    assert record.deletion_mark is None


def test_normalize_digits():
    assert normalize_digits(" ६१ ") == "61"
