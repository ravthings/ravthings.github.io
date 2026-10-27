"use strict";

/* ==========================================================================
   1. Model samples
   --------------------------------------------------------------------------
   The page only ever calls generateSample(modelId), which must return a
   Promise that resolves to a string. The HTML never needs to change. Both the
   "Generate sample" buttons and the hero terminal use this one function.

   To use a real live model later, replace the body of generateSample() with
   a request to your own server, for example:

     async function generateSample(modelId) {
       const res = await fetch(`https://your-server.example.com/${modelId}/generate`, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ max_tokens: 200 }),
       });
       if (!res.ok) throw new Error(`Request failed: ${res.status}`);
       const data = await res.json();
       return data.text;
     }
   ========================================================================== */

// Keys match the data-model attribute on each card in index.html.
const SAMPLES = {
  "kick-off": [
    "[paste output 1]",
    "[paste output 2]",
    "[paste output 3]",
  ],
  "shake-gpt": [
    "[paste output 1]",
    "[paste output 2]",
  ],
};

const lastSampleIndex = {};

async function generateSample(modelId) {
  const pool = SAMPLES[modelId];
  if (!pool || pool.length === 0) {
    throw new Error(`No samples found for "${modelId}"`);
  }

  // Pick a random sample, avoiding the one shown last time.
  let index;
  do {
    index = Math.floor(Math.random() * pool.length);
  } while (pool.length > 1 && index === lastSampleIndex[modelId]);
  lastSampleIndex[modelId] = index;

  return pool[index];
}

/* ==========================================================================
   2. Typing animation and "Generate sample" buttons
   ========================================================================== */

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function typeInto(element, text) {
  if (reducedMotion.matches) {
    element.textContent = text;
    return;
  }

  const characters = Array.from(text);
  // Longer samples type faster so the animation always stays short.
  const delay = Math.min(28, Math.max(6, 2200 / characters.length));

  for (let i = 1; i <= characters.length; i++) {
    element.textContent = characters.slice(0, i).join("");
    await wait(delay);
  }
}

document.querySelectorAll("[data-model]").forEach((card) => {
  const modelId = card.dataset.model;
  const button = card.querySelector("[data-generate]");
  const output = card.querySelector("[data-output]");
  const textElement = output.querySelector(".sample-text");

  button.addEventListener("click", async () => {
    const originalLabel = button.textContent;

    button.disabled = true;
    button.textContent = "Generating…";
    output.hidden = false;
    textElement.textContent = "";
    textElement.classList.add("is-typing");

    try {
      const text = await generateSample(modelId);
      await typeInto(textElement, text);
    } catch (error) {
      console.error(error);
      textElement.textContent = "Couldn’t generate a sample. Try again.";
    } finally {
      textElement.classList.remove("is-typing");
      button.disabled = false;
      button.textContent = originalLabel;
    }
  });
});

/* ==========================================================================
   3. Hero terminal
   --------------------------------------------------------------------------
   Types "python main.py", then types a Kick-Off sample, holds, and repeats
   with a different sample. It pauses while it is off screen or the tab is
   hidden. With reduced motion it shows one static sample instead.
   ========================================================================== */

async function runTerminal(root) {
  const body = root.querySelector(".terminal-body");
  const commandElement = root.querySelector("[data-term-cmd]");
  const outputElement = root.querySelector("[data-term-out]");

  const COMMAND = "python main.py";
  const MODEL_ID = "kick-off";
  const HOLD_MS = 3200;

  let onScreen = true;
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      onScreen = entries[0].isIntersecting;
    }).observe(root);
  }
  const canRun = () => onScreen && !document.hidden;

  async function nextSample() {
    try {
      return await generateSample(MODEL_ID);
    } catch (error) {
      console.error(error);
      return "";
    }
  }

  async function type(element, text, delay) {
    element.classList.add("is-typing");
    const characters = Array.from(text);
    for (let i = 1; i <= characters.length; i++) {
      while (!canRun()) await wait(250);
      element.textContent = characters.slice(0, i).join("");
      body.scrollTop = body.scrollHeight;
      await wait(delay);
    }
  }

  if (reducedMotion.matches) {
    commandElement.textContent = COMMAND;
    outputElement.textContent = await nextSample();
    return;
  }

  while (true) {
    commandElement.textContent = "";
    outputElement.textContent = "";
    outputElement.classList.remove("is-typing");
    body.scrollTop = 0;

    await type(commandElement, COMMAND, 60);
    commandElement.classList.remove("is-typing");
    await wait(450);

    const sample = await nextSample();
    const length = Array.from(sample).length || 1;
    await type(outputElement, sample, Math.min(30, Math.max(8, 2800 / length)));

    await wait(HOLD_MS);
  }
}

const terminal = document.querySelector("[data-terminal]");
if (terminal) runTerminal(terminal);

/* ==========================================================================
   4. Navigation: mobile menu and scrolled state
   ========================================================================== */

const nav = document.querySelector(".nav");
const navToggle = nav.querySelector(".nav-toggle");

function setMenu(open) {
  nav.classList.toggle("is-open", open);
  navToggle.setAttribute("aria-expanded", String(open));
  navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
}

navToggle.addEventListener("click", () => {
  setMenu(!nav.classList.contains("is-open"));
});

nav.querySelectorAll(".nav-links a").forEach((link) => {
  link.addEventListener("click", () => setMenu(false));
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setMenu(false);
});

// Transparent at the top of the page, blurred dark background once scrolled.
function updateNavState() {
  nav.classList.toggle("is-scrolled", window.scrollY > 8);
}

updateNavState();
window.addEventListener("scroll", updateNavState, { passive: true });

/* ==========================================================================
   5. Fade-in and slide-up as sections scroll into view
   --------------------------------------------------------------------------
   The CSS only hides .reveal elements when motion is allowed, so with
   prefers-reduced-motion everything is simply visible.
   ========================================================================== */

const revealElements = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0 }
  );
  revealElements.forEach((element) => revealObserver.observe(element));
} else {
  revealElements.forEach((element) => element.classList.add("is-visible"));
}

/* ==========================================================================
   6. Footer year
   ========================================================================== */

document.getElementById("year").textContent = new Date().getFullYear();