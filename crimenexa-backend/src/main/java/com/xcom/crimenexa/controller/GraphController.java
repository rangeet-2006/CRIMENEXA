package com.xcom.crimenexa.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;

import java.util.UUID;

@RestController
@RequestMapping("/api/graph")
public class GraphController {

    @Value("${ai.service.base-url}")
    private String aiServiceBaseUrl;

    private final RestTemplate restTemplate = new RestTemplate();

    @GetMapping("/{caseId}")
    public ResponseEntity<?> getGraph(@PathVariable UUID caseId) {
        // Proxies to the Python AI service, which queries Neo4j directly
        String url = aiServiceBaseUrl + "/graph/" + caseId;
        Object response = restTemplate.getForObject(url, Object.class);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{caseId}/influencers")
    public ResponseEntity<?> getTopInfluencers(@PathVariable UUID caseId) {
        String url = aiServiceBaseUrl + "/graph/" + caseId + "/influencers";
        Object response = restTemplate.getForObject(url, Object.class);
        return ResponseEntity.ok(response);
    }
}