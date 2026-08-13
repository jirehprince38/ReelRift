import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

const BODY_HTML = "\n\n  <!-- Header -->\n  <header class=\"site-header\">\n\n    <div class=\"wrap header-inner\">\n\n      <!-- Logo -->\n      <a\n        class=\"logo\"\n        href=\"/\"\n        aria-label=\"ReelRift Home\"\n      >\n        <span class=\"dot\"></span>\n        REEL<span class=\"b\">RIFT</span>\n      </a>\n\n      <!-- Navigation -->\n      <nav\n        class=\"nav\"\n        aria-label=\"Main navigation\"\n      >\n\n        <button\n          data-nav=\"home\"\n          class=\"active\"\n          type=\"button\"\n        >\n          Home\n        </button>\n\n        <button\n          data-nav=\"movies\"\n          type=\"button\"\n        >\n          Movies\n        </button>\n\n        <button\n          data-nav=\"tv\"\n          type=\"button\"\n        >\n          TV Series\n        </button>\n\n        <button\n          data-nav=\"updates\"\n          type=\"button\"\n        >\n          Updates\n        </button>\n\n      </nav>\n\n      <!-- Search -->\n      <div class=\"search\">\n\n        <label\n          for=\"searchInput\"\n          class=\"sr-only\"\n        >\n          \n        </label>\n\n        <input\n          id=\"searchInput\"\n          type=\"search\"\n          placeholder=\"Search movies or TV series\u2026\"\n          autocomplete=\"off\"\n          aria-label=\"Search movies or TV series\"\n        >\n\n        <button\n          class=\"btn primary\"\n          id=\"searchBtn\"\n          type=\"button\"\n        >\n          Search\n        </button>\n\n      </div>\n\n    </div>\n\n  </header>\n\n\n  <!-- Main Content -->\n  <main\n    class=\"wrap\"\n    id=\"app\"\n  >\n  </main>\n\n\n  <!-- Footer -->\n  <footer class=\"site-footer\">\n\n    <div\n      class=\"wrap\"\n      id=\"siteFooter\"\n    >\n    </div>\n\n  </footer>\n\n\n  <!-- JavaScript -->\n  \n\n";
const SCRIPTS: string[] = ["/script.js"];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ReelRift — Stream Movies & TV Series" },
      { name: "description", content: "ReelRift is a modern platform for discovering popular movies and TV series with a smooth streaming experience." },
      { property: "og:title", content: "ReelRift — Stream Movies & TV Series" },
      { property: "og:description", content: "Discover popular movies and TV series on ReelRift." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
