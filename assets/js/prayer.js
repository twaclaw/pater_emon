/*
 * prayer.js -- per-chapter controls for the prayer blocks.
 *
 * A chapter declares its text with `::: {.prayer ...}` and this script adds
 * whatever controls that block can support. Right now that is the
 * transliteration toggle, which appears only for blocks that actually carry
 * transliteration lines, so the Latin and Spanish chapters stay uncluttered.
 *
 * The preference is global rather than per-block: a reader who turns the
 * transliteration off in Ancient Greek expects it off in Modern Greek too.
 */
(function () {
  "use strict";

  var STORE_KEY = "lp:translit";

  function prefersTranslit() {
    try {
      return window.localStorage.getItem(STORE_KEY) !== "off";
    } catch (e) {
      return true;
    }
  }

  function storeTranslit(on) {
    try {
      window.localStorage.setItem(STORE_KEY, on ? "on" : "off");
    } catch (e) {
      /* private mode, blocked storage: the toggle still works for this page */
    }
  }

  function label(btn, on) {
    btn.textContent = on ? "Hide transliteration" : "Show transliteration";
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  }

  function apply(on) {
    document.querySelectorAll(".prayer").forEach(function (block) {
      block.classList.toggle("tr-hidden", !on);
    });
    document.querySelectorAll(".prayer-toggle").forEach(function (btn) {
      label(btn, on);
    });
  }

  /* audio.js may already have put a control bar above this block; share it
     rather than stacking a second one. */
  function controlsFor(block) {
    var bar = block.previousElementSibling;
    if (bar && bar.classList.contains("prayer-controls")) return bar;
    bar = document.createElement("div");
    bar.className = "prayer-controls";
    block.parentNode.insertBefore(bar, block);
    return bar;
  }

  function init() {
    var on = prefersTranslit();

    document.querySelectorAll(".prayer").forEach(function (block) {
      if (!block.querySelector(".verse-tr")) return;

      var bar = controlsFor(block);
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "prayer-toggle";
      btn.setAttribute("aria-controls", block.id);
      label(btn, on);

      btn.addEventListener("click", function () {
        var next = block.classList.contains("tr-hidden");
        storeTranslit(next);
        apply(next);
      });

      bar.appendChild(btn);
    });

    apply(on);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
