package com.xcom.crimenexa.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.MimeTypeUtils;
import org.springframework.web.client.RestTemplate;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

@Service
public class SupabaseStorageService {

    @Value("${supabase.url}")
    private String supabaseUrl;

    @Value("${supabase.service-role-key}")
    private String serviceRoleKey;

    @Value("${supabase.storage.bucket}")
    private String bucketName;

    private final RestTemplate restTemplate = new RestTemplate();

    public String uploadFile(Path localFilePath, String storagePath) throws Exception {
        byte[] fileBytes = Files.readAllBytes(localFilePath);

        String contentType = Files.probeContentType(localFilePath);
        if (contentType == null) {
            contentType = MediaType.APPLICATION_OCTET_STREAM_VALUE;
        }

        String uploadUrl = supabaseUrl + "/storage/v1/object/" + bucketName + "/" + storagePath;

        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Bearer " + serviceRoleKey);
        headers.set("apikey", serviceRoleKey);
        headers.set("Content-Type", contentType);
        headers.set("x-upsert", "true");

        HttpEntity<byte[]> requestEntity = new HttpEntity<>(fileBytes, headers);

        restTemplate.exchange(uploadUrl, HttpMethod.POST, requestEntity, String.class);

        return storagePath;
    }

    public String generateSignedUrl(String storagePath, int expiresInSeconds) {
        String signUrl = supabaseUrl + "/storage/v1/object/sign/" + bucketName + "/" + storagePath;

        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Bearer " + serviceRoleKey);
        headers.set("apikey", serviceRoleKey);
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> body = Map.of("expiresIn", expiresInSeconds);
        HttpEntity<Map<String, Object>> requestEntity = new HttpEntity<>(body, headers);

        @SuppressWarnings("unchecked")
        Map<String, String> response = restTemplate.postForObject(signUrl, requestEntity, Map.class);

        String signedPath = response.get("signedURL");
        return supabaseUrl + "/storage/v1" + signedPath;
    }
}