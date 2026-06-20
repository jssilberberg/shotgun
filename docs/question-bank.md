# Static movie question bank

This project uses `serverless/questions.generated.js` as the production-safe question bank.

To generate a larger bank from TMDB, run this locally from the repo root:

```bash
TMDB_API_KEY=your_key_here node scripts/generate-tmdb-question-bank.mjs
```

Useful options:

```bash
QUESTION_BANK_TARGET=1500 \
TMDB_DISCOVER_PAGES=40 \
TMDB_MIN_VOTE_COUNT=300 \
TMDB_REQUEST_DELAY_MS=300 \
TMDB_API_KEY=your_key_here \
node scripts/generate-tmdb-question-bank.mjs
```

The generator writes a JavaScript module at:

```txt
serverless/questions.generated.js
```

Commit that generated file after reviewing it:

```bash
git add serverless/questions.generated.js
git commit -m "Generate TMDB movie question bank"
git push
```

The live app imports that generated module through `serverless/shotgunGame.js`, so no TMDB API key is needed at runtime.

## Question templates currently generated

- Who directed `[movie]`?
- What year was `[movie]` released?
- In `[movie]`, which actor plays `[character]`?
- Which `[year]` film stars `[actor 1]` and `[actor 2]`?
- Who composed the music for `[movie]`? where available.

## Notes

- The generator deduplicates prompts.
- It skips adult/video titles.
- It uses popular English-language movies by default.
- It waits between requests and retries after TMDB rate-limit responses.
- The generated questions include TMDB source metadata for traceability.
