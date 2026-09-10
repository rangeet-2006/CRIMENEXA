package com.xcom.crimenexa.controller;

import com.xcom.crimenexa.model.Evidence;
import com.xcom.crimenexa.service.UploadService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

@RestController
@RequestMapping("/api/ingest")
public class UploadController {

    @Autowired
    private UploadService uploadService;

    @PostMapping("/upload")
    public ResponseEntity<?> uploadFile(
            @RequestParam("file") MultipartFile file,
            @RequestParam("documentCategory") String documentCategory,
            @RequestParam("caseId") UUID caseId,
            Authentication authentication) {

        try {
            String uploaderBadgeId = authentication.getName();
            Evidence evidence = uploadService.handleUpload(file, documentCategory, caseId, uploaderBadgeId);
            return ResponseEntity.ok(evidence);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("Upload failed: " + e.getMessage());
        }
    }
}