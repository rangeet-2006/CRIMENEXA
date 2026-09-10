package com.xcom.crimenexa.controller;

import com.xcom.crimenexa.dto.AlertResponse;
import com.xcom.crimenexa.service.AlertService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/alerts")
public class AlertController {

    @Autowired
    private AlertService alertService;

    @GetMapping
    public ResponseEntity<List<AlertResponse>> getAlerts(
            @RequestParam(required = false, defaultValue = "ALL") String severity) {
        return ResponseEntity.ok(alertService.getAlerts(severity));
    }

    @PatchMapping("/{alertId}/acknowledge")
    @PreAuthorize("hasAnyRole('ADMIN', 'SENIOR')")
    public ResponseEntity<AlertResponse> acknowledge(@PathVariable UUID alertId) {
        return ResponseEntity.ok(alertService.acknowledgeAlert(alertId));
    }
}