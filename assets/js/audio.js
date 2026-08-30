/*
 * audio.js -- listening, with the text following along.
 *
 * A prayer block declares what it can be listened to with, in markdown:
 *
 *   ::: {.prayer lang="la" speech="la" audio="Read aloud=assets/audio/x.mp3" #la-missal}
 *
 * and this file turns that into a player. Two engines sit behind one small
 * interface, so a chapter never has to care which one it gets:
 *
 *   SpeechEngine  speaks the verses with the browser's own voice for the
 *                 block's language. It speaks one utterance per verse, so
 *                 verse highlighting is exact by construction, and it uses
 *                 `boundary` events to underline the word being said.
 *
 *   FileEngine    plays a recording. Highlighting needs a cue list -- one
 *                 timestamp per verse, in `cues` -- because an audio file
 *                 carries no idea of where a line ends. Without cues the
 *                 recording still plays; the block is simply marked as
 *                 sounding rather than followed line by line.
 *
 * Adding a language means adding `speech="xx-XX"` to its prayer block. Adding
 * a recording means adding `audio="Label=path"`. Neither needs code here.
 */
(function () {
  "use strict";

  var scriptURL = document.currentScript && document.currentScript.src;

  /* Chapters live one directory down, so a path written in markdown is
     resolved against the site root rather than the current page. This
     script's own URL is the only thing on the page that reliably knows
     where the root is, because Quarto rewrote it during rendering. */
  function siteURL(path) {
    if (!scriptURL) return path;
    return new URL(path, scriptURL.replace(/assets\/js\/audio\.js.*$/, "")).href;
  }

  // ---------------------------------------------------------------- helpers

  function ensureBar(block) {
    var bar = block.previousElementSibling;
    if (bar && bar.classList.contains("prayer-controls")) return bar;
    bar = document.createElement("div");
    bar.className = "prayer-controls";
    block.parentNode.insertBefore(bar, block);
    return bar;
  }

  function parsePairs(spec) {
    // "Label=path; Other label=other/path" -> [{label, value}, ...]
    if (!spec) return [];
    return spec.split(";").map(function (chunk) {
      var at = chunk.indexOf("=");
      if (at < 0) return { label: "Listen", value: chunk.trim() };
      return {
        label: chunk.slice(0, at).trim(),
        value: chunk.slice(at + 1).trim()
      };
    }).filter(function (p) { return p.value; });
  }

  function parseCueSets(spec) {
    // "0,3.1,5.7; 0,2,4" -> [[0,3.1,5.7],[0,2,4]]
    if (!spec) return [];
    return spec.split(";").map(function (set) {
      return set.split(",")
        .map(function (t) { return parseFloat(t); })
        .filter(function (t) { return !isNaN(t); });
    });
  }

  // ------------------------------------------------------------ highlighting

  function Highlighter(block) {
    this.verses = Array.prototype.slice.call(block.querySelectorAll(".verse"));
    this.block = block;
    this.current = -1;
  }

  Highlighter.prototype.verse = function (i) {
    if (i === this.current) return;
    this.clearWord();
    if (this.verses[this.current]) {
      this.verses[this.current].classList.remove("is-speaking");
    }
    this.current = i;
    if (this.verses[i]) this.verses[i].classList.add("is-speaking");
  };

  /* Word highlighting rewrites the verse's text node, so it only runs on a
     verse whose text is a single plain text node -- anything with markup
     inside keeps verse-level highlighting only. */
  Highlighter.prototype.word = function (i, start, length) {
    var verse = this.verses[i];
    if (!verse) return;
    var span = verse.querySelector(".verse-text");
    if (!span) return;

    if (span.dataset.plain === undefined) {
      var only = span.childNodes.length === 1 &&
                 span.firstChild.nodeType === 3;
      span.dataset.plain = only ? span.textContent : "";
    }
    var text = span.dataset.plain;
    if (!text) return;

    if (!length || start >= text.length) return;
    var head = text.slice(0, start);
    var word = text.slice(start, start + length);
    var tail = text.slice(start + length);

    span.textContent = "";
    span.appendChild(document.createTextNode(head));
    var mark = document.createElement("span");
    mark.className = "word-speaking";
    mark.textContent = word;
    span.appendChild(mark);
    span.appendChild(document.createTextNode(tail));
  };

  Highlighter.prototype.clearWord = function () {
    var verse = this.verses[this.current];
    if (!verse) return;
    var span = verse.querySelector(".verse-text");
    if (span && span.dataset.plain) span.textContent = span.dataset.plain;
  };

  Highlighter.prototype.clear = function () {
    this.clearWord();
    this.verses.forEach(function (v) { v.classList.remove("is-speaking"); });
    this.current = -1;
  };

  // ----------------------------------------------------------- speech engine

  function SpeechEngine(block, voice, hl) {
    this.block = block;
    this.voice = voice;
    this.lang = voice ? voice.lang : block.dataset.speechLang;
    this.hl = hl;

    /* data-say is a respelling meant only for the synthesiser: the Latin
       chapter shows "qui es in caelis" and says "qui es in celis", so an
       Italian voice produces ecclesiastical Latin. Where there is no
       respelling the displayed text is spoken as written. */
    this.texts = hl.verses.map(function (v) {
      if (v.dataset.say) return v.dataset.say;
      var span = v.querySelector(".verse-text");
      return span ? span.textContent.trim() : "";
    });
    this.index = 0;
  }

  SpeechEngine.prototype.speakFrom = function (i, onstate) {
    var self = this;
    if (i >= this.texts.length) {
      this.hl.clear();
      onstate("stopped");
      return;
    }
    this.index = i;

    var u = new SpeechSynthesisUtterance(punctuate(this.texts[i]));
    if (this.voice) u.voice = this.voice;
    u.lang = this.lang;

    /* A prayer is not a news bulletin, but slowing the voice down is the
       wrong lever -- past about 0.9 the synthesis stretches vowels and
       starts to drawl. The measured cadence comes from the pause between
       lines instead, below. */
    u.rate = 0.92;
    u.pitch = 0.96;

    u.onstart = function () { self.hl.verse(i); };
    u.onboundary = function (e) {
      if (e.name && e.name !== "word") return;
      // charIndex points into what was spoken. Where that is a respelling it
      // does not line up with the text on screen, so the line stays
      // highlighted as a whole and no word is underlined.
      if (self.hl.verses[i] && self.hl.verses[i].dataset.say) return;
      self.hl.word(i, e.charIndex, e.charLength || wordLength(self.texts[i], e.charIndex));
    };
    u.onend = function () {
      if (self.stopped) return;
      self.timer = window.setTimeout(function () {
        if (!self.stopped) self.speakFrom(i + 1, onstate);
      }, VERSE_PAUSE_MS);
    };
    u.onerror = function () {
      if (self.stopped) return;
      self.hl.clear();
      onstate("stopped");
    };

    window.speechSynthesis.speak(u);
  };

  SpeechEngine.prototype.play = function (onstate) {
    if (window.speechSynthesis.paused && window.speechSynthesis.speaking) {
      window.speechSynthesis.resume();
      onstate("playing");
      return;
    }
    this.stopped = false;
    window.speechSynthesis.cancel();
    onstate("playing");
    this.speakFrom(0, onstate);
  };

  SpeechEngine.prototype.pause = function (onstate) {
    window.speechSynthesis.pause();
    onstate("paused");
  };

  SpeechEngine.prototype.stop = function (onstate) {
    this.stopped = true;
    window.clearTimeout(this.timer);
    window.speechSynthesis.cancel();
    this.hl.clear();
    onstate("stopped");
  };

  var VERSE_PAUSE_MS = 260;
  var MAX_VOICES = 5;

  /* A line ending in nothing is read with a flat, unfinished intonation and
     runs into the next. Giving it a comma is enough for the engine to fall
     at the end of the phrase. */
  function punctuate(text) {
    return /[.,;:!?\u00b7\u037e]\s*$/.test(text) ? text : text + ",";
  }

  /* Firefox reports charLength as 0; fall back to reading the word off the
     text ourselves so the underline is still the right width. */
  function wordLength(text, from) {
    var m = /^\S+/.exec(text.slice(from));
    return m ? m[0].length : 0;
  }

  var voiceCache = null;

  function voices() {
    if (!("speechSynthesis" in window)) return [];
    voiceCache = window.speechSynthesis.getVoices() || [];
    return voiceCache;
  }

  /* macOS and iOS ship joke voices localised into every language -- Spanish
     gets a "Grandma", a "Rocko", a "Jester". They match on language like any
     other voice, so picking the first match lands on one of these about as
     often as not, and the result is what makes synthesised speech sound like
     a toy. Rank them last rather than hiding them: on a device with nothing
     else installed, a silly voice still beats silence. */
  var NOVELTY = /^(albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|junior|kathy|organ|pipe organ|princess|ralph|superstar|trinoids|whisper|wobble|zarvox|deranged|hysterical|bruce|agnes|victoria|eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley)\b/i;

  // The names vendors give their better synthesis engines.
  var GOOD = /(premium|enhanced|neural|natural|siri|google|wavenet|online|multilingual)/i;

  function normLang(v) {
    return (v.lang || "").toLowerCase().replace("_", "-");
  }

  /* `spec` is the block's speech attribute: one BCP 47 tag, or several in
     preference order. The Spanish chapter asks for Colombian first and falls
     back through the other American Spanishes, because Castilian pronounces
     "cielos" with a th- that sounds foreign across the Atlantic. */
  function langPrefs(spec) {
    return String(spec).split(",")
      .map(function (t) { return t.trim().toLowerCase(); })
      .filter(Boolean);
  }

  function scoreVoice(v, prefs) {
    var lang = normLang(v);
    if (!lang) return -1;
    var base = lang.split("-")[0];

    var rank = -1;
    for (var i = 0; i < prefs.length; i++) {
      if (lang === prefs[i]) { rank = i; break; }
    }
    if (rank < 0) {
      // no exact region match: accept the language, but rank it below every
      // requested region so a named preference always wins
      var wanted = prefs.some(function (p) { return p.split("-")[0] === base; });
      if (!wanted) return -1;
      rank = prefs.length;
    }

    var score = 1000 - rank * 50;
    if (GOOD.test(v.name)) score += 30;
    if (NOVELTY.test(v.name)) score -= 500;
    if (v.localService === false) score += 5;   // cloud voices are usually better
    if (v.default) score += 2;
    return score;
  }

  function rankVoices(spec) {
    var prefs = langPrefs(spec);
    var all = voiceCache || voices();
    return all
      .map(function (v) { return { voice: v, score: scoreVoice(v, prefs) }; })
      .filter(function (x) { return x.score >= 0; })
      .sort(function (a, b) { return b.score - a.score; })
      .map(function (x) { return x.voice; });
  }

  function pickVoice(spec) {
    var ranked = rankVoices(spec);
    return ranked.length ? ranked[0] : null;
  }

  // ------------------------------------------------------------- file engine

  function FileEngine(block, src, cues, hl) {
    this.hl = hl;
    this.cues = cues || [];
    this.audio = new Audio(siteURL(src));
    this.audio.preload = "none";

    var self = this;
    if (this.cues.length) {
      this.audio.addEventListener("timeupdate", function () {
        var t = self.audio.currentTime, i = -1;
        for (var k = 0; k < self.cues.length; k++) {
          if (t >= self.cues[k]) i = k; else break;
        }
        self.hl.verse(i);
      });
    } else {
      block.classList.add("no-cues");
    }
  }

  FileEngine.prototype.play = function (onstate) {
    var self = this;
    this.audio.play().then(function () {
      onstate("playing");
    }, function () {
      onstate("stopped");
    });
    this.audio.onended = function () { self.hl.clear(); onstate("stopped"); };
  };

  FileEngine.prototype.pause = function (onstate) {
    this.audio.pause();
    onstate("paused");
  };

  FileEngine.prototype.stop = function (onstate) {
    this.audio.pause();
    this.audio.currentTime = 0;
    this.hl.clear();
    onstate("stopped");
  };

  // ------------------------------------------------------------------- setup

  var players = [];

  function buildPlayer(block) {
    var hl = new Highlighter(block);
    if (!hl.verses.length) return;

    var lang = block.dataset.speechLang;
    var tracks = parsePairs(block.dataset.audio);
    var cueSets = parseCueSets(block.dataset.cues);

    var sources = tracks.map(function (t, i) {
      return {
        label: t.label,
        make: function () { return new FileEngine(block, t.value, cueSets[i], hl); }
      };
    });

    /* Offer the best voices rather than one, because which voices exist
       varies wildly between devices and the reader can hear the difference
       far better than any ranking can guess it. */
    if (lang && "speechSynthesis" in window) {
      var prefix = block.dataset.speechLabel;
      rankVoices(lang).slice(0, MAX_VOICES).forEach(function (voice) {
        sources.push({
          label: prefix ? prefix + " \u00b7 " + voice.name
                        : voice.name + " (" + voice.lang.replace("_", "-") + ")",
          make: function () { return new SpeechEngine(block, voice, hl); }
        });
      });
    }

    if (!sources.length) {
      if (lang) noVoiceNote(block, lang);
      return;
    }

    // A recording of a human voice outranks any synthesiser; keep file
    // sources first so the default is the best thing on offer.

    var bar = ensureBar(block);

    var player = {
      block: block, hl: hl, sources: sources,
      engine: null, which: 0, state: "stopped", setState: null
    };
    players.push(player);

    var play = document.createElement("button");
    play.type = "button";
    play.className = "prayer-play";
    play.setAttribute("aria-controls", block.id);

    var stop = document.createElement("button");
    stop.type = "button";
    stop.className = "prayer-stop";
    stop.textContent = "Stop";
    stop.hidden = true;

    player.setState = setState;

    function setState(s) {
      player.state = s;
      play.textContent = s === "playing" ? "Pause" : (s === "paused" ? "Resume" : "Listen");
      play.setAttribute("aria-pressed", s === "playing" ? "true" : "false");
      stop.hidden = s === "stopped";
      block.classList.toggle("is-sounding", s !== "stopped");
    }

    play.addEventListener("click", function () {
      if (player.state === "playing") {
        player.engine.pause(setState);
        return;
      }
      if (player.state === "stopped") {
        stopAllExcept(player);
        player.engine = player.sources[player.which].make();
      }
      player.engine.play(setState);
    });

    stop.addEventListener("click", function () {
      if (player.engine) player.engine.stop(setState);
      else setState("stopped");
    });

    bar.appendChild(play);
    bar.appendChild(stop);

    if (sources.length > 1) {
      var select = document.createElement("select");
      select.className = "prayer-source";
      select.setAttribute("aria-label", "Choose a voice");
      sources.forEach(function (s, i) {
        var opt = document.createElement("option");
        opt.value = String(i);
        opt.textContent = s.label;
        select.appendChild(opt);
      });
      select.addEventListener("change", function () {
        if (player.engine) player.engine.stop(setState);
        player.engine = null;
        player.which = parseInt(select.value, 10);
      });
      bar.appendChild(select);
    }

    if (block.dataset.audioCredit) {
      var credit = document.createElement("span");
      credit.className = "prayer-credit";
      credit.innerHTML = block.dataset.audioCredit;
      bar.appendChild(credit);
    }

    setState("stopped");
  }

  /* Better to say why there is no button than to show one that does nothing.
     Which voices a device has is not something the page can change. */
  function noVoiceNote(block, lang) {
    var bar = ensureBar(block);
    var note = document.createElement("span");
    note.className = "prayer-credit";
    note.textContent =
      "This device has no " + langPrefs(lang)[0] + " voice installed, so this " +
      "text cannot be read aloud here.";
    bar.appendChild(note);
  }

  /* Only one block sounds at a time: speechSynthesis is a single queue
     anyway, and two prayers at once helps nobody. */
  function stopAllExcept(keep) {
    players.forEach(function (p) {
      if (p !== keep && p.engine && p.state !== "stopped") p.engine.stop(p.setState);
    });
  }

  function init() {
    document.querySelectorAll(".prayer").forEach(buildPlayer);
  }

  /* getVoices() is empty until the browser has loaded its voice list, and
     which voices exist decides whether a block gets a synthesised option at
     all -- so wait for the list before building any players. */
  function whenVoicesReady(done) {
    if (!("speechSynthesis" in window)) return done();
    if (voices().length) return done();
    var fired = false;
    function go() { if (!fired) { fired = true; voices(); done(); } }
    window.speechSynthesis.addEventListener("voiceschanged", go, { once: true });
    setTimeout(go, 1000);   // some browsers never fire the event
  }

  function start() { whenVoicesReady(init); }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }

  // Speech synthesis is a browser-wide singleton and outlives the page.
  window.addEventListener("beforeunload", function () {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  });
})();
