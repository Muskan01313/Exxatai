/** Only allow same-site paths, so a crafted link can't bounce users to another site after login. */
export function safeCallbackUrl(value: string | string[] | undefined): string {
  const url = Array.isArray(value) ? value[0] : value;
  if (!url || !url.startsWith("/") || url.startsWith("//") || url.startsWith("/\\")) {
    return "/";
  }
  return url;
}
