(function () {
  "use strict";

  var CATALOG = window.CATALOG || { sections: [], questions: [] };
  var S = CATALOG.sections || [];
  var ALL_CHAPTERS = [];
  S.forEach(function (sec) {
    sec.chapters.forEach(function (ch) {
      ALL_CHAPTERS.push(ch.id);
    });
  });

  var CHAPTER_IDS = {};
  CATALOG.questions.forEach(function (q) {
    (CHAPTER_IDS[q.chapter] = CHAPTER_IDS[q.chapter] || []).push(q.id);
  });

  var state = {
    selected: new Set(ALL_CHAPTERS),
    count: 20,
    countAll: false,
    onlyUnsolved: false,
    quiz: [],
    index: 0,
    answered: false,
    current: null,
    results: [],
  };

  var $ = function (id) { return document.getElementById(id); };

  var PROGRESS_KEY = "msvoe-fb2-progress";
  var PREFS_KEY = "msvoe-fb2-prefs";

  function loadProgress() {
    try {
      var p = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}");
      return p && typeof p === "object" ? p : {};
    } catch (e) { return {}; }
  }
  function saveProgress(p) {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch (e) {}
  }
  function loadPrefs() {
    try {
      var p = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
      return p && typeof p === "object" ? p : {};
    } catch (e) { return {}; }
  }
  function savePrefs(p) {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch (e) {}
  }
  function isMastered(progress, id) {
    var e = progress[id];
    return !!(e && e.r > 0);
  }
  function masteredCount(progress) {
    var n = 0;
    CATALOG.questions.forEach(function (q) { if (isMastered(progress, q.id)) n++; });
    return n;
  }
  function recordResult(id, correct) {
    var progress = loadProgress();
    var e = progress[id] || { r: 0, w: 0 };
    if (correct) e.r += 1; else e.w += 1;
    e.t = Date.now();
    progress[id] = e;
    saveProgress(progress);
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function sectionName(id) {
    for (var i = 0; i < S.length; i++) if (S[i].id === id) return S[i].name;
    return id;
  }
  function chapterName(id) {
    for (var i = 0; i < S.length; i++)
      for (var j = 0; j < S[i].chapters.length; j++)
        if (S[i].chapters[j].id === id) return S[i].chapters[j].name;
    return id;
  }

  function show(screen) {
    ["setup", "quiz", "result"].forEach(function (s) {
      $("screen-" + s).hidden = s !== screen;
    });
    $("restartBtn").hidden = screen !== "quiz";
  }

  function renderTopics() {
    var wrap = $("topics");
    wrap.innerHTML = "";
    S.forEach(function (sec) {
      var block = document.createElement("div");
      block.className = "section-block";

      var total = sec.chapters.reduce(function (n, c) { return n + c.count; }, 0);
      var head = document.createElement("label");
      head.className = "section-title";
      head.innerHTML =
        '<input type="checkbox" data-section="' + sec.id + '" />' +
        '<span class="s-name">' + sec.id + ". " + sec.name + "</span>" +
        '<span class="s-count">' + total + " Fragen</span>";
      block.appendChild(head);

      var list = document.createElement("div");
      list.className = "chapters";
      sec.chapters.forEach(function (ch) {
        var lab = document.createElement("label");
        lab.className = "chapter";
        lab.innerHTML =
          '<input type="checkbox" data-chapter="' + ch.id + '" />' +
          '<span class="c-name">' + ch.id + " – " + ch.name + "</span>" +
          '<span class="c-count" data-chapter-count="' + ch.id + '" data-total="' + ch.count + '">' + ch.count + "</span>";
        list.appendChild(lab);
      });
      block.appendChild(list);
      wrap.appendChild(block);
    });

    wrap.addEventListener("change", function (e) {
      var t = e.target;
      if (t.dataset.chapter) {
        if (t.checked) state.selected.add(t.dataset.chapter);
        else state.selected.delete(t.dataset.chapter);
        syncCheckboxes();
      } else if (t.dataset.section) {
        var sec = S.filter(function (x) { return x.id === t.dataset.section; })[0];
        sec.chapters.forEach(function (ch) {
          if (t.checked) state.selected.add(ch.id);
          else state.selected.delete(ch.id);
        });
        syncCheckboxes();
      }
    });
  }

  function syncCheckboxes() {
    document.querySelectorAll("input[data-chapter]").forEach(function (cb) {
      cb.checked = state.selected.has(cb.dataset.chapter);
    });
    document.querySelectorAll("input[data-section]").forEach(function (cb) {
      var sec = S.filter(function (x) { return x.id === cb.dataset.section; })[0];
      var all = sec.chapters.every(function (ch) { return state.selected.has(ch.id); });
      var none = sec.chapters.every(function (ch) { return !state.selected.has(ch.id); });
      cb.checked = all;
      cb.indeterminate = !all && !none;
    });
    updateInfo();
  }

  function availableQuestions() {
    var progress = state.onlyUnsolved ? loadProgress() : null;
    return CATALOG.questions.filter(function (q) {
      if (!state.selected.has(q.chapter)) return false;
      if (progress && isMastered(progress, q.id)) return false;
      return true;
    });
  }

  function refreshTopicCounts() {
    var progress = loadProgress();
    document.querySelectorAll("[data-chapter-count]").forEach(function (span) {
      var total = parseInt(span.dataset.total, 10);
      var ids = CHAPTER_IDS[span.dataset.chapterCount] || [];
      var mastered = ids.filter(function (id) { return isMastered(progress, id); }).length;
      span.textContent = mastered > 0 ? mastered + "/" + total + " ✓" : String(total);
    });
  }

  function updateInfo() {
    var avail = availableQuestions().length;
    $("selectedInfo").textContent =
      state.selected.size + " von " + ALL_CHAPTERS.length + " Kapiteln ausgewählt · " + avail + " Fragen verfügbar";
    $("countInfo").textContent = state.countAll
      ? "Es werden alle " + avail + " verfügbaren Fragen verwendet."
      : "Es werden " + Math.min(state.count, avail) + " Fragen verwendet.";

    var progress = loadProgress();
    var totalQ = CATALOG.questions.length;
    var mastered = masteredCount(progress);
    $("progressInfo").textContent =
      "Richtig beantwortet: " + mastered + " von " + totalQ + " Fragen (" +
      pct(mastered, totalQ) + " %)" +
      (state.onlyUnsolved
        ? " · in der aktuellen Auswahl noch " + avail + " offen"
        : "");

    var start = $("startBtn");
    start.disabled = avail === 0;
    if (state.selected.size === 0) start.textContent = "Zuerst Themen auswählen";
    else if (avail === 0) start.textContent = "Alle ausgewählten Fragen gemeistert!";
    else start.textContent = "Prüfung starten";
    refreshTopicCounts();
  }

  function setupCounts() {
    document.querySelectorAll(".chip[data-count]").forEach(function (chip) {
      chip.addEventListener("click", function () {
        var v = chip.dataset.count;
        state.countAll = v === "all";
        if (!state.countAll) {
          state.count = parseInt(v, 10);
          $("countInput").value = v;
        }
        document.querySelectorAll(".chip").forEach(function (c) { c.classList.remove("active"); });
        chip.classList.add("active");
        updateInfo();
      });
    });
    $("countInput").addEventListener("input", function () {
      var v = parseInt($("countInput").value, 10);
      state.countAll = false;
      state.count = isNaN(v) || v < 1 ? 1 : v;
      document.querySelectorAll(".chip").forEach(function (c) { c.classList.remove("active"); });
      updateInfo();
    });
    document.querySelector('.chip[data-count="20"]').classList.add("active");
  }

  function startQuiz() {
    var avail = availableQuestions();
    if (!avail.length) return;
    var progress = loadProgress();
    var pool = shuffle(avail);
    var n = state.countAll ? pool.length : Math.min(state.count, pool.length);
    state.quiz = pool.slice(0, n).map(function (q) {
      var answers = [{ text: q.correct, correct: true }].concat(
        q.wrong.map(function (w) { return { text: w, correct: false }; })
      );
      return {
        id: q.id,
        code: q.code,
        section: q.section,
        chapter: q.chapter,
        q: q.q,
        image: q.image,
        answers: shuffle(answers),
        masteredBefore: isMastered(progress, q.id),
      };
    });
    state.index = 0;
    state.results = [];
    show("quiz");
    renderQuestion();
  }

  function renderQuestion() {
    state.answered = false;
    var q = state.quiz[state.index];
    state.current = q;

    $("qCounter").textContent = "Frage " + (state.index + 1) + " / " + state.quiz.length;
    var done = state.results.length;
    var correct = state.results.filter(function (r) { return r.correct; }).length;
    $("progressFill").style.width = (state.index / state.quiz.length) * 100 + "%";
    $("scoreLive").textContent = correct + " richtig";

    $("qCode").textContent = q.code;
    $("qCat").textContent = q.category || (q.chapter + " · " + chapterName(q.chapter));
    $("qText").textContent = q.q;

    if (q.image) {
      $("qImage").src = q.image;
      $("qImageWrap").hidden = false;
    } else {
      $("qImage").removeAttribute("src");
      $("qImageWrap").hidden = true;
    }

    var ul = $("answers");
    ul.innerHTML = "";
    var letters = ["A", "B", "C", "D", "E", "F"];
    q.answers.forEach(function (a, i) {
      var li = document.createElement("li");
      li.className = "answer";
      li.dataset.index = i;
      li.innerHTML = '<span class="marker">' + letters[i] + '</span><span class="text"></span>';
      li.querySelector(".text").textContent = a.text;
      li.addEventListener("click", function () { selectAnswer(i); });
      ul.appendChild(li);
    });

    $("feedback").hidden = true;
    $("feedback").className = "feedback";
    $("checkBtn").disabled = true;
    $("checkBtn").hidden = false;
    $("nextBtn").hidden = true;
    $("nextBtn").textContent = state.index === state.quiz.length - 1 ? "Ergebnis anzeigen" : "Nächste Frage";
    q.selected = null;
  }

  function selectAnswer(i) {
    if (state.answered) return;
    state.current.selected = i;
    document.querySelectorAll(".answer").forEach(function (el) {
      el.classList.toggle("selected", parseInt(el.dataset.index, 10) === i);
    });
    $("checkBtn").disabled = false;
  }

  function checkAnswer() {
    if (state.answered) return;
    var q = state.current;
    if (q.selected == null) return;
    state.answered = true;

    var chosen = q.answers[q.selected];
    var correctIdx = q.answers.findIndex(function (a) { return a.correct; });

    document.querySelectorAll(".answer").forEach(function (el) {
      var idx = parseInt(el.dataset.index, 10);
      el.classList.add("locked");
      if (idx === correctIdx) el.classList.add("correct");
      if (idx === q.selected && !q.answers[idx].correct) el.classList.add("wrong");
      if (idx === q.selected) el.classList.remove("selected");
    });

    var fb = $("feedback");
    fb.hidden = false;
    if (chosen.correct) {
      fb.className = "feedback ok";
      fb.textContent = "Richtig!";
    } else {
      fb.className = "feedback no";
      fb.innerHTML = "Leider falsch.<span class='explain'>Richtig wäre: " + escapeHtml(q.answers[correctIdx].text) + "</span>";
    }

    state.results.push({
      id: q.id, code: q.code, section: q.section, chapter: q.chapter,
      q: q.q, image: q.image,
      correct: chosen.correct,
      chosenText: chosen.text,
      correctText: q.answers[correctIdx].text,
      masteredBefore: q.masteredBefore,
    });
    recordResult(q.id, chosen.correct);

    $("checkBtn").hidden = true;
    $("nextBtn").hidden = false;
    var c = state.results.filter(function (r) { return r.correct; }).length;
    $("scoreLive").textContent = c + " richtig";
  }

  function nextQuestion() {
    if (!state.answered) return;
    if (state.index < state.quiz.length - 1) {
      state.index++;
      renderQuestion();
    } else {
      showResults();
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function pct(c, t) { return t ? Math.round((c / t) * 100) : 0; }

  function showResults() {
    show("result");
    var total = state.results.length;
    var correct = state.results.filter(function (r) { return r.correct; }).length;
    var overall = pct(correct, total);

    $("overallPct").textContent = overall + "%";
    $("overallDetail").textContent = correct + " von " + total + " Fragen richtig";
    var v = $("verdict");
    if (overall >= 75) { v.className = "verdict pass"; v.textContent = "Bestanden"; }
    else { v.className = "verdict fail"; v.textContent = "Nicht bestanden"; }

    var newlyMastered = state.results.filter(function (r) { return r.correct && !r.masteredBefore; }).length;
    $("newMastered").textContent = newlyMastered
      ? newlyMastered + (newlyMastered === 1 ? " Frage" : " Fragen") + " neu gemeistert."
      : "";
    var progress = loadProgress();
    var mastered = masteredCount(progress);
    var totalQ = CATALOG.questions.length;
    $("progressNow").textContent =
      "Fortschritt insgesamt: " + mastered + " von " + totalQ +
      " Fragen richtig beantwortet (" + pct(mastered, totalQ) + " %).";

    var bySection = {}, byChapter = {};
    state.results.forEach(function (r) {
      [["sec", r.section, bySection], ["ch", r.chapter, byChapter]].forEach(function (x) {
        var key = x[1], box = x[2];
        if (!box[key]) box[key] = { correct: 0, total: 0 };
        box[key].total++;
        if (r.correct) box[key].correct++;
      });
    });

    $("sectionResults").innerHTML = renderRows(bySection, function (id) {
      return '<span class="r-name">' + id + ". " + escapeHtml(sectionName(id)) + "</span>";
    }, function (id) { return id; });

    $("chapterResults").innerHTML = renderRows(byChapter, function (id) {
      return '<span class="r-name">' + id + ' <span class="sub">' + escapeHtml(chapterName(id)) + "</span></span>";
    }, function (id) { return id; });

    var wrong = state.results.filter(function (r) { return !r.correct; });
    var wrap = $("reviewWrap");
    if (wrong.length) {
      wrap.hidden = false;
      $("review").innerHTML = wrong.map(function (r) {
        return '<div class="review-item">' +
          '<div class="ri-q">' + r.code + " · " + escapeHtml(r.q) + "</div>" +
          (r.image ? '<img src="' + r.image + '" alt="" />' : "") +
          '<div class="ri-line bad">Deine Antwort: ' + escapeHtml(r.chosenText) + "</div>" +
          '<div class="ri-line good">Richtig: ' + escapeHtml(r.correctText) + "</div>" +
          "</div>";
      }).join("");
    } else {
      wrap.hidden = true;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderRows(box, labelFn) {
    var keys = Object.keys(box).sort();
    return keys.map(function (id) {
      var b = box[id];
      var p = pct(b.correct, b.total);
      var cls = p >= 75 ? "good" : p >= 50 ? "mid" : "bad";
      return '<div class="result-row">' +
        '<div class="r-head">' + labelFn(id) +
        '<span class="r-pct">' + p + "% (" + b.correct + "/" + b.total + ")</span></div>" +
        '<div class="bar"><span class="' + cls + '" style="width:' + p + '%"></span></div>' +
        "</div>";
    }).join("");
  }

  function init() {
    $("footerSource").innerHTML = 'Quelle: <a href="' + CATALOG.source + '" target="_blank" rel="noopener">' +
      escapeHtml(CATALOG.title) + "</a>";
    renderTopics();
    setupCounts();

    var prefs = loadPrefs();
    state.onlyUnsolved = !!prefs.onlyUnsolved;
    $("onlyUnsolved").checked = state.onlyUnsolved;
    $("onlyUnsolved").addEventListener("change", function () {
      state.onlyUnsolved = this.checked;
      var p = loadPrefs();
      p.onlyUnsolved = state.onlyUnsolved;
      savePrefs(p);
      updateInfo();
    });
    $("resetProgress").addEventListener("click", function () {
      if (!window.confirm("Gesamten Fortschritt wirklich löschen?")) return;
      try { localStorage.removeItem(PROGRESS_KEY); } catch (e) {}
      updateInfo();
    });

    syncCheckboxes();

    $("selectAll").addEventListener("click", function () {
      ALL_CHAPTERS.forEach(function (c) { state.selected.add(c); });
      syncCheckboxes();
    });
    $("selectNone").addEventListener("click", function () {
      state.selected.clear();
      syncCheckboxes();
    });
    $("startBtn").addEventListener("click", startQuiz);
    $("checkBtn").addEventListener("click", checkAnswer);
    $("nextBtn").addEventListener("click", nextQuestion);
    $("restartBtn").addEventListener("click", function () { show("setup"); updateInfo(); });
    $("againBtn").addEventListener("click", function () { show("setup"); updateInfo(); });

    document.addEventListener("keydown", function (e) {
      if ($("screen-quiz").hidden) return;
      if (e.key === "Enter") {
        if (!$("checkBtn").hidden && !$("checkBtn").disabled) checkAnswer();
        else if (!$("nextBtn").hidden) nextQuestion();
      } else if (/^[1-9]$/.test(e.key) && !state.answered) {
        var i = parseInt(e.key, 10) - 1;
        if (i < state.current.answers.length) selectAnswer(i);
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
