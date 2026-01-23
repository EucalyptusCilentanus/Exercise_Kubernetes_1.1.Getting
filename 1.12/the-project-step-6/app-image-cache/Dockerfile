FROM node:20-alpine

WORKDIR /usr/src/app
ENV NODE_ENV=production

COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY src ./src

USER node

EXPOSE 3001
CMD ["node", "src/index.js"]
