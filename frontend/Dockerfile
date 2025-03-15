# Use nginx directly
FROM nginx:alpine

# Copy static files
COPY public/ /usr/share/nginx/html/

# Copy nginx configuration
COPY nginx/nginx.conf /etc/nginx/nginx.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"] 