(function () {
    "use strict";

    // ---- Preloader ----
    var preloader = document.getElementById("preloader");
    function hidePreloader() {
        if (!preloader || preloader.classList.contains("is-hidden")) return;
        preloader.classList.add("is-hidden");
        document.body.classList.remove("is-loading");
        setTimeout(function () {
            if (preloader && preloader.parentNode) {
                preloader.parentNode.removeChild(preloader);
            }
        }, 700);
    }
    // Hide shortly after load, with a minimum display time so it doesn't flash
    var startTime = Date.now();
    window.addEventListener("load", function () {
        var elapsed = Date.now() - startTime;
        var minShow = 900;
        setTimeout(hidePreloader, Math.max(0, minShow - elapsed));
    });
    // Safety fallback in case 'load' is delayed
    setTimeout(hidePreloader, 6000);

    // ---- Mobile nav toggle ----
    var toggle = document.getElementById("navToggle");
    var nav = document.getElementById("nav");

    function closeNav() {
        nav.classList.remove("is-open");
        toggle.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
    }

    if (toggle && nav) {
        toggle.addEventListener("click", function () {
            var open = nav.classList.toggle("is-open");
            toggle.classList.toggle("is-open", open);
            toggle.setAttribute("aria-expanded", open ? "true" : "false");
        });

        nav.querySelectorAll("a").forEach(function (link) {
            link.addEventListener("click", closeNav);
        });

        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape") closeNav();
        });
    }

    // ---- Header shadow on scroll ----
    var header = document.querySelector(".header");
    window.addEventListener("scroll", function () {
        if (window.scrollY > 8) {
            header.style.boxShadow = "0 10px 30px rgba(0,0,0,0.35)";
        } else {
            header.style.boxShadow = "none";
        }
    }, { passive: true });

    // ---- Current year ----
    var yearEl = document.getElementById("year");
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    // ---- Booking form ----
    var form = document.getElementById("bookingForm");
    var note = document.getElementById("formNote");
    if (form) {
        form.addEventListener("submit", function (e) {
            e.preventDefault();
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }
            if (note) note.hidden = false;
            form.querySelector("button[type=submit]").textContent = "Request Sent \u2713";
            form.reset();
            setTimeout(function () {
                if (note) note.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 50);
        });
    }

    // ---- Scroll progress bar ----
    var progress = document.createElement("div");
    progress.className = "scroll-progress";
    document.body.appendChild(progress);

    // ---- Back-to-top spinning-gear button ----
    var toTop = document.createElement("button");
    toTop.className = "to-top";
    toTop.setAttribute("aria-label", "Back to top");
    toTop.innerHTML =
        '<svg viewBox="0 0 100 100" aria-hidden="true">' +
        '<path fill="currentColor" d="M50 6l5 3 6-1 4 5 6 1 2 5 6 3v6l4 5-2 6 3 5-4 5 1 6-5 3-2 6-6 1-3 5-6-1-5 4-5-2-5 2-5-4-6 1-3-5-6-1-2-6-5-3 1-6-4-5 3-5-2-6 4-5v-6l6-3 2-5 6-1 4-5 6 1z"/>' +
        '<circle cx="50" cy="50" r="22" fill="#0b0b0c"/>' +
        '<path fill="currentColor" d="M50 33l11 11h-7v13h-8V44h-7z"/>' +
        '</svg>';
    document.body.appendChild(toTop);
    toTop.addEventListener("click", function () {
        window.scrollTo({ top: 0, behavior: "smooth" });
    });

    function onScroll() {
        var h = document.documentElement;
        var scrolled = h.scrollTop || document.body.scrollTop;
        var height = h.scrollHeight - h.clientHeight;
        var pct = height > 0 ? (scrolled / height) * 100 : 0;
        progress.style.width = pct + "%";
        toTop.classList.toggle("is-visible", scrolled > 500);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    // ---- Count-up numbers + animated rating bars ----
    function animateCount(elm) {
        var target = parseFloat(elm.getAttribute("data-count"));
        var dec = parseInt(elm.getAttribute("data-decimals") || "0", 10);
        var suffix = elm.getAttribute("data-suffix") || "";
        var dur = 1300, start = null;
        function step(ts) {
            if (!start) start = ts;
            var p = Math.min((ts - start) / dur, 1);
            var eased = 1 - Math.pow(1 - p, 3);
            elm.textContent = (target * eased).toFixed(dec) + suffix;
            if (p < 1) requestAnimationFrame(step);
            else elm.textContent = target.toFixed(dec) + suffix;
        }
        requestAnimationFrame(step);
    }

    if ("IntersectionObserver" in window) {
        var fxObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                var t = entry.target;
                if (t.hasAttribute("data-count")) animateCount(t);
                if (t.classList.contains("rating-bars")) {
                    t.querySelectorAll(".rating-bar__fill").forEach(function (f) {
                        var w = f.getAttribute("data-w") || f.style.width;
                        f.style.width = w;
                    });
                }
                fxObserver.unobserve(t);
            });
        }, { threshold: 0.4 });

        document.querySelectorAll("[data-count]").forEach(function (el) {
            fxObserver.observe(el);
        });
        var bars = document.querySelector(".rating-bars");
        if (bars) {
            bars.querySelectorAll(".rating-bar__fill").forEach(function (f) {
                f.setAttribute("data-w", f.style.width);
                f.style.width = "0%";
            });
            fxObserver.observe(bars);
        }
    }

    // ---- Spotlight follow on service cards ----
    document.querySelectorAll(".service").forEach(function (card) {
        card.addEventListener("mousemove", function (e) {
            var r = card.getBoundingClientRect();
            card.style.setProperty("--mx", ((e.clientX - r.left) / r.width * 100) + "%");
            card.style.setProperty("--my", ((e.clientY - r.top) / r.height * 100) + "%");
        });
    });

    // ---- Reveal on scroll ----
    if ("IntersectionObserver" in window) {
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add("in-view");
                    io.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12 });

        document.querySelectorAll(".card, .section__head, .ctaband__inner, .mobile__content, .mobile__media")
            .forEach(function (el) {
                el.classList.add("reveal");
                io.observe(el);
            });
    }
})();
