declare namespace Cloudflare {
  interface Env {
    DB: import("@cloudflare/workers-types").D1Database;
    GOOGLE_AUTH_CLIENT_ID?: string;
    ADMIN_GOOGLE_EMAILS?: string;
  }
}

declare module "cloudflare:workers" {
  export const env: Cloudflare.Env;
}
