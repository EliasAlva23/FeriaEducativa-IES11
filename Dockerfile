# ============================================================
# Sirve el sitio estático (index.html, dashboard.html, css/, js/,
# img/) tal cual lo hace Netlify -- SOLO para probar en Docker en
# la compu local, en vez de "python -m http.server". No reemplaza
# el deploy real: Netlify sigue siendo quien publica el sitio.
# ============================================================
FROM nginx:alpine

COPY . /usr/share/nginx/html

EXPOSE 80
