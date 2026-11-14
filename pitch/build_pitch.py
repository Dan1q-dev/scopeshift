"""Build the ten-slide ScopeShift PDF and its English speaker notes.

Requires ReportLab. Run with the bundled Codex Python or any Python containing it:
    python pitch/build_pitch.py
"""
from pathlib import Path
from html import escape
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "scopeshift-pitch.pdf"
PUBLIC = "https://scopeshift.vercel.app"
REPO = "https://github.com/Dan1q-dev/scopeshift"
DATE = "14 NOV 2026"
SOURCES = {
    "BLS": "https://www.bls.gov/news.release/archives/conemp_11082024.htm",
    "Yoodli": "https://support.yoodli.ai/en/articles/15862405-create-chat-based-roleplays",
    "HoneyBook": "https://www.honeybook.com/faqs",
}
SLIDES = [{'seconds': 25,
  'tag': 'BUSINESS CUP 2.0 / SKILLS',
  'title': 'ScopeShift',
  'intro': 'Learn it. Apply it. Improve it.',
  'cards': [('$75.00 / hour', ['$1,500 fixed fee', '20 estimated hours']),
            ('$57.69 / hour', ['Same fee after free booking', '26 estimated hours: +6 hours'])],
  'bottom': 'Skills is live. Real Project Mode is a planned extension.',
  'note': 'ScopeShift helps freelancers practice difficult scope conversations. Our next step connects '
          'practice to actual work: understand a client request, review its evidence and prepare a response. '
          'Learn it. Apply it. Improve it. Today Skills is live; Real Project Mode is being designed and has '
          'not yet been validated end to end.'},
 {'seconds': 25,
  'tag': 'THE PROBLEM',
  'title': 'Before pricing a request, understand it.',
  'intro': 'An extra request is not automatically extra paid work.',
  'cards': [('Included', ['Promised deliverables', 'Unused included revisions']),
            ('Unclear', ['Missing requirements', 'Conflicting or changed terms']),
            ('Outside scope', ['Clarify the requested change', 'Negotiate before committing'])],
  'bottom': 'A contract-analysis suggestion is not a legal conclusion or an accepted amendment.',
  'note': 'A client request may already be included, may be an included correction, or may be outside the '
          'agreed scope. Silence in a contract is not the same as an exclusion. The practical task is to '
          'establish what the documents say and what still needs clarification before discussing a price. We '
          'are designing Real Project Mode around that distinction.'},
 {'seconds': 25,
  'tag': 'INITIAL CUSTOMER',
  'title': 'Start with fixed-fee web professionals.',
  'intro': 'Initial audience hypothesis: US independent professionals aged 25-45.',
  'cards': [('Relevant work', ['Website scope changes', 'A visible budget and delivery date']),
            ('Broad context', ['11.9 million independent contractors', 'In their main job, July 2023'])],
  'bottom': 'The BLS count is broad context, not our addressable market or a 2026 estimate.',
  'sources': [('BLS, released 8 Nov 2024', 'https://www.bls.gov/news.release/archives/conemp_11082024.htm')],
  'note': 'Our first learner is an independent web professional working on fixed-fee projects. The Bureau of '
          'Labor Statistics counted eleven point nine million independent contractors in their main job in '
          'July twenty twenty-three. That is broad context. It does not measure our age range, profession, '
          'demand or willingness to pay.'},
 {'seconds': 35,
  'tag': 'PRODUCT LOOP / VERIFIED VS PLANNED',
  'title': 'Learn it. Apply it. Improve it.',
  'intro': 'Connect negotiation practice with carefully reviewed project decisions.',
  'cards': [('Learn: live', ['Skills simulations', 'Validated project consequences']),
            ('Apply: planned', ['Review a contract and request', 'Confirm findings and estimates']),
            ('Improve: planned', ['Recommend a relevant skill', 'Return to a synthetic practice'])],
  'bottom': 'The new contract-analysis workflow is not yet implemented or tested.',
  'note': 'Skills already lets the learner negotiate in natural language, reach an accepted agreement and '
          'compare economic outcomes. Real Project Mode is the planned application layer: review a contract '
          'and client request, inspect source evidence, confirm assumptions and draft a reply. A later '
          'opt-in handoff recommends a relevant synthetic exercise. None of the new workflow is claimed as '
          'shipped today.'},
 {'seconds': 55,
  'tag': 'DEMO / ACTIVE SIX-HOUR SCENARIO',
  'title': 'One project. Two defensible outcomes.',
  'intro': 'Start: $1,500 / 20h / day 7 / $75.00 per hour. Booking adds 6 hours.',
  'cards': [('Paid path: $78.85 / hour',
             ['Booking: +$400, +2 days',
              'Rush: +$150, -2 days',
              'Gallery -> testimonials: equal 4h',
              'Final: $2,050 / 26h / day 7']),
            ('Free path: $57.69 / hour',
             ['Booking: no extra fee or days',
              'Decline the earlier-delivery request',
              'Gallery -> testimonials: equal 4h',
              'Final: $1,500 / 26h / day 7'])],
  'bottom': 'Replay the booking decision. Compare accepted outcomes, not promises.',
  'note': 'Here is the active scenario. Start with fifteen hundred dollars, twenty hours and seven days. '
          'First propose booking for four hundred dollars and two more days. The client accepts: nineteen '
          'hundred dollars, twenty-six hours, day nine. Offer two-day acceleration for another hundred and '
          'fifty dollars. Finally exchange the four-hour gallery for the four-hour testimonials section. The '
          'result is twenty-fifty, twenty-six hours, day seven. Replay the booking decision and accept it '
          'for free. Decline acceleration, then make the same equal-effort swap. The result is fifteen '
          'hundred dollars for twenty-six hours. The simulator exposes the cost; it does not automatically '
          'call goodwill a mistake.'},
 {'seconds': 25,
  'tag': 'POSITIONING',
  'title': 'A focused workflow in an existing category.',
  'intro': 'AI negotiation practice and scope-management assistance already exist.',
  'cards': [('The Deep Brief', ['Client-scope roleplay', 'Expanding requests and pricing']),
            ('Human Dynamics', ['Scope-creep practice', 'Contract-term scenarios']),
            ('Our focus', ['Skills: validated economics', 'Real Project Mode: planned'])],
  'bottom': 'Our combined learning-to-application workflow still needs user validation.',
  'sources': [('The Deep Brief', 'https://www.thedeepbrief.co.uk/practice/client_scope'),
              ('Human Dynamics', 'https://tryhumandynamics.com/scenarios/')],
  'note': 'There are direct alternatives. The Deep Brief offers practice with client scope renegotiation. '
          'Human Dynamics lists scope-creep and contract-term scenarios. Our focus is linking verified '
          'project consequences to learning and, next, to a carefully confirmed practical workflow. We do '
          'not claim that no alternatives exist or that the future combination is already proven.'},
 {'seconds': 25,
  'tag': 'REAL PROJECT MODE / PLANNED',
  'title': 'Review evidence. Confirm. Then estimate.',
  'intro': 'Contract + client message -> analysis -> confirmation -> calculation -> draft reply.',
  'cards': [('Read the evidence', ['Included or excluded?', 'Unspecified or clarify?']),
            ('Confirm assumptions', ['User reviews findings', 'User confirms effort and rate']),
            ('Prepare a draft', ['Calculate a proposed quote', 'Client acceptance is separate'])],
  'bottom': 'Three fictional QA cases prepared. Live AI and the full flow await the API.',
  'note': 'We have prepared three fictional contracts and expected analyses. A website case separates '
          'promised email notifications from excluded booking and unspecified analytics. A design case '
          'protects an included revision from an automatic upsell. A writing case distinguishes an accepted '
          'amendment from an unaccepted quote. The user must confirm findings and estimation inputs. The '
          'output is a draft, not legal advice, a bill or a client agreement.'},
 {'seconds': 25,
  'tag': 'PRICING HYPOTHESES',
  'title': 'Prove repeated value before charging.',
  'intro': 'The first scenario is available now. Payments are not enabled.',
  'cards': [('Free', ['First scenario', 'No registration required', 'Available now']),
            ('$19 / pack', ['Focused scenario collection', 'Planned one-time price', 'Demand not validated']),
            ('$9 / month',
             ['Future scenario library', 'Planned subscription price', 'Repeated use not established'])],
  'bottom': 'Planned prices, not evidence of demand. Real Project Mode packaging is undecided.',
  'note': 'The first Skills scenario is free. The existing landing lists future hypotheses of nineteen '
          'dollars per scenario pack and nine dollars per month. Payments are not enabled. We have not '
          'decided how Real Project Mode would be packaged or priced. We must test useful repeat behavior '
          'and completed purchases rather than treating interest as paid demand.'},
 {'seconds': 30,
  'tag': 'COMMERCIAL EXPERIMENT / ASSUMPTIONS',
  'title': 'A testable funnel, not a market forecast.',
  'intro': '10,000 prospects x 20% start x 50% finish x 5% buy = 50 buyers.',
  'cards': [('50 buyers', ['Every funnel rate is assumed', 'Measure each step separately']),
            ('$950 gross', ['50 packs x $19', 'Not actual sales']),
            ('$15.13 / pack', ['$19 - $0.87 - $2 - $1', 'Before acquisition and fixed costs'])],
  'bottom': 'Payment, usage and support costs are placeholders. Refunds, taxes and CAC are excluded.',
  'note': 'This is a small proposed experiment, not a forecast. The assumed funnel yields fifty buyers and '
          'nine hundred fifty dollars in gross sales. Placeholder payment, usage and support costs leave '
          'fifteen dollars and thirteen cents per pack before acquisition and fixed costs. None is measured '
          'unit economics. We must observe real conversion, token usage, support effort and refunds before '
          'relying on it.'},
 {'seconds': 30,
  'tag': 'BEYOND HORIZON / TEAM',
  'title': 'Learn it. Apply it. Improve it.',
  'intro': 'Beyond Horizon: a live Skills demo and a clearly scoped next step.',
  'cards': [('Danila', ['Backend + simulation engine', 'OpenAI, integration and deployment']),
            ('Arsen', ['Frontend + user experience', 'Workspace, Replay and comparison']),
            ('Albina', ['Scenarios + evaluation', 'Quality checks and pitch'])],
  'bottom': 'Try the live Skills demo. Real Project Mode remains planned until verified.',
  'note': 'We are Beyond Horizon: Danila, Arsen and Albina. Our public Skills demo works today. We have '
          'prepared a fictional quality corpus and acceptance rules for Real Project Mode; backend contracts '
          'and end-to-end validation are still pending. Our next proof is that freelancers can review a real '
          'situation, make an informed decision and practice the skill they need. Learn it. Apply it. '
          'Improve it.'}]

W, H = 960, 540
BG, CARD, WHITE, MUTED, MINT, LINE = [HexColor(c) for c in ("#0d1b25", "#1a303c", "#f2f5f4", "#b6c4cb", "#a6ed90", "#3a4b55")]


def paragraph(c, text, x, top, width, size=16, color=MUTED, bold=False, max_height=None):
    style = ParagraphStyle("slide", fontName="Helvetica-Bold" if bold else "Helvetica", fontSize=size,
                           leading=size * 1.3, textColor=color, spaceAfter=0)
    p = Paragraph(escape(text), style)
    _, height = p.wrap(width, 1000)
    if max_height is not None and height > max_height:
        raise ValueError(f"Text overflows allocated area: {text}")
    p.drawOn(c, x, top - height)
    return height


def build_pdf():
    c = canvas.Canvas(str(OUTPUT), pagesize=(W, H), pageCompression=1)
    c.setTitle("ScopeShift | Beyond Horizon | Public demo pitch")
    c.setAuthor("Beyond Horizon: Danila, Arsen, Albina")
    c.setSubject("Business Cup 2.0 / Skills live / Real Project Mode planned")
    for index, slide in enumerate(SLIDES, 1):
        c.setFillColor(BG)
        c.rect(0, 0, W, H, fill=1, stroke=0)
        paragraph(c, slide["tag"], 54, 498, 852, 10, MINT, True, 18)
        paragraph(c, slide["title"], 54, 454, 852, 32, WHITE, True, 84)
        paragraph(c, slide["intro"], 54, 369, 852, 17, MUTED, max_height=48)
        cards = slide["cards"]
        gap, y, h = 18, 126, 176
        width = (852 - gap * (len(cards) - 1)) / len(cards)
        for card_index, (heading, lines) in enumerate(cards):
            x = 54 + card_index * (width + gap)
            c.setFillColor(CARD)
            c.roundRect(x, y, width, h, 12, fill=1, stroke=0)
            paragraph(c, heading, x + 18, y + h - 20, width - 36, 20, MINT, True, 56)
            top = y + h - 66
            for text in lines:
                used = paragraph(c, text, x + 18, top, width - 36, 14.5, MUTED, max_height=42)
                top -= used + 5
            if top < y + 8:
                raise ValueError(f"Card content exceeds bounds on slide {index}")
        paragraph(c, slide["bottom"], 54, 101, 852, 14, WHITE, max_height=39)
        for source_index, (label, url) in enumerate(slide.get("sources", [])):
            sx = 54 + source_index * 250
            c.setFillColor(MUTED)
            c.setFont("Helvetica", 8.5)
            c.drawString(sx, 58, "Source: " + label + " (14 Nov 2026)")
            c.linkURL(url, (sx, 55, sx + 240, 68), relative=0, thickness=0)
        c.setStrokeColor(LINE)
        c.line(54, 46, 906, 46)
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 8)
        c.drawString(54, 27, "SCOPESHIFT / BEYOND HORIZON")
        c.drawCentredString(480, 27, "scopeshift.vercel.app | " + DATE)
        c.linkURL(PUBLIC, (350, 20, 610, 37), relative=0, thickness=0)
        c.setFillColor(MINT)
        c.drawRightString(906, 27, f"{index:02d}")
        if index == 10:
            c.linkURL(REPO, (54, 20, 250, 37), relative=0, thickness=0)
        c.showPage()
    c.save()


def build_notes():
    lines = ["# ScopeShift - five-minute pitch", "",
             "Current public app: https://scopeshift.vercel.app. Repository: https://github.com/Dan1q-dev/scopeshift.", "",
             "English ten-slide expansion deck: Skills is live; Real Project Mode is planned, awaiting API and end-to-end verification. The active Skills scenario remains the six-hour Sarah Mitchell project. Team: Danila, Arsen and Albina / Beyond Horizon. Prepared 14 November 2026. Total allocated time: 300 seconds. Rehearse to fit the speaker's actual pace.", ""]
    for i, slide in enumerate(SLIDES, 1):
        lines += [f"## {i}. {slide['title']} - {slide['seconds']} seconds", "", "On slide: " + slide["intro"], ""]
        for heading, details in slide["cards"]:
            lines += ["- **" + heading + ":** " + "; ".join(details) + "."]
        lines += ["", slide["bottom"], "", "Say: " + slide["note"], ""]
        for label, url in slide.get("sources", []):
            lines += [f"Source: [{label}]({url}), checked 14 November 2026.", ""]
    lines += ["## Demo cues and limits", "",
              "Use the public app, not a canned conversation. The active baseline is $1,500 / 20h / day 7. Booking is a six-hour addition. The paid booking step is $1,900 / 26h / day 9; the full paid path is $2,050 / 26h / day 7. A free booking path with declined rush and equal-effort swap is $1,500 / 26h / day 7. The gallery and testimonials are both four-hour items.", "",
              "Optional named exchange: contact form + portfolio gallery replaced by booking gives $1,500 / 18h / day 7 / $83.33 per hour. Do not use the archived four-hour booking or separate About-page draft for the live demo.", "",
              "OpenAI interprets actions. The engine forms client replies, checks agreements and computes project state. Booking field and reservation details are partly open; asking a question does not prove requirements were fully resolved. Saved attempts use an anonymous signed browser cookie and Postgres; loss of that cookie prevents recovery without an account. A shared daily AI quota limits the public demo.", "",
              "## Commercial and research caveats", "",
              "The BLS statistic is dated July 2023 and covers main-job independent contractors. It is not a 2026 forecast or a count of our exact target segment. Do not multiply it by price to claim TAM. Competitor descriptions establish adjacent categories, not a feature-exclusivity audit. Pricing, acquisition rates and costs are hypotheses. No interviews, paid demand, retention or measured learning gains are claimed.", "",
              "Illustrative contribution math: $19 - (3% x $19 + $0.30) - $2 usage - $1 support = $15.13 before acquisition and fixed costs. These are assumptions, not processor quotes or measured OpenAI costs. Refunds, taxes and fraud are excluded.", "",
              "Technical evidence and deployment limits: ../docs/PUBLIC_DEPLOYMENT.md. Final combined-branch checks are recorded separately by the captain; this deck does not claim an uncompleted CI or E2E run.", ""]
    (ROOT / "storyline.md").write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    assert len(SLIDES) == 10 and sum(s["seconds"] for s in SLIDES) == 300
    for slide in SLIDES:
        assert all(ord(ch) < 128 for ch in str(slide)), "Use ASCII punctuation in the deck source."
    build_pdf()
    build_notes()
    print("Built ten-slide PDF and five-minute speaker notes.")
