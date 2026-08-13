import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

const BODY_HTML = "\n<header class=\"site-header\">\n  <div class=\"wrap header-inner\">\n    <a class=\"logo\" href=\"/\"><span class=\"dot\"></span>REEL<span class=\"b\">RIFT</span></a>\n    <nav class=\"nav\"><button class=\"active\">Admin Panel</button></nav>\n    <div class=\"search\"><a class=\"btn\" href=\"/\">\u2190 Back to site</a>\n      <button class=\"btn hidden\" id=\"logoutBtn\">Log out</button></div>\n  </div>\n</header>\n\n<!-- LOGIN -->\n<section id=\"loginView\" class=\"admin-shell\">\n  <div class=\"panel login-card\">\n    <h3>Admin login</h3>\n    <div class=\"field\"><label>Username</label><input id=\"user\" autocomplete=\"username\" /></div>\n    <div class=\"field\"><label>Password</label><input id=\"pass\" type=\"password\" autocomplete=\"current-password\" /></div>\n    <button class=\"btn primary\" id=\"loginBtn\" style=\"width:100%\">Sign in</button>\n    <div class=\"error hidden\" id=\"loginErr\"></div>\n  </div>\n</section>\n\n<!-- PANEL -->\n<section id=\"panelView\" class=\"admin-shell hidden\">\n  <div class=\"panel\">\n    <h3>1 \u00b7 Find a title on TMDb</h3>\n    <div class=\"row2\">\n      <div class=\"field\"><label>Type</label>\n        <select id=\"aType\"><option value=\"movie\">Movie</option><option value=\"tv\">TV Series</option></select>\n      </div>\n      <div class=\"field\"><label>Search query</label><input id=\"aQuery\" placeholder=\"e.g. Spider-Man\" /></div>\n    </div>\n    <button class=\"btn primary\" id=\"aSearch\">Search TMDb</button>\n    <div class=\"error hidden\" id=\"aErr\"></div>\n    <div class=\"res-list\" id=\"aResults\" style=\"margin-top:14px\"></div>\n  </div>\n\n  <div class=\"panel\">\n    <h3>2 \u00b7 Selected title</h3>\n    <div id=\"aSelected\" style=\"color:var(--muted);font-size:14px\">No title selected yet.</div>\n    <div class=\"row2\" id=\"aSeasonRow\" style=\"margin-top:12px\">\n      <div class=\"field\"><label>Season</label><select id=\"aSeason\"></select></div>\n      <div class=\"field\"><label>Episode</label><select id=\"aEpisode\"></select></div>\n    </div>\n  </div>\n\n  <div class=\"panel\">\n    <h3>3 \u00b7 Configure servers</h3>\n    <p style=\"color:var(--muted);font-size:12px;margin-bottom:12px\">\n      Leave a field empty to use the default template URL. Only enter video sources you are authorized to use.\n    </p>\n    <div class=\"field\"><label>Availability status</label>\n      <select id=\"aStatus\">\n        <option value=\"available\">Available (watchable)</option>\n        <option value=\"unavailable\">Unavailable (blocked)</option>\n        <option value=\"coming_soon\">Coming soon (blocked)</option>\n      </select>\n    </div>\n    <div class=\"field\"><label>Server 1 URL</label><input id=\"s1\" placeholder=\"auto (template)\" /></div>\n    <div class=\"field\"><label>Server 2 URL</label><input id=\"s2\" placeholder=\"auto (template)\" /></div>\n    <div class=\"field\"><label>Server 3 URL</label><input id=\"s3\" placeholder=\"auto (template)\" /></div>\n    <button class=\"btn primary\" id=\"aSave\">Save settings</button>\n    <button class=\"btn\" id=\"aFill\">Fill with templates</button>\n    <button class=\"btn\" id=\"aDelete\">Delete this entry</button>\n    <div class=\"ok hidden\" id=\"aOk\"></div>\n    <div class=\"error hidden\" id=\"aSaveErr\"></div>\n  </div>\n\n  <div class=\"panel\">\n    <h3>Site footer \u00b7 Discord server</h3>\n    <p style=\"color:var(--muted);font-size:12px;margin-bottom:12px\">Footer shows \u201cMade by Myticmoth\u201d plus this invite link.</p>\n    <div class=\"field\"><label>Discord invite URL</label><input id=\"discord\" placeholder=\"https://discord.gg/...\" /></div>\n    <button class=\"btn primary\" id=\"dSave\">Save Discord link</button>\n    <div class=\"ok hidden\" id=\"dOk\"></div>\n    <div class=\"error hidden\" id=\"dErr\"></div>\n  </div>\n\n  <div class=\"panel\">\n    <h3>Post a site update</h3>\n    <p style=\"color:var(--muted);font-size:12px;margin-bottom:12px\">Announcements appear on the public Updates page.</p>\n    <div class=\"field\"><label>Title</label><input id=\"annTitle\" maxlength=\"160\" placeholder=\"e.g. New servers added\" /></div>\n    <div class=\"field\"><label>Message</label><textarea id=\"annBody\" rows=\"4\" maxlength=\"4000\" placeholder=\"What's new?\"></textarea></div>\n    <div class=\"field\"><label><input type=\"checkbox\" id=\"annPinned\" style=\"width:auto;margin-right:8px\" />Pin to top</label></div>\n    <button class=\"btn primary\" id=\"annSave\">Publish update</button>\n    <div class=\"ok hidden\" id=\"annOk\"></div>\n    <div class=\"error hidden\" id=\"annErr\"></div>\n    <div id=\"annList\" style=\"margin-top:16px\"></div>\n  </div>\n\n  <div class=\"panel\">\n    <h3>User reports</h3>\n    <p style=\"color:var(--muted);font-size:12px;margin-bottom:12px\">Messages submitted from the Updates page.</p>\n    <button class=\"btn\" id=\"repRefresh\">Refresh reports</button>\n    <div id=\"repList\" style=\"margin-top:14px\"></div>\n  </div>\n\n  <div class=\"panel\">\n    <h3>Saved settings (localStorage: reelrift_servers)</h3>\n    <div id=\"aTable\"></div>\n  </div>\n</section>\n\n\n\n";
const SCRIPTS: string[] = ["/script.js", "/admin.js"];

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "ReelRift Admin — Server Configuration" },
      { name: "description", content: "ReelRift admin panel for searching TMDb titles and configuring playback servers." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "ReelRift Admin" },
      { property: "og:description", content: "Configure playback servers for ReelRift titles." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "stylesheet", href: "/style.css" }],
  }),
  component: Page,
});

function Page() {
  useEffect(() => {
    const els = SCRIPTS.map((src) => {
      const el = document.createElement("script");
      el.src = src;
      el.async = false;
      document.body.appendChild(el);
      return el;
    });
    return () => {
      els.forEach((el) => el.remove());
    };
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: BODY_HTML }} />;
}
