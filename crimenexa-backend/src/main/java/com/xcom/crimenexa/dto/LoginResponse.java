package com.xcom.crimenexa.dto;

public class LoginResponse {

    private String tempToken;
    private String otpSentTo;

    public LoginResponse() {
    }

    public LoginResponse(String tempToken, String otpSentTo) {
        this.tempToken = tempToken;
        this.otpSentTo = otpSentTo;
    }

    public String getTempToken() {
        return tempToken;
    }

    public void setTempToken(String tempToken) {
        this.tempToken = tempToken;
    }

    public String getOtpSentTo() {
        return otpSentTo;
    }

    public void setOtpSentTo(String otpSentTo) {
        this.otpSentTo = otpSentTo;
    }
}