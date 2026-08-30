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

  local attrs = { ["data-prayer-id"] = prayer_id }
  if speech then attrs["data-speech-lang"] = speech end
  for k, val in pairs(div.attributes) do
    if k ~= "lang" and k ~= "speech" then attrs[k] = val end
  end

  local classes = pandoc.List({ "prayer" })
  for _, c in ipairs(div.classes) do
    if c ~= "prayer" then classes:insert(c) end
  end

  return pandoc.Div(out, pandoc.Attr(prayer_id, classes, attrs))
end

function Div(el)
  if has_class(el, "prayer") then return build(el) end
end
