FROM node:20-alpine

WORKDIR /app
COPY server.js /app/server.js

ENV PORT=3000
ENV LOG_FILE=/usr/src/app/files/log.txt

EXPOSE 3000
CMD ["node", "server.js"]
