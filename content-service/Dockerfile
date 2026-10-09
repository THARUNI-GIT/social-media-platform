FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm i
COPY . .
RUN npx prisma generate && npm run build
CMD ["sh","-c","npx prisma migrate deploy && node dist/main"]
