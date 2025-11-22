FROM nginx:alpine

# Copy built static files
COPY dist/ /usr/share/nginx/html/

# Copy custom nginx config for SPA routing and caching
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
