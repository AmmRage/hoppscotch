#
#  88888888ba         db         ad88888ba   88888888888     88  88b           d88         db         ,ad8888ba,   88888888888
#  88      "8b       d88b       d8"     "8b  88              88  888b         d888        d88b       d8"'    `"8b  88
#  88      ,8P      d8'`8b      Y8,          88              88  88`8b       d8'88       d8'`8b     d8'            88
#  88aaaaaa8P'     d8'  `8b     `Y8aaaaa,    88aaaaa         88  88 `8b     d8' 88      d8'  `8b    88             88aaaaa
#  88""""""8b,    d8YaaaaY8b      `"""""8b,  88"""""         88  88  `8b   d8'  88     d8YaaaaY8b   88      88888  88"""""
#  88      `8b   d8""""""""8b           `8b  88              88  88   `8b d8'   88    d8""""""""8b  Y8,        88  88
#  88      a8P  d8'        `8b  Y8a     a8P  88              88  88    `888'    88   d8'        `8b  Y8a.    .a88  88
#  88888888P"  d8'          `8b  "Y88888P"   88888888888     88  88     `8'     88  d8'          `8b  `"Y88888P"   88888888888
#
#
# prepare the base image
FROM node:20-alpine3.19 AS base_builder

WORKDIR /usr/src/app

ENV HOPP_ALLOW_RUNTIME_ENV=true

# Required by @hoppscotch/js-sandbox to build `isolated-vm`
RUN apk add python3 make g++

RUN npm install -g pnpm
COPY pnpm-lock.yaml .
RUN pnpm fetch

COPY . .

RUN echo $VITE_BACKEND_GQL_URL
RUN echo $VITE_ADMIN_BACKEND_GQL_URL

RUN pnpm install -f

#
#  88888888ba         db         ,ad8888ba,   88      a8P   88888888888  888b      88  88888888ba,       88888888ba   88        88  88  88           88888888ba,
#  88      "8b       d88b       d8"'    `"8b  88    ,88'    88           8888b     88  88      `"8b      88      "8b  88        88  88  88           88      `"8b
#  88      ,8P      d8'`8b     d8'            88  ,88"      88           88 `8b    88  88        `8b     88      ,8P  88        88  88  88           88        `8b
#  88aaaaaa8P'     d8'  `8b    88             88,d88'       88aaaaa      88  `8b   88  88         88     88aaaaaa8P'  88        88  88  88           88         88
#  88""""""8b,    d8YaaaaY8b   88             8888"88,      88"""""      88   `8b  88  88         88     88""""""8b,  88        88  88  88           88         88
#  88      `8b   d8""""""""8b  Y8,            88P   Y8b     88           88    `8b 88  88         8P     88      `8b  88        88  88  88           88         8P
#  88      a8P  d8'        `8b  Y8a.    .a8P  88     "88,   88           88     `8888  88      .a8P      88      a8P  Y8a.    .a8P  88  88           88      .a8P
#  88888888P"  d8'          `8b  `"Y8888Y"'   88       Y8b  88888888888  88      `888  88888888Y"'       88888888P"    `"Y8888Y"'   88  88888888888  88888888Y"'
#
#
# Build the backend
FROM base_builder AS backend_builder
WORKDIR /usr/src/app/packages/hoppscotch-backend
RUN pnpm exec prisma generate
RUN pnpm run build
RUN pnpm --filter=hoppscotch-backend deploy /dist/backend --prod
WORKDIR /dist/backend
RUN pnpm exec prisma generate

#
#  88888888ba         db         ,ad8888ba,   88      a8P   88888888888  888b      88  88888888ba,
#  88      "8b       d88b       d8"'    `"admin api baseURL8b  88    ,88'    88           8888b     88  88      `"8b
#  88      ,8P      d8'`8b     d8'            88  ,88"      88           88 `8b    88  88        `8b
#  88aaaaaa8P'     d8'  `8b    88             88,d88'       88aaaaa      88  `8b   88  88         88
#  88""""""8b,    d8YaaaaY8b   88             8888"88,      88"""""      88   `8b  88  88         88
#  88      `8b   d8""""""""8b  Y8,            88P   Y8b     88           88    `8b 88  88         8P
#  88      a8P  d8'        `8b  Y8a.    .a8P  88     "88,   88           88     `8888  88      .a8P
#  88888888P"  d8'          `8b  `"Y8888Y"'   88       Y8b  88888888888  88      `888  88888888Y"'
#
#
FROM node:20-alpine3.19 AS backend
RUN apk add caddy
RUN npm install -g pnpm

COPY --from=base_builder  /usr/src/app/packages/hoppscotch-backend/backend.Caddyfile /etc/caddy/backend.Caddyfile
COPY --from=backend_builder /dist/backend /dist/backend
COPY --from=base_builder /usr/src/app/packages/hoppscotch-backend/prod_run.mjs /dist/backend

# Remove the env file to avoid backend copying it in and using it
ENV PRODUCTION="true"
ENV PORT=8080
ENV APP_PORT=${PORT}
ENV DB_URL=${DATABASE_URL}

WORKDIR /dist/backend

CMD ["node", "prod_run.mjs"]
EXPOSE 80
EXPOSE 3170


#
#  88888888888  88888888ba     ,ad8888ba,    888b      88  888888888888  88888888888  888b      88  88888888ba,       88888888ba   88        88  88  88           88888888ba,
#  88           88      "8b   d8"'    `"8b   8888b     88       88       88           8888b     88  88      `"8b      88      "8b  88        88  88  88           88      `"8b
#  88           88      ,8P  d8'        `8b  88 `8b    88       88       88           88 `8b    88  88        `8b     88      ,8P  88        88  88  88           88        `8b
#  88aaaaa      88aaaaaa8P'  88          88  88  `8b   88       88       88aaaaa      88  `8b   88  88         88     88aaaaaa8P'  88        88  88  88           88         88
#  88"""""      88""""88'    88          88  88   `8b  88       88       88"""""      88   `8b  88  88         88     88""""""8b,  88        88  88  88           88         88
#  88           88    `8b    Y8,        ,8P  88    `8b 88       88       88           88    `8b 88  88         8P     88      `8b  88        88  88  88           88         8P
#  88           88     `8b    Y8a.    .a8P   88     `8888       88       88           88     `8888  88      .a8P      88      a8P  Y8a.    .a8P  88  88           88      .a8P
#  88           88      `8b    `"Y8888Y"'    88      `888       88       88888888888  88      `888  88888888Y"'       88888888P"    `"Y8888Y"'   88  88888888888  88888888Y"'
#
#
FROM base_builder AS fe_builder
WORKDIR /usr/src/app/packages/hoppscotch-selfhost-web
RUN pnpm run generate

#
#  88888888888  88888888ba     ,ad8888ba,    888b      88  888888888888  88888888888  888b      88  88888888ba,
#  88           88      "8b   d8"'    `"8b   8888b     88       88       88           8888b     88  88      `"8b
#  88           88      ,8P  d8'        `8b  88 `8b    88       88       88           88 `8b    88  88        `8b
#  88aaaaa      88aaaaaa8P'  88          88  88  `8b   88       88       88aaaaa      88  `8b   88  88         88
#  88"""""      88""""88'    88          88  88   `8b  88       88       88"""""      88   `8b  88  88         88
#  88           88    `8b    Y8,        ,8P  88    `8b 88       88       88           88    `8b 88  88         8P
#  88           88     `8b    Y8a.    .a8P   88     `8888       88       88           88     `8888  88      .a8P
#  88           88      `8b    `"Y8888Y"'    88      `888       88       88888888888  88      `888  88888888Y"'
#
#
FROM caddy:2-alpine AS app
COPY --from=fe_builder /usr/src/app/packages/hoppscotch-selfhost-web/prod_run.mjs /site/prod_run.mjs
COPY --from=fe_builder /usr/src/app/packages/hoppscotch-selfhost-web/selfhost-web.Caddyfile /etc/caddy/selfhost-web.Caddyfile
COPY --from=fe_builder /usr/src/app/packages/hoppscotch-selfhost-web/dist/ /site/selfhost-web
COPY --from=base_builder /usr/src/app/version.txt /site/selfhost-web/version.txt

RUN apk add nodejs npm

RUN npm install -g @import-meta-env/cli

EXPOSE 80
EXPOSE 3000

WORKDIR /site

CMD ["/bin/sh", "-c", "node /site/prod_run.mjs && caddy run --config /etc/caddy/selfhost-web.Caddyfile --adapter caddyfile"]

#
#         db         88888888ba,    88b           d88  88  888b      88     88888888ba   88        88  88  88           88888888ba,
#        d88b        88      `"8b   888b         d888  88  8888b     88     88      "8b  88        88  88  88           88      `"8b
#       d8'`8b       88        `8b  88`8b       d8'88  88  88 `8b    88     88      ,8P  88        88  88  88           88        `8b
#      d8'  `8b      88         88  88 `8b     d8' 88  88  88  `8b   88     88aaaaaa8P'  88        88  88  88           88         88
#     d8YaaaaY8b     88         88  88  `8b   d8'  88  88  88   `8b  88     88""""""8b,  88        88  88  88           88         88
#    d8""""""""8b    88         8P  88   `8b d8'   88  88  88    `8b 88     88      `8b  88        88  88  88           88         8P
#   d8'        `8b   88      .a8P   88    `888'    88  88  88     `8888     88      a8P  Y8a.    .a8P  88  88           88      .a8P
#  d8'          `8b  88888888Y"'    88     `8'     88  88  88      `888     88888888P"    `"Y8888Y"'   88  88888888888  88888888Y"'
#
#
FROM base_builder AS sh_admin_builder
WORKDIR /usr/src/app/packages/hoppscotch-sh-admin
# Generate `sh-admin`, the regular build
RUN pnpm run build --outDir dist-multiport-setup


#
#         db         88888888ba,    88b           d88  88  888b      88
#        d88b        88      `"8b   888b         d888  88  8888b     88
#       d8'`8b       88        `8b  88`8b       d8'88  88  88 `8b    88
#      d8'  `8b      88         88  88 `8b     d8' 88  88  88  `8b   88
#     d8YaaaaY8b     88         88  88  `8b   d8'  88  88  88   `8b  88
#    d8""""""""8b    88         8P  88   `8b d8'   88  88  88    `8b 88
#   d8'        `8b   88      .a8P   88    `888'    88  88  88     `8888
#  d8'          `8b  88888888Y"'    88     `8'     88  88  88      `888
#
#
FROM caddy:2-alpine AS sh_admin

COPY --from=sh_admin_builder /usr/src/app/packages/hoppscotch-sh-admin/prod_run.mjs /site/prod_run.mjs
COPY --from=sh_admin_builder /usr/src/app/packages/hoppscotch-sh-admin/sh-admin-multiport-setup.Caddyfile /etc/caddy/sh-admin-multiport-setup.Caddyfile
COPY --from=sh_admin_builder /usr/src/app/packages/hoppscotch-sh-admin/dist-multiport-setup /site/sh-admin-multiport-setup
COPY --from=base_builder /usr/src/app/version.txt /site/sh-admin-multiport-setup/version.txt

RUN apk add nodejs npm

RUN npm install -g @import-meta-env/cli

EXPOSE 80
EXPOSE 3100

WORKDIR /site

CMD ["node","/site/prod_run.mjs"]

#
#         db         88    ,ad8888ba,
#        d88b        88   d8"'    `"8b
#       d8'`8b       88  d8'        `8b
#      d8'  `8b      88  88          88
#     d8YaaaaY8b     88  88          88
#    d8""""""""8b    88  Y8,        ,8P
#   d8'        `8b   88   Y8a.    .a8P
#  d8'          `8b  88    `"Y8888Y"'
#
#
FROM node:20-alpine3.19 AS aio

ENV PRODUCTION="true"
ENV PORT=8080
ENV APP_PORT=${PORT}
ENV DB_URL=${DATABASE_URL}

# Open Containers Initiative (OCI) labels - useful for bots like Renovate
LABEL org.opencontainers.image.source="https://github.com/AmmRage/hoppscotch" \
  org.opencontainers.image.url="https://docs.hoppscotch.io" \
  org.opencontainers.image.licenses="MIT"

# Run this separately to use the cache from backend
RUN apk add caddy

RUN apk add tini curl

RUN npm install -g pnpm

# Copy necessary files
# Backend files
COPY --from=base_builder /usr/src/app/packages/hoppscotch-backend/backend.Caddyfile /etc/caddy/backend.Caddyfile
COPY --from=backend_builder /dist/backend /dist/backend
COPY --from=base_builder /usr/src/app/packages/hoppscotch-backend/prod_run.mjs /dist/backend
COPY --from=base_builder /usr/src/app/aio_run.mjs /dist/backend/aio_run.mjs

# FE Files
COPY --from=fe_builder /usr/src/app/packages/hoppscotch-selfhost-web/dist /site/selfhost-web
COPY --from=sh_admin_builder /usr/src/app/packages/hoppscotch-sh-admin/dist-multiport-setup /site/sh-admin-multiport-setup
COPY aio-multiport-setup.Caddyfile /etc/caddy/aio-multiport-setup.Caddyfile

RUN npm install -g @import-meta-env/cli

ENTRYPOINT [ "tini", "--" ]
COPY --chmod=755 healthcheck.sh /
HEALTHCHECK --interval=5s CMD /bin/sh /healthcheck.sh

WORKDIR /dist/backend

CMD ["node", "/dist/backend/aio_run.mjs"]
EXPOSE 3170
EXPOSE 3000
EXPOSE 3100
EXPOSE 80
