package com.xcom.crimenexa.service;

import com.xcom.crimenexa.model.AuditLog;
import com.xcom.crimenexa.repository.AuditLogRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class AuditLogService {

    @Autowired
    private AuditLogRepository auditLogRepository;

    public void log(UUID userId, String action, String ipAddress, String deviceInfo) {
        AuditLog auditLog = new AuditLog();
        auditLog.setUserId(userId);
        auditLog.setAction(action);
        auditLog.setIpAddress(ipAddress);
        auditLog.setDeviceInfo(deviceInfo);
        auditLogRepository.save(auditLog);
    }
}