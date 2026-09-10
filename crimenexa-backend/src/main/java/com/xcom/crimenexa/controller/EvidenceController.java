package com.xcom.crimenexa.controller;

import com.xcom.crimenexa.dto.EvidenceResponse;
import com.xcom.crimenexa.service.EvidenceService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Read access to evidence records.
 *
 * Uploads are processed asynchronously, so the upload response can only confirm
 * storage - it returns while the AI call is still in flight. Without this
 * endpoint a file that failed during processing showed the investigator a
 * success and nothing else, because there was no way to read the status back.
 */
@RestController
@RequestMapping("/api/evidence")
public class EvidenceController {

    @Autowired
    private EvidenceService evidenceService;

    @GetMapping("/case/{caseId}")
    public ResponseEntity<List<EvidenceResponse>> getForCase(@PathVariable UUID caseId) {
        return ResponseEntity.ok(evidenceService.getForCase(caseId));
    }

    @GetMapping("/{evidenceId}")
    public ResponseEntity<EvidenceResponse> getOne(@PathVariable UUID evidenceId) {
        return ResponseEntity.ok(evidenceService.getById(evidenceId));
    }
}
