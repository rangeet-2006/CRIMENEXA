package com.xcom.crimenexa.service;

import com.xcom.crimenexa.dto.DashboardSummaryResponse;
import com.xcom.crimenexa.model.Alert;
import com.xcom.crimenexa.model.CaseRecord;
import com.xcom.crimenexa.repository.AlertRepository;
import com.xcom.crimenexa.repository.CaseRepository;
import com.xcom.crimenexa.repository.EvidenceRepository;
import com.xcom.crimenexa.repository.ReportRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class DashboardService {

    @Autowired
    private CaseRepository caseRepository;

    @Autowired
    private EvidenceRepository evidenceRepository;

    @Autowired
    private AlertRepository alertRepository;

    @Autowired
    private ReportRepository reportRepository;

    public DashboardSummaryResponse getSummary() {
        long activeCases = caseRepository.findByStatus(CaseRecord.CaseStatus.ACTIVE).size();
        long totalEntities = caseRepository.findAll().stream()
                .mapToInt(CaseRecord::getEntitiesCount)
                .sum();
        long openAlerts = alertRepository.findAll().stream()
                .filter(a -> !a.isAcknowledged())
                .count();
        long criticalAlerts = alertRepository.countBySeverity(Alert.Severity.CRITICAL);
        long reportsGenerated = reportRepository.count();

        return new DashboardSummaryResponse(activeCases, totalEntities, openAlerts, criticalAlerts, reportsGenerated);
    }
}