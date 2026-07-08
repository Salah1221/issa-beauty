# nginx: enable HTTP/2 (and HTTP/3) for the storefront

Lighthouse flags "Use HTTP/2" (~700ms). The storefront currently serves over
**HTTP/1.1**, which loads the JS/CSS/font/image requests with limited
parallelism. HTTP/2 multiplexes them over one connection — a real first-load win
with zero app changes.

Edit the storefront server block in `/etc/nginx/sites-available/issa-beauty`
(the `listen 443 ssl;` server).

## nginx ≥ 1.25.1 (preferred — separate `http2` directive)

```nginx
server {
    listen 443 ssl;
    http2 on;                     # <-- add this line
    server_name issabeauty.org www.issabeauty.org;
    ...
}
```

## nginx < 1.25.1 (older syntax on the `listen` line)

```nginx
    listen 443 ssl http2;         # <-- add http2 here
```

Check your version with `nginx -v`.

## Optional: HTTP/3 (QUIC), if your nginx has it

```nginx
    listen 443 quic reuseport;
    listen 443 ssl;
    http2 on;
    add_header Alt-Svc 'h3=":443"; ma=86400';
```

## Apply & verify

```bash
sudo nginx -t && sudo systemctl reload nginx
# should report h2:
curl -sI --http2 https://issabeauty.org/ | grep -i "^HTTP"
```

Expect `HTTP/2 200`. Reload is zero-downtime; to roll back, remove the added
line and reload.
