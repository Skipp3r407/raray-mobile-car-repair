(function () {
    "use strict";

    var PHONE = "954-295-9213";
    var PHONE_TEL = "9542959213";
    var KB = window.BMCR_KB || [];

    // ---- Text processing ----
    var STOPWORDS = {
        "a":1,"an":1,"the":1,"is":1,"are":1,"am":1,"do":1,"does":1,"did":1,"i":1,"my":1,
        "me":1,"you":1,"your":1,"we":1,"to":1,"of":1,"in":1,"on":1,"for":1,"and":1,"or":1,
        "it":1,"its":1,"this":1,"that":1,"with":1,"at":1,"be":1,"can":1,"could":1,"would":1,
        "should":1,"have":1,"has":1,"had":1,"get":1,"got":1,"will":1,"if":1,"so":1,"as":1,
        "what":1,"whats":1,"how":1,"when":1,"where":1,"who":1,"why":1,"which":1,"please":1,
        "there":1,"here":1,"about":1,"from":1,"up":1,"out":1,"any":1,"some":1,"need":1
    };

    // Synonym / normalization map -> canonical token(s)
    var SYNONYMS = {
        "wont":"not","won't":"not","cant":"not","can't":"not","doesnt":"not","doesn't":"not",
        "isnt":"not","ac":"air conditioning","a/c":"air conditioning","ck":"check",
        "engin":"engine","brakes":"brake","braking":"brake","batteries":"battery",
        "tyres":"tire","tyre":"tire","tires":"tire","wheels":"wheel","lights":"light",
        "diagnostic":"diagnostics","diagnose":"diagnostics","scan":"diagnostics",
        "price":"pricing","prices":"pricing","cost":"pricing","costs":"pricing","quote":"pricing",
        "estimate":"pricing","charge":"pricing","fee":"pricing","appointment":"book",
        "appt":"book","schedule":"book","booking":"book","reserve":"book","fix":"repair",
        "fixed":"repair","repairs":"repair","fixing":"repair","servicing":"service",
        "services":"service","mechanic":"mechanic","stranded":"emergency","towing":"tow",
        "overheat":"overheating","overheated":"overheating","starting":"start","starts":"start",
        "started":"start","cranking":"crank","cranks":"crank","cranked":"crank",
        "dead":"dead","jumpstart":"jump","jump-start":"jump","squeaking":"squeal",
        "squeak":"squeal","squealing":"squeal","squeaky":"squeal","grinding":"grind",
        "shaking":"shake","shakes":"shake","vibrating":"vibrate","vibration":"vibrate",
        "vibrates":"vibrate","leaking":"leak","leaks":"leak","leaked":"leak",
        "smells":"smell","smelling":"smell","noises":"noise","sounds":"noise","sound":"noise",
        "phone":"phone","number":"phone","call":"phone","text":"phone","contact":"phone",
        "hours":"hours","open":"hours","today":"today","now":"now","area":"area",
        "serve":"serve","service area":"area","come":"come","location":"location",
        "transmission":"transmission","trans":"transmission","alternator":"alternator",
        "starter":"starter","spark":"spark","plug":"spark","plugs":"spark",
        "check engine":"check engine","cel":"check engine","oil change":"oil",
        "warranty":"warranty","guarantee":"warranty","guaranteed":"warranty","warrantied":"warranty",
        "hi":"hello","hey":"hello","yo":"hello","sup":"hello","hiya":"hello",
        "thanks":"thank","thx":"thank","ty":"thank"
    };

    function normalize(text) {
        return String(text)
            .toLowerCase()
            .replace(/[^a-z0-9'\/\- ]+/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function tokenize(text) {
        var norm = normalize(text);
        // multi-word synonym phrases first
        norm = norm.replace(/check engine/g, "checkengine")
                   .replace(/air conditioning/g, "airconditioning");
        var raw = norm.split(" ");
        var out = [];
        for (var i = 0; i < raw.length; i++) {
            var t = raw[i];
            if (!t) continue;
            if (SYNONYMS[t]) t = SYNONYMS[t];
            t = t.replace(/[''\-\/]/g, "");
            if (!t || STOPWORDS[t]) continue;
            // light stemming
            if (t.length > 4 && /ing$/.test(t)) t = t.slice(0, -3);
            else if (t.length > 4 && /s$/.test(t) && !/ss$/.test(t)) t = t.slice(0, -1);
            out.push(t);
        }
        return out;
    }

    // ---- Build index with IDF weighting ----
    var df = {};
    var docs = KB.map(function (entry) {
        var toks = tokenize(entry.q);
        var set = {};
        toks.forEach(function (t) { set[t] = (set[t] || 0) + 1; });
        Object.keys(set).forEach(function (t) { df[t] = (df[t] || 0) + 1; });
        return { entry: entry, tf: set, toks: toks };
    });
    var N = docs.length || 1;
    function idf(t) {
        return Math.log((N + 1) / ((df[t] || 0) + 1)) + 1;
    }

    function score(queryToks, doc) {
        if (!queryToks.length) return 0;
        var s = 0, matched = 0;
        var qset = {};
        queryToks.forEach(function (t) { qset[t] = true; });
        Object.keys(qset).forEach(function (t) {
            if (doc.tf[t]) { s += idf(t); matched++; }
        });
        if (!matched) return 0;
        // normalize by query length, reward coverage
        var coverage = matched / Object.keys(qset).length;
        var docLenPenalty = 1 / Math.sqrt(doc.toks.length + 1);
        return s * (0.5 + 0.5 * coverage) * (0.7 + 0.6 * docLenPenalty);
    }

    function search(query, limit) {
        var qToks = tokenize(query);
        var results = [];
        for (var i = 0; i < docs.length; i++) {
            var sc = score(qToks, docs[i]);
            if (sc > 0) results.push({ doc: docs[i], score: sc });
        }
        results.sort(function (a, b) { return b.score - a.score; });
        return results.slice(0, limit || 4);
    }

    // ---- Suggestions ----
    var STARTERS = [
        "Do you offer same-day service?",
        "How much for brake repair?",
        "My check engine light is on",
        "My car won't start",
        "What areas do you serve?",
        "How do I book an appointment?",
        "My AC isn't cold",
        "Do you come to me?"
    ];

    // ---- DOM helpers ----
    function el(tag, cls, html) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (html != null) n.innerHTML = html;
        return n;
    }

    var root = document.getElementById("chatbot");
    if (!root) return;
    var toggleBtn = document.getElementById("chatToggle");
    var panel = document.getElementById("chatPanel");
    var closeBtn = document.getElementById("chatClose");
    var body = document.getElementById("chatBody");
    var form = document.getElementById("chatForm");
    var input = document.getElementById("chatInput");
    var chipsWrap = document.getElementById("chatChips");

    var opened = false;

    function escapeHtml(s) {
        return String(s).replace(/[&<>"]/g, function (c) {
            return { "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;" }[c];
        });
    }

    function linkify(text) {
        // make phone number clickable
        return escapeHtml(text).replace(
            /954-295-9213/g,
            '<a href="tel:' + PHONE_TEL + '">954-295-9213</a>'
        );
    }

    function scrollDown() {
        body.scrollTop = body.scrollHeight;
    }

    function addMsg(text, who) {
        var row = el("div", "cbot__row cbot__row--" + who);
        if (who === "bot") {
            row.appendChild(el("div", "cbot__avatar", "&#9881;"));
        }
        var bubble = el("div", "cbot__bubble cbot__bubble--" + who);
        bubble.innerHTML = linkify(text);
        row.appendChild(bubble);
        body.appendChild(row);
        scrollDown();
        return row;
    }

    function addTyping() {
        var row = el("div", "cbot__row cbot__row--bot");
        row.appendChild(el("div", "cbot__avatar", "&#9881;"));
        var bubble = el("div", "cbot__bubble cbot__bubble--bot cbot__typing",
            "<span></span><span></span><span></span>");
        row.appendChild(bubble);
        body.appendChild(row);
        scrollDown();
        return row;
    }

    function addSuggestions(list) {
        if (!list || !list.length) return;
        var wrap = el("div", "cbot__suggests");
        wrap.appendChild(el("div", "cbot__suggests-label", "Related questions:"));
        list.forEach(function (q) {
            var b = el("button", "cbot__suggest", escapeHtml(q));
            b.type = "button";
            b.addEventListener("click", function () { handleUser(q); });
            wrap.appendChild(b);
        });
        body.appendChild(wrap);
        scrollDown();
    }

    function addCallCta() {
        var wrap = el("div", "cbot__cta");
        wrap.innerHTML = '<a class="cbot__call" href="tel:' + PHONE_TEL + '">' +
            '<span aria-hidden="true">&#9742;</span> Call ' + PHONE + '</a>';
        body.appendChild(wrap);
        scrollDown();
    }

    function respond(query) {
        var results = search(query, 4);
        var typing = addTyping();

        setTimeout(function () {
            if (typing && typing.parentNode) typing.parentNode.removeChild(typing);

            var best = results[0];
            if (best && best.score >= 1.1) {
                addMsg(best.doc.entry.a, "bot");
                var related = results.slice(1, 4)
                    .filter(function (r) { return r.score > 0.6; })
                    .map(function (r) { return r.doc.entry.q; });
                addSuggestions(related);
                // contextually offer a call button for service-y answers
                if (/call|book|quote|diagnos|same-day/i.test(best.doc.entry.a)) {
                    addCallCta();
                }
            } else if (best && best.score > 0.45) {
                addMsg("I think this might help:", "bot");
                addMsg(best.doc.entry.a, "bot");
                var alt = results.slice(0, 3).map(function (r) { return r.doc.entry.q; });
                addSuggestions(alt);
            } else {
                addMsg("I'm not totally sure about that one \u2014 but our mechanic can help! " +
                       "Call or text " + PHONE + " for same-day mobile service across Broward County. " +
                       "You can also try asking about brakes, batteries, diagnostics, pricing, or booking.", "bot");
                addCallCta();
                addSuggestions(STARTERS.slice(0, 4));
            }
        }, 480 + Math.random() * 350);
    }

    function handleUser(text) {
        text = (text || "").trim();
        if (!text) return;
        addMsg(text, "user");
        input.value = "";
        respond(text);
    }

    // ---- Welcome ----
    var welcomed = false;
    function welcome() {
        if (welcomed) return;
        welcomed = true;
        addMsg("Hi! \uD83D\uDC4B I'm the Broward Mobile Car Repair assistant. " +
               "Ask me about our services, pricing, your service area, or describe a car problem \u2014 " +
               "I know 500+ answers. How can I help?", "bot");
        if (chipsWrap && !chipsWrap.childElementCount) {
            STARTERS.forEach(function (q) {
                var b = el("button", "cbot__chip", escapeHtml(q));
                b.type = "button";
                b.addEventListener("click", function () {
                    handleUser(q);
                });
                chipsWrap.appendChild(b);
            });
        }
    }

    // ---- Open / close ----
    function openPanel() {
        opened = true;
        panel.classList.add("is-open");
        toggleBtn.classList.add("is-active");
        toggleBtn.setAttribute("aria-expanded", "true");
        welcome();
        setTimeout(function () { input.focus(); }, 250);
    }
    function closePanel() {
        opened = false;
        panel.classList.remove("is-open");
        toggleBtn.classList.remove("is-active");
        toggleBtn.setAttribute("aria-expanded", "false");
    }

    toggleBtn.addEventListener("click", function () {
        opened ? closePanel() : openPanel();
    });
    if (closeBtn) closeBtn.addEventListener("click", closePanel);

    form.addEventListener("submit", function (e) {
        e.preventDefault();
        handleUser(input.value);
    });

    // Deep-link: open chat automatically when URL ends with #chat
    if (location.hash === "#chat") {
        setTimeout(openPanel, 400);
    }

    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && opened) closePanel();
    });
})();
