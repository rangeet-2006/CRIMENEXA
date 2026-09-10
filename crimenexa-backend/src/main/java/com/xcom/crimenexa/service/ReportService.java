package com.xcom.crimenexa.service;

import com.xcom.crimenexa.dto.ReportRequest;
import com.xcom.crimenexa.dto.ReportResponse;
import com.xcom.crimenexa.model.CaseRecord;
import com.xcom.crimenexa.model.Report;
import com.xcom.crimenexa.repository.CaseRepository;
import com.xcom.crimenexa.repository.ReportRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ReportService {

    @Autowired
    private ReportRepository reportRepository;

    @Autowired
    private CaseRepository caseRepository;

    public List<ReportResponse> getReportsForCase(UUID caseId) {
        List<Report> reports = reportRepository.findByCaseIdOrderByGeneratedAtDesc(caseId);
        String caseCode = caseRepository.findById(caseId).map(CaseRecord::getCaseCode).orElse("N/A");
        return reports.stream().map(r -> toResponse(r, caseCode)).collect(Collectors.toList());
    }

    public ReportResponse generateReport(ReportRequest request) {
        UUID caseId = UUID.fromString(request.getCaseId());
        CaseRecord caseRecord = caseRepository.findById(caseId)
                .orElseThrow(() -> new RuntimeException("Case not found"));

        Report report = new Report();
        report.setCaseId(caseId);
        report.setType(Report.ReportType.valueOf(request.getReportType().toUpperCase()));
        report.setTitle(caseRecord.getOperationName() + " — " + formatTypeLabel(request.getReportType()));

        // TODO: actual PDF generation happens here (or async via a job/queue)
        // for now storing a placeholder path and page count
        report.setPages(1);
        report.setFilePath("reports/" + caseRecord.getCaseCode() + "_" + System.currentTimeMillis() + ".pdf");

        Report saved = reportRepository.save(report);
        return toResponse(saved, caseRecord.getCaseCode());
    }

    private String formatTypeLabel(String type) {
        return switch (type.toUpperCase()) {
            case "FULL_REPORT" -> "Full Case Summary";
            case "GRAPH_EXPORT" -> "Network Graph Report";
            case "FINANCIAL" -> "Financial Audit Trail";
            default -> "Report";
        };
    }

    private ReportResponse toResponse(Report r, String caseCode) {
        return new ReportResponse(
                r.getId().toString(),
                r.getTitle(),
                caseCode,
                r.getType().name(),
                r.getPages(),
                r.getGeneratedAt(),
                // Empty until PDF generation exists. It previously returned
                // "/api/reports/download/{id}", a route no controller defines -
                // so every download link in the UI was dead. An empty string
                // lets the client disable the link instead of offering a 404.
                ""
        );
    }
}