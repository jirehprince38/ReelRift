
(function () {
  const $ = (id) => document.getElementById(id);
  const show = (el, on) => el.classList.toggle("hidden", !on);

  /* ---------- auth (server-side, HttpOnly cookie) ---------- */
  function setLogged(on) {
    show($("loginView"), !on);
    show($("panelView"), on);
    show($("logoutBtn"), on);
    if (on) { renderTable(); loadReports(); loadAnnouncements(); }
  }

  async function doLogin() {
    const u = $("user").value.trim(), p = $("pass").value;
    $("loginBtn").disabled = true;
    show($("loginErr"), false);
    try {
      const res = await fetch("/api/public/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password: p }),
      });
      if (res.ok) {
        setLogged(true);
      } else {
        const data = await res.json().catch(() => ({}));
        $("loginErr").textContent = data.error || "Invalid username or password.";
        show($("loginErr"), true);
      }
    } catch (e) {
      $("loginErr").textContent = "Network error. Please try again.";
      show($("loginErr"), true);
    } finally {
      $("loginBtn").disabled = false;
    }
  }

  $("loginBtn").addEventListener("click", doLogin);
  $("pass").addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });
  $("logoutBtn").addEventListener("click", async function () {
    try { await fetch("/api/public/admin-logout", { method: "POST" }); } catch (e) {}
    setLogged(false);
  });

  /* check existing session on load */
  (async function () {
    try {
      const res = await fetch("/api/public/admin-session", { headers: { "Cache-Control": "no-store" } });
      const data = await res.json().catch(() => ({}));
      setLogged(!!data.loggedIn);
    } catch (e) {
      setLogged(false);
    }
  })();

  /* ---------- storage helpers ---------- */
  function readAll() {
    try { return JSON.parse(localStorage.getItem("reelrift_servers") || "{}") || {}; }
    catch (e) { return {}; }
  }
  function writeAll(obj) { localStorage.setItem("reelrift_servers", JSON.stringify(obj)); }

  /* ---------- site settings (discord) ---------- */
  const SITE = "reelrift_site";
  function readSite() { try { return JSON.parse(localStorage.getItem(SITE) || "{}") || {}; } catch (e) { return {}; } }
  $("discord").value = readSite().discord || "";
  $("dSave").addEventListener("click", function () {
    const v = $("discord").value.trim();
    if (v && !/^https?:\/\//i.test(v)) {
      $("dErr").textContent = "Discord URL must start with http:// or https://";
      show($("dErr"), true); show($("dOk"), false); return;
    }
    const s = readSite(); s.discord = v;
    localStorage.setItem(SITE, JSON.stringify(s));
    show($("dErr"), false);
    $("dOk").textContent = v ? "Discord link saved." : "Discord link cleared.";
    show($("dOk"), true);
  });

  let sel = null; // { type, id, title }

  function currentKey() {
    if (!sel) return null;
    if (sel.type === "movie") return "movie_" + sel.id;
    const s = $("aSeason").value || 1, e = $("aEpisode").value || 1;
    return "tv_" + sel.id + "_s" + s + "_e" + e;
  }

  /* ---------- search ---------- */
  async function search() {
    const type = $("aType").value;
    const q = $("aQuery").value.trim();
    show($("aErr"), false);
    if (!q) { $("aErr").textContent = "Please enter a search query."; show($("aErr"), true); return; }
    $("aResults").innerHTML = '<div class="msg">Searching…</div>';
    try {
      const data = await tmdb("/search/" + type, { query: q });
      const items = data.results || [];
      if (!items.length) { $("aResults").innerHTML = '<div class="msg">No results found.</div>'; return; }
      $("aResults").innerHTML = items.map(function (i) {
        const title = (i.title || i.name || "Untitled").replace(/</g, "&lt;");
        const date = i.release_date || i.first_air_date || "";
        const img = i.poster_path ? '<img src="https://image.tmdb.org/t/p/w200' + i.poster_path + '" alt="">' : "<img alt=''>";
        return '<div class="res" data-id="' + i.id + '">' + img +
          "<div><b>" + title + "</b><small>" + (date ? date.slice(0, 4) : "—") + " · TMDb ID: " + i.id + " · ★ " + (i.vote_average ? i.vote_average.toFixed(1) : "N/A") + "</small></div></div>";
      }).join("");
      $("aResults").querySelectorAll(".res").forEach(function (el) {
        el.addEventListener("click", function () {
          selectTitle(type, el.dataset.id, el.querySelector("b").textContent);
        });
      });
    } catch (err) {
      $("aResults").innerHTML = "";
      $("aErr").textContent = err.message || "Network error. Please try again.";
      show($("aErr"), true);
    }
  }
  $("aSearch").addEventListener("click", search);
  $("aQuery").addEventListener("keydown", (e) => { if (e.key === "Enter") search(); });

  /* ---------- selection ---------- */
  async function selectTitle(type, id, title) {
    sel = { type: type, id: id, title: title };
    $("aSelected").innerHTML = "<b>" + title + "</b><br><small style='color:var(--muted)'>Type: " + type + " · TMDb ID: " + id + "</small>";
    show($("aSeasonRow"), type === "tv");
    if (type === "tv") await loadSeasons(id);
    loadForm();
  }

  async function loadSeasons(id) {
    $("aSeason").innerHTML = "<option>…</option>";
    try {
      const d = await tmdb("/tv/" + id, {});
      const seasons = (d.seasons || []).filter((s) => s.season_number > 0);
      const list = seasons.length ? seasons : [{ season_number: 1 }];
      $("aSeason").innerHTML = list.map((s) => '<option value="' + s.season_number + '">Season ' + s.season_number + "</option>").join("");
      await loadEpisodes();
    } catch (e) {
      $("aSeason").innerHTML = '<option value="1">Season 1</option>';
      $("aEpisode").innerHTML = '<option value="1">Episode 1</option>';
    }
  }

  async function loadEpisodes() {
    if (!sel || sel.type !== "tv") return;
    $("aEpisode").innerHTML = "<option>…</option>";
    try {
      const s = $("aSeason").value;
      const d = await tmdb("/tv/" + sel.id + "/season/" + s, {});
      const eps = d.episodes || [];
      $("aEpisode").innerHTML = eps.length
        ? eps.map((e) => '<option value="' + e.episode_number + '">E' + e.episode_number + " · " + (e.name || "Episode " + e.episode_number).replace(/</g, "") + "</option>").join("")
        : '<option value="1">Episode 1</option>';
      loadForm();
    } catch (e) {
      $("aEpisode").innerHTML = '<option value="1">Episode 1</option>';
    }
  }
  $("aSeason").addEventListener("change", loadEpisodes);
  $("aEpisode").addEventListener("change", loadForm);

  /* ---------- form ---------- */
  function loadForm() {
    const key = currentKey();
    const saved = key ? readAll()[key] || {} : {};
    $("s1").value = saved.server1 || "";
    $("s2").value = saved.server2 || "";
    $("s3").value = saved.server3 || "";
    $("aStatus").value = saved.status || "available";
    show($("aOk"), false); show($("aSaveErr"), false);
  }

  $("aFill").addEventListener("click", function () {
    if (!sel) return flagErr("Select a title first.");
    const season = sel.type === "tv" ? $("aSeason").value : 1;
    const episode = sel.type === "tv" ? $("aEpisode").value : 1;
    const servers = buildServers(sel.type, sel.id, season, episode);
    $("s1").value = servers[0].url; $("s2").value = servers[1].url; $("s3").value = servers[2].url;
  });

  function flagErr(m) { $("aSaveErr").textContent = m; show($("aSaveErr"), true); show($("aOk"), false); }
  function flagOk(m) { $("aOk").textContent = m; show($("aOk"), true); show($("aSaveErr"), false); }

  $("aSave").addEventListener("click", function () {
    const key = currentKey();
    if (!key) return flagErr("Select a movie or TV episode first.");
    const vals = { server1: $("s1").value.trim(), server2: $("s2").value.trim(), server3: $("s3").value.trim() };
    const status = $("aStatus").value;
    const bad = Object.keys(vals).filter((k) => vals[k] && !/^https?:\/\//i.test(vals[k]));
    if (bad.length) return flagErr("Server URLs must start with http:// or https://");
    if (status === "available" && !vals.server1 && !vals.server2 && !vals.server3) return flagErr("Enter at least one server URL, or use “Fill with templates”.");
    vals.status = status;
    const all = readAll();
    all[key] = vals;
    writeAll(all);
    flagOk("Saved settings for " + key);
    renderTable();
  });

  $("aDelete").addEventListener("click", function () {
    const key = currentKey();
    if (!key) return flagErr("Select a movie or TV episode first.");
    const all = readAll();
    if (!all[key]) return flagErr("No saved settings for " + key);
    delete all[key];
    writeAll(all);
    loadForm();
    flagOk("Deleted " + key);
    renderTable();
  });

  /* ---------- saved table ---------- */
  function renderTable() {
    const all = readAll();
    const keys = Object.keys(all);
    if (!keys.length) { $("aTable").innerHTML = '<div class="msg">No saved settings yet.</div>'; return; }
    $("aTable").innerHTML =
      '<table class="saved"><thead><tr><th>Key</th><th>Status</th><th>Server 1</th><th>Server 2</th><th>Server 3</th><th></th></tr></thead><tbody>' +
      keys.map(function (k) {
        const v = all[k] || {};
        const st = v.status || "available";
        return "<tr><td><b>" + k + "</b></td><td>" + st.replace("_", " ") + "</td><td>" + (v.server1 || "—") + "</td><td>" + (v.server2 || "—") + "</td><td>" + (v.server3 || "—") +
          '</td><td><button class="btn" data-edit="' + k + '">Edit</button> <button class="btn" data-del="' + k + '">Delete</button></td></tr>';
      }).join("") + "</tbody></table>";

    $("aTable").querySelectorAll("[data-del]").forEach(function (b) {
      b.addEventListener("click", function () {
        const all2 = readAll(); delete all2[b.dataset.del]; writeAll(all2); renderTable(); loadForm();
      });
    });
    $("aTable").querySelectorAll("[data-edit]").forEach(function (b) {
      b.addEventListener("click", function () {
        const key = b.dataset.edit;
        const v = readAll()[key] || {};
        const m = key.match(/^tv_(\d+)_s(\d+)_e(\d+)$/);
        if (m) {
          sel = { type: "tv", id: m[1], title: "TV " + m[1] };
          $("aSelected").innerHTML = "<b>TV series</b><br><small style='color:var(--muted)'>TMDb ID: " + m[1] + " · S" + m[2] + "E" + m[3] + "</small>";
          show($("aSeasonRow"), true);
          $("aSeason").innerHTML = '<option value="' + m[2] + '">Season ' + m[2] + "</option>";
          $("aEpisode").innerHTML = '<option value="' + m[3] + '">Episode ' + m[3] + "</option>";
        } else {
          const id = key.replace("movie_", "");
          sel = { type: "movie", id: id, title: "Movie " + id };
          $("aSelected").innerHTML = "<b>Movie</b><br><small style='color:var(--muted)'>TMDb ID: " + id + "</small>";
          show($("aSeasonRow"), false);
        }
        $("s1").value = v.server1 || ""; $("s2").value = v.server2 || ""; $("s3").value = v.server3 || "";
        $("aStatus").value = v.status || "available";
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
  }


  /* ---------- announcements ---------- */
  function escH(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fdate(iso) { try { return new Date(iso).toLocaleString(); } catch (e) { return ""; } }

  async function loadAnnouncements() {
    const box = $("annList");
    if (!box) return;
    box.innerHTML = '<div class="msg">Loading…</div>';
    try {
      const res = await fetch("/api/public/announcements", { headers: { "Cache-Control": "no-store" } });
      const data = await res.json();
      const items = data.announcements || [];
      box.innerHTML = items.length
        ? items.map(function (a) {
            return '<div class="rep-item"><div class="rep-head">' + (a.pinned ? "<b>PINNED</b> · " : "") + escH(fdate(a.created_at)) +
              '</div><b>' + escH(a.title) + "</b><p>" + escH(a.body) + "</p>" +
              '<div class="rep-actions"><button class="btn" data-anndel="' + a.id + '">Delete</button></div></div>';
          }).join("")
        : '<div class="msg">No announcements yet.</div>';
      box.querySelectorAll("[data-anndel]").forEach(function (b) {
        b.addEventListener("click", async function () {
          await fetch("/api/public/announcements?id=" + encodeURIComponent(b.dataset.anndel), { method: "DELETE" });
          loadAnnouncements();
        });
      });
    } catch (e) {
      box.innerHTML = '<div class="msg">Could not load announcements.</div>';
    }
  }

  $("annSave").addEventListener("click", async function () {
    show($("annOk"), false); show($("annErr"), false);
    const title = $("annTitle").value.trim(), body = $("annBody").value.trim();
    if (!title || !body) { $("annErr").textContent = "Title and message are required."; show($("annErr"), true); return; }
    try {
      const res = await fetch("/api/public/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title, body: body, pinned: $("annPinned").checked }),
      });
      const data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || "Could not publish.");
      $("annTitle").value = ""; $("annBody").value = ""; $("annPinned").checked = false;
      $("annOk").textContent = "Update published."; show($("annOk"), true);
      loadAnnouncements();
    } catch (e) {
      $("annErr").textContent = e.message; show($("annErr"), true);
    }
  });

  /* ---------- reports ---------- */
  async function loadReports() {
    const box = $("repList");
    if (!box) return;
    box.innerHTML = '<div class="msg">Loading…</div>';
    try {
      const res = await fetch("/api/public/reports", { headers: { "Cache-Control": "no-store" } });
      if (!res.ok) throw new Error("unauth");
      const data = await res.json();
      const items = data.reports || [];
      box.innerHTML = items.length
        ? items.map(function (r) {
            return '<div class="rep-item' + (r.handled ? " handled" : "") + '"><div class="rep-head">' +
              "<b>" + escH((r.category || "general").replace("_", " ")) + "</b> · " + escH(fdate(r.created_at)) +
              (r.name ? " · " + escH(r.name) : "") + (r.email ? " · " + escH(r.email) : "") +
              (r.handled ? " · resolved" : "") + "</div><p>" + escH(r.message) + "</p>" +
              '<div class="rep-actions"><button class="btn" data-rep="' + r.id + '" data-handled="' + (r.handled ? "1" : "0") + '">' +
              (r.handled ? "Mark unresolved" : "Mark resolved") + '</button>' +
              '<button class="btn" data-repdel="' + r.id + '">Delete</button></div></div>';
          }).join("")
        : '<div class="msg">No reports yet.</div>';
      box.querySelectorAll("[data-rep]").forEach(function (b) {
        b.addEventListener("click", async function () {
          await fetch("/api/public/reports", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: b.dataset.rep, handled: b.dataset.handled !== "1" }),
          });
          loadReports();
        });
      });
      box.querySelectorAll("[data-repdel]").forEach(function (b) {
        b.addEventListener("click", async function () {
          await fetch("/api/public/reports?id=" + encodeURIComponent(b.dataset.repdel), { method: "DELETE" });
          loadReports();
        });
      });
    } catch (e) {
      box.innerHTML = '<div class="msg">Could not load reports. Make sure you are signed in.</div>';
    }
  }
  $("repRefresh").addEventListener("click", loadReports);

  show($("aSeasonRow"), false);
  renderTable();
})();
