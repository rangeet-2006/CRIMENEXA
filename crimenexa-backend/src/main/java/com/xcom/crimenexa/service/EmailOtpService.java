package com.xcom.crimenexa.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class EmailOtpService {

    private static final String BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

    @Value("${brevo.api.key}")
    private String brevoApiKey;

    @Value("${brevo.sender.email}")
    private String senderEmail;

    @Value("${brevo.sender.name}")
    private String senderName;

    private final RestTemplate restTemplate = new RestTemplate();

    public void sendOtp(String toEmail, String otp) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("api-key", brevoApiKey);
        headers.set("accept", "application/json");

        Map<String, Object> sender = new HashMap<>();
        sender.put("name", senderName);
        sender.put("email", senderEmail);

        Map<String, Object> recipient = new HashMap<>();
        recipient.put("email", toEmail);

        Map<String, Object> body = new HashMap<>();
        body.put("sender", sender);
        body.put("to", List.of(recipient));
        body.put("subject", "CRIMENEXA — Your One-Time Passcode");
        body.put("htmlContent",
                "<p>Your verification code is: <b>" + otp + "</b></p>" +
                "<p>This code expires in 5 minutes.</p>" +
                "<p>Do not share this code with anyone.</p>" +
                "<p>— CRIMENEXA Security</p>"
        );

        HttpEntity<Map<String, Object>> requestEntity = new HttpEntity<>(body, headers);
        restTemplate.postForObject(BREVO_API_URL, requestEntity, String.class);
    }

    public String maskEmail(String email) {
        int atIndex = email.indexOf('@');
        if (atIndex <= 1) {
            return "***" + email.substring(atIndex);
        }
        String visible = email.substring(0, 1);
        String domain = email.substring(atIndex);
        return visible + "***" + domain;
    }
}