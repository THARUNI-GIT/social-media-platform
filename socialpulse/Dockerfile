FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm i
COPY . .
ARG VITE_API_URL=http://localhost:8080
ARG VITE_CHAT_URL=http://localhost:8080
ARG VITE_NOTIFY_URL=http://localhost:8080
ENV VITE_API_URL=$VITE_API_URL VITE_CHAT_URL=$VITE_CHAT_URL VITE_NOTIFY_URL=$VITE_NOTIFY_URL
RUN npm run build
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
