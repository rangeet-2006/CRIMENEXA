package com.xcom.crimenexa.config;

// Mail properties (host, port, username, password) are configured directly
// in application.properties. Spring Boot auto-configures a JavaMailSender bean
// from those properties, so no manual bean definition is required here.
// This class is kept as a placeholder for any future custom mail configuration
// (e.g., custom MimeMessage templates, connection pooling, etc.)

import org.springframework.context.annotation.Configuration;

@Configuration
public class MailConfig {
}