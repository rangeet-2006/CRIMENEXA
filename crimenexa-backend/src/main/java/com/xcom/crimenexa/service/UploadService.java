package com.xcom.crimenexa.service;

import com.xcom.crimenexa.model.CaseRecord;
import com.xcom.crimenexa.model.Evidence;
import com.xcom.crimenexa.model.User;
import com.xcom.crimenexa.repository.CaseRepository;
import com.xcom.crimenexa.repository.EvidenceRepository;
import com.xcom.crimenexa.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.UUID;

@Service
public class UploadService {

    private static final Logger logger = LoggerFactory.getLogger(UploadService.class);

    private static final String UPLOAD_DIR = "uploads";

    @Autowired
    private EvidenceRepository evidenceRepository;

    @Autowired
    private CaseRepository caseRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private AiIntegrationService aiIntegrationService;

    @Autowired
    private SupabaseStorageService supabaseStorageService;

    public Evidence handleUpload(MultipartFile file, String documentCategory, UUID caseId, String uploaderBadgeId)
            throws IOException, NoSuchAlgorithmException {

        CaseRecord caseRecord = caseRepository.findById(caseId)
                .orElseThrow(() -> new RuntimeException("Case not found"));

        User uploader = userRepository.findByBadgeId(uploaderBadgeId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Path uploadDirPath = Paths.get(UPLOAD_DIR);
        if (!Files.exists(uploadDirPath)) {
            Files.createDirectories(uploadDirPath);
        }

        String storedFileName = UUID.randomUUID() + "_" + file.getOriginalFilename();
        Path filePath = uploadDirPath.resolve(storedFileName);

        // Read the upload once, then hash it and write it. The bytes are handed
        // to the async stage directly rather than re-read from disk: the upload
        // directory is on ephemeral storage, so a container recycle between the
        // response and the background call left the async stage with a missing
        // file and no way for the user to find out. This also removes a second
        // full read of the file, since the hash needed the contents anyway.
        byte[] content = file.getBytes();
        Files.write(filePath, content);

        String fileHash = computeSha256(content);

        // Durable copy in object storage. The local write above is only a
        // working copy - this bucket is what survives a container recycle.
        // A failure here leaves storagePath null rather than rejecting the
        // upload: the evidence row, its hash and the AI analysis are all still
        // worth having, and the local file is intact for this request.
        String storagePath = caseId + "/" + storedFileName;
        try {
            supabaseStorageService.uploadFile(filePath, storagePath);
        } catch (Exception e) {
            logger.warn("Supabase upload failed for evidence file {}: {}", storedFileName, e.getMessage());
            storagePath = null;
        }

        Evidence evidence = new Evidence();
        evidence.setCaseId(caseId);
        evidence.setFileName(file.getOriginalFilename());
        evidence.setDocumentCategory(Evidence.DocumentCategory.valueOf(documentCategory.toUpperCase().replace(" ", "_")));
        evidence.setFilePath(filePath.toString());
        evidence.setFileHash(fileHash);
        evidence.setUploadedBy(uploader.getId());
        evidence.setStoragePath(storagePath);
        evidence.setStatus(Evidence.UploadStatus.QUEUED);

        Evidence saved = evidenceRepository.save(evidence);

        aiIntegrationService.processUploadAsync(
                saved.getId(),
                content,
                file.getOriginalFilename(),
                saved.getDocumentCategory(),
                caseId
        );

        return saved;
    }

    private String computeSha256(byte[] content) throws NoSuchAlgorithmException {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] hashBytes = digest.digest(content);

        StringBuilder sb = new StringBuilder();
        for (byte b : hashBytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }
}