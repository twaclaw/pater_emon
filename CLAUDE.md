# CLAUDE.md

A Quarto book of the Lord's Prayer in eight languages, published to GitHub
Pages, with a print PDF built from the same sources.

## Layout

| Path | What it is |
|---|---|
| [_quarto.yml](_quarto.yml) | formats, chapter order, theme |
| [chapters/](chapters/) | one `.qmd` per language, plus `sources.qmd` |
| [assets/prayer.lua](assets/prayer.lua) | expands `.prayer` blocks; prunes the PDF |
| [assets/prayer.tex](assets/prayer.tex) | print styling for the prayer blocks |
| [assets/js/audio.js](assets/js/audio.js) | playback + line highlighting |
| [assets/js/prayer.js](assets/js/prayer.js) | transliteration toggle |
| [assets/css/prayer.scss](assets/css/prayer.scss) | web styling, both themes |

```sh
quarto render            # both formats into _book/
quarto render --to html
quarto render --to pdf   # needs LuaLaTeX + tlmgr install ebgaramond
quarto preview
```

## Adding a language

This is the common task and it should stay a five-minute job. Nothing below
needs code changes.

**1. Get the text from Wikipedia, not from memory.** Fetch the raw wikitext so
the words are exact:

```sh
curl -s -H "User-Agent: lords-prayer-quarto/1.0" \
  "https://LL.wikipedia.org/w/api.php?action=parse&page=PAGE&prop=wikitext&format=json&formatversion=2" \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['parse']['wikitext'])"
```

Prefer the article in that language's own Wikipedia — it carries the
liturgical text and the confessional variants, which the English article does
not.

**2. Write `chapters/<language>.qmd`.** One `# Language` heading, then a
`.prayer` block per version, one petition per line:

```markdown
::: {.prayer lang="it" speech="it-IT" #it-cei}
| Padre nostro, che sei nei cieli,
| sia santificato il tuo nome,
:::
```

- `lang` — BCP 47 tag for the text. Used for HTML semantics; dropped for LaTeX
  on purpose (see below).
- `speech` — BCP 47 tag for speech synthesis. **This alone gives the chapter a
  Listen button and line-by-line highlighting.** Nothing else to configure.
- `#id` — prefixes the generated per-verse ids (`#it-cei-v1`, …).
- `.variant` on a secondary version, for the smaller type.

**3. Non-Latin scripts get a transliteration.** Mark the line `{.tr}` and it
attaches to the line above:

```markdown
| πάτερ ἡμῶν ὁ ἐν τοῖς οὐρανοῖς
| [páter hēmôn ho en toîs ouranoîs]{.tr}
```

A block with no `.tr` lines gets no toggle button, so Latin-script chapters
stay uncluttered. Say in the chapter what the transliteration targets:
Ancient Greek romanises the *spelling*, Modern Greek the *sound*, and the two
disagree on the same letters.

**4. Add it to `book.chapters` in [_quarto.yml](_quarto.yml).** The order is
deliberate: source languages first (Ancient Greek, Modern Greek, Latin), then
the vernaculars. It is not alphabetical — do not "fix" it.

**5. Add a row to the articles table in
[chapters/sources.qmd](chapters/sources.qmd).** The prayer texts are CC BY-SA
and attribution is a licence obligation, not a nicety.

**6. Render both formats** and check the new chapter appears in the sidebar and
in the PDF's table of contents.

## Editorial rules

These are the ones that took work to get right; breaking them makes the book
wrong rather than ugly.

- **Quote, don't reconstruct.** If an article describes a text rather than
  printing it, either find another Wikipedia article that prints it verbatim
  or quote the description instead. Where a text has been normalised at all —
  the Modern Greek monotonic conversion, the German ecumenical text sourced
  from a second article — say so in `sources.qmd`. That file already carries
  several such notes; add to them rather than letting a silent edit through.
- **Never invent audio cue timings.** See *Audio* below.
- **Line breaks are editorial, words are not.** Breaking a prose text into
  petitions is fine and noted in `sources.qmd`. Changing a word is not.
- Cross-link chapters that argue with each other. The sixth petition
  (*lead us not into temptation*) is revised differently in Lithuanian,
  Italian, Modern Greek and the ELLC English; those four chapters should keep
  pointing at each other.

## Audio

Two engines behind one Listen button, in [assets/js/audio.js](assets/js/audio.js):

- **`SpeechEngine`** — the device's voice for `speech="xx-XX"`. One utterance
  per verse, so verse highlighting is exact by construction with no timings to
  measure; `boundary` events underline the word being said. This is the path
  for new languages.
- **`FileEngine`** — a recording, declared as `audio="Label=path"` pairs
  separated by `;`. It follows the text only when given `cues`, a start time
  per verse.

Latin uses recordings because no browser ships a Latin voice. Neither bundled
recording has cues, so neither is highlighted line by line.

**Do not guess cue timings.** Silence detection on the spoken Latin gives 7
segments for a 9-line text, with the tail segments far too short for the words
in them; shipping those numbers would produce visibly wrong highlighting.
Cues have to be listened to and written down.

Recordings go in [assets/audio/](assets/audio/) with provenance in
[assets/audio/CREDITS.md](assets/audio/CREDITS.md).

## The PDF

`--to pdf` produces a printable of the prayers alone: chapter titles, texts,
transliterations, Sources. The commentary stays on the web, where its links
work. Pruning happens in `Pandoc()` in
[assets/prayer.lua](assets/prayer.lua):

| Marker | Effect |
|---|---|
| *(none)* | dropped |
| `.prayer` | kept |
| `.pdf-keep` | kept (the Modern Greek pronunciation key) |
| `.pdf-skip` | dropped even if a prayer (the preface's demo block) |
| `.pdf-full` on a heading | keeps that whole section (Sources) |

A heading survives only if something under it did. `pdf-prayers-only: false`
in `_quarto.yml` puts the whole book in print instead.

Three things that will bite anyone editing the PDF path:

- **`.pdf-full` is a heading class, not front matter.** A Quarto book renders
  to PDF as one merged document; per-chapter metadata is gone by the time the
  filter runs. Front matter was tried and silently did nothing.
- **`lang` is dropped for LaTeX.** Pandoc turns `lang="grc"` into
  `\foreignlanguage{ancientgreek}`, a babel language this document does not
  load — that was the original PDF build failure. Nothing needs it, because
  the font covers every script.
- **The font is not decorative.** EB Garamond is the only face in TeX Live
  covering all 106 non-ASCII characters the chapters use — polytonic Greek,
  the transliteration diacritics, Lithuanian and Spanish accents. TeX Gyre
  Pagella misses 43 of them. It is also the web book's face. If you change it,
  check coverage first:

  ```sh
  uv run --with fonttools python -c "..."   # see git log for the check
  ```

`\interlinepenalty=10000` in [assets/prayer.tex](assets/prayer.tex) keeps a
text and its transliteration from splitting across a page turn. After adding a
chapter, confirm every prayer still lands intact on one page.

## Conventions

- No em dashes in code comments (repo-wide preference).
- `uv run --with <pkg>` for one-off Python tooling; nothing is added to a
  project environment.
- Comments explain *why*, especially where the obvious approach was tried and
  failed — several already record exactly that.

## Publishing

Pushing to `main` renders and deploys to GitHub Pages via
[.github/workflows/publish.yml](.github/workflows/publish.yml), which installs
TinyTeX plus `ebgaramond` and `koma-script` for the PDF. Pages must be set to
**Settings → Pages → Source → GitHub Actions**.
