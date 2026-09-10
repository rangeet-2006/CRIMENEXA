package com.xcom.crimenexa.service;

import com.xcom.crimenexa.dto.EvidenceResponse;
import com.xcom.crimenexa.model.Evidence;
import com.xcom.crimenexa.repository.EvidenceRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class EvidenceService {

    @Autowired
    private EvidenceRepository evidenceRepository;

    public List<EvidenceResponse> getForCase(UUID caseId) {
        return evidenceRepository.findByCaseIdOrderByUploadedAtDesc(caseId).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public EvidenceResponse getById(UUID evidenceId) {
        Evidence evidence = evidenceRepository.findById(evidenceId)
                .orElseThrow(() -> new RuntimeException("Evidence not found"));
        return toResponse(evidence);
    }

    private EvidenceResponse toResponse(Evidence e) {
        return new EvidenceResponse(
                e.getId().toString(),
                e.getCaseId() != null ? e.getCaseId().toString() : null,
                e.getFileName(),
                e.getDocumentCategory() != null ? e.getDocumentCategory().name() : null,
                e.getFileHash(),
                e.getStatus() != null ? e.getStatus().name() : null,
                e.getUploadedAt(),
                e.getProcessingError()
        );
    }
}
