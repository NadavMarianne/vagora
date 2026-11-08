// Two ways to open a page:
// - `openPage`, for going somewhere (the menu): the page opens along its path, so back walks
//   outward. An order sits on Orders, which sits on its market, which sits on Home.
// - `peekPage`, for a quick look (the home page, notifications, banners): the page opens on top
//   of where you are, so one back returns there.
import { type Href, router } from "expo-router";

/** The pages that lead to `path`, outermost first, ending with `path` itself (Home not included,
 * since it's always at the bottom). */
export function pagePath(path: string): string[] {
  const parts = path.split("?")[0].split("/").filter(Boolean);
  if (parts.length === 0) return [];
  if (parts[0] !== "markets" || parts.length < 2 || parts[1] === "new") return [path];
  const market = `/markets/${parts[1]}`;
  const chain = [market];
  const section = parts[2];
  // Sections inside a market that have their own list page to sit on.
  if (section === "orders" || section === "store" || section === "members") {
    chain.push(`${market}/${section}`);
  }
  if (section === "proposals") chain.push(`${market}/store`);
  // A product's own sub-page (like "my offer") sits on the product.
  if (section === "store" && parts.length > 4) chain.push(`${market}/store/${parts[3]}`);
  if (path !== chain[chain.length - 1]) chain.push(path);
  return chain;
}

/** Shows `path` with its outer pages behind it, replacing whatever was open. */
export function openPage(path: string) {
  if (router.canDismiss()) router.dismissAll();
  for (const page of pagePath(path)) router.push(page as Href);
}

/** Shows `path` on top of the current page, so one back returns to it. Home itself clears
 * everything open instead. */
export function peekPage(path: string) {
  if (path === "/") return openPage("/");
  router.push(path as Href);
}
