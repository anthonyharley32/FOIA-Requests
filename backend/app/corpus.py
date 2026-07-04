"""Tiny curated corpus + naive keyword retrieval for the demo.

This is a deliberately small, hand-curated set of REAL, publicly available
facts about the JFK assassination records (all released via NARA under the
JFK Records Collection Act). It stands in for a full RAG pipeline for the
hackathon: retrieval is a simple keyword-overlap score over this in-memory
list -- no vector store, no embeddings -- but it is genuinely retrieval, and
every citation card's title/source/url comes from here (never from the model)
so citations can't be hallucinated.

To add topics later, append entries to DOCS with the same shape and the
retriever picks them up automatically.
"""

DOCS = [
    {
        "title": "Warren Commission Report (1964) — Summary and Conclusions",
        "source": "National Archives (NARA)",
        "url": "https://www.archives.gov/research/jfk/warren-commission-report",
        "text": (
            "The President's Commission on the Assassination of President Kennedy, "
            "known as the Warren Commission, concluded in 1964 that Lee Harvey Oswald "
            "acted alone in shooting President John F. Kennedy on November 22, 1963, "
            "firing three shots from the sixth floor of the Texas School Book Depository "
            "in Dallas. It found no evidence that Oswald or Jack Ruby was part of any "
            "conspiracy, domestic or foreign."
        ),
    },
    {
        "title": "House Select Committee on Assassinations (HSCA) Final Report (1979)",
        "source": "National Archives (NARA)",
        "url": "https://www.archives.gov/research/jfk/select-committee-report",
        "text": (
            "The HSCA reinvestigated the assassination and concluded that President "
            "Kennedy was 'probably assassinated as a result of a conspiracy,' based in "
            "part on disputed acoustic evidence suggesting a possible second shooter. "
            "The committee could not identify any other gunmen or the scope of the "
            "conspiracy, and its acoustic findings were later contested."
        ),
    },
    {
        "title": "President John F. Kennedy Assassination Records Collection Act of 1992",
        "source": "National Archives (NARA)",
        "url": "https://www.archives.gov/research/jfk/jfk-act",
        "text": (
            "Passed in the wake of public interest following Oliver Stone's film 'JFK,' "
            "the Act required all assassination-related records to be housed in a single "
            "NARA collection and released to the public, with limited postponements. It "
            "established the Assassination Records Review Board and set a target of full "
            "disclosure, with any continued withholding requiring periodic re-justification."
        ),
    },
    {
        "title": "2017–2018 NARA JFK Records Releases",
        "source": "National Archives (NARA)",
        "url": "https://www.archives.gov/research/jfk/release",
        "text": (
            "Beginning in October 2017, NARA released tens of thousands of previously "
            "classified JFK assassination documents. A subset was temporarily withheld "
            "or released with redactions at the request of agencies citing national "
            "security, law enforcement, and privacy concerns, subject to further review."
        ),
    },
    {
        "title": "2021–2023 NARA JFK Records Releases",
        "source": "National Archives (NARA)",
        "url": "https://www.archives.gov/research/jfk/release-2023",
        "text": (
            "Additional tranches of records were released in 2021, 2022, and 2023, "
            "bringing the great majority of the collection into full public view. NARA "
            "reported that roughly 99 percent of the documents in the collection were "
            "publicly available, with a small remainder still containing redactions."
        ),
    },
    {
        "title": "CIA Records on Oswald's September–October 1963 Mexico City Trip",
        "source": "National Archives (NARA)",
        "url": "https://www.archives.gov/research/jfk",
        "text": (
            "Released records document CIA monitoring of Lee Harvey Oswald's visit to "
            "Mexico City weeks before the assassination, including his contacts with the "
            "Cuban consulate and the Soviet embassy. These files have been a focus of "
            "researchers examining what U.S. intelligence knew about Oswald beforehand."
        ),
    },
    {
        "title": "Zapruder Film — Abraham Zapruder Home Movie of the Assassination",
        "source": "National Archives (NARA)",
        "url": "https://www.archives.gov/research/jfk/zapruder-film",
        "text": (
            "The 26-second color home movie filmed by Abraham Zapruder is the most "
            "complete visual record of the assassination. The original is preserved by "
            "NARA. Frame-by-frame analysis of the film has been central to nearly every "
            "investigation and independent study of the shooting."
        ),
    },
]

_STOPWORDS = {
    "the", "a", "an", "of", "on", "in", "to", "for", "and", "or", "is", "are",
    "was", "were", "about", "what", "who", "when", "where", "why", "how", "did",
    "do", "does", "any", "all", "records", "record", "document", "documents",
    "information", "info", "i", "me", "my", "you", "please", "regarding", "with",
}


def _tokens(text: str) -> list[str]:
    cleaned = "".join(c.lower() if c.isalnum() else " " for c in text)
    return [t for t in cleaned.split() if t and t not in _STOPWORDS]


def retrieve(query: str, k: int = 4) -> list[dict]:
    """Return up to k docs scored by keyword overlap with the query.

    Returns [] when nothing meaningfully overlaps (score 0) -- that's the
    signal the topic isn't in our public-records corpus, so the caller should
    fall back to helping the user file a FOIA request instead.
    """
    q = set(_tokens(query))
    if not q:
        return []
    scored = []
    for doc in DOCS:
        doc_tokens = set(_tokens(doc["title"] + " " + doc["text"]))
        score = len(q & doc_tokens)
        if score > 0:
            scored.append((score, doc))
    scored.sort(key=lambda pair: pair[0], reverse=True)
    return [doc for _, doc in scored[:k]]
