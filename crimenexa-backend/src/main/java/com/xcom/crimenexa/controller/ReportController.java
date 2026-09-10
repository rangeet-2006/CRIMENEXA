package com.xcom.crimenexa.controller;

import com.xcom.crimenexa.dto.ReportRequest;
import com.xcom.crimenexa.dto.ReportResponse;
import com.xcom.crimenexa.service.ReportService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/reports")
public class ReportController {

    @Autowired
    private ReportService reportService;

    @GetMapping("/{caseId}")
    public ResponseEntity<List<ReportResponse>> getReports(@PathVariable UUID caseId) {
        return ResponseEntity.ok(reportService.getReportsForCase(caseId));
    }

    @PostMapping("/generate")
    @PreAuthorize("hasAnyRole('ADMIN', 'SENIOR')")
    public ResponseEntity<ReportResponse> generateReport(@Valid @RequestBody ReportRequest request) {
        return ResponseEntity.ok(reportService.generateReport(request));
    }
}