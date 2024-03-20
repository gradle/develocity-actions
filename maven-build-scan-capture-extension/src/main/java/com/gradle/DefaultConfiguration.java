package com.gradle;

import java.util.HashMap;
import java.util.Map;

class DefaultConfiguration implements Configuration {

    private enum CaptureStrategy {
        ALWAYS, ON_FAILURE, ON_DEMAND
    }

    static final String CONFIG_KEY_CAPTURE_STRATEGY = "INPUT_CAPTURE_STRATEGY";
    static final String CONFIG_KEY_CAPTURE_CURRENT_ENABLED = "CAPTURE_BUILD_SCAN";
    static final String CONFIG_KEY_CAPTURE_UNPUBLISHED_BUILD_SCANS = "INPUT_CAPTURE_UNPUBLISHED_BUILD_SCANS";
    static final String CONFIG_KEY_CAPTURE_BUILD_SCAN_LINKS = "INPUT_CAPTURE_BUILD_SCAN_LINKS";
    static final String CONFIG_KEY_BUILD_SCAN_DATA_DIR = "BUILD_SCAN_DATA_DIR";
    static final String CONFIG_KEY_BUILD_SCAN_METADATA_DIR = "BUILD_SCAN_METADATA_DIR";
    static final String CONFIG_KEY_BUILD_SCAN_METADATA_COPY_DIR = "BUILD_SCAN_METADATA_COPY_DIR";
    static final String CONFIG_KEY_BUILD_SCAN_DATA_COPY_DIR = "BUILD_SCAN_DATA_COPY_DIR";
    static final String CONFIG_KEY_JOB_NAME = "INPUT_JOB_NAME";
    static final String CONFIG_KEY_WORKFLOW_NAME = "SETUP_WORKFLOW_NAME";
    static final String CONFIG_KEY_PR_NUMBER = "PR_NUMBER";
    static final String CONFIG_KEY_BUILD_ID = "BUILD_ID";
    static final String CONFIG_KEY_IS_BUILD_SCAN_REPUBLICATION = "IS_BUILD_SCAN_REPUBLICATION";

    final Map<String,String> configuration = new HashMap<>();

    private DefaultConfiguration() {}

    static DefaultConfiguration get() {
        DefaultConfiguration instance = new DefaultConfiguration();

        instance.configuration.put(CONFIG_KEY_WORKFLOW_NAME, getEnvOrDefault(CONFIG_KEY_WORKFLOW_NAME, "unknown workflow name"));
        instance.configuration.put(CONFIG_KEY_JOB_NAME, getEnvOrDefault(CONFIG_KEY_JOB_NAME, "unknown job name"));
        instance.configuration.put(CONFIG_KEY_PR_NUMBER, getEnvOrDefault(CONFIG_KEY_PR_NUMBER, "0"));
        instance.configuration.put(CONFIG_KEY_BUILD_ID, getEnv(CONFIG_KEY_BUILD_ID));
        instance.configuration.put(CONFIG_KEY_CAPTURE_STRATEGY, getEnvOrDefault(CONFIG_KEY_CAPTURE_STRATEGY, CaptureStrategy.ALWAYS.name()));
        instance.configuration.put(CONFIG_KEY_CAPTURE_UNPUBLISHED_BUILD_SCANS, getEnvOrDefault(CONFIG_KEY_CAPTURE_UNPUBLISHED_BUILD_SCANS, String.valueOf(true)));
        instance.configuration.put(CONFIG_KEY_CAPTURE_BUILD_SCAN_LINKS, getEnvOrDefault(CONFIG_KEY_CAPTURE_BUILD_SCAN_LINKS, String.valueOf(true)));
        instance.configuration.put(CONFIG_KEY_CAPTURE_CURRENT_ENABLED, getEnvOrDefault(CONFIG_KEY_CAPTURE_CURRENT_ENABLED, String.valueOf(false)));
        instance.configuration.put(CONFIG_KEY_BUILD_SCAN_DATA_DIR, getEnv(CONFIG_KEY_BUILD_SCAN_DATA_DIR));
        instance.configuration.put(CONFIG_KEY_BUILD_SCAN_DATA_COPY_DIR, getEnv(CONFIG_KEY_BUILD_SCAN_DATA_COPY_DIR));
        instance.configuration.put(CONFIG_KEY_BUILD_SCAN_METADATA_DIR, getEnv(CONFIG_KEY_BUILD_SCAN_METADATA_DIR));
        instance.configuration.put(CONFIG_KEY_BUILD_SCAN_METADATA_COPY_DIR, getEnv(CONFIG_KEY_BUILD_SCAN_METADATA_COPY_DIR));
        instance.configuration.put(CONFIG_KEY_IS_BUILD_SCAN_REPUBLICATION, getEnvOrDefault(CONFIG_KEY_IS_BUILD_SCAN_REPUBLICATION, String.valueOf(false)));

        return instance;
    }

    private static String getEnvOrDefault(String key, String defaultValue) {
        String value = getEnv(key);
        return value != null ? value : defaultValue;
    }

    private static String getEnv(String key) {
        return System.getenv(key);
    }

    private CaptureStrategy getCaptureStrategy() {
        return CaptureStrategy.valueOf(configuration.get(CONFIG_KEY_CAPTURE_STRATEGY));
    }

    public String getWorkflowName() {
        return configuration.get(CONFIG_KEY_WORKFLOW_NAME);
    }

    public String getJobName() {
        return configuration.get(CONFIG_KEY_JOB_NAME);
    }

    public String getPrNumber() {
        return configuration.get(CONFIG_KEY_PR_NUMBER);
    }

    public String getBuildId() {
        return configuration.get(CONFIG_KEY_BUILD_ID);
    }

    public boolean isCaptureUnpublishedBuildScans(boolean isBuildFailure) {
        return Boolean.parseBoolean(configuration.get(CONFIG_KEY_CAPTURE_UNPUBLISHED_BUILD_SCANS)) && isCaptureRequired(isBuildFailure);
    }

    public boolean isCaptureBuildScanLinks(boolean isBuildFailure) {
        return Boolean.parseBoolean(configuration.get(CONFIG_KEY_CAPTURE_BUILD_SCAN_LINKS)) && isCaptureRequired(isBuildFailure);
    }

    private boolean isCaptureRequired(boolean isBuildFailure) {
        return getCaptureStrategy().equals(CaptureStrategy.ALWAYS)
                || (isBuildFailure && getCaptureStrategy().equals(CaptureStrategy.ON_FAILURE))
                || (Boolean.parseBoolean(configuration.get(CONFIG_KEY_CAPTURE_CURRENT_ENABLED)) && getCaptureStrategy().equals(CaptureStrategy.ON_DEMAND));
    }

    public boolean isBuildScanRepublication() {
        return Boolean.parseBoolean(configuration.get(CONFIG_KEY_IS_BUILD_SCAN_REPUBLICATION));
    }

    public String getBuildScanDataDir() {
        return configuration.get(CONFIG_KEY_BUILD_SCAN_DATA_DIR);
    }

    public String getBuildScanDataCopyDir() {
        return configuration.get(CONFIG_KEY_BUILD_SCAN_DATA_COPY_DIR);
    }

    public String getBuildScanMetadataDir() {
        return configuration.get(CONFIG_KEY_BUILD_SCAN_METADATA_DIR);
    }

    public String getBuildScanMetadataCopyDir() {
        return configuration.get(CONFIG_KEY_BUILD_SCAN_METADATA_COPY_DIR);
    }

    @Override
    public String toString() {
        return "Configuration{" +
                "configuration=" + configuration +
                '}';
    }
}
