#!/bin/sh
set -e

# the host volume may be owned by any uid → align it then drop privileges
# (the app never runs as root)
chown -R node:node /app/data

exec su-exec node sh -c "npx prisma migrate deploy && exec npx next start -H 0.0.0.0 -p 3000"
