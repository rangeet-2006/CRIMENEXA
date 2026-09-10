package com.xcom.crimenexa.controller;

import com.xcom.crimenexa.dto.AlertResponse;
import com.xcom.crimenexa.dto.InternalAlertRequest;
import com.xcom.crimenexa.exception.UnauthorizedAccessException;
import com.xcom.crimenexa.service.AlertService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/internal")
public class InternalController {

    @Value("${internal.api.key}")
    private String internalApiKey;

    @Autowired
    private AlertService alertService;

    @PostMapping("/alerts")
    public ResponseEntity<AlertResponse> createAlert(
            @RequestHeader("X-Internal-Api-Key") String providedKey,
            @Valid @RequestBody InternalAlertRequest request) {

        if (!internalApiKey.equals(providedKey)) {
            throw new UnauthorizedAccessException("Invalid internal API key");
        }

        AlertResponse response = alertService.createAlert(request);
        return ResponseEntity.ok(response);
    }
}