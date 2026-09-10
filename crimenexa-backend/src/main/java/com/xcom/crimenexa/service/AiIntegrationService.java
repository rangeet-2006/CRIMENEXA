package com.xcom.crimenexa.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.xcom.crimenexa.model.Alert;
import com.xcom.crimenexa.model.Evidence;
import com.xcom.crimenexa.repository.AlertRepository;
import com.xcom.crimenexa.repository.CaseRepository;
import com.xcom.crimenexa.repository.EvidenceRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.UUID;

@Service
public class AiIntegrationService {

    private static final Logger logger = LoggerFactory.getLogger(AiIntegrationService.class);

    @Value("${ai.service.base-url}")
    private String aiServiceBaseUrl;

    @Autowired
    private EvidenceRepository evidenceRepository;

    @Autowired
    private CaseRepository caseRepository;

    @Autowired
    private AlertRepository alertRepository;

    private final RestTemplate restTemplate = new RestTemplate();

    @Async
    public void processUploadAsync(UUID evidenceId, byte[] content, String fileName,
                                    Evidence.DocumentCategory category, UUID caseId) {
        try {
            markStatus(evidenceId, Evidence.UploadStatus.PROCESSING);

            String endpoint = resolveEndpoint(category);
            String url = aiServiceBaseUrl + endpoint;

            logger.info("Calling AI service: {} for evidence {} ({} bytes)", url, evidenceId,
                    content != null ? content.length : 0);

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            // Held in memory rather than read back from the upload directory,
            // which is ephemeral. getFilename() matters: the AI service keys its
            // CSV-vs-Excel decision off the extension.
            body.add("file", new ByteArrayResource(content) {
                @Override
                public String getFilename() {
                    return fileName != null ? fileName : "upload";
                }
            });
            body.add("case_id", caseId.toString());
            // /extraction/extract declares document_category as a required form
            // field; omitting it fails the request with 422 before any parsing.
            // The dedicated /ingestion/* routes ignore it.
            body.add("document_category", category.name());

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);

            Object response = restTemplate.postForObject(url, requestEntity, Object.class);
            logger.info("AI service response for evidence {}: {}", evidenceId, response);

            markStatus(evidenceId, Evidence.UploadStatus.EXTRACTED);

            // Nothing else pulls results back from the AI service, so without
            // this the case entity count stays at zero and a detected anomaly
            // never becomes an alert.
            syncCaseFromAi(caseId);

        } catch (Exception e) {
            logger.error("AI processing failed for evidence {}: {}", evidenceId, e.getMessage(), e);
            // Record the reason on the row. It previously existed only in the
            // server log, so the user saw a green tick and no way to find out.
            markFailed(evidenceId, e.getMessage());
        }
    }

    /**
     * Route on the AI service for a category.
     *
     * These are appended to ai.service.base-url, which ALREADY ends in /api
     * (see application.properties and AI_SERVICE_BASE_URL in render.yaml).
     * They previously carried their own "/api" prefix, producing
     * ".../api/api/ingestion/fir" - a 404 that marked every upload FAILED.
     * GraphController uses the same no-prefix convention.
     */
    private String resolveEndpoint(Evidence.DocumentCategory category) {
        return switch (category) {
            case FIR -> "/ingestion/fir";
            case CALL_RECORDS -> "/ingestion/cdr";
            case BANK_RECORDS -> "/ingestion/transactions";
            case LOCATION -> "/ingestion/location";
            // The AI service's /ingestion/forensic now accepts a file rather
            // than raw text, so forensic reports can be uploaded like any other
            // evidence. A text-only variant remains at /ingestion/forensic-text.
            case FORENSIC -> "/ingestion/forensic";
            case SURVEILLANCE -> "/ingestion/cctv";
            case SOCIAL_MEDIA, OTHER -> "/extraction/extract";
        };
    }

    /**
     * Pull post-ingestion results back from the AI service and record them.
     *
     * Writes the case's entity count and raises an alert per detected anomaly.
     * Failures here are logged and swallowed: the evidence itself is already
     * stored and marked EXTRACTED, so a summary that cannot be fetched should
     * not turn a successful upload into a failed one.
     */
    private void syncCaseFromAi(UUID caseId) {
        try {
            String url = aiServiceBaseUrl + "/ingestion/case-summary/" + caseId;
            CaseSummary summary = restTemplate.getForObject(url, CaseSummary.class);
            if (summary == null) return;

            caseRepository.findById(caseId).ifPresent(caseRecord -> {
                if (summary.entityTotal > 0) {
                    caseRecord.setEntitiesCount(summary.entityTotal);
                    caseRepository.save(caseRecord);
                }
            });

            // Alerts are NOT created here. The AI service pushes findings to
            // /api/internal/alerts (see alert_notifier_service.py), which is the
            // single creation path - doing it from this poll as well would record
            // every anomaly twice by two independent mechanisms.
        } catch (Exception e) {
            logger.warn("Could not sync case {} from AI service: {}", caseId, e.getMessage());
        }
    }

    /** Response of GET /ingestion/case-summary/{caseId} on the AI service. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class CaseSummary {
        @JsonProperty("entity_total")
        public int entityTotal;
        public List<AnomalyFinding> anomalies;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    static class AnomalyFinding {
        public String category;
        public String severity;
        public String title;
        public String description;
    }

    private void markFailed(UUID evidenceId, String reason) {
        evidenceRepository.findById(evidenceId).ifPresent(evidence -> {
            evidence.setStatus(Evidence.UploadStatus.FAILED);
            // Trim: a Spring exception chain can run to thousands of characters,
            // and the column is a plain varchar.
            if (reason != null) {
                evidence.setProcessingError(reason.length() > 480 ? reason.substring(0, 480) + "..." : reason);
            }
            evidenceRepository.save(evidence);
        });
    }

    private void markStatus(UUID evidenceId, Evidence.UploadStatus status) {
        evidenceRepository.findById(evidenceId).ifPresent(evidence -> {
            evidence.setStatus(status);
            evidenceRepository.save(evidence);
        });
    }
}