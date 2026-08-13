/* =========================================================
   ReelRift — pure JavaScript app
   ========================================================= */

/* ---------- config ---------- */
/* The TMDb API key now lives on the server. The browser only ever
   talks to our own /api/tmdb proxy, so the key is never exposed. */
// Ilagay ito sa pinakataas ng iyong script.js
(function() {
    const urlParams = new URLSearchParams(window.location.search);
    const type = urlParams.get('type');
    const id = urlParams.get('id');

    if (type && id) {
        // Isasalin nito ang parameter patungo sa iyong hash route (#/movie/id)
        window.location.hash = `/${type}/${id}`;
    }
})();

const TMDB_PROXY = "/api/public/tmdb";
const IMG = "https://image.tmdb.org/t/p/w500";
const IMG_SM = "https://image.tmdb.org/t/p/w300";
const IMG_BD = "https://image.tmdb.org/t/p/original";
const STORAGE_KEY = "reelrift_servers";
const SITE_KEY = "reelrift_site";

/* ---------- site settings (admin editable) ---------- */
function loadSite() {
  try {
    return JSON.parse(localStorage.getItem(SITE_KEY) || "{}") || {};
  } catch (e) {
    return {};
  }
}
function saveSite(obj) {
  localStorage.setItem(SITE_KEY, JSON.stringify(obj));
}

/* ---------- availability status ---------- */
function entryKey(type, id, season, episode) {
  return type === "movie" ? "movie_" + id : "tv_" + id + "_s" + (season || 1) + "_e" + (episode || 1);
}
function getStatus(type, id, season, episode) {
  const saved = loadOverrides()[entryKey(type, id, season, episode)] || {};
  return saved.status || "available";
}
const STATUS_TEXT = {
  unavailable: { title: "Status: Unavailable", body: "This title is currently unavailable and cannot be watched." },
  coming_soon: { title: "Status: Coming Soon", body: "This title is not released for streaming yet. Please check back later." },
};

/* ---------- reusable embed URL templates ---------- */
const TEMPLATES = {
  movie: {
    server1: "https://vsembed.ru/embed/movie?tmdb={TMDB_ID}",
    server2: "https://cinesrc.st/embed/movie/{TMDB_ID}",
    server3: "https://vidfast.vc/movie/{TMDB_ID}?autoPlay=true",
  },
  tv: {
    server1: "https://vsembed.ru/embed/tv/{TMDB_ID}/{SEASON}/{EPISODE}",
    server2: "https://cinesrc.st/embed/tv/{TMDB_ID}?s={SEASON}&e={EPISODE}",
    server3: "https://multiembed.mov/?video_id={TMDB_ID}&tmdb=1&s={SEASON}&e={EPISODE}",
  },
};

function fillTemplate(tpl, values) {
  return tpl
    .replace(/\{TMDB_ID\}/g, values.id)
    .replace(/\{SEASON\}/g, values.season)
    .replace(/\{EPISODE\}/g, values.episode);
}

/* admin overrides from localStorage */
function loadOverrides() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
  } catch (e) {
    return {};
  }
}

function buildServers(type, id, season, episode) {
  const key = type === "movie" ? "movie_" + id : `tv_${id}_s${season}_e${episode}`;
  const saved = loadOverrides()[key] || {};
  const t = TEMPLATES[type];
  const values = { id: id, season: season || 1, episode: episode || 1 };
  return [1, 2, 3].map(function (n) {
    const k = "server" + n;
    const custom = (saved[k] || "").trim();
    return { label: "Server " + n, url: custom || fillTemplate(t[k], values), custom: !!custom };
  });
}

/* ---------- TMDb fetch ---------- */
async function tmdb(path, params) {
  const url = new URL(TMDB_PROXY, location.origin);
  url.searchParams.set("path", path);
  Object.keys(params || {}).forEach(function (k) {
    url.searchParams.set(k, params[k]);
  });
  let res;
  try {
    res = await fetch(url.toString());
  } catch (e) {
    throw new Error("Network error. Please check your internet connection and try again.");
  }
  if (res.status === 401) throw new Error("Invalid TMDb API key. Please check the configuration.");
  if (res.status === 404) throw new Error("We couldn't find that title on TMDb.");
  if (!res.ok) throw new Error("TMDb request failed (" + res.status + "). Please try again later.");
  try {
    return await res.json();
  } catch (e) {
    throw new Error("Received invalid data from TMDb.");
  }
}

/* ---------- helpers ---------- */
const app = document.getElementById("app");
const esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const year = (d) => (d && d.length >= 4 ? d.slice(0, 4) : "—");
const rating = (v) => (v ? Number(v).toFixed(1) : "N/A");
const scrollTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

function posterHTML(path, title) {
  if (!path) return '<div class="noimg">No poster available<br>' + esc(title) + "</div>";
  return '<img loading="lazy" src="' + IMG + path + '" alt="' + esc(title) + ' poster">';
}

function cardHTML(item, type) {
  const title = item.title || item.name || "Untitled";
  const date = item.release_date || item.first_air_date || "";
  return (
    '<article class="card fade" data-id="' + item.id + '" data-type="' + type + '">' +
    '<div class="poster">' + posterHTML(item.poster_path, title) +
    '<span class="badge star">★ ' + rating(item.vote_average) + "</span></div>" +
    '<div class="card-body"><h3 title="' + esc(title) + '">' + esc(title) + "</h3>" +
    "<small>" + (type === "movie" ? "Movie" : "TV") + " · " + year(date) + "</small></div></article>"
  );
}

function gridHTML(items, type) {
  if (!items || !items.length) return msgHTML("Nothing here", "No titles were returned for this section.");
  return '<div class="grid">' + items.map((i) => cardHTML(i, type)).join("") + "</div>";
}

function msgHTML(title, text) {
  return '<div class="msg"><strong>' + esc(title) + "</strong>" + esc(text) + "</div>";
}

function skeletons(n) {
  let s = '<div class="grid">';
  for (let i = 0; i < n; i++) s += '<div class="skeleton"></div>';
  return s + "</div>";
}

function sectionHTML(title, inner) {
  return '<section class="section"><div class="section-head"><h2>' + esc(title) + "</h2></div>" + inner + "</section>";
}

/* card click delegation */
if (app) app.addEventListener("click", function (e) {
  const card = e.target.closest("[data-id][data-type]");
  if (card && app.contains(card)) {
    location.hash = "#/" + card.dataset.type + "/" + card.dataset.id;
  }
});

/* ---------- pages ---------- */
/* ---------- home sub-sections ---------- */
function aboutHTML() {
  return (
    '<section class="section about fade"><div class="about-card">' +
    "<h2>What is ReelRift?</h2>" +
    "<p>ReelRift is a modern streaming interface for discovering and watching popular movies and TV series. " +
    "Browse what's trending, search for anything you like, and start watching instantly with multiple playback " +
    "servers — all in one clean, fast, dark-themed experience. No account or payment required.</p>" +
    "</div></section>"
  );
}

function faqHTML() {
  const faqs = [
    { q: "Is ReelRift free to use?", a: "Yes. ReelRift is completely free to browse and stream. No account or payment is required." },
    { q: "Where does the content come from?", a: "Title details and posters come from TMDb. Playback is provided through third-party streaming servers." },
    { q: "What if a title won't play?", a: "Try switching to a different server using the server buttons on the watch page. Some titles may be temporarily unavailable or not released for streaming yet." },
    { q: "Do I need to sign up?", a: "No sign up is needed. Just search or browse and press Watch now." },
  ];
  const items = faqs
    .map(function (f) {
      return '<details class="faq-item"><summary>' + esc(f.q) + "</summary><p>" + esc(f.a) + "</p></details>";
    })
    .join("");
  return '<section class="section faq fade"><div class="section-head"><h2>Frequently Asked Questions</h2></div>' + items + "</section>";
}

function homeSearchHTML() {
  return (
    '<section class="section home-search fade"><div class="hs-card">' +
    "<h2>Find something to watch</h2>" +
    '<div class="hs-row">' +
    '<input id="homeSearchInput" type="search" placeholder="Search movies or TV series…" autocomplete="off" aria-label="Search movies or TV series" />' +
    '<button class="btn primary" id="homeSearchBtn">Search</button>' +
    "</div></div></section>"
  );
}

function wireHomeSearch() {
  const input = document.getElementById("homeSearchInput");
  const btn = document.getElementById("homeSearchBtn");
  if (!input || !btn) return;
  const go = function () {
    const q = (input.value || "").trim();
    if (!q) { input.focus(); return; }
    location.hash = "#/search/" + encodeURIComponent(q);
  };
  btn.addEventListener("click", go);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.isComposing && e.keyCode !== 229) go();
  });
}

async function renderHome() {
  app.innerHTML = '<div class="hero"></div>' + skeletons(6);
  try {
    const [trend, pop] = await Promise.all([
      tmdb("/trending/movie/week", { page: 1 }),
      tmdb("/movie/popular", { page: 1 }),
    ]);
    /* Real trending: pick from this week's trending so the hero changes as
       trending changes. Rotate through the top few for freshness. */
    const trending = (trend.results || []).filter((x) => x.backdrop_path);
    const feat = trending.length
      ? trending[Math.floor(Math.random() * Math.min(5, trending.length))]
      : (pop.results || [])[0];

    let html = "";
    if (feat) {
      html +=
        '<section class="hero fade">' +
        (feat.backdrop_path ? '<img class="bd" src="' + IMG_BD + feat.backdrop_path + '" alt="">' : "") +
        '<div class="veil"></div><div class="hero-body">' +
        '<div class="pill-row"><span class="pill">Trending now</span><span class="pill">★ ' + rating(feat.vote_average) + '</span><span class="pill">' + year(feat.release_date) + "</span></div>" +
        "<h1>" + esc(feat.title || feat.name) + "</h1><p>" + esc(feat.overview || "No overview available.") + "</p>" +
        '<button class="btn primary" data-id="' + feat.id + '" data-type="movie">▶ Watch now</button></div></section>';
    }

    html += aboutHTML();
    html += faqHTML();
    html += homeSearchHTML();

    app.innerHTML = html;
    wireHomeSearch();
  } catch (err) {
    app.innerHTML = msgHTML("Couldn't load the homepage", err.message);
  }
}

async function renderList(type) {
  app.innerHTML = sectionHTML(type === "movie" ? "Movies" : "TV Series", skeletons(12));
  try {
    const a = await tmdb(type === "movie" ? "/movie/popular" : "/tv/popular", { page: 1 });
    const b = await tmdb(type === "movie" ? "/movie/top_rated" : "/tv/top_rated", { page: 1 });
    let html = sectionHTML(type === "movie" ? "Popular Movies" : "Popular TV Series", gridHTML(a.results, type));
    html += sectionHTML(type === "movie" ? "Top Rated Movies" : "Top Rated TV Series", gridHTML(b.results, type));
    if (type === "movie") {
      const [up, now] = await Promise.all([
        tmdb("/movie/upcoming", { page: 1 }),
        tmdb("/movie/now_playing", { page: 1 }),
      ]);
      const today = new Date().toISOString().slice(0, 10);
      const nowIds = new Set((now.results || []).map(function (m) { return m.id; }));
      /* TMDb's "upcoming" list still includes titles that already premiered in
         some regions, which is why released movies were showing up there.
         Keep only titles whose release date is still in the future and that are
         not already playing. */
      let upcoming = (up.results || [])
        .filter(function (m) { return m.release_date && m.release_date >= today && !nowIds.has(m.id); })
        .sort(function (a, b) { return a.release_date < b.release_date ? -1 : 1; });
      if (upcoming.length < 6) {
        /* Fallback: ask TMDb directly for titles releasing after today. */
        try {
          const disc = await tmdb("/discover/movie", {
            sort_by: "popularity.desc",
            "primary_release_date.gte": today,
            "vote_count.gte": 0,
            with_release_type: "2|3",
            page: 1,
          });
          const seen = {};
          upcoming = upcoming.concat(disc.results || []).filter(function (m) {
            if (!m.release_date || m.release_date < today || nowIds.has(m.id) || seen[m.id]) return false;
            seen[m.id] = 1;
            return true;
          }).sort(function (a, b) { return a.release_date < b.release_date ? -1 : 1; });
        } catch (e) { /* keep whatever we have */ }
      }
      upcoming = upcoming.slice(0, 18);
      html += sectionHTML("In Cinemas Now", gridHTML((now.results || []).slice(0, 18), "movie"));
      if (upcoming.length) {
        html += sectionHTML("Upcoming Movies", gridHTML(upcoming, "movie"));
      }
    }
    app.innerHTML = html;
  } catch (err) {
    app.innerHTML = msgHTML("Couldn't load titles", err.message);
  }
}

async function renderSearch(query) {
  app.innerHTML = sectionHTML('Results for "' + query + '"', skeletons(12));
  try {
    const [m, t] = await Promise.all([
      tmdb("/search/movie", { query: query }),
      tmdb("/search/tv", { query: query }),
    ]);
    const movies = (m && m.results) || [];
    const shows = (t && t.results) || [];
    if (!movies.length && !shows.length) {
      app.innerHTML = msgHTML("No results found", 'Nothing matched "' + query + '". Try a different spelling or keyword.');
      return;
    }
    let html = "";
    if (movies.length) html += sectionHTML("Movies · " + movies.length, gridHTML(movies, "movie"));
    if (shows.length) html += sectionHTML("TV Series · " + shows.length, gridHTML(shows, "tv"));
    app.innerHTML = html;
  } catch (err) {
    app.innerHTML = msgHTML("Search failed", "Network error. Please try again.");
  }
}

/* ---------- watch page ---------- */
let current = null; // { type, id, season, episode, data }

function playerHTML(title) {
  return (
    '<section class="section fade">' +
    '<div class="watch-player"><iframe id="videoPlayer" allowfullscreen allow="autoplay; fullscreen; encrypted-media" referrerpolicy="origin"></iframe></div>' +
    '<div class="center" style="max-width:1200px;margin:14px auto 0"><h2 id="nowPlaying" style="font-size:17px">' + esc(title) + "</h2></div>" +
    '<div class="servers" id="serverBtns"></div>' +
    '<div id="playerNote" class="center" style="color:var(--muted);font-size:13px"></div>' +
    "</section>"
  );
}

function mountServers() {
  const box = document.getElementById("serverBtns");
  const frame = document.getElementById("videoPlayer");
  const note = document.getElementById("playerNote");
  if (!box || !frame || !current) return;
  const status = getStatus(current.type, current.id, current.season, current.episode);
  if (status !== "available") {
    const s = STATUS_TEXT[status] || STATUS_TEXT.unavailable;
    const shell = frame.parentElement;
    if (shell) {
      shell.innerHTML =
        '<div class="blocked"><h3>' + esc(s.title) + "</h3><p>" + esc(s.body) + "</p></div>";
    }
    box.innerHTML = "";
    if (note) note.textContent = "Playback is disabled for this title.";
    return;
  }
  const servers = buildServers(current.type, current.id, current.season, current.episode);
  box.innerHTML = servers
    .map((s, i) => '<button class="server-btn' + (i === 0 ? " active" : "") + '" data-url="' + esc(s.url) + '">' + s.label + "</button>")
    .join("");
  function select(btn) {
    const url = btn.getAttribute("data-url");
    if (!url) {
      note.textContent = "This server has no URL configured. Please pick another server.";
      return;
    }
    box.querySelectorAll(".server-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    frame.src = url;
    note.textContent = "If playback doesn't start, try another server.";
  }
  box.querySelectorAll(".server-btn").forEach(function (b) {
    b.addEventListener("click", function (e) {
      e.preventDefault();
      select(b);
    });
  });
  const first = box.querySelector(".server-btn");
  if (first) select(first);
}

async function renderMovie(id) {
  app.innerHTML = msgHTML("Loading…", "Fetching movie details from TMDb.");
  try {
    const d = await tmdb("/movie/" + id, {});
    current = { type: "movie", id: d.id, season: 1, episode: 1 };
    const genres = (d.genres || []).map((g) => '<span class="pill">' + esc(g.name) + "</span>").join("") || '<span class="pill">Unknown</span>';
    app.innerHTML =
      playerHTML(d.title || "Untitled") +
      '<section class="detail fade">' +
      '<div class="poster">' + posterHTML(d.poster_path, d.title) + "</div><div>" +
      "<h1>" + esc(d.title) + "</h1>" +
      '<div class="pill-row">' + genres + "</div>" +
      '<p class="ov">' + esc(d.overview || "No overview available for this title.") + "</p>" +
      '<div class="meta">' +
      "<div><span>Rating</span>★ " + rating(d.vote_average) + "</div>" +
      "<div><span>Votes</span>" + (d.vote_count || 0).toLocaleString() + "</div>" +
      "<div><span>Release date</span>" + esc(d.release_date || "Unknown") + "</div>" +
      "<div><span>Runtime</span>" + (d.runtime ? d.runtime + " min" : "Unknown") + "</div>" +
      "<div><span>TMDb ID</span>" + d.id + "</div></div></div></section>";
    mountServers();
    scrollTop();
  } catch (err) {
    app.innerHTML = msgHTML("Couldn't load this movie", err.message);
  }
}

async function renderTV(id, season, episode) {
  app.innerHTML = msgHTML("Loading…", "Fetching series details from TMDb.");
  try {
    const d = await tmdb("/tv/" + id, {});
    const seasons = (d.seasons || []).filter((s) => s.season_number > 0);
    const list = seasons.length ? seasons : [{ season_number: 1, name: "Season 1" }];
    const sNum = Number(season) || list[0].season_number;
    const eNum = Number(episode) || 1;
    current = { type: "tv", id: d.id, season: sNum, episode: eNum };

    app.innerHTML =
      playerHTML((d.name || "Untitled") + " · S" + sNum + "E" + eNum) +
      '<section class="detail fade">' +
      '<div class="poster">' + posterHTML(d.poster_path, d.name) + "</div><div>" +
      "<h1>" + esc(d.name) + "</h1>" +
      '<div class="pill-row">' + ((d.genres || []).map((g) => '<span class="pill">' + esc(g.name) + "</span>").join("") || '<span class="pill">Unknown</span>') + "</div>" +
      '<p class="ov">' + esc(d.overview || "No overview available for this series.") + "</p>" +
      '<div class="meta">' +
      "<div><span>Rating</span>★ " + rating(d.vote_average) + "</div>" +
      "<div><span>First air date</span>" + esc(d.first_air_date || "Unknown") + "</div>" +
      "<div><span>Seasons</span>" + (d.number_of_seasons || list.length) + "</div>" +
      "<div><span>Episodes</span>" + (d.number_of_episodes || "Unknown") + "</div>" +
      "<div><span>TMDb ID</span>" + d.id + "</div></div></div></section>" +
      '<section class="section" style="max-width:1200px;margin:26px auto">' +
      "<div class=\"section-head\"><h2>Seasons</h2></div>" +
      '<div class="chips" id="seasonChips">' +
      list.map((s) => '<button class="chip' + (s.season_number === sNum ? " active" : "") + '" data-season="' + s.season_number + '">' + esc(s.name || "Season " + s.season_number) + "</button>").join("") +
      '</div><div id="episodeArea"></div></section>';

    mountServers();
    document.getElementById("seasonChips").addEventListener("click", function (e) {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      location.hash = "#/tv/" + d.id + "/" + chip.dataset.season + "/1";
    });
    loadEpisodes(d.id, sNum, eNum);
    scrollTop();
  } catch (err) {
    app.innerHTML = msgHTML("Couldn't load this series", err.message);
  }
}

async function loadEpisodes(id, season, activeEp) {
  const area = document.getElementById("episodeArea");
  if (!area) return;
  area.innerHTML = msgHTML("Loading episodes…", "");
  try {
    const s = await tmdb("/tv/" + id + "/season/" + season, {});
    const eps = s.episodes || [];
    if (!eps.length) {
      area.innerHTML = msgHTML("No episodes found", "TMDb has no episode data for this season yet.");
      return;
    }
    area.innerHTML =
      '<div class="eplist">' +
      eps
        .map(function (ep) {
          const img = ep.still_path
            ? '<img loading="lazy" src="' + IMG_SM + ep.still_path + '" alt="">'
            : '<div class="noimg" style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--muted);font-size:12px">No image</div>';
          return (
            '<article class="ep' + (ep.episode_number === activeEp ? " active" : "") + '" data-ep="' + ep.episode_number + '">' +
            '<div class="thumb">' + img + "</div><div class=\"info\">" +
            "<h4>E" + ep.episode_number + " · " + esc(ep.name || "Episode " + ep.episode_number) + "</h4>" +
            "<small>" + esc(ep.air_date || "Unknown air date") + " · ★ " + rating(ep.vote_average) + "</small>" +
            "<p>" + esc(ep.overview || "No overview available.") + "</p></div></article>"
          );
        })
        .join("") +
      "</div>";
    area.addEventListener("click", function (e) {
      const el = e.target.closest(".ep");
      if (!el) return;
      current.episode = Number(el.dataset.ep);
      area.querySelectorAll(".ep").forEach((x) => x.classList.remove("active"));
      el.classList.add("active");
      const t = document.getElementById("nowPlaying");
      if (t) t.textContent = t.textContent.replace(/S\d+E\d+/, "S" + current.season + "E" + current.episode);
      mountServers();
      scrollTop();
    });
  } catch (err) {
    area.innerHTML = msgHTML("Couldn't load episodes", err.message);
  }
}


/* ---------- updates & report page ---------- */
function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch (e) { return ""; }
}

async function renderUpdates() {
  app.innerHTML = sectionHTML("Updates", '<div class="msg">Loading updates…</div>');
  let items = [];
  try {
    const res = await fetch("/api/public/announcements", { headers: { "Cache-Control": "no-store" } });
    const data = await res.json();
    items = data.announcements || [];
  } catch (e) { items = []; }

  const list = items.length
    ? '<div class="updates-list">' + items.map(function (a) {
        return '<article class="update-card' + (a.pinned ? " pinned" : "") + '">' +
          '<div class="update-meta">' + (a.pinned ? '<span class="pill">Pinned</span>' : "") +
          '<span class="update-date">' + esc(fmtDate(a.created_at)) + "</span></div>" +
          "<h3>" + esc(a.title) + "</h3><p>" + esc(a.body) + "</p></article>";
      }).join("") + "</div>"
    : '<div class="msg">No announcements yet. Check back soon.</div>';

  const form =
    '<section class="section fade"><div class="report-card">' +
    "<h2>Report an issue</h2>" +
    '<p class="report-sub">Broken playback, wrong title, or a bug? Send it straight to the ReelRift admin team.</p>' +
    '<div class="row2">' +
    '<div class="field"><label for="rName">Your name <span class="opt">(optional)</span></label><input id="rName" maxlength="120" placeholder="Name" /></div>' +
    '<div class="field"><label for="rEmail">Email <span class="opt">(optional)</span></label><input id="rEmail" type="email" maxlength="160" placeholder="you@example.com" /></div>' +
    "</div>" +
    '<div class="field"><label for="rCat">Report type</label><select id="rCat">' +
    '<option value="broken_video">Video won\u2019t play</option>' +
    '<option value="wrong_title">Wrong title or details</option>' +
    '<option value="bug">Website bug</option>' +
    '<option value="request">Title request</option>' +
    '<option value="general">Something else</option>' +
    "</select></div>" +
    '<div class="field"><label for="rMsg">Message</label><textarea id="rMsg" rows="5" maxlength="4000" placeholder="Tell us what happened, and include the title name if you can."></textarea></div>' +
    '<button class="btn primary" id="rSend">Submit report</button>' +
    '<div class="error hidden" id="rErr"></div><div class="ok hidden" id="rOk"></div>' +
    "</div></section>";

  app.innerHTML =
    '<section class="section page-head fade"><h1>Updates &amp; Reports</h1>' +
    "<p>Announcements from the ReelRift team, plus a direct line to report problems.</p></section>" +
    sectionHTML("Latest announcements", list) + form;

  wireReportForm();
}

function wireReportForm() {
  const btn = document.getElementById("rSend");
  if (!btn) return;
  const err = document.getElementById("rErr");
  const ok = document.getElementById("rOk");
  btn.addEventListener("click", async function () {
    const msg = (document.getElementById("rMsg").value || "").trim();
    err.classList.add("hidden"); ok.classList.add("hidden");
    if (msg.length < 5) {
      err.textContent = "Please describe the issue first.";
      err.classList.remove("hidden");
      return;
    }
    btn.disabled = true;
    btn.textContent = "Sending…";
    try {
      const res = await fetch("/api/public/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: document.getElementById("rName").value,
          email: document.getElementById("rEmail").value,
          category: document.getElementById("rCat").value,
          message: msg,
        }),
      });
      const data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || "Could not send your report.");
      ok.textContent = "Thanks! Your report was sent to the admin team.";
      ok.classList.remove("hidden");
      document.getElementById("rMsg").value = "";
    } catch (e) {
      err.textContent = e.message || "Network error. Please try again.";
      err.classList.remove("hidden");
    } finally {
      btn.disabled = false;
      btn.textContent = "Submit report";
    }
  });
}

/* ---------- router ---------- */
function setActiveNav(name) {
  document.querySelectorAll(".nav button").forEach(function (b) {
    b.classList.toggle("active", b.dataset.nav === name);
  });
}

function route() {
  const hash = location.hash.replace(/^#\/?/, "");
  const parts = hash.split("/").filter(Boolean);
  if (!parts.length) { setActiveNav("home"); return renderHome(); }
  if (parts[0] === "updates") { setActiveNav("updates"); return renderUpdates(); }
  if (parts[0] === "movies") { setActiveNav("movies"); return renderList("movie"); }
  if (parts[0] === "tv" && parts.length === 1) { setActiveNav("tv"); return renderList("tv"); }
  if (parts[0] === "search") { setActiveNav(""); return renderSearch(decodeURIComponent(parts[1] || "")); }
  if (parts[0] === "movie" && parts[1]) { setActiveNav("movies"); return renderMovie(parts[1]); }
  if (parts[0] === "tv" && parts[1]) { setActiveNav("tv"); return renderTV(parts[1], parts[2], parts[3]); }
  app.innerHTML = msgHTML("Page not found", "That page doesn't exist on ReelRift.");
}

if (app) window.addEventListener("hashchange", route);

document.querySelectorAll("[data-nav]").forEach(function (el) {
  el.addEventListener("click", function (e) {
    e.preventDefault();
    const n = el.dataset.nav;
    location.hash = n === "home" ? "#/" : n === "movies" ? "#/movies" : n === "updates" ? "#/updates" : "#/tv";
  });
});

function doSearch() {
  const input = document.getElementById("searchInput");
  const q = (input.value || "").trim();
  if (!q) { input.focus(); return; }
  location.hash = "#/search/" + encodeURIComponent(q);
}
if (document.getElementById("searchBtn")) {
  document.getElementById("searchBtn").addEventListener("click", doSearch);
  document.getElementById("searchInput").addEventListener("keydown", function (e) {
    if (e.key === "Enter") doSearch();
  });
}

if (app) route();

/* ---------- footer (Made by Myticmoth + Discord) ---------- */
(function renderFooter() {
  const el = document.getElementById("siteFooter");
  if (!el) return;
  const site = loadSite();
  const link = (site.discord || "").trim();
  el.innerHTML =
    '<div class="foot-main">Made by <b>Myticmoth</b></div>' +
    (link
      ? '<div class="foot-sub"><a class="btn primary" href="' + esc(link) + '" target="_blank" rel="noopener noreferrer">Join our Discord server</a></div>'
      : '<div class="foot-sub" style="color:var(--muted)">Discord server coming soon.</div>') +
    '<div class="foot-sub" style="color:var(--muted);font-size:12px">Metadata by TMDb. This product uses the TMDb API but is not endorsed or certified by TMDb.</div>';
})();
