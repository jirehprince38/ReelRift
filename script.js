/* =========================================================
   ReelRift — Ultra-Modern Cinema & Streaming Engine
   Pure JavaScript, High-Performance, Zero Dependencies
   ========================================================= */

/* ---------- CONFIGURATION & CONSTANTS ---------- */
const TMDB_PROXY = "/api/tmdb";
const IMG = "https://image.tmdb.org/t/p/w500";
const IMG_SM = "https://image.tmdb.org/t/p/w300";
const IMG_BD = "https://image.tmdb.org/t/p/original";
const IMG_PROFILE = "https://image.tmdb.org/t/p/w185";

const STORAGE_KEY = "reelrift_servers";
const SITE_KEY = "reelrift_site";
const WATCHLIST_KEY = "reelrift_watchlist";

/* Embed Server Templates */
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

const GENRES = [
  { id: "", name: "All Genres" },
  { id: "28", name: "Action" },
  { id: "12", name: "Adventure" },
  { id: "16", name: "Animation" },
  { id: "35", name: "Comedy" },
  { id: "80", name: "Crime" },
  { id: "18", name: "Drama" },
  { id: "14", name: "Fantasy" },
  { id: "27", name: "Horror" },
  { id: "878", name: "Sci-Fi" },
  { id: "53", name: "Thriller" },
];

/* ---------- UTILITY FUNCTIONS ---------- */
const app = document.getElementById("app");
const esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));

const year = (d) => (d && d.length >= 4 ? d.slice(0, 4) : "—");
const rating = (v) => (v ? Number(v).toFixed(1) : "N/A");
const scrollTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

/* Toast Notification System */
function showToast(message, type = "success") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = "toast " + type;
  toast.innerHTML = (type === "success" ? "✓ " : "ℹ ") + esc(message);
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(8px)";
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

/* ---------- SITE SETTINGS & OVERRIDES (ADMIN) ---------- */
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

function loadOverrides() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
  } catch (e) {
    return {};
  }
}

function entryKey(type, id, season, episode) {
  return type === "movie" ? "movie_" + id : "tv_" + id + "_s" + (season || 1) + "_e" + (episode || 1);
}

function getStatus(type, id, season, episode) {
  const saved = loadOverrides()[entryKey(type, id, season, episode)] || {};
  return saved.status || "available";
}

const STATUS_TEXT = {
  unavailable: { title: "Title Unavailable", body: "This title is currently not available for playback on our streaming servers." },
  coming_soon: { title: "Coming Soon", body: "This release is upcoming and has not arrived on streaming servers yet. Check back soon!" },
};

function fillTemplate(tpl, values) {
  return tpl
    .replace(/\{TMDB_ID\}/g, values.id)
    .replace(/\{SEASON\}/g, values.season)
    .replace(/\{EPISODE\}/g, values.episode);
}

function buildServers(type, id, season, episode) {
  const key = type === "movie" ? "movie_" + id : `tv_${id}_s${season}_e${episode}`;
  const saved = loadOverrides()[key] || {};
  const t = TEMPLATES[type];
  const values = { id: id, season: season || 1, episode: episode || 1 };
  const labels = ["Server 1 (HD)", "Server 2 (Fast)", "Server 3 (Multi)"];

  return [1, 2, 3].map(function (n, idx) {
    const k = "server" + n;
    const custom = (saved[k] || "").trim();
    return {
      label: labels[idx] || "Server " + n,
      url: custom || fillTemplate(t[k], values),
      custom: !!custom,
    };
  });
}

/* ---------- WATCHLIST (MY LIST) SYSTEM ---------- */
function getWatchlist() {
  try {
    return JSON.parse(localStorage.getItem(WATCHLIST_KEY) || "[]") || [];
  } catch (e) {
    return [];
  }
}

function saveWatchlist(list) {
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
  updateWatchlistBadge();
}

function isInWatchlist(type, id) {
  const list = getWatchlist();
  return list.some((item) => String(item.id) === String(id) && item.type === type);
}

function toggleWatchlist(item, type) {
  let list = getWatchlist();
  const idStr = String(item.id);
  const exists = list.some((x) => String(x.id) === idStr && x.type === type);

  if (exists) {
    list = list.filter((x) => !(String(x.id) === idStr && x.type === type));
    saveWatchlist(list);
    showToast("Removed from My List");
    return false;
  } else {
    list.unshift({
      id: item.id,
      type: type,
      title: item.title || item.name || "Untitled",
      poster_path: item.poster_path || "",
      vote_average: item.vote_average || 0,
      release_date: item.release_date || item.first_air_date || "",
      added_at: Date.now(),
    });
    saveWatchlist(list);
    showToast("Added to My List");
    return true;
  }
}

function updateWatchlistBadge() {
  const list = getWatchlist();
  const count = list.length;
  ["watchlistCount", "mobileWatchlistCount"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = count;
      el.style.display = count > 0 ? "inline-block" : "none";
    }
  });
}

/* ---------- TMDB API PROXY CALL ---------- */
async function tmdb(path, params) {
  const url = new URL(TMDB_PROXY, location.origin);
  url.searchParams.set("path", path);
  Object.keys(params || {}).forEach((k) => {
    url.searchParams.set(k, params[k]);
  });
  let res;
  try {
    res = await fetch(url.toString());
  } catch (e) {
    throw new Error("Network error. Please check your internet connection.");
  }
  if (res.status === 401) throw new Error("Invalid TMDb API key configuration.");
  if (res.status === 404) throw new Error("Title not found on TMDb.");
  if (!res.ok) throw new Error("TMDb request failed (" + res.status + ").");
  try {
    return await res.json();
  } catch (e) {
    throw new Error("Received malformed data from TMDb.");
  }
}

/* ---------- HTML BUILDERS ---------- */
function posterHTML(path, title) {
  if (!path) {
    return '<div class="noimg"><span>No Poster<br><b>' + esc(title) + "</b></span></div>";
  }
  return '<img loading="lazy" decoding="async" src="' + IMG + path + '" alt="' + esc(title) + ' poster" onerror="this.src=\'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 300 450%22><rect fill=%22%2312121c%22 width=%22300%22 height=%22450%22/><text fill=%22%238b8b9f%22 x=%2250%%22 y=%2250%%22 text-anchor=%22middle%22 font-family=%22sans-serif%22 font-size=%2216%22>No Poster</text></svg>\'">';
}

function cardHTML(item, type) {
  const title = item.title || item.name || "Untitled";
  const date = item.release_date || item.first_air_date || "";
  const isBookmarked = isInWatchlist(type, item.id);

  return (
    '<article class="card fade" data-id="' + item.id + '" data-type="' + type + '">' +
    '<div class="poster">' +
    posterHTML(item.poster_path, title) +
    '<span class="card-badge rating">★ ' + rating(item.vote_average) + "</span>" +
    '<span class="card-badge quality">HD</span>' +
    '<div class="card-hover-overlay">' +
    '<button class="quick-play-btn" title="Watch Now" aria-label="Watch Now">' +
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>' +
    "</button>" +
    '<button class="quick-bookmark-btn' + (isBookmarked ? " active" : "") + '" title="' + (isBookmarked ? "Remove from List" : "Add to List") + '" data-action="bookmark" aria-label="Save to list">' +
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="' + (isBookmarked ? "currentColor" : "none") + '" stroke="currentColor" stroke-width="2.5"><path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>' +
    "</button>" +
    "</div>" +
    "</div>" +
    '<div class="card-body">' +
    '<h3 title="' + esc(title) + '">' + esc(title) + "</h3>" +
    "<small>" + (type === "movie" ? "Movie" : "Series") + " • " + year(date) + "</small>" +
    "</div></article>"
  );
}

function gridHTML(items, type) {
  if (!items || !items.length) {
    return msgHTML("No titles found", "There are currently no items to display in this section.");
  }
  return '<div class="grid">' + items.map((i) => cardHTML(i, type)).join("") + "</div>";
}

function msgHTML(title, text) {
  return '<div class="msg"><strong>' + esc(title) + "</strong><p>" + esc(text) + "</p></div>";
}

function skeletons(n) {
  let s = '<div class="grid">';
  for (let i = 0; i < n; i++) s += '<div class="skeleton"></div>';
  return s + "</div>";
}

function sectionHTML(title, inner, extraLink = "") {
  return (
    '<section class="section">' +
    '<div class="section-head">' +
    '<h2 class="section-title">' + esc(title) + "</h2>" +
    (extraLink ? '<a href="' + esc(extraLink.url) + '" class="section-link">' + esc(extraLink.label) + " &rarr;</a>" : "") +
    "</div>" +
    inner +
    "</section>"
  );
}

/* ---------- GENRE FILTER BAR ---------- */
function genreBarHTML(activeGenreId = "") {
  const items = GENRES.map((g) => {
    const active = String(g.id) === String(activeGenreId) ? " active" : "";
    return '<button class="genre-btn' + active + '" data-genre="' + g.id + '">' + esc(g.name) + "</button>";
  }).join("");
  return '<div class="genre-bar" id="genreBar">' + items + "</div>";
}

/* ---------- ABOUT & FAQ SECTIONS ---------- */
function aboutFeaturesHTML() {
  return (
    '<section class="section about-section fade">' +
    '<div class="section-head"><h2 class="section-title">The ReelRift Streaming Advantage</h2></div>' +
    '<div class="about-features-grid">' +
    '<div class="feature-box">' +
    '<div class="feature-box-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg></div>' +
    "<h3>Instant Multi-Server Playback</h3>" +
    "<p>Engineered with redundant high-speed streaming servers for seamless playback without buffer lag or downtime.</p>" +
    "</div>" +
    '<div class="feature-box">' +
    '<div class="feature-box-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg></div>' +
    "<h3>Cinema-Grade HD Streams</h3>" +
    "<p>Stream your favorite Hollywood blockbusters, indie cinema gems, and trending TV shows in crystal clear HD.</p>" +
    "</div>" +
    '<div class="feature-box">' +
    '<div class="feature-box-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg></div>' +
    "<h3>100% Free &amp; Sign-up Free</h3>" +
    "<p>Enjoy an uncompromising streaming experience with zero credit card requirements, subscriptions, or login walls.</p>" +
    "</div>" +
    "</div></section>"
  );
}

function faqHTML() {
  const faqs = [
    { q: "Is ReelRift completely free to use?", a: "Yes. ReelRift is 100% free to explore and stream. You will never be asked for payment or a credit card." },
    { q: "How do I switch playback servers if one buffers?", a: "On the watch page, click any of the Server buttons (Server 1, Server 2, or Server 3) directly underneath the video player. Each connects to an independent streaming node." },
    { q: "Where does the movie metadata come from?", a: "All movie details, cast information, high-resolution backdrops, and posters are powered directly by The Movie Database (TMDb) API." },
    { q: "Can I save movies to watch later?", a: "Yes! Click the Bookmark icon on any movie poster or on the watch page to add it to 'My List', which is saved directly to your browser." },
  ];

  const items = faqs
    .map((f) => '<details class="faq-item"><summary>' + esc(f.q) + "</summary><p>" + esc(f.a) + "</p></details>")
    .join("");

  return (
    '<section class="section faq-section fade">' +
    '<div class="section-head"><h2 class="section-title">Frequently Asked Questions</h2></div>' +
    '<div class="faq-wrap">' + items + "</div></section>"
  );
}

/* ---------- CARD CLICK & BOOKMARK DELEGATION ---------- */
if (app) {
  app.addEventListener("click", function (e) {
    const bookmarkBtn = e.target.closest('[data-action="bookmark"]');
    const card = e.target.closest("[data-id][data-type]");

    if (bookmarkBtn && card) {
      e.stopPropagation();
      const type = card.dataset.type;
      const id = card.dataset.id;
      const title = card.querySelector("h3") ? card.querySelector("h3").innerText : "Untitled";
      const posterImg = card.querySelector(".poster img");
      const poster_path = posterImg ? posterImg.getAttribute("src").replace(IMG, "") : "";
      const ratingText = card.querySelector(".card-badge.rating") ? card.querySelector(".card-badge.rating").innerText.replace("★ ", "") : "0";

      const active = toggleWatchlist(
        { id: id, title: title, poster_path: poster_path, vote_average: Number(ratingText) || 0 },
        type
      );
      bookmarkBtn.classList.toggle("active", active);
      return;
    }

    if (card && app.contains(card)) {
      location.hash = "#/" + card.dataset.type + "/" + card.dataset.id;
    }
  });
}

/* ---------- HOMEPAGE RENDERER ---------- */
async function renderHome(selectedGenre = "") {
  app.innerHTML = '<div class="hero skeleton" style="min-height:500px"></div>' + sectionHTML("Featured Titles", skeletons(12));

  try {
    const [trendRes, popRes, topRes, tvRes] = await Promise.all([
      tmdb("/trending/movie/week", { page: 1 }),
      selectedGenre
        ? tmdb("/discover/movie", { with_genres: selectedGenre, sort_by: "popularity.desc", page: 1 })
        : tmdb("/movie/popular", { page: 1 }),
      tmdb("/movie/top_rated", { page: 1 }),
      tmdb("/tv/popular", { page: 1 }),
    ]);

    const trending = (trendRes.results || []).filter((x) => x.backdrop_path);
    const feat = trending.length ? trending[Math.floor(Math.random() * Math.min(6, trending.length))] : (popRes.results || [])[0];

    let html = "";

    // 1. Hero Showcase
    if (feat) {
      const isBookmarked = isInWatchlist("movie", feat.id);
      html +=
        '<section class="hero fade">' +
        (feat.backdrop_path ? '<img class="bd" src="' + IMG_BD + feat.backdrop_path + '" alt="' + esc(feat.title) + '">' : "") +
        '<div class="veil"></div>' +
        '<div class="hero-body">' +
        '<div class="hero-pill-row">' +
        '<span class="pill hot">🔥 Trending #1</span>' +
        '<span class="pill rating">★ ' + rating(feat.vote_average) + "</span>" +
        '<span class="pill">' + year(feat.release_date) + "</span>" +
        '<span class="pill">Ultra HD</span>' +
        "</div>" +
        "<h1>" + esc(feat.title || feat.name) + "</h1>" +
        "<p>" + esc(feat.overview || "Stream this blockbuster movie instantly on ReelRift with high-speed multi-server support.") + "</p>" +
        '<div class="hero-actions">' +
        '<button class="btn btn-primary" data-id="' + feat.id + '" data-type="movie">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>' +
        " Watch Now" +
        "</button>" +
        '<button class="btn btn-secondary' + (isBookmarked ? " active" : "") + '" id="heroBookmarkBtn" data-id="' + feat.id + '" data-type="movie">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="' + (isBookmarked ? "currentColor" : "none") + '" stroke="currentColor" stroke-width="2.5"><path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>' +
        (isBookmarked ? " In My List" : " Add to List") +
        "</button>" +
        "</div>" +
        "</div></section>";
    }

    // 2. Genre Filter Bar
    html += genreBarHTML(selectedGenre);

    // 3. User's Watchlist Preview (if any)
    const watchlist = getWatchlist();
    if (watchlist.length > 0) {
      html += sectionHTML("My Watchlist (" + watchlist.length + ")", gridHTML(watchlist.slice(0, 6), "movie"), {
        url: "#/watchlist",
        label: "View All",
      });
    }

    // 4. Trending & Popular Sections
    html += sectionHTML(selectedGenre ? "Filtered Movies" : "Trending Blockbusters", gridHTML((popRes.results || []).slice(0, 14), "movie"));
    html += sectionHTML("Top Rated Masterpieces", gridHTML((topRes.results || []).slice(0, 14), "movie"));
    html += sectionHTML("Popular TV Series", gridHTML((tvRes.results || []).slice(0, 14), "tv"));

    // 5. Features & FAQ
    html += aboutFeaturesHTML();
    html += faqHTML();

    app.innerHTML = html;

    // Wire hero bookmark button
    const heroBm = document.getElementById("heroBookmarkBtn");
    if (heroBm && feat) {
      heroBm.addEventListener("click", () => {
        const active = toggleWatchlist(feat, "movie");
        heroBm.innerHTML =
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="' + (active ? "currentColor" : "none") + '" stroke="currentColor" stroke-width="2.5"><path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>' +
          (active ? " In My List" : " Add to List");
      });
    }

    // Wire Genre Buttons
    const genreBar = document.getElementById("genreBar");
    if (genreBar) {
      genreBar.addEventListener("click", (e) => {
        const btn = e.target.closest(".genre-btn");
        if (!btn) return;
        const gid = btn.dataset.genre;
        renderHome(gid);
      });
    }
  } catch (err) {
    app.innerHTML = msgHTML("Unable to load titles", err.message);
  }
}

/* ---------- MOVIES & TV LIST PAGES ---------- */
async function renderList(type) {
  app.innerHTML = sectionHTML(type === "movie" ? "Movies" : "TV Series", skeletons(12));
  try {
    const [pop, top] = await Promise.all([
      tmdb(type === "movie" ? "/movie/popular" : "/tv/popular", { page: 1 }),
      tmdb(type === "movie" ? "/movie/top_rated" : "/tv/top_rated", { page: 1 }),
    ]);

    let html = genreBarHTML();
    html += sectionHTML(type === "movie" ? "Popular Movies" : "Popular TV Shows", gridHTML(pop.results, type));
    html += sectionHTML(type === "movie" ? "Top Rated Movies" : "Critically Acclaimed Series", gridHTML(top.results, type));

    if (type === "movie") {
      const upcoming = await tmdb("/movie/upcoming", { page: 1 });
      html += sectionHTML("Upcoming Theatrical Releases", gridHTML(upcoming.results, "movie"));
    }

    app.innerHTML = html;
  } catch (err) {
    app.innerHTML = msgHTML("Error loading catalog", err.message);
  }
}

/* ---------- SEARCH PAGE ---------- */
async function renderSearch(query) {
  if (!query) {
    app.innerHTML = msgHTML("Search ReelRift", "Type keywords above to discover movies, TV series, and actors.");
    return;
  }
  app.innerHTML = sectionHTML('Results for "' + query + '"', skeletons(12));
  try {
    const [m, t] = await Promise.all([
      tmdb("/search/movie", { query: query }),
      tmdb("/search/tv", { query: query }),
    ]);
    const movies = (m && m.results) || [];
    const shows = (t && t.results) || [];

    if (!movies.length && !shows.length) {
      app.innerHTML = msgHTML("No titles found", 'Nothing matched "' + query + '". Try checking spelling or search a different keyword.');
      return;
    }

    let html = "";
    if (movies.length) html += sectionHTML("Movies (" + movies.length + ")", gridHTML(movies, "movie"));
    if (shows.length) html += sectionHTML("TV Series (" + shows.length + ")", gridHTML(shows, "tv"));
    app.innerHTML = html;
  } catch (err) {
    app.innerHTML = msgHTML("Search error", "Unable to complete search request.");
  }
}

/* ---------- WATCHLIST (MY LIST) PAGE ---------- */
function renderWatchlistPage() {
  const list = getWatchlist();
  if (!list.length) {
    app.innerHTML =
      '<div class="msg" style="padding:100px 20px;">' +
      '<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="color:var(--muted);margin-bottom:14px"><path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>' +
      "<strong>Your Watchlist is Empty</strong>" +
      "<p style=\"max-width:400px;margin:10px auto 24px\">Save movies and series to your list to easily track and watch them whenever you want.</p>" +
      '<button class="btn btn-primary" onclick="location.hash=\'#/\'">Browse Trending Titles</button>' +
      "</div>";
    return;
  }

  app.innerHTML =
    '<div class="fade">' +
    '<div class="section-head" style="margin-top:20px;">' +
    '<h2 class="section-title">My Saved Watchlist (' + list.length + ")</h2>" +
    '<button class="btn btn-sm" id="clearWatchlistBtn">Clear All</button>' +
    "</div>" +
    gridHTML(list, "movie") +
    "</div>";

  const clearBtn = document.getElementById("clearWatchlistBtn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (confirm("Are you sure you want to clear your entire watchlist?")) {
        saveWatchlist([]);
        renderWatchlistPage();
        showToast("Watchlist cleared");
      }
    });
  }
}

/* ---------- WATCH / PLAYER PAGE ENGINE ---------- */
let current = null; // { type, id, season, episode, data }

function playerHTML(title, backdropUrl) {
  return (
    '<div class="watch-container fade">' +
    '<div class="player-ambient-shell" id="playerShell">' +
    (backdropUrl ? '<div class="player-ambient-glow" style="background-image:url(' + backdropUrl + ')"></div>' : "") +
    '<div class="watch-player"><iframe id="videoPlayer" allowfullscreen allow="autoplay; fullscreen; encrypted-media; picture-in-picture" referrerpolicy="origin"></iframe></div>' +
    "</div>" +
    '<div class="player-toolbar">' +
    '<div class="player-title-info">' +
    '<h2 id="nowPlayingTitle">' + esc(title) + "</h2>" +
    '<p id="playerStatusNote">Click a server below if current video is buffering.</p>' +
    "</div>" +
    '<div class="servers-wrap" id="serverBtns"></div>' +
    '<div class="watch-actions-bar">' +
    '<button class="btn btn-sm" id="reloadServerBtn" title="Reload Video"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg> Reload</button>' +
    '<button class="btn btn-sm" id="theaterModeBtn" title="Expand Player Width"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg> Theater</button>' +
    '<button class="btn btn-sm" id="reportStreamBtn" title="Report playback issue"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg> Report</button>' +
    '<button class="btn btn-sm" id="shareBtn" title="Copy link to clipboard"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg> Share</button>' +
    "</div>" +
    "</div>" +
    "</div>"
  );
}

function mountServers() {
  const box = document.getElementById("serverBtns");
  const frame = document.getElementById("videoPlayer");
  const note = document.getElementById("playerStatusNote");
  if (!box || !frame || !current) return;

  const status = getStatus(current.type, current.id, current.season, current.episode);
  if (status !== "available") {
    const s = STATUS_TEXT[status] || STATUS_TEXT.unavailable;
    const shell = frame.parentElement;
    if (shell) {
      shell.innerHTML = '<div class="blocked"><h3>' + esc(s.title) + "</h3><p>" + esc(s.body) + "</p></div>";
    }
    box.innerHTML = "";
    if (note) note.textContent = "Playback disabled for this title.";
    return;
  }

  const servers = buildServers(current.type, current.id, current.season, current.episode);
  box.innerHTML =
    '<span class="servers-label">Servers:</span>' +
    servers
      .map(
        (s, i) =>
          '<button class="server-btn' + (i === 0 ? " active" : "") + '" data-url="' + esc(s.url) + '">' +
          '<span class="server-dot"></span> ' + esc(s.label) +
          "</button>"
      )
      .join("");

  function select(btn) {
    const url = btn.getAttribute("data-url");
    if (!url) {
      if (note) note.textContent = "Server offline. Please switch to another server.";
      return;
    }
    box.querySelectorAll(".server-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    frame.src = url;
    if (note) note.textContent = "Connecting to " + btn.innerText.trim() + "…";
  }

  box.querySelectorAll(".server-btn").forEach((b) => {
    b.addEventListener("click", (e) => {
      e.preventDefault();
      select(b);
    });
  });

  const first = box.querySelector(".server-btn");
  if (first) select(first);

  // Wire Toolbar buttons
  const reloadBtn = document.getElementById("reloadServerBtn");
  if (reloadBtn) {
    reloadBtn.onclick = () => {
      const activeBtn = box.querySelector(".server-btn.active") || first;
      if (activeBtn) select(activeBtn);
      showToast("Reloading player stream…");
    };
  }

  const theaterBtn = document.getElementById("theaterModeBtn");
  if (theaterBtn) {
    theaterBtn.onclick = () => {
      const container = document.querySelector(".watch-container");
      if (container) {
        container.style.maxWidth = container.style.maxWidth === "100%" ? "1240px" : "100%";
        theaterBtn.classList.toggle("active");
      }
    };
  }

  const shareBtn = document.getElementById("shareBtn");
  if (shareBtn) {
    shareBtn.onclick = () => {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(location.href);
        showToast("Stream link copied to clipboard!");
      }
    };
  }

  const reportBtn = document.getElementById("reportStreamBtn");
  if (reportBtn) {
    reportBtn.onclick = () => openReportModal();
  }
}

/* Cast & Recommendations Builder */
async function loadExtras(type, id) {
  try {
    const [credits, similar] = await Promise.all([
      tmdb("/" + type + "/" + id + "/credits", {}),
      tmdb("/" + type + "/" + id + "/recommendations", { page: 1 }),
    ]);

    const extrasContainer = document.getElementById("watchExtras");
    if (!extrasContainer) return;

    let html = "";

    // Cast Row
    const cast = (credits.cast || []).slice(0, 8);
    if (cast.length) {
      html +=
        '<section class="section">' +
        '<div class="section-head"><h2 class="section-title">Top Cast</h2></div>' +
        '<div class="cast-grid">' +
        cast
          .map((c) => {
            const photo = c.profile_path
              ? '<img class="cast-photo" src="' + IMG_PROFILE + c.profile_path + '" alt="' + esc(c.name) + '">'
              : '<div class="cast-photo" style="display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:10px">No Photo</div>';
            return (
              '<div class="cast-card">' +
              photo +
              '<div class="cast-name" title="' + esc(c.name) + '">' + esc(c.name) + "</div>" +
              '<div class="cast-character" title="' + esc(c.character || "") + '">' + esc(c.character || "") + "</div>" +
              "</div>"
            );
          })
          .join("") +
        "</div></section>";
    }

    // Similar / Recommended Row
    const recs = (similar.results || []).slice(0, 12);
    if (recs.length) {
      html += sectionHTML("More Like This", gridHTML(recs, type));
    }

    extrasContainer.innerHTML = html;
  } catch (e) {
    // Extras are optional; failure should not break watch page
  }
}

/* ---------- RENDER MOVIE WATCH PAGE ---------- */
async function renderMovie(id) {
  app.innerHTML = msgHTML("Loading Cinema Stream…", "Fetching stream links and movie details from TMDb.");
  try {
    const d = await tmdb("/movie/" + id, {});
    current = { type: "movie", id: d.id, season: 1, episode: 1, data: d };

    const genres = (d.genres || []).map((g) => '<span class="pill">' + esc(g.name) + "</span>").join("") || '<span class="pill">Cinema</span>';
    const isBookmarked = isInWatchlist("movie", d.id);
    const backdropUrl = d.backdrop_path ? IMG_BD + d.backdrop_path : "";

    app.innerHTML =
      playerHTML(d.title || "Movie Stream", backdropUrl) +
      '<section class="detail-grid fade">' +
      '<div class="detail-poster">' + posterHTML(d.poster_path, d.title) + "</div>" +
      '<div class="detail-content">' +
      "<h1>" + esc(d.title) + "</h1>" +
      (d.tagline ? '<div class="detail-tagline">“' + esc(d.tagline) + '”</div>' : "") +
      '<div class="hero-pill-row">' +
      '<span class="pill rating">★ ' + rating(d.vote_average) + " Rating</span>" +
      '<span class="pill">' + year(d.release_date) + "</span>" +
      '<span class="pill">' + (d.runtime ? d.runtime + " min" : "Full Feature") + "</span>" +
      genres +
      "</div>" +
      '<p class="detail-overview">' + esc(d.overview || "No synopsis available for this title.") + "</p>" +
      '<div class="meta-grid">' +
      '<div class="meta-item"><span>Status</span><strong>' + esc(d.status || "Released") + "</strong></div>" +
      '<div class="meta-item"><span>User Votes</span><strong>' + (d.vote_count || 0).toLocaleString() + "</strong></div>" +
      '<div class="meta-item"><span>Release Date</span><strong>' + esc(d.release_date || "Unknown") + "</strong></div>" +
      '<div class="meta-item"><span>TMDb ID</span><strong>' + d.id + "</strong></div>" +
      "</div>" +
      '<div class="watch-actions-bar">' +
      '<button class="btn btn-primary" id="detailBookmarkBtn">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="' + (isBookmarked ? "currentColor" : "none") + '" stroke="currentColor" stroke-width="2.5"><path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>' +
      (isBookmarked ? " In My List" : " Save to My List") +
      "</button>" +
      "</div>" +
      "</div></section>" +
      '<div id="watchExtras"></div>';

    mountServers();
    loadExtras("movie", d.id);

    const bmBtn = document.getElementById("detailBookmarkBtn");
    if (bmBtn) {
      bmBtn.onclick = () => {
        const active = toggleWatchlist(d, "movie");
        bmBtn.innerHTML =
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="' + (active ? "currentColor" : "none") + '" stroke="currentColor" stroke-width="2.5"><path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>' +
          (active ? " In My List" : " Save to My List");
      };
    }

    scrollTop();
  } catch (err) {
    app.innerHTML = msgHTML("Unable to load movie", err.message);
  }
}

/* ---------- RENDER TV SERIES WATCH PAGE ---------- */
async function renderTV(id, season, episode) {
  app.innerHTML = msgHTML("Loading TV Series Stream…", "Fetching episode catalog and server links from TMDb.");
  try {
    const d = await tmdb("/tv/" + id, {});
    const seasons = (d.seasons || []).filter((s) => s.season_number > 0);
    const list = seasons.length ? seasons : [{ season_number: 1, name: "Season 1" }];
    const sNum = Number(season) || list[0].season_number;
    const eNum = Number(episode) || 1;
    current = { type: "tv", id: d.id, season: sNum, episode: eNum, data: d };

    const genres = (d.genres || []).map((g) => '<span class="pill">' + esc(g.name) + "</span>").join("") || '<span class="pill">Series</span>';
    const isBookmarked = isInWatchlist("tv", d.id);
    const backdropUrl = d.backdrop_path ? IMG_BD + d.backdrop_path : "";

    app.innerHTML =
      playerHTML((d.name || "TV Series") + " • S" + sNum + " E" + eNum, backdropUrl) +
      '<section class="detail-grid fade">' +
      '<div class="detail-poster">' + posterHTML(d.poster_path, d.name) + "</div>" +
      '<div class="detail-content">' +
      "<h1>" + esc(d.name) + "</h1>" +
      (d.tagline ? '<div class="detail-tagline">“' + esc(d.tagline) + '”</div>' : "") +
      '<div class="hero-pill-row">' +
      '<span class="pill rating">★ ' + rating(d.vote_average) + " Rating</span>" +
      '<span class="pill">Season ' + sNum + ", Episode " + eNum + "</span>" +
      '<span class="pill">' + (d.number_of_seasons || list.length) + " Seasons</span>" +
      genres +
      "</div>" +
      '<p class="detail-overview">' + esc(d.overview || "No overview available for this series.") + "</p>" +
      '<div class="meta-grid">' +
      '<div class="meta-item"><span>First Aired</span><strong>' + esc(d.first_air_date || "Unknown") + "</strong></div>" +
      '<div class="meta-item"><span>Total Episodes</span><strong>' + (d.number_of_episodes || "—") + "</strong></div>" +
      '<div class="meta-item"><span>Status</span><strong>' + esc(d.status || "Ongoing") + "</strong></div>" +
      '<div class="meta-item"><span>TMDb ID</span><strong>' + d.id + "</strong></div>" +
      "</div>" +
      '<div class="watch-actions-bar">' +
      '<button class="btn btn-primary" id="detailBookmarkBtn">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="' + (isBookmarked ? "currentColor" : "none") + '" stroke="currentColor" stroke-width="2.5"><path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>' +
      (isBookmarked ? " In My List" : " Save to My List") +
      "</button>" +
      '<button class="btn btn-secondary" id="prevEpBtn">&larr; Prev Episode</button>' +
      '<button class="btn btn-secondary" id="nextEpBtn">Next Episode &rarr;</button>' +
      "</div>" +
      "</div></section>" +
      '<section class="tv-episodes-section fade">' +
      '<div class="section-head"><h2 class="section-title">Select Season &amp; Episode</h2></div>' +
      '<div class="season-selector" id="seasonChips">' +
      list.map((s) => '<button class="season-tab' + (s.season_number === sNum ? " active" : "") + '" data-season="' + s.season_number + '">' + esc(s.name || "Season " + s.season_number) + "</button>").join("") +
      '</div><div id="episodeArea"></div></section>' +
      '<div id="watchExtras"></div>';

    mountServers();
    loadExtras("tv", d.id);

    // Season Selector
    document.getElementById("seasonChips").addEventListener("click", function (e) {
      const chip = e.target.closest(".season-tab");
      if (!chip) return;
      location.hash = "#/tv/" + d.id + "/" + chip.dataset.season + "/1";
    });

    loadEpisodes(d.id, sNum, eNum);

    // Prev / Next Episode buttons
    const prevBtn = document.getElementById("prevEpBtn");
    const nextBtn = document.getElementById("nextEpBtn");
    if (prevBtn) {
      prevBtn.onclick = () => {
        if (current.episode > 1) {
          location.hash = "#/tv/" + d.id + "/" + current.season + "/" + (current.episode - 1);
        } else {
          showToast("You are on the first episode of this season.");
        }
      };
    }
    if (nextBtn) {
      nextBtn.onclick = () => {
        location.hash = "#/tv/" + d.id + "/" + current.season + "/" + (current.episode + 1);
      };
    }

    const bmBtn = document.getElementById("detailBookmarkBtn");
    if (bmBtn) {
      bmBtn.onclick = () => {
        const active = toggleWatchlist(d, "tv");
        bmBtn.innerHTML =
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="' + (active ? "currentColor" : "none") + '" stroke="currentColor" stroke-width="2.5"><path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>' +
          (active ? " In My List" : " Save to My List");
      };
    }

    scrollTop();
  } catch (err) {
    app.innerHTML = msgHTML("Error loading series", err.message);
  }
}

async function loadEpisodes(id, season, activeEp) {
  const area = document.getElementById("episodeArea");
  if (!area) return;
  area.innerHTML = msgHTML("Loading episodes…", "Fetching episode stills and titles from TMDb.");
  try {
    const s = await tmdb("/tv/" + id + "/season/" + season, {});
    const eps = s.episodes || [];
    if (!eps.length) {
      area.innerHTML = msgHTML("No episodes cataloged", "TMDb has not indexed episodes for this season yet.");
      return;
    }
    area.innerHTML =
      '<div class="eplist">' +
      eps
        .map(function (ep) {
          const img = ep.still_path
            ? '<img loading="lazy" src="' + IMG_SM + ep.still_path + '" alt="Episode ' + ep.episode_number + '">'
            : '<div class="noimg" style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--muted);font-size:12px">No Preview</div>';
          return (
            '<article class="ep' + (ep.episode_number === activeEp ? " active" : "") + '" data-ep="' + ep.episode_number + '">' +
            '<div class="thumb">' + img + "</div>" +
            '<div class="info">' +
            "<h4>Episode " + ep.episode_number + " • " + esc(ep.name || "Episode " + ep.episode_number) + "</h4>" +
            "<small>" + esc(ep.air_date || "Unknown date") + " • ★ " + rating(ep.vote_average) + "</small>" +
            "<p>" + esc(ep.overview || "No episode summary available.") + "</p>" +
            "</div></article>"
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
      const t = document.getElementById("nowPlayingTitle");
      if (t) {
        t.textContent = t.textContent.replace(/E\d+/, "E" + current.episode);
      }
      mountServers();
      scrollTop();
    });
  } catch (err) {
    area.innerHTML = msgHTML("Could not load episodes", err.message);
  }
}

/* ---------- LIVE INSTANT SEARCH & DROPDOWN ---------- */
(function setupLiveSearch() {
  const input = document.getElementById("searchInput");
  const dropdown = document.getElementById("liveSearchDropdown");
  const clearBtn = document.getElementById("clearSearchBtn");
  if (!input || !dropdown) return;

  let debounceTimer = null;

  async function performLiveSearch(q) {
    if (!q || q.length < 2) {
      dropdown.classList.remove("open");
      dropdown.innerHTML = "";
      return;
    }

    try {
      const [mRes, tRes] = await Promise.all([
        tmdb("/search/movie", { query: q }),
        tmdb("/search/tv", { query: q }),
      ]);

      const movies = (mRes.results || []).slice(0, 3).map((x) => ({ ...x, media_type: "movie" }));
      const shows = (tRes.results || []).slice(0, 3).map((x) => ({ ...x, media_type: "tv" }));
      const combined = [...movies, ...shows];

      if (!combined.length) {
        dropdown.innerHTML = '<div style="padding:16px;text-align:center;color:var(--muted);font-size:13px">No quick results found for "' + esc(q) + '"</div>';
        dropdown.classList.add("open");
        return;
      }

      dropdown.innerHTML =
        '<div class="ls-list">' +
        combined
          .map((item) => {
            const title = item.title || item.name || "Untitled";
            const date = item.release_date || item.first_air_date || "";
            const poster = item.poster_path ? IMG_SM + item.poster_path : "";
            return (
              '<div class="ls-item" data-id="' + item.id + '" data-type="' + item.media_type + '">' +
              (poster
                ? '<img class="ls-poster" src="' + poster + '" alt="">'
                : '<div class="ls-poster" style="display:flex;align-items:center;justify-content:center;font-size:9px;color:var(--muted)">No Poster</div>') +
              '<div class="ls-info">' +
              '<div class="ls-title">' + esc(title) + "</div>" +
              '<div class="ls-meta">' +
              '<span class="ls-badge">' + (item.media_type === "movie" ? "Movie" : "Series") + "</span>" +
              "<span>" + year(date) + "</span>" +
              '<span style="color:var(--star-gold)">★ ' + rating(item.vote_average) + "</span>" +
              "</div></div></div>"
            );
          })
          .join("") +
        "</div>" +
        '<div class="ls-footer" id="lsViewAllBtn">View all results for "' + esc(q) + '" &rarr;</div>';

      dropdown.classList.add("open");

      // Dropdown item clicks
      dropdown.querySelectorAll(".ls-item").forEach((el) => {
        el.addEventListener("click", () => {
          location.hash = "#/" + el.dataset.type + "/" + el.dataset.id;
          dropdown.classList.remove("open");
          input.value = "";
          if (clearBtn) clearBtn.style.display = "none";
        });
      });

      const viewAll = document.getElementById("lsViewAllBtn");
      if (viewAll) {
        viewAll.addEventListener("click", () => {
          location.hash = "#/search/" + encodeURIComponent(q);
          dropdown.classList.remove("open");
        });
      }
    } catch (e) {
      // Quiet fail
    }
  }

  input.addEventListener("input", () => {
    const q = input.value.trim();
    if (clearBtn) clearBtn.style.display = q ? "block" : "none";
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => performLiveSearch(q), 280);
  });

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      input.value = "";
      clearBtn.style.display = "none";
      dropdown.classList.remove("open");
      input.focus();
    });
  }

  // Close dropdown on click outside
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-box")) {
      dropdown.classList.remove("open");
    }
  });

  // Enter triggers full search
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const q = input.value.trim();
      if (q) {
        dropdown.classList.remove("open");
        location.hash = "#/search/" + encodeURIComponent(q);
      }
    }
  });

  const searchBtn = document.getElementById("searchBtn");
  if (searchBtn) {
    searchBtn.addEventListener("click", () => {
      const q = input.value.trim();
      if (q) {
        dropdown.classList.remove("open");
        location.hash = "#/search/" + encodeURIComponent(q);
      }
    });
  }
})();

/* ---------- REPORT STREAM MODAL ---------- */
function openReportModal() {
  const modal = document.getElementById("reportModal");
  if (modal) modal.style.display = "flex";
}
function closeReportModal() {
  const modal = document.getElementById("reportModal");
  if (modal) modal.style.display = "none";
}

(function setupReportModal() {
  const closeBtn = document.getElementById("closeReportModal");
  const cancelBtn = document.getElementById("cancelReportBtn");
  const submitBtn = document.getElementById("submitReportBtn");
  if (closeBtn) closeBtn.onclick = closeReportModal;
  if (cancelBtn) cancelBtn.onclick = closeReportModal;

  if (submitBtn) {
    submitBtn.onclick = async () => {
      const type = document.getElementById("reportIssueType").value;
      const note = (document.getElementById("reportNote").value || "").trim();
      submitBtn.disabled = true;
      submitBtn.innerText = "Submitting…";

      try {
        await fetch("/api/public/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: (current && current.data && (current.data.title || current.data.name)) || "Stream",
            issueType: type,
            note: note,
            mediaType: (current && current.type) || "unknown",
            mediaId: (current && current.id) || 0,
            season: (current && current.season) || 1,
            episode: (current && current.episode) || 1,
            reportedAt: new Date().toISOString(),
          }),
        });
      } catch (e) {
        // Fallback
      }

      submitBtn.disabled = false;
      submitBtn.innerText = "Submit Report";
      closeReportModal();
      showToast("Report submitted. Thank you for your feedback!", "success");
    };
  }
})();

/* ---------- APP ROUTER ---------- */
function setActiveNav(name) {
  document.querySelectorAll(".nav button, .mobile-bottom-nav button").forEach(function (b) {
    b.classList.toggle("active", b.dataset.nav === name);
  });
}

function route() {
  const hash = location.hash.replace(/^#\/?/, "");
  const parts = hash.split("/").filter(Boolean);

  if (!parts.length) {
    setActiveNav("home");
    return renderHome();
  }
  if (parts[0] === "movies") {
    setActiveNav("movies");
    return renderList("movie");
  }
  if (parts[0] === "tv" && parts.length === 1) {
    setActiveNav("tv");
    return renderList("tv");
  }
  if (parts[0] === "watchlist") {
    setActiveNav("watchlist");
    return renderWatchlistPage();
  }
  if (parts[0] === "search") {
    setActiveNav("");
    return renderSearch(decodeURIComponent(parts[1] || ""));
  }
  if (parts[0] === "movie" && parts[1]) {
    setActiveNav("movies");
    return renderMovie(parts[1]);
  }
  if (parts[0] === "tv" && parts[1]) {
    setActiveNav("tv");
    return renderTV(parts[1], parts[2], parts[3]);
  }

  app.innerHTML = msgHTML("Page Not Found", "The requested page does not exist on ReelRift.");
}

if (app) window.addEventListener("hashchange", route);

document.querySelectorAll("[data-nav]").forEach(function (el) {
  el.addEventListener("click", function (e) {
    e.preventDefault();
    const n = el.dataset.nav;
    location.hash = n === "home" ? "#/" : n === "movies" ? "#/movies" : n === "tv" ? "#/tv" : "#/watchlist";
  });
});

/* Init */
updateWatchlistBadge();
if (app) route();

/* ---------- FOOTER ATTRIBUTION ---------- */
(function renderFooter() {
  const el = document.getElementById("siteFooter");
  if (!el) return;
  const site = loadSite();
  const link = (site.discord || "").trim();

  el.innerHTML =
    '<div class="foot-main">Reel<span style="color:var(--brand-bright)">Rift</span> Cinema Stream</div>' +
    '<div class="foot-sub">' +
    (link
      ? '<a class="btn btn-sm btn-primary" href="' + esc(link) + '" target="_blank" rel="noopener noreferrer">Join our Discord Community</a>'
      : '<span style="color:var(--muted)">Made with &hearts; for movie &amp; series lovers worldwide.</span>') +
    "</div>" +
    '<div class="foot-sub" style="font-size:12px;color:var(--muted);max-width:760px;margin-top:12px;">' +
    "ReelRift does not host or store any media files on its servers. All streams are delivered through third-party media embeds. Metadata and promotional artwork provided courtesy of TMDb. This product uses the TMDb API but is not certified or endorsed by TMDb." +
    "</div>";
})();
