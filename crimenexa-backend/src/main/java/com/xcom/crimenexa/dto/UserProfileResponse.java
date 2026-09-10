package com.xcom.crimenexa.dto;

import java.time.Instant;

public class UserProfileResponse {

    private String id;
    private String badgeId;
    private String fullName;
    private String email;
    private String role;
    private Instant lastLogin;

    public UserProfileResponse() {
    }

    public UserProfileResponse(String id, String badgeId, String fullName, String email, String role, Instant lastLogin) {
        this.id = id;
        this.badgeId = badgeId;
        this.fullName = fullName;
        this.email = email;
        this.role = role;
        this.lastLogin = lastLogin;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getBadgeId() {
        return badgeId;
    }

    public void setBadgeId(String badgeId) {
        this.badgeId = badgeId;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public Instant getLastLogin() {
        return lastLogin;
    }

    public void setLastLogin(Instant lastLogin) {
        this.lastLogin = lastLogin;
    }
}