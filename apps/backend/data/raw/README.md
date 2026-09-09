# Raw source data (backend)

This directory holds **unprocessed** source materials for the GATE CS & IT
question bank. Files here are inputs to the question-parsing/ingestion
pipeline (not yet implemented) and should be treated  as immutable reference
data — never edit the PDFs in place.

## Layout

```
apps/backend/data/raw/
└── CS/                    # GATE Computer Science PYQ PDFs (one per exam paper)
    ├── 2007_CS.pdf
    ├── 2008_CS.pdf
    ├── ...
    └── 2026_CS2.pdf
```

File naming convention: `<year>_CS<n>.pdf`, where the optional numeric suffix
(`1`, `2`) disambiguates multiple sessions/papers in the same year.

## Usage in code

Prefer resolving paths relative to this package (e.g.
`path.join(process.cwd(), "apps/backend/data/raw")` from the repo root when
running via the npm workspace, or `path.resolve(__dirname, "../../data/raw")`
from compiled `src/` code) instead of hard-coding absolute paths. Parsed output
belongs in the database (via Prisma) or in a non-committed working directory —
never alongside these raw inputs.
