FROM nginx:1.25-alpine

# Replace the default nginx config with ours
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy static files
COPY public/ /usr/share/nginx/html/

EXPOSE 80
