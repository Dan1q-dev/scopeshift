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
DATE = "15 NOV 2026"
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
  'bottom': 'Practice teaches negotiation. Real Project helps apply it to work.',
  'note': 'ScopeShift helps freelancers stop giving away time without understanding the trade-off. Six extra '
          'hours on a fifteen-hundred-dollar project reduce revenue per hour from seventy-five dollars to '
          'fifty-seven sixty-nine. Practice lets people rehearse that conversation. Real Project helps them '
          'review an actual request, inspect evidence and prepare their own proposed response. Both modes '
          'are publicly available. Learn it. Apply it. Improve it.'},
 {'seconds': 25,
  'tag': 'THE PROBLEM',
  'title': 'Before pricing a request, understand it.',
  'intro': 'An extra request is not automatically extra paid work.',
  'cards': [('Included', ['Promised deliverables', 'Unused included revisions']),
            ('Unclear', ['Missing requirements', 'Conflicting or changed terms']),
            ('Outside scope', ['Clarify the requested change', 'Negotiate before committing'])],
  'bottom': 'A contract-analysis suggestion is not a legal conclusion or an accepted amendment.',
  'note': 'A request may already be included, may be an included correction, or may need a new scope '
          'agreement. Silence is not an exclusion. Our analysis separates included, excluded, unspecified '
          'and ambiguous work. It shows supporting quotations where available and asks the user to review '
          'them. The system does not decide legal rights or automatically make extra work billable.'},
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
  'tag': 'TWO PUBLIC MODES',
  'title': 'Learn it. Apply it. Improve it.',
  'intro': 'Connect negotiation practice with carefully reviewed project decisions.',
  'cards': [('Learn: Practice', ['Negotiate with a fictional client', 'See verified project consequences']),
            ('Apply: Real Project',
             ['Review pasted agreement and request', 'Estimate and draft proposed terms']),
            ('Improve: Replay', ['Review advice on your exact reply', 'Rewrite and compare two attempts'])],
  'bottom': 'Real Project links to fictional Practice. Real project text stays separate.',
  'note': 'Practice teaches negotiation with verified economic consequences. Results identifies a concrete '
          'reply and an observable practice focus. Improve this reply opens a separate attempt before that '
          'turn. The original stays available. The learner rewrites the response and sends it deliberately, '
          'then compares outcomes. Real Project applies the discipline to pasted agreement text, reviewed '
          'interpretations and user-entered estimates. Its Practice link opens the existing fictional '
          'scenario without transferring real project text. Independent evidence of learning gains and '
          'repeat value is still needed.'},
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
  'bottom': 'Get feedback. Rewrite a reply in Replay. Compare accepted outcomes.',
  'note': 'Here is the live practice loop. Booking for four hundred dollars and two more days is accepted: '
          'nineteen hundred dollars, twenty-six hours, day nine. Then propose nine hundred dollars for '
          'two-day acceleration. The client counters and the contract stays unchanged. In Results, the '
          'advice quotes that exact reply. Improve this reply opens a second attempt before it, preserving '
          'booking and the original attempt. Rewrite the offer to the one hundred fifty dollars the client '
          'previously offered, then press Send. If accepted, the second attempt becomes twenty-fifty, '
          'twenty-six hours, day seven. Both attempts are still in progress until the remaining request is '
          'resolved. The slide also shows complete paid and free routes with an equal four-hour scope swap. '
          'Free work can be a defensible decision; the lesson is to understand its consequences.'},
 {'seconds': 25,
  'tag': 'POSITIONING',
  'title': 'A focused workflow in an existing category.',
  'intro': 'AI negotiation practice and scope-management assistance already exist.',
  'cards': [('The Deep Brief', ['Client-scope roleplay', 'Expanding requests and pricing']),
            ('Human Dynamics', ['Scope-creep practice', 'Contract-term scenarios']),
            ('Our focus', ['Practice: verified economics', 'Real Project: reviewed proposals'])],
  'bottom': 'Two connected workflows. Learning gains and retention still need validation.',
  'sources': [('The Deep Brief', 'https://www.thedeepbrief.co.uk/practice/client_scope'),
              ('Human Dynamics', 'https://tryhumandynamics.com/scenarios/')],
  'note': 'Direct alternatives exist. The Deep Brief offers client-scope practice. Human Dynamics lists '
          'scope-creep and contract-term scenarios. Our focus combines practice with project economics and '
          "an evidence-review workflow for a freelancer's own situation. We do not claim category "
          'exclusivity, legal certainty or proven learning gains. The next step is testing whether this '
          'combination improves real decisions and brings freelancers back.'},
 {'seconds': 25,
  'tag': 'REAL PROJECT / PUBLIC DEMO',
  'title': 'Review evidence. Confirm. Then estimate.',
  'intro': 'Paste agreement and request. Review analysis. Estimate. Edit your response.',
  'cards': [('Review scope', ['Included, excluded or unclear', 'Inspect quotes and correct findings']),
            ('Calculate a proposal', ['$1,500 + $400 = $1,900', '20h + 6h = 26h / $73.08 per hour']),
            ('Prepare the response', ['Draft, edit, save and copy', 'Client acceptance remains separate'])],
  'bottom': 'Live AI path checked with fictional text. Text paste only. No legal conclusions.',
  'note': 'In our public acceptance check, one mixed request became five separate items. The agreed contact '
          'form was included, calendar synchronization was excluded, booking and extra pages were '
          'unspecified, and minor updates needed clarification. We corrected booking to ambiguous and '
          'selected it alone for a proposal. User-entered estimates of six hours and four hundred dollars '
          'produced nineteen hundred dollars over twenty-six hours. Twenty dollars of new expenses left '
          'three hundred eighty dollars of additional compensation after those expenses. The original '
          'contract stayed unchanged. We generated, edited, copied and reopened a proposed reply. This is '
          'planning assistance with human review, not legal advice or client acceptance.'},
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
  'intro': 'Beyond Horizon: learn safely, apply carefully, practice again.',
  'cards': [('Danila', ['Backend + simulation engine', 'OpenAI, integration and deployment']),
            ('Arsen', ['Frontend + user experience', 'Workspace, Replay and comparison']),
            ('Albina', ['Scenarios + evaluation', 'Quality checks and pitch'])],
  'bottom': 'Try both public modes at scopeshift.vercel.app.',
  'note': 'We are Beyond Horizon. Danila builds the backend and simulation engine. Arsen builds the user '
          'experience. Albina owns scenarios, evaluation and quality. Practice and Real Project are public. '
          'We have verified the practical workflow using fictional data and prepared additional contract '
          'cases for regression checks. Next we need independent freelancer testing, clearer contextual '
          'training and evidence of repeat value. Try the demo and challenge it with a request that is '
          'already included. Learn it. Apply it. Improve it.'}]

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
    c.setSubject("Business Cup 2.0 / Practice and Real Project public")
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
             "English ten-slide deck: Practice and Real Project are public. Real Project desktop acceptance was checked with fictional data on 15 November. The active Practice scenario remains the six-hour Sarah Mitchell project. Team: Danila, Arsen and Albina / Beyond Horizon. Prepared 15 November 2026. Total allocated time: 300 seconds. Rehearse to fit the speaker's actual pace.", ""]
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
              "AI interprets actions and writes constrained client dialogue. The engine checks agreements and computes project state. Booking field and reservation details are partly open; asking a question does not prove requirements were fully resolved. Saved attempts use an anonymous signed browser cookie and Postgres; loss of that cookie prevents recovery without an account. A shared daily AI quota limits the public demo.", "",
              "## Real Project demo limits", "",
              "Use fictional pasted text. PDF/DOCX/image upload and OCR are unavailable. Analysis requires source review and separate AI consent. User estimates determine proposed arithmetic. A generated draft, review confirmation or calculation never means client acceptance. The public Practice link opens the existing fictional scenario without real source text. Results provides targeted reply coaching; selection among additional practice scenarios is future work. Anonymous browser history is not cross-device recovery.", "",
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
