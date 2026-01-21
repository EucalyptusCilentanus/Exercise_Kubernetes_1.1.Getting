FROM node:20-alpine

WORKDIR /app
COPY writer.js /app/writer.js

ENV LOG_FILE=/usr/src/app/files/log.txt
ENV INTERVAL_SECONDS=5

CMD ["node", "writer.js"]
