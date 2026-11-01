// One home for the site: send www and the old pages.dev address to https://aibuildclub.co,
// keeping the path and query (so ad parameters survive). Preview deploys (<hash>.ai-build-club.pages.dev) are left alone.
const CANONICAL = "aibuildclub.co";
const REDIRECT_HOSTS = ["www.aibuildclub.co", "ai-build-club.pages.dev"];

export async function onRequest({ request, next }) {
  const url = new URL(request.url);
  if (REDIRECT_HOSTS.includes(url.hostname)) {
    url.hostname = CANONICAL;
    url.protocol = "https:";
    return Response.redirect(url.toString(), 301);
  }
  return next();
}
