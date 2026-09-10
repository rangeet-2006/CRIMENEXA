package com.xcom.crimenexa.controller;

import com.xcom.crimenexa.dto.CaseRequest;
import com.xcom.crimenexa.dto.CaseResponse;
import com.xcom.crimenexa.service.CaseService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/cases")
public class CaseController {

    @Autowired
    private CaseService caseService;

    @GetMapping
    public ResponseEntity<List<CaseResponse>> getCases(
            @RequestParam(required = false, defaultValue = "ALL") String status,
            @RequestParam(required = false) String search) {
        return ResponseEntity.ok(caseService.getAllCases(status, search));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'SENIOR')")
    public ResponseEntity<CaseResponse> createCase(@Valid @RequestBody CaseRequest request, Authentication authentication) {
        String officerBadgeId = authentication.getName();
        return ResponseEntity.ok(caseService.createCase(request, officerBadgeId));
    }

    @PatchMapping("/{caseId}/status")
    @PreAuthorize("hasAnyRole('ADMIN', 'SENIOR')")
    public ResponseEntity<CaseResponse> updateStatus(@PathVariable UUID caseId, @RequestParam String status) {
        return ResponseEntity.ok(caseService.updateStatus(caseId, status));
    }
}