/**
 * ReelRift Admin Control Room
 * Full-featured catalog manager, server router, incident viewer, and diagnostics suite.
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const show = (el, on) => {
    if (el) el.classList.toggle("hidden", !on);
  };

  function escH(t) {
    return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function fdate(iso) {
    try {
      const d = new Date(iso);
      return isNaN(d) ? "" : d.toLocaleString();
    } catch (e) {
      return "";
    }
  }

  /* ==========================================================================
     1. AUTHENTICATION (Dual Endpoint Fallback)
     ========================================================================== */
  async function fetchWithFallback(url1, url2, options) {
    try {
      const res = await fetch(url1, options);
      if (res.status !== 404) return res;
    } catch (e) {}
    return fetch(url2, options);
  }

  function setLogged(on) {
    show($("loginView"), !on);
    show($("panelView"), on);
    show($("logoutBtn"), on);
    if (on) {
      renderTable();
      loadReports();
      loadAnnouncements();
      updateDashboardStats();
    }
  }

  async function doLogin() {
    const u = $("user").value.trim(), p = $("pass").value;
    $("loginBtn").disabled = true;
    show($("loginErr"), false);

    try {
      const res = await fetchWithFallback("/api/public/admin-login", "/api/admin-login", {
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
    try {
      await fetchWithFallback("/api/public/admin-logout", "/api/admin-logout", { method: "POST" });
    } catch (e) {}
    setLogged(false);
  });

  // Check existing session on boot
  (async function checkSession() {
    try {
      const res = await fetchWithFallback("/api/public/admin-session", "/api/admin-session", {
        headers: { "Cache-Control": "no-store" },
      });
      const data = await res.json().catch(() => ({}));
      setLogged(!!data.loggedIn);
    } catch (e) {
      setLogged(false);
    }
  })();

  /* ==========================================================================
     2. NAVIGATION TABS & QUICK ACTIONS
     ========================================================================== */
  const tabButtons = document.querySelectorAll(".admin-tab-btn");
  const tabContents = {
    dashboard: $("tabDashboard"),
    servers: $("tabServers"),
    reports: $("tabReports"),
    announcements: $("tabAnnouncements"),
    system: $("tabSystem"),
  };

  function switchAdminTab(tabName) {
    tabButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tabName);
    });
    Object.keys(tabContents).forEach((key) => {
      show(tabContents[key], key === tabName);
    });
    if (tabName === "reports") loadReports();
    if (tabName === "announcements") loadAnnouncements();
    if (tabName === "dashboard") updateDashboardStats();
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => switchAdminTab(btn.dataset.tab));
  });

  // Quick Action Buttons on Dashboard
  $("quickAddOverride").addEventListener("click", () => {
    switchAdminTab("servers");
    $("aQuery").focus();
  });
  $("quickCheckReports").addEventListener("click", () => switchAdminTab("reports"));
  $("quickPostBroadcast").addEventListener("click", () => {
    switchAdminTab("announcements");
    $("annTitle").focus();
  });
  $("quickExportBackup").addEventListener("click", () => {
    switchAdminTab("system");
    $("btnExportJSON").click();
  });

  /* ==========================================================================
     3. LOCAL STORAGE DATA HELPERS & STATS
     ========================================================================== */
  function readAll() {
    try {
      return JSON.parse(localStorage.getItem("reelrift_servers") || "{}") || {};
    } catch (e) {
      return {};
    }
  }

  function writeAll(obj) {
    localStorage.setItem("reelrift_servers", JSON.stringify(obj));
    updateDashboardStats();
  }

  let allReportsCache = [];
  let allAnnouncementsCache = [];

  function updateDashboardStats() {
    const all = readAll();
    const count = Object.keys(all).length;
    if ($("statOverridesCount")) $("statOverridesCount").textContent = count;

    const unhandled = allReportsCache.filter((r) => !r.handled).length;
    if ($("statReportsCount")) $("statReportsCount").textContent = unhandled;
    if ($("tabRepBadge")) $("tabRepBadge").textContent = unhandled;

    const annCount = allAnnouncementsCache.length;
    if ($("statAnnCount")) $("statAnnCount").textContent = annCount;
    if ($("tabAnnBadge")) $("tabAnnBadge").textContent = annCount;
  }

  /* ==========================================================================
     4. CATALOG & SERVER OVERRIDES
     ========================================================================== */
  let sel = null; // { type, id, title }

  function currentKey() {
    if (!sel) return null;
    if (sel.type === "movie") return "movie_" + sel.id;
    const s = $("aSeason").value || 1, e = $("aEpisode").value || 1;
    return "tv_" + sel.id + "_s" + s + "_e" + e;
  }

  async function search() {
    const type = $("aType").value;
    const q = $("aQuery").value.trim();
    show($("aErr"), false);
    if (!q) {
      $("aErr").textContent = "Please enter a search query.";
      show($("aErr"), true);
      return;
    }
    $("aResults").innerHTML = '<div class="msg">Searching TMDb…</div>';
    try {
      const data = await tmdb("/search/" + type, { query: q });
      const items = data.results || [];
      if (!items.length) {
        $("aResults").innerHTML = '<div class="msg">No results found on TMDb.</div>';
        return;
      }
      $("aResults").innerHTML = items.map(function (i) {
        const title = escH(i.title || i.name || "Untitled");
        const date = i.release_date || i.first_air_date || "";
        const img = i.poster_path
          ? '<img src="https://image.tmdb.org/t/p/w200' + i.poster_path + '" alt="">'
          : '<div style="width:42px;height:63px;background:var(--surface-2);border-radius:6px;"></div>';
        return '<div class="res" data-id="' + i.id + '">' + img +
          '<div><b>' + title + '</b><small>' + (date ? date.slice(0, 4) : "—") + ' · TMDb ID: ' + i.id + ' · ★ ' + (i.vote_average ? i.vote_average.toFixed(1) : "N/A") + '</small></div></div>';
      }).join("");

      $("aResults").querySelectorAll(".res").forEach(function (el) {
        el.addEventListener("click", function () {
          selectTitle(type, el.dataset.id, el.querySelector("b").textContent);
        });
      });
    } catch (err) {
      $("aResults").innerHTML = "";
      $("aErr").textContent = err.message || "Network error communicating with TMDb.";
      show($("aErr"), true);
    }
  }

  $("aSearch").addEventListener("click", search);
  $("aQuery").addEventListener("keydown", (e) => { if (e.key === "Enter") search(); });

  async function selectTitle(type, id, title) {
    sel = { type: type, id: id, title: title };
    $("aSelected").innerHTML = '<b>' + escH(title) + '</b><br><small style="color:var(--muted)">Type: ' + type + ' · TMDb ID: ' + id + '</small>';
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
      $("aSeason").innerHTML = list.map((s) => '<option value="' + s.season_number + '">Season ' + s.season_number + '</option>').join("");
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
        ? eps.map((e) => '<option value="' + e.episode_number + '">E' + e.episode_number + ' · ' + escH(e.name || "Episode " + e.episode_number) + '</option>').join("")
        : '<option value="1">Episode 1</option>';
      loadForm();
    } catch (e) {
      $("aEpisode").innerHTML = '<option value="1">Episode 1</option>';
    }
  }

  $("aSeason").addEventListener("change", loadEpisodes);
  $("aEpisode").addEventListener("change", loadForm);

  function loadForm() {
    const key = currentKey();
    const saved = key ? readAll()[key] || {} : {};
    $("s1").value = saved.server1 || "";
    $("s2").value = saved.server2 || "";
    $("s3").value = saved.server3 || "";
    $("aStatus").value = saved.status || "available";
    show($("aOk"), false);
    show($("aSaveErr"), false);
  }

  $("aFill").addEventListener("click", function () {
    if (!sel) return flagErr("Select a title first from TMDb search results.");
    const season = sel.type === "tv" ? $("aSeason").value : 1;
    const episode = sel.type === "tv" ? $("aEpisode").value : 1;
    if (typeof buildServers === "function") {
      const servers = buildServers(sel.type, sel.id, season, episode);
      $("s1").value = servers[0] ? servers[0].url : "";
      $("s2").value = servers[1] ? servers[1].url : "";
      $("s3").value = servers[2] ? servers[2].url : "";
    } else {
      if (sel.type === "movie") {
        $("s1").value = `https://vsembed.ru/embed/movie/${sel.id}`;
        $("s2").value = `https://cinesrc.st/embed/movie/${sel.id}`;
        $("s3").value = "";
      } else {
        $("s1").value = `https://vsembed.ru/embed/tv/${sel.id}/${season}/${episode}`;
        $("s2").value = `https://cinesrc.st/embed/tv/${sel.id}/${season}/${episode}`;
        $("s3").value = "";
      }
    }
  });

  function flagErr(m) {
    $("aSaveErr").textContent = m;
    show($("aSaveErr"), true);
    show($("aOk"), false);
  }

  function flagOk(m) {
    $("aOk").textContent = m;
    show($("aOk"), true);
    show($("aSaveErr"), false);
  }

  $("aSave").addEventListener("click", function () {
    const key = currentKey();
    if (!key) return flagErr("Select a movie or TV episode first.");
    const vals = {
      server1: $("s1").value.trim(),
      server2: $("s2").value.trim(),
      server3: $("s3").value.trim(),
    };
    const status = $("aStatus").value;
    const bad = Object.keys(vals).filter((k) => vals[k] && !/^https?:\/\//i.test(vals[k]));
    if (bad.length) return flagErr("Server URLs must start with http:// or https://");
    if (status === "available" && !vals.server1 && !vals.server2 && !vals.server3) {
      return flagErr("Enter at least one server URL, or use “Fill with templates”.");
    }
    vals.status = status;
    const all = readAll();
    all[key] = vals;
    writeAll(all);
    flagOk("Successfully saved routing settings for " + key);
    renderTable();
  });

  $("aDelete").addEventListener("click", function () {
    const key = currentKey();
    if (!key) return flagErr("Select a movie or TV episode first.");
    const all = readAll();
    if (!all[key]) return flagErr("No custom override found for " + key);
    delete all[key];
    writeAll(all);
    loadForm();
    flagOk("Deleted override for " + key);
    renderTable();
  });

  /* ==========================================================================
     5. LIVE STREAM SANDBOX PREVIEW
     ========================================================================== */
  const streamTesterBox = $("streamTesterBox");
  const testIframe = $("testIframe");

  $("aToggleTest").addEventListener("click", function () {
    const isHidden = streamTesterBox.classList.contains("hidden");
    show(streamTesterBox, isHidden);
    if (isHidden) {
      // Default to testing server 1
      $("testS1").click();
    } else {
      testIframe.src = "about:blank";
    }
  });

  $("closeTester").addEventListener("click", function () {
    show(streamTesterBox, false);
    testIframe.src = "about:blank";
  });

  function resolvePreviewUrl(serverIndex) {
    let url = "";
    if (serverIndex === 1) url = $("s1").value.trim();
    if (serverIndex === 2) url = $("s2").value.trim();
    if (serverIndex === 3) url = $("s3").value.trim();

    if (!url && sel) {
      const season = sel.type === "tv" ? $("aSeason").value : 1;
      const episode = sel.type === "tv" ? $("aEpisode").value : 1;
      if (typeof buildServers === "function") {
        const defaults = buildServers(sel.type, sel.id, season, episode);
        if (defaults[serverIndex - 1]) url = defaults[serverIndex - 1].url;
      }
    }
    return url;
  }

  $("testS1").addEventListener("click", function () {
    const url = resolvePreviewUrl(1);
    if (!url) return alert("No URL defined for Server 1.");
    testIframe.src = url;
  });

  $("testS2").addEventListener("click", function () {
    const url = resolvePreviewUrl(2);
    if (!url) return alert("No URL defined for Server 2.");
    testIframe.src = url;
  });

  $("testS3").addEventListener("click", function () {
    const raw = $("s3").value.trim();
    if (!raw) return alert("Please enter a direct MP4 / WebM / M3U8 URL for Server 3 first.");
    const title = sel ? sel.title : "Stream Preview";
    testIframe.src = `/player.html?src=${encodeURIComponent(raw)}&title=${encodeURIComponent(title)}`;
  });

  /* ==========================================================================
     6. SAVED OVERRIDES TABLE WITH REAL-TIME FILTER
     ========================================================================== */
  function renderTable() {
    const all = readAll();
    let keys = Object.keys(all);
    const filterText = ($("overrideFilterInput") ? $("overrideFilterInput").value.trim().toLowerCase() : "");
    const filterStatus = ($("overrideStatusFilter") ? $("overrideStatusFilter").value : "all");

    if (filterText) {
      keys = keys.filter((k) => k.toLowerCase().includes(filterText));
    }
    if (filterStatus !== "all") {
      keys = keys.filter((k) => (all[k].status || "available") === filterStatus);
    }

    if (!keys.length) {
      $("aTable").innerHTML = '<div class="msg" style="text-align:center;padding:24px;">No overrides match your criteria.</div>';
      return;
    }

    $("aTable").innerHTML =
      '<div style="overflow-x:auto;"><table class="saved"><thead><tr><th>Routing Key</th><th>Status</th><th>Server 1</th><th>Server 2</th><th>Server 3</th><th style="text-align:right;">Actions</th></tr></thead><tbody>' +
      keys.map(function (k) {
        const v = all[k] || {};
        const st = v.status || "available";
        const badgeColor = st === "available" ? "badge-success" : (st === "coming_soon" ? "badge-pending" : "badge-error");
        return '<tr>' +
          '<td><b style="font-family:monospace;font-size:12.5px;">' + escH(k) + '</b></td>' +
          '<td><span class="badge-status ' + badgeColor + '">' + escH(st.replace("_", " ")) + '</span></td>' +
          '<td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + escH(v.server1 || "") + '">' + (v.server1 ? escH(v.server1) : '<span style="color:var(--muted)">auto</span>') + '</td>' +
          '<td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + escH(v.server2 || "") + '">' + (v.server2 ? escH(v.server2) : '<span style="color:var(--muted)">auto</span>') + '</td>' +
          '<td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + escH(v.server3 || "") + '">' + (v.server3 ? escH(v.server3) : '<span style="color:var(--muted)">—</span>') + '</td>' +
          '<td style="text-align:right;white-space:nowrap;">' +
            '<button class="btn" data-edit="' + escH(k) + '" style="padding:4px 10px;font-size:12px;margin-right:6px;">Edit</button>' +
            '<button class="btn" data-del="' + escH(k) + '" style="padding:4px 10px;font-size:12px;color:#ef4444;">Delete</button>' +
          '</td></tr>';
      }).join("") + '</tbody></table></div>';

    $("aTable").querySelectorAll("[data-del]").forEach(function (b) {
      b.addEventListener("click", function () {
        const target = b.dataset.del;
        if (confirm("Delete override for " + target + "?")) {
          const all2 = readAll();
          delete all2[target];
          writeAll(all2);
          renderTable();
          loadForm();
        }
      });
    });

    $("aTable").querySelectorAll("[data-edit]").forEach(function (b) {
      b.addEventListener("click", function () {
        const key = b.dataset.edit;
        const v = readAll()[key] || {};
        const m = key.match(/^tv_(\d+)_s(\d+)_e(\d+)$/);
        if (m) {
          sel = { type: "tv", id: m[1], title: "TV " + m[1] };
          $("aSelected").innerHTML = '<b>TV Series</b><br><small style="color:var(--muted)">TMDb ID: ' + m[1] + ' · S' + m[2] + 'E' + m[3] + '</small>';
          show($("aSeasonRow"), true);
          $("aSeason").innerHTML = '<option value="' + m[2] + '">Season ' + m[2] + '</option>';
          $("aEpisode").innerHTML = '<option value="' + m[3] + '">Episode ' + m[3] + '</option>';
        } else {
          const id = key.replace("movie_", "");
          sel = { type: "movie", id: id, title: "Movie " + id };
          $("aSelected").innerHTML = '<b>Movie</b><br><small style="color:var(--muted)">TMDb ID: ' + id + '</small>';
          show($("aSeasonRow"), false);
        }
        $("s1").value = v.server1 || "";
        $("s2").value = v.server2 || "";
        $("s3").value = v.server3 || "";
        $("aStatus").value = v.status || "available";
        window.scrollTo({ top: $("tabServers").offsetTop - 40, behavior: "smooth" });
      });
    });
  }

  if ($("overrideFilterInput")) $("overrideFilterInput").addEventListener("input", renderTable);
  if ($("overrideStatusFilter")) $("overrideStatusFilter").addEventListener("change", renderTable);

  /* ==========================================================================
     7. USER INCIDENT REPORTS MANAGEMENT
     ========================================================================== */
  let reportsFilterMode = "all"; // "all" | "pending" | "resolved"

  async function loadReports() {
    const box = $("repList");
    if (!box) return;
    box.innerHTML = '<div class="msg" style="padding:20px;text-align:center;">Loading incident reports…</div>';

    try {
      const res = await fetchWithFallback("/api/public/reports", "/api/reports", {
        headers: { "Cache-Control": "no-store" },
      });
      if (!res.ok) throw new Error("unauth");
      const data = await res.json();
      allReportsCache = data.reports || [];
      updateDashboardStats();

      let items = allReportsCache;
      if (reportsFilterMode === "pending") items = items.filter((r) => !r.handled);
      if (reportsFilterMode === "resolved") items = items.filter((r) => !!r.handled);

      if (!items.length) {
        box.innerHTML = '<div class="msg" style="padding:24px;text-align:center;">No reports found for this filter.</div>';
        return;
      }

      box.innerHTML = items.map(function (r) {
        return '<div class="rep-item' + (r.handled ? ' handled' : '') + '">' +
          '<div class="rep-head">' +
            '<div>' +
              '<span class="badge-status ' + (r.handled ? 'badge-success' : 'badge-error') + '" style="margin-right:8px;">' + (r.handled ? 'RESOLVED' : 'PENDING') + '</span>' +
              '<b>' + escH((r.category || "General").replace("_", " ").toUpperCase()) + '</b>' +
            '</div>' +
            '<small style="color:var(--muted);">' + escH(fdate(r.created_at)) + '</small>' +
          '</div>' +
          (r.name || r.email ? '<div style="font-size:12.5px;color:var(--muted);margin-bottom:6px;">Reporter: ' + escH(r.name || 'Anonymous') + (r.email ? ' &lt;' + escH(r.email) + '&gt;' : '') + '</div>' : '') +
          '<p style="margin:8px 0;line-height:1.5;">' + escH(r.message) + '</p>' +
          '<div class="rep-actions">' +
            '<button class="btn" data-rep="' + r.id + '" data-handled="' + (r.handled ? "1" : "0") + '">' +
              (r.handled ? "Mark as Pending" : "✓ Mark as Resolved") +
            '</button>' +
            '<button class="btn" data-repdel="' + r.id + '" style="color:#ef4444;">Delete</button>' +
          '</div>' +
        '</div>';
      }).join("");

      box.querySelectorAll("[data-rep]").forEach(function (b) {
        b.addEventListener("click", async function () {
          b.disabled = true;
          await fetchWithFallback("/api/public/reports", "/api/reports", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: b.dataset.rep, handled: b.dataset.handled !== "1" }),
          });
          loadReports();
        });
      });

      box.querySelectorAll("[data-repdel]").forEach(function (b) {
        b.addEventListener("click", async function () {
          if (confirm("Permanently delete this report?")) {
            b.disabled = true;
            await fetchWithFallback(
              "/api/public/reports?id=" + encodeURIComponent(b.dataset.repdel),
              "/api/reports?id=" + encodeURIComponent(b.dataset.repdel),
              { method: "DELETE" }
            );
            loadReports();
          }
        });
      });
    } catch (e) {
      box.innerHTML = '<div class="msg" style="padding:20px;text-align:center;">Could not load reports. Ensure your admin session is active.</div>';
    }
  }

  $("repRefresh").addEventListener("click", loadReports);

  $("repFilterAll").addEventListener("click", () => {
    reportsFilterMode = "all";
    loadReports();
  });
  $("repFilterPending").addEventListener("click", () => {
    reportsFilterMode = "pending";
    loadReports();
  });
  $("repFilterResolved").addEventListener("click", () => {
    reportsFilterMode = "resolved";
    loadReports();
  });

  /* ==========================================================================
     8. BROADCASTS & ANNOUNCEMENTS
     ========================================================================== */
  async function loadAnnouncements() {
    const box = $("annList");
    if (!box) return;
    box.innerHTML = '<div class="msg" style="padding:20px;text-align:center;">Loading announcements…</div>';

    try {
      const res = await fetchWithFallback("/api/public/announcements", "/api/announcements", {
        headers: { "Cache-Control": "no-store" },
      });
      const data = await res.json();
      allAnnouncementsCache = data.announcements || [];
      updateDashboardStats();

      box.innerHTML = allAnnouncementsCache.length
        ? allAnnouncementsCache.map(function (a) {
            return '<div class="rep-item">' +
              '<div class="rep-head">' +
                '<div>' +
                  (a.pinned ? '<span class="badge-status badge-pending" style="margin-right:8px;">★ PINNED</span>' : '') +
                  '<b>' + escH(a.title) + '</b>' +
                '</div>' +
                '<small style="color:var(--muted);">' + escH(fdate(a.created_at)) + '</small>' +
              '</div>' +
              '<p style="margin:8px 0;line-height:1.5;color:var(--text);">' + escH(a.body) + '</p>' +
              '<div class="rep-actions">' +
                '<button class="btn" data-anndel="' + a.id + '" style="color:#ef4444;">Delete Broadcast</button>' +
              '</div>' +
            '</div>';
          }).join("")
        : '<div class="msg" style="padding:24px;text-align:center;">No announcements published yet.</div>';

      box.querySelectorAll("[data-anndel]").forEach(function (b) {
        b.addEventListener("click", async function () {
          if (confirm("Delete this broadcast announcement?")) {
            b.disabled = true;
            await fetchWithFallback(
              "/api/public/announcements?id=" + encodeURIComponent(b.dataset.anndel),
              "/api/announcements?id=" + encodeURIComponent(b.dataset.anndel),
              { method: "DELETE" }
            );
            loadAnnouncements();
          }
        });
      });
    } catch (e) {
      box.innerHTML = '<div class="msg" style="padding:20px;text-align:center;">Could not load announcements.</div>';
    }
  }

  $("annSave").addEventListener("click", async function () {
    show($("annOk"), false);
    show($("annErr"), false);
    const title = $("annTitle").value.trim(), body = $("annBody").value.trim();
    if (!title || !body) {
      $("annErr").textContent = "Title and message content are required.";
      show($("annErr"), true);
      return;
    }

    try {
      const res = await fetchWithFallback("/api/public/announcements", "/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title, body: body, pinned: $("annPinned").checked }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not publish broadcast.");
      $("annTitle").value = "";
      $("annBody").value = "";
      $("annPinned").checked = false;
      $("annOk").textContent = "Broadcast announcement published successfully.";
      show($("annOk"), true);
      loadAnnouncements();
    } catch (e) {
      $("annErr").textContent = e.message;
      show($("annErr"), true);
    }
  });

  /* ==========================================================================
     9. SYSTEM SETTINGS & DISCORD
     ========================================================================== */
  const SITE = "reelrift_site";
  function readSite() {
    try {
      return JSON.parse(localStorage.getItem(SITE) || "{}") || {};
    } catch (e) {
      return {};
    }
  }

  $("discord").value = readSite().discord || "";
  $("dSave").addEventListener("click", function () {
    const v = $("discord").value.trim();
    if (v && !/^https?:\/\//i.test(v)) {
      $("dErr").textContent = "Discord URL must start with http:// or https://";
      show($("dErr"), true);
      show($("dOk"), false);
      return;
    }
    const s = readSite();
    s.discord = v;
    localStorage.setItem(SITE, JSON.stringify(s));
    show($("dErr"), false);
    $("dOk").textContent = v ? "Discord invite link saved." : "Discord invite link cleared.";
    show($("dOk"), true);
  });

  /* ==========================================================================
     10. BACKUP EXPORT & RESTORE (JSON)
     ========================================================================== */
  $("btnExportJSON").addEventListener("click", function () {
    const backupData = {
      version: "2.0",
      timestamp: new Date().toISOString(),
      servers: readAll(),
      site: readSite(),
    };
    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = new Date().toISOString().split("T")[0];
    a.href = url;
    a.download = `reelrift-backup-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    $("backupFeedback").textContent = "Backup downloaded successfully.";
    show($("backupFeedback"), true);
  });

  $("inputImportJSON").addEventListener("change", function (e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (evt) {
      try {
        const parsed = JSON.parse(evt.target.result);
        if (parsed.servers && typeof parsed.servers === "object") {
          const current = readAll();
          const merged = Object.assign({}, current, parsed.servers);
          writeAll(merged);
        }
        if (parsed.site && typeof parsed.site === "object") {
          localStorage.setItem(SITE, JSON.stringify(parsed.site));
          $("discord").value = parsed.site.discord || "";
        }
        renderTable();
        updateDashboardStats();
        $("backupFeedback").textContent = "Backup configuration successfully restored and merged!";
        show($("backupFeedback"), true);
      } catch (err) {
        alert("Invalid JSON backup file: " + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  /* ==========================================================================
     11. STREAM PROVIDER CONNECTIVITY DIAGNOSTICS
     ========================================================================== */
  $("btnRunDiagnostics").addEventListener("click", async function () {
    const cards = document.querySelectorAll(".health-card");
    $("btnRunDiagnostics").disabled = true;

    for (const card of cards) {
      const domain = card.dataset.domain;
      const badge = card.querySelector(".badge-status");
      badge.className = "badge-status badge-pending";
      badge.textContent = "Testing…";

      const start = Date.now();
      try {
        let testUrl = domain === "api.themoviedb.org"
          ? "https://image.tmdb.org/t/p/w200/wwemzKWzjKYJFfCeiB57q3r4Bcm.png"
          : `https://${domain}/favicon.ico?_cb=${Date.now()}`;

        await new Promise((resolve, reject) => {
          const img = new Image();
          const timer = setTimeout(() => {
            img.src = "";
            reject(new Error("Timeout"));
          }, 4500);
          img.onload = () => { clearTimeout(timer); resolve(); };
          img.onerror = () => { clearTimeout(timer); resolve(); /* reachable even if 404 */ };
          img.src = testUrl;
        });

        const elapsed = Date.now() - start;
        badge.className = "badge-status badge-success";
        badge.textContent = `Online (${elapsed}ms)`;
      } catch (err) {
        badge.className = "badge-status badge-error";
        badge.textContent = "Timeout / Unreachable";
      }
    }

    $("btnRunDiagnostics").disabled = false;
  });

  /* ==========================================================================
     12. DANGER ZONE: WIPE ROUTING OVERRIDES
     ========================================================================== */
  $("btnWipeOverrides").addEventListener("click", function () {
    if (confirm("WARNING: Are you sure you want to delete ALL custom title overrides? This cannot be undone.")) {
      writeAll({});
      renderTable();
      loadForm();
      alert("All title overrides have been cleared.");
    }
  });

  // Initial startup table render
  renderTable();
})();