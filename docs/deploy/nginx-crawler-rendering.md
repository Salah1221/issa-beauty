# nginx: serve live crawler previews for product pages

The storefront is static (nginx serves `/var/www/issa-beauty/client/dist`). Social
crawlers do not run JS, so `/products/:id` shares need server-rendered `<head>`
tags. This config routes **crawler user-agents only** for product pages to the
backend meta-service, and proxies `/sitemap.xml` to the backend. Real users are
untouched.

Set `<BACKEND>` to the backend origin reachable from nginx (e.g.
`https://api.issabeauty.org` or `http://127.0.0.1:5002`).

## 1. Crawler UA map (http {} block, once)

```nginx
map $http_user_agent $is_crawler {
    default 0;
    "~*facebookexternalhit|WhatsApp|Twitterbot|LinkedInBot|Slackbot|TelegramBot|Discordbot|Pinterest|redditbot|Applebot|bingbot|Googlebot|Embedly|vkShare|W3C_Validator|Google-InspectionTool" 1;
}
```

## 2. server {} block for issabeauty.org

```nginx
# Product pages: crawlers get live meta HTML from the backend; users get the SPA.
location ~ ^/products/[^/]+$ {
    if ($is_crawler) {
        proxy_pass <BACKEND>/render$request_uri;
    }
    try_files $uri /index.html;
}

# Always serve the dynamic sitemap from the backend.
location = /sitemap.xml {
    proxy_pass <BACKEND>/sitemap.xml;
}

# (existing) SPA fallback for everything else
location / {
    try_files $uri /index.html;
}
```

> `proxy_pass` inside `if` is one of the few directives allowed there. If the
> backend is unreachable, the `try_files` fallback still serves the SPA shell.

## 3. Apply & verify

```bash
sudo nginx -t && sudo systemctl reload nginx

# Should return server-rendered OG tags:
curl -A "facebookexternalhit/1.1" https://issabeauty.org/products/<REAL_ID> | grep og:title
# A normal user still gets the SPA shell (no product-specific og:title):
curl -A "Mozilla/5.0" https://issabeauty.org/products/<REAL_ID> | grep -c 'id="root"'
# Sitemap:
curl https://issabeauty.org/sitemap.xml | head
```

Then run the URL through the Facebook Sharing Debugger and a JSON-LD validator.

## Rollback

Remove the two `location` additions (and the `map`) and reload nginx. No app
redeploy needed.
