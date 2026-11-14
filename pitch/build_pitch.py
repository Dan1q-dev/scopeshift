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
SLIDES = [
    {
        "seconds": 25, "tag": "BUSINESS CUP 2.0 / SKILLS", "title": "ScopeShift",
        "intro": "Stop working for free. Learn to negotiate.",
        "cards": [
            ("$75.00 / hour", ["$1,500 fixed fee", "20 estimated hours"]),
            ("$57.69 / hour", ["Same fee after free booking", "26 estimated hours: +6 hours"]),
        ],
        "bottom": "Practice the decision before a real client asks for more.",
        "note": "A website project starts at fifteen hundred dollars for twenty estimated hours: seventy-five dollars an hour. The client asks for booking. Add its six hours for free and the estimated rate becomes fifty-seven dollars and sixty-nine cents. ScopeShift lets freelancers practice that decision before the stakes are real.",
    },
    {
        "seconds": 25, "tag": "THE PROBLEM", "title": "A small request changes the whole deal.",
        "intro": "A contract captures the starting point. The next conversation changes it.",
        "cards": [
            ("Clarify", ["What does the client actually need?", "What is already included?"]),
            ("Choose", ["Price it, exchange scope,", "offer bounded goodwill or decline."]),
            ("Agree", ["Confirm scope, fee and date", "before making a commitment."]),
        ],
        "bottom": "Problem hypothesis: repeated practice can make these trade-offs clearer.",
        "note": "A small change is rarely only a price question. The freelancer has to understand the request, separate existing work from new work, choose a reasonable trade-off and agree on clear terms. Our hypothesis is that practicing those decisions is more useful than collecting another negotiation script. We have not yet established learning gains.",
    },
    {
        "seconds": 25, "tag": "INITIAL CUSTOMER", "title": "Start with fixed-fee web professionals.",
        "intro": "Initial audience hypothesis: US independent professionals aged 25-45.",
        "cards": [
            ("Relevant work", ["Website scope changes", "A visible budget and delivery date"]),
            ("Broad context", ["11.9 million independent contractors", "In their main job, July 2023"]),
        ],
        "bottom": "The BLS count is broad context, not our addressable market or a 2026 estimate.",
        "sources": [("BLS, released 8 Nov 2024", SOURCES["BLS"])],
        "note": "Our first learner is an independent web professional working on fixed-fee projects. The Bureau of Labor Statistics counted eleven point nine million independent contractors in their main job in July twenty twenty-three. That is broad context. It does not measure our age range, profession, demand or willingness to pay.",
    },
    {
        "seconds": 35, "tag": "WORKING PRODUCT", "title": "Free text in. Validated consequences out.",
        "intro": "One live scenario: Sarah Mitchell's website, three client requests.",
        "cards": [
            ("OpenAI", ["Interprets the learner's proposal", "Returns a validated action"]),
            ("Simulation engine", ["Decides acceptance and client replies", "Computes money, effort and dates"]),
            ("Replay + feedback", ["Try another decision", "Compare evidence and economics"]),
        ],
        "bottom": "Example: booking +$400 and +2 days gives $1,900 / 26h / day 9 / $73.08 per hour.",
        "note": "The learner answers in their own words. OpenAI extracts a structured action. The deterministic engine checks the scenario rules, decides the client's response and calculates accepted consequences. Client replies currently come from the engine, not unrestricted model generation. Only an accepted agreement changes the project. A booking offer of four hundred dollars and two extra days produces nineteen hundred dollars, twenty-six hours and delivery on day nine.",
    },
    {
        "seconds": 55, "tag": "DEMO / ACTIVE SIX-HOUR SCENARIO", "title": "One project. Two defensible outcomes.",
        "intro": "Start: $1,500 / 20h / day 7 / $75.00 per hour. Booking adds 6 hours.",
        "cards": [
            ("Paid path: $78.85 / hour", ["Booking: +$400, +2 days", "Rush: +$150, -2 days", "Gallery -> testimonials: equal 4h", "Final: $2,050 / 26h / day 7"]),
            ("Free path: $57.69 / hour", ["Booking: no extra fee or days", "Decline the earlier-delivery request", "Gallery -> testimonials: equal 4h", "Final: $1,500 / 26h / day 7"]),
        ],
        "bottom": "Replay the booking decision. Compare accepted outcomes, not promises.",
        "note": "Here is the active scenario. Start with fifteen hundred dollars, twenty hours and seven days. First propose booking for four hundred dollars and two more days. The client accepts: nineteen hundred dollars, twenty-six hours, day nine. Offer two-day acceleration for another hundred and fifty dollars. Finally exchange the four-hour gallery for the four-hour testimonials section. The result is twenty-fifty, twenty-six hours, day seven. Replay the booking decision and accept it for free. Decline acceleration, then make the same equal-effort swap. The result is fifteen hundred dollars for twenty-six hours. The simulator exposes the cost; it does not automatically call goodwill a mistake.",
    },
    {
        "seconds": 25, "tag": "POSITIONING", "title": "Connect the agreement to its economics.",
        "intro": "A focused learning workflow, not a claim that AI roleplay is new.",
        "cards": [
            ("Yoodli", ["Chat roleplay practice", "Coaching and rubric feedback"]),
            ("HoneyBook", ["Client workflows", "Contracts, invoices and payments"]),
            ("ScopeShift", ["Freelancer scope negotiation", "Validated outcomes + branching Replay"]),
        ],
        "bottom": "Our intended advantage must be tested with learners. No exclusivity claim.",
        "sources": [("Yoodli Help Center", SOURCES["Yoodli"]), ("HoneyBook FAQ", SOURCES["HoneyBook"])],
        "note": "Yoodli already provides chat roleplays with coaching and rubric feedback. HoneyBook supports real client workflows including contracts and payments. Our intended focus is freelancer scope negotiation connected to validated project economics and replay. These are adjacent products, not proof of an exclusive feature. We still need evidence that this specific learning workflow is useful.",
    },
    {
        "seconds": 25, "tag": "EVIDENCE-BASED FEEDBACK", "title": "Show what happened, and why it matters.",
        "intro": "Action, Rule and Verified evidence support practical next steps.",
        "cards": [
            ("Action", ["The learner proposes a defined", "booking addition or scope exchange."]),
            ("Rule", ["Apply only accepted, feasible", "changes to the active contract."]),
            ("Verified", ["Show the accepted amendment", "and recomputed project state."]),
        ],
        "bottom": "Missing evidence is unassessed. No overall skill percentage or personality score.",
        "note": "Feedback separates the learner's action, the applicable scenario rule and the verified outcome. It gives a practical next step. A question proves inquiry, not that every requirement was resolved. Missing evidence remains unassessed. We do not turn a partial rubric into an overall skill percentage. Next we must test transfer to a new scenario and voluntary replay.",
    },
    {
        "seconds": 25, "tag": "PRICING HYPOTHESES", "title": "Prove repeated value before charging.",
        "intro": "The first scenario is available now. Payments are not enabled.",
        "cards": [
            ("Free", ["First scenario", "No registration required", "Available now"]),
            ("$19 / pack", ["Focused scenario collection", "Planned one-time price", "Demand not validated"]),
            ("$9 / month", ["Future scenario library", "Planned subscription price", "Repeated use not established"]),
        ],
        "bottom": "These plans match the landing page. They are not revenue or willingness-to-pay evidence.",
        "note": "The first scenario is free and needs no account. The landing page shows two future pricing hypotheses: a nineteen-dollar scenario pack and a nine-dollar monthly library. Payments are not enabled. We will test completed purchases after free practice, while measuring whether people return. Stated interest alone will not count as paid demand.",
    },
    {
        "seconds": 30, "tag": "COMMERCIAL EXPERIMENT / ASSUMPTIONS", "title": "A testable funnel, not a market forecast.",
        "intro": "10,000 prospects x 20% start x 50% finish x 5% buy = 50 buyers.",
        "cards": [
            ("50 buyers", ["Every funnel rate is assumed", "Measure each step separately"]),
            ("$950 gross", ["50 packs x $19", "Not actual sales"]),
            ("$15.13 / pack", ["$19 - $0.87 - $2 - $1", "Before acquisition and fixed costs"]),
        ],
        "bottom": "Payment, usage and support costs are placeholders. Refunds, taxes and CAC are excluded.",
        "note": "This is a small proposed experiment, not a forecast. The assumed funnel yields fifty buyers and nine hundred fifty dollars in gross sales. Placeholder payment, usage and support costs leave fifteen dollars and thirteen cents per pack before acquisition and fixed costs. None is measured unit economics. We must observe real conversion, token usage, support effort and refunds before relying on it.",
    },
    {
        "seconds": 30, "tag": "BEYOND HORIZON / TEAM", "title": "Practice before the next client call.",
        "intro": "Working public demo: scopeshift.vercel.app",
        "cards": [
            ("Danila", ["Backend + simulation engine", "OpenAI, integration and deployment"]),
            ("Arsen", ["Frontend + user experience", "Workspace, Replay and comparison"]),
            ("Albina", ["Scenarios + evaluation", "Quality checks and pitch"]),
        ],
        "bottom": "Try a negotiation. Challenge the outcome. No paid-traction or learning-gain claim.",
        "note": "We are Beyond Horizon: Danila, Arsen and Albina. The public app is available at scopeshift dot vercel dot app, and the code is on GitHub. The current demo has one scenario, evidence feedback and saved anonymous attempts. There is no claim of paid traction or proven learning gains. Try a response you would actually send to a client, then challenge its consequences.",
    },
]

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
    c.setSubject("Business Cup 2.0 / Skills / verified active website scenario")
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
             "English ten-slide deck aligned with the active six-hour Sarah Mitchell scenario. Team: Danila, Arsen and Albina / Beyond Horizon. Prepared 14 November 2026. Total allocated time: 300 seconds. Rehearse to fit the speaker's actual pace.", ""]
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
