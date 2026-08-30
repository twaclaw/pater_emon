# The Lord's Prayer

A Quarto book presenting the Lord's Prayer in six languages — Spanish,
Lithuanian, English, Ancient Greek, Modern Greek and Latin — one language per
chapter, with the texts taken from Wikipedia.

The Greek chapters print a transliteration in the Latin alphabet beneath each
line, which a button hides. The preference is remembered across chapters and
visits.

## Build

```sh
quarto render      # writes _book/
quarto preview     # live reload on :4200
```

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

[assets/prayer.lua](assets/prayer.lua) turns that block into one `.verse` div
per petition, each with a stable id, so text can be addressed a line at a time.

## Licence

Prayer texts are from Wikipedia, reused under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/); see
[chapters/sources.qmd](chapters/sources.qmd) for per-chapter provenance and
editorial notes. The surrounding commentary and code are offered under the
same licence.
