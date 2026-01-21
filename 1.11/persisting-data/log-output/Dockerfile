FROM node:20-alpine
WORKDIR /app
COPY server.js /app/server.js
ENV PORT=3000
ENV COUNT_FILE=/usr/src/app/files/pingpong.txt
EXPOSE 3000
CMD ["node", "server.js"]
