package com.xcom.crimenexa.service;

import com.xcom.crimenexa.dto.AlertResponse;
import com.xcom.crimenexa.dto.InternalAlertRequest;
import com.xcom.crimenexa.model.Alert;
import com.xcom.crimenexa.model.CaseRecord;
import com.xcom.crimenexa.repository.AlertRepository;
import com.xcom.crimenexa.repository.CaseRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class AlertService {

    @Autowired
    private AlertRepository alertRepository;

    @Autowired
    private CaseRepository caseRepository;

    public List<AlertResponse> getAlerts(String severityFilter) {
        List<Alert> alerts;

        if (severityFilter != null && !severityFilter.equalsIgnoreCase("ALL")) {
            alerts = alertRepository.findBySeverityOrderByCreatedAtDesc(Alert.Severity.valueOf(severityFilter.toUpperCase()));
        } else {
            alerts = alertRepository.findAllByOrderByCreatedAtDesc();
        }

        Map<UUID, String> caseCodeMap = caseRepository.findAll().stream()
                .collect(Collectors.toMap(CaseRecord::getId, CaseRecord::getCaseCode));

        return alerts.stream()
                .map(a -> toResponse(a, caseCodeMap.getOrDefault(a.getCaseId(), "N/A")))
                .collect(Collectors.toList());
    }

    /**
     * Raise an alert on behalf of the AI service.
     *
     * Called by InternalController when the AI service pushes a finding. This
     * is the single alert-creation path: AiIntegrationService deliberately does
     * not also create them from its case-summary poll, or every anomaly would
     * be recorded twice by two mechanisms.
     */
    public AlertResponse createAlert(InternalAlertRequest request) {
        UUID caseId = UUID.fromString(request.getCaseId());

        CaseRecord caseRecord = caseRepository.findById(caseId)
                .orElseThrow(() -> new RuntimeException("Case not found"));

        // The AI service re-runs detection over all accumulated evidence on each
        // upload, so it re-reports findings it has already sent.
        if (alertRepository.existsByCaseIdAndTitle(caseId, request.getTitle())) {
            Alert existing = alertRepository.findAllByOrderByCreatedAtDesc().stream()
                    .filter(a -> caseId.equals(a.getCaseId()) && request.getTitle().equals(a.getTitle()))
                    .findFirst()
                    .orElse(null);
            if (existing != null) return toResponse(existing, caseRecord.getCaseCode());
        }

        Alert alert = new Alert();
        alert.setCaseId(caseId);
        alert.setSeverity(parseSeverity(request.getSeverity()));
        alert.setCategory(request.getCategory());
        alert.setTitle(request.getTitle());
        alert.setDescription(request.getDescription());
        alert.setAcknowledged(false);

        Alert saved = alertRepository.save(alert);
        return toResponse(saved, caseRecord.getCaseCode());
    }

    /** An unrecognised severity should not lose the finding entirely. */
    private Alert.Severity parseSeverity(String value) {
        if (value == null) return Alert.Severity.INFO;
        try {
            return Alert.Severity.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return Alert.Severity.WARNING;
        }
    }

    public AlertResponse acknowledgeAlert(UUID alertId) {
        Alert alert = alertRepository.findById(alertId)
                .orElseThrow(() -> new RuntimeException("Alert not found"));
        alert.setAcknowledged(true);
        Alert saved = alertRepository.save(alert);

        String caseCode = caseRepository.findById(saved.getCaseId())
                .map(CaseRecord::getCaseCode)
                .orElse("N/A");

        return toResponse(saved, caseCode);
    }

    private AlertResponse toResponse(Alert a, String caseCode) {
        return new AlertResponse(
                a.getId().toString(),
                caseCode,
                a.getSeverity().name(),
                a.getCategory(),
                a.getTitle(),
                a.getDescription(),
                a.isAcknowledged(),
                a.getCreatedAt()
        );
    }
}