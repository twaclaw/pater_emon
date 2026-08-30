# The Lord's Prayer

A Quarto book presenting the Lord's Prayer in six languages — Spanish,
Lithuanian, English, Ancient Greek, Modern Greek and Latin — one language per
chapter, with the texts taken from Wikipedia.

The Greek chapters print a transliteration in the Latin alphabet beneath each
line, which a button hides. The preference is remembered across chapters and
visits.

## Build

```sh
quarto render              # both formats, into _book/
quarto render --to html
quarto render --to pdf
quarto preview             # live reload on :4200
```

The PDF needs LuaLaTeX and the `ebgaramond` package (`tlmgr install
ebgaramond`).

## Publishing

Pushing to `main` renders the book and deploys it to GitHub Pages via
[.github/workflows/publish.yml](.github/workflows/publish.yml). The repository
needs **Settings → Pages → Source** set to **GitHub Actions**.

## Adding a language

1. Add `chapters/<language>.qmd` and list it under `book.chapters` in
   [_quarto.yml](_quarto.yml).
2. Write the text as a `prayer` block, one petition per line:

   ```markdown
   ::: {.prayer lang="grc" speech="el-GR" #grc-na28}
   | πάτερ ἡμῶν ὁ ἐν τοῖς οὐρανοῖς
   | [páter hēmôn ho en toîs ouranoîs]{.tr}
   | ἁγιασθήτω τὸ ὄνομά σου
   | [hagiasthḗtō tò ónomá sou]{.tr}
   :::
   ```

   `lang` is the BCP 47 tag for the text itself, `speech` the tag used for
   speech synthesis, and the `#id` prefixes the generated per-verse ids.

3. Lines marked `{.tr}` attach to the line above as its transliteration. A
   block with no `.tr` lines gets no toggle button.

That is all a new language needs. The `speech` tag gives it a Listen button
and line-by-line highlighting; see [Audio](#audio) to attach a recording
instead.

[assets/prayer.lua](assets/prayer.lua) turns that block into one `.verse` div
per petition, each with a stable id, so text can be addressed a line at a time.

## The PDF

`quarto render --to pdf` produces a printable of the prayers themselves —
chapter titles, the texts, the transliterations, and Sources. The commentary
stays in the web book, where its links work.

What survives into print is decided in
[assets/prayer.lua](assets/prayer.lua):

| Marker | Effect |
|---|---|
| *(none)* | dropped from the PDF |
| `.prayer` | kept — this is the text itself |
| `.pdf-keep` | kept, for a block that belongs with the text (the pronunciation key) |
| `.pdf-skip` | dropped even if it is a prayer (the demo block in the preface) |
| `.pdf-full` on a heading | keeps that whole section verbatim (Sources) |

A heading survives only if something under it did, so a commentary-only
section takes its heading with it. To get the whole book in print instead,
set `pdf-prayers-only: false` in [_quarto.yml](_quarto.yml).

`.pdf-full` is a heading class rather than front matter because a Quarto book
renders to PDF as one merged document: by the time the filter runs, per-chapter
metadata is gone.

Two things the PDF does differently from the HTML, both in
[assets/prayer.tex](assets/prayer.tex): each prayer becomes a `prayer`
environment with `\interlinepenalty=10000`, so a text and its transliteration
never split across a page turn; and the `lang` attribute is dropped, because
pandoc turns `lang="grc"` into `\foreignlanguage{ancientgreek}` and this
document loads no babel language to match. Nothing needs it — **EB Garamond**
covers every script in the book, which is why it is the PDF's `mainfont` as
well as the web book's face.

## Audio

Every prayer block gets a **Listen** button that reads the text and highlights
each line as it is spoken. Two engines sit behind that one button
([assets/js/audio.js](assets/js/audio.js)):

| Engine | Used when | Highlighting |
|---|---|---|
| `SpeechEngine` | the block has `speech="xx-XX"` and the device has a voice for it | exact — one utterance per verse, plus word-level from `boundary` events |
| `FileEngine` | the block has `audio="..."` | needs a `cues` list; without one the recording just plays |

Speech synthesis is the extensible path: a new chapter gets audio and
synchronised highlighting from its `speech` attribute alone, with no timings
to measure and nothing to keep in step, because each verse is spoken as its
own utterance.

### Adding audio

A recording is declared on the prayer block, as one or more `Label=path`
pairs separated by `;`. Paths are relative to the site root.

```markdown
::: {.prayer lang="la" speech="la" #la-missal
     audio="Read aloud=assets/audio/pater-noster-spoken.mp3;
            Gregorian chant=assets/audio/pater-noster-chant.mp3"
     audio-credit="Reading by Geremia (public domain)."}
```

More than one source puts a picker next to the button. To make a recording
follow the text, add `cues` — the start time in seconds of each verse, one
list per track in the same order as `audio`, tracks separated by `;`:

```markdown
     cues="0,3.12,5.75,7.64,10.22,14.69,16.92,18.72,19.10; "
```

The trailing `;` above leaves the second track without cues. Neither of the
bundled recordings has a measured cue list yet, so neither is highlighted
line by line — the timings have to be listened to and written down, which is
the one part of this that no attribute can do for you.

Recordings live in [assets/audio/](assets/audio/) with their provenance in
[assets/audio/CREDITS.md](assets/audio/CREDITS.md).

## Licence

Prayer texts are from Wikipedia, reused under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/); see
[chapters/sources.qmd](chapters/sources.qmd) for per-chapter provenance and
editorial notes. The surrounding commentary and code are offered under the
same licence.
