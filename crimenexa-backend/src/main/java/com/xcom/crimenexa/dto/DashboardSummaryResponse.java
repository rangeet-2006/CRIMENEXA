package com.xcom.crimenexa.dto;

public class DashboardSummaryResponse {

    private long activeCases;
    private long totalEntities;
    private long openAlerts;
    private long criticalAlerts;
    private long reportsGenerated;

    public DashboardSummaryResponse() {
    }

    public DashboardSummaryResponse(long activeCases, long totalEntities, long openAlerts,
                                     long criticalAlerts, long reportsGenerated) {
        this.activeCases = activeCases;
        this.totalEntities = totalEntities;
        this.openAlerts = openAlerts;
        this.criticalAlerts = criticalAlerts;
        this.reportsGenerated = reportsGenerated;
    }

    public long getActiveCases() {
        return activeCases;
    }

    public void setActiveCases(long activeCases) {
        this.activeCases = activeCases;
    }

    public long getTotalEntities() {
        return totalEntities;
    }

    public void setTotalEntities(long totalEntities) {
        this.totalEntities = totalEntities;
    }

    public long getOpenAlerts() {
        return openAlerts;
    }

    public void setOpenAlerts(long openAlerts) {
        this.openAlerts = openAlerts;
    }

    public long getCriticalAlerts() {
        return criticalAlerts;
    }

    public void setCriticalAlerts(long criticalAlerts) {
        this.criticalAlerts = criticalAlerts;
    }

    public long getReportsGenerated() {
        return reportsGenerated;
    }

    public void setReportsGenerated(long reportsGenerated) {
        this.reportsGenerated = reportsGenerated;
    }
}