/* =========================================================
   ReelRift — pure JavaScript app
   ========================================================= */

/* ---------- config ---------- */
/* The TMDb API key now lives on the server. The browser only ever
   talks to our own /api/tmdb proxy, so the key is never exposed. */
const TMDB_PROXY = "/api/tmdb";
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
async function renderHome() {
  app.innerHTML = '<div class="hero"></div>' + sectionHTML("Popular Movies", skeletons(10));
  try {
    const [pop, top, up, tv] = await Promise.all([
      tmdb("/movie/popular", { page: 1 }),
      tmdb("/movie/top_rated", { page: 1 }),
      tmdb("/movie/upcoming", { page: 1 }),
      tmdb("/tv/popular", { page: 1 }),
    ]);
    const feat = (pop.results || [])[0];
    let html = "";
    if (feat) {
      html +=
        '<section class="hero fade">' +
        (feat.backdrop_path ? '<img class="bd" src="' + IMG_BD + feat.backdrop_path + '" alt="">' : "") +
        '<div class="veil"></div><div class="hero-body">' +
        '<div class="pill-row"><span class="pill">Trending now</span><span class="pill">★ ' + rating(feat.vote_average) + '</span><span class="pill">' + year(feat.release_date) + "</span></div>" +
        "<h1>" + esc(feat.title) + "</h1><p>" + esc(feat.overview || "No overview available.") + "</p>" +
        '<button class="btn primary" data-id="' + feat.id + '" data-type="movie">▶ Watch now</button></div></section>';
    }
    html += sectionHTML("Popular Movies", gridHTML((pop.results || []).slice(0, 12), "movie"));
    html += sectionHTML("Top Rated Movies", gridHTML((top.results || []).slice(0, 12), "movie"));
    html += sectionHTML("Upcoming Movies", gridHTML((up.results || []).slice(0, 12), "movie"));
    html += sectionHTML("Popular TV Series", gridHTML((tv.results || []).slice(0, 12), "tv"));
    app.innerHTML = html;
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
      const up = await tmdb("/movie/upcoming", { page: 1 });
      html += sectionHTML("Upcoming Movies", gridHTML(up.results, "movie"));
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
    location.hash = n === "home" ? "#/" : n === "movies" ? "#/movies" : "#/tv";
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

/* =========================================================
   Anti devtools / anti inspect / anti debug
   ========================================================= */
(function protect() {
  const block = function (e) { e.preventDefault(); e.stopPropagation(); return false; };

  document.addEventListener("contextmenu", block);
  document.addEventListener("dragstart", block);
  document.addEventListener("selectstart", function (e) {
    if (!/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return block(e);
  });

  document.addEventListener("keydown", function (e) {
    const k = (e.key || "").toLowerCase();
    const combo =
      e.key === "F12" ||
      ((e.ctrlKey || e.metaKey) && e.shiftKey && ["i", "j", "c", "k", "e"].indexOf(k) !== -1) ||
      ((e.ctrlKey || e.metaKey) && ["u", "s"].indexOf(k) !== -1);
    if (combo) { block(e); warn(); }
  }, true);

  let overlay = null;
  function warn() {
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;" +
      "background:rgba(7,8,12,.96);color:#eef1f7;font:600 18px system-ui;text-align:center;padding:24px";
    overlay.innerHTML = "Developer tools are disabled on ReelRift.<br><span style='font-weight:400;font-size:14px;color:#96a0b5'>Closing this notice in a moment…</span>";
    document.body.appendChild(overlay);
    setTimeout(function () { if (overlay) { overlay.remove(); overlay = null; } }, 1800);
  }

  /* devtools open detection (window size heuristic) */
  setInterval(function () {
    const w = window.outerWidth - window.innerWidth;
    const h = window.outerHeight - window.innerHeight;
    if (w > 200 || h > 220) warn();
  }, 1500);

  /* discourage console debugging */
  try {
    if (window.console) {
      console.clear();
      console.log("%cReelRift", "color:#ff3d5a;font-size:22px;font-weight:800");
      console.log("%cInspecting this page is disabled.", "color:#96a0b5;font-size:13px");
    }
  } catch (e) {}
})();

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
