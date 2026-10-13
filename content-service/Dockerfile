FROM node:20-alpine
WORKDIR /app
# Prisma needs OpenSSL on Alpine; without it the engines fail to load.
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm i
COPY . .
RUN npx prisma generate && npm run build
CMD ["sh","-c","npx prisma migrate deploy && node dist/main"]
