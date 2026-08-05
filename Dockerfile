FROM php:8.2-apache

# Install MySQL PDO extensions
RUN docker-php-ext-install pdo pdo_mysql

# Enable Apache mod_rewrite
RUN a2enmod rewrite

# Point Apache root to the public directory
ENV APACHE_DOCUMENT_ROOT /var/www/html/public
RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/*.conf
RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/conf-available/*.conf

# Copy project files into container
COPY . /var/www/html/

# Copy api directory into public so Apache can serve /api/ requests
RUN cp -r /var/www/html/api /var/www/html/public/

EXPOSE 80
