FROM nginx:alpine

COPY index.html styles.css scripts.js /usr/share/nginx/html/
COPY img/ /usr/share/nginx/html/img/

EXPOSE 80
