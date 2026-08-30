--[[
  prayer.lua -- turns a readable markdown block into verse-addressable HTML.

  Source form:

      ::: {.prayer lang="grc" speech="el-GR" id="grc-na28"}
      | πάτερ ἡμῶν ὁ ἐν τοῖς οὐρανοῖς
      | [páter hēmôn ho en toîs ouranoîs]{.tr}
      | ἁγιασθήτω τὸ ὄνομά σου
      | [hagiasthḗtō tò ónomá sou]{.tr}
      :::

  Every line that is not marked `.tr` opens a new verse; a `.tr` line attaches
  to the verse above it as its transliteration. Output:

      <div class="prayer" data-prayer-id="grc-na28" data-speech-lang="el-GR">
        <div class="verse" id="grc-na28-v1" data-verse="1">
          <span class="verse-text" lang="grc">πάτερ ...</span>
          <span class="verse-tr">páter ...</span>
        </div>
        ...
      </div>

  Stable per-verse ids are what the audio layer highlights against, so the
  numbering here is deliberately independent of document order.

  For LaTeX the same block becomes a `prayer` environment holding one line
  block, with transliterations wrapped in \prayertr. Per-verse divs and ids
  would be meaningless on paper, and the `lang` attribute is dropped there on
  purpose: pandoc turns lang="grc" into \foreignlanguage{ancientgreek}, which
  needs a babel language this document does not load. The PDF font covers
  every script in the book, so nothing needs to switch languages.
]]

local function has_class(el, name)
  if not el.classes then return false end
  return el.classes:includes(name)
end

-- A line of a LineBlock is a list of inlines. It counts as a transliteration
-- when its only meaningful content is a Span carrying the `.tr` class.
local function translit_span(inlines)
  local found = nil
  for _, inl in ipairs(inlines) do
    if inl.t == "Span" and has_class(inl, "tr") then
      if found then return nil end
      found = inl
    elseif inl.t ~= "Space" and inl.t ~= "SoftBreak" then
      return nil
    end
  end
  return found
end

local function is_blank(inlines)
  for _, inl in ipairs(inlines) do
    if inl.t ~= "Space" and inl.t ~= "SoftBreak" then return false end
  end
  return true
end

local function build(div)
  local prayer_id = div.identifier
  if prayer_id == "" then prayer_id = "prayer" end

  local text_lang = div.attributes["lang"]
  local speech = div.attributes["speech"]

  local verses = {}
  for _, block in ipairs(div.content) do
    if block.t == "LineBlock" then
      for _, line in ipairs(block.content) do
        if not is_blank(line) then
          local tr = translit_span(line)
          if tr and #verses > 0 then
            verses[#verses].tr = tr.content
          elseif not tr then
            table.insert(verses, { text = line })
          end
        end
      end
    end
  end

  if #verses == 0 then return div end

  local classes = pandoc.List({ "prayer" })
  for _, c in ipairs(div.classes) do
    if c ~= "prayer" then classes:insert(c) end
  end

  if FORMAT:match("latex") then
    local lines = pandoc.List()
    for _, v in ipairs(verses) do
      lines:insert(v.text)
      if v.tr then
        local tr = pandoc.List({ pandoc.RawInline("latex", "\\prayertr{") })
        tr:extend(v.tr)
        tr:insert(pandoc.RawInline("latex", "}"))
        lines:insert(tr)
      end
    end
    return pandoc.Div({
      pandoc.RawBlock("latex", "\\begin{prayer}"),
      pandoc.LineBlock(lines),
      pandoc.RawBlock("latex", "\\end{prayer}"),
    }, pandoc.Attr("", classes, {}))
  end

  local out = pandoc.List()
  for i, v in ipairs(verses) do
    local parts = pandoc.List()

    parts:insert(pandoc.Span(v.text, pandoc.Attr("", { "verse-text" },
      text_lang and { lang = text_lang } or {})))

    if v.tr then
      parts:insert(pandoc.Span(v.tr, pandoc.Attr("", { "verse-tr" }, {})))
    end

    out:insert(pandoc.Div(
      pandoc.Plain(parts),
      pandoc.Attr(prayer_id .. "-v" .. i, { "verse" }, { ["data-verse"] = tostring(i) })
    ))
  end

  -- Everything else the author wrote on the div rides along as a data
  -- attribute, so the audio layer can be configured from markdown alone.
  local attrs = { ["data-prayer-id"] = prayer_id }
  if speech then attrs["data-speech-lang"] = speech end
  for k, val in pairs(div.attributes) do
    if k ~= "lang" and k ~= "speech" then
      if k:sub(1, 5) ~= "data-" then k = "data-" .. k end
      attrs[k] = val
    end
  end

  return pandoc.Div(out, pandoc.Attr(prayer_id, classes, attrs))
end

function Div(el)
  if has_class(el, "prayer") then return build(el) end
end

--[[
  The PDF is a printable of the prayers themselves: chapter titles, the texts,
  the transliterations, nothing else. The commentary belongs to the web book,
  where a reader can follow its links.

  A block survives if it is a prayer or is marked `.pdf-keep`, unless it is
  marked `.pdf-skip`; a heading survives if anything under it did. A heading
  marked `.pdf-full` keeps its whole section verbatim -- Sources needs that,
  because the attribution is a licence obligation.

  The marker is a heading class rather than document metadata because a book
  is rendered to PDF as one merged document: by the time this runs the
  per-chapter front matter is gone, and only project metadata is left.
]]

local function keep(block)
  if block.t ~= "Div" then return false end
  if has_class(block, "pdf-skip") then return false end
  return has_class(block, "prayer") or has_class(block, "pdf-keep")
end

local function prune(blocks)
  local out = pandoc.List()
  local i = 1
  while i <= #blocks do
    local block = blocks[i]
    if block.t == "Header" then
      local j = i + 1
      while j <= #blocks and
            not (blocks[j].t == "Header" and blocks[j].level <= block.level) do
        j = j + 1
      end

      local section = {}
      for k = i + 1, j - 1 do section[#section + 1] = blocks[k] end
      local kept = has_class(block, "pdf-full") and section or prune(section)

      -- Chapter titles stay even when empty, so the book keeps its shape.
      if block.level == 1 or #kept > 0 then
        out:insert(block)
        for _, k in ipairs(kept) do out:insert(k) end
      end
      i = j
    else
      if keep(block) then out:insert(block) end
      i = i + 1
    end
  end
  return out
end

function Pandoc(doc)
  if not FORMAT:match("latex") then return nil end
  if doc.meta["pdf-prayers-only"] == false then return nil end
  return pandoc.Pandoc(prune(doc.blocks), doc.meta)
end
