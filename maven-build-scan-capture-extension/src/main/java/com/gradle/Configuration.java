package com.gradle;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

public class Configuration {

    private enum CaptureStrategy {
        ALWAYS, ON_FAILURE, ON_DEMAND
    }

    private static final String CONFIG_KEY_BUILD_SCAN_CAPTURE_STRATEGY = "INPUT_BUILD_SCAN_CAPTURE_STRATEGY";
    private static final CaptureStrategy CONFIG_KEY_BUILD_SCAN_CAPTURE_STRATEGY_DEFAULT = CaptureStrategy.ALWAYS;
    private static final String CONFIG_KEY_BUILD_SCAN_CAPTURE_CURRENT_ENABLED = "CAPTURE_BUILD_SCAN";
    private static final boolean CONFIG_KEY_BUILD_SCAN_CAPTURE_CURRENT_ENABLED_DEFAULT = false;
    private static final String CONFIG_KEY_BUILD_SCAN_CAPTURE_UNPUBLISHED_ENABLED = "INPUT_BUILD_SCAN_CAPTURE_UNPUBLISHED_ENABLED";
    private static final boolean CONFIG_KEY_BUILD_SCAN_CAPTURE_UNPUBLISHED_ENABLED_DEFAULT = true;
    private static final String CONFIG_KEY_BUILD_SCAN_CAPTURE_LINK_ENABLED = "INPUT_BUILD_SCAN_CAPTURE_LINK_ENABLED";
    private static final boolean CONFIG_KEY_BUILD_SCAN_CAPTURE_LINK_ENABLED_DEFAULT = true;
    private final Map<String,String> configuration = new HashMap<>();
    private final AtomicBoolean isBuildFailure = new AtomicBoolean(false);

    private Configuration() {}

    static Configuration get() {
        Configuration instance = new Configuration();

        instance.configuration.put(CONFIG_KEY_BUILD_SCAN_CAPTURE_STRATEGY, getEnvOrDefault(CONFIG_KEY_BUILD_SCAN_CAPTURE_STRATEGY, CONFIG_KEY_BUILD_SCAN_CAPTURE_STRATEGY_DEFAULT.name()));
        instance.configuration.put(CONFIG_KEY_BUILD_SCAN_CAPTURE_UNPUBLISHED_ENABLED, getEnvOrDefault(CONFIG_KEY_BUILD_SCAN_CAPTURE_UNPUBLISHED_ENABLED, String.valueOf(CONFIG_KEY_BUILD_SCAN_CAPTURE_UNPUBLISHED_ENABLED_DEFAULT)));
        instance.configuration.put(CONFIG_KEY_BUILD_SCAN_CAPTURE_LINK_ENABLED, getEnvOrDefault(CONFIG_KEY_BUILD_SCAN_CAPTURE_LINK_ENABLED, String.valueOf(CONFIG_KEY_BUILD_SCAN_CAPTURE_LINK_ENABLED_DEFAULT)));
        instance.configuration.put(CONFIG_KEY_BUILD_SCAN_CAPTURE_CURRENT_ENABLED, getEnvOrDefault(CONFIG_KEY_BUILD_SCAN_CAPTURE_CURRENT_ENABLED, String.valueOf(CONFIG_KEY_BUILD_SCAN_CAPTURE_CURRENT_ENABLED_DEFAULT)));

        return instance;
    }

    private static String getEnvOrDefault(String key, String defaultValue) {
        String value = System.getenv(key);
        return value != null ? value : defaultValue;
    }

    void setBuildFailure() {
        isBuildFailure.set(true);
    }

    private CaptureStrategy getCaptureStrategy() {
        return CaptureStrategy.valueOf(configuration.get(CONFIG_KEY_BUILD_SCAN_CAPTURE_STRATEGY));
    }

    boolean isBuildScanCaptureUnpublishedEnabled() {
        return Boolean.parseBoolean(configuration.get(CONFIG_KEY_BUILD_SCAN_CAPTURE_UNPUBLISHED_ENABLED)) && isCaptureRequired();
    }

    boolean isBuildScanCaptureLinkEnabled() {
        return Boolean.parseBoolean(configuration.get(CONFIG_KEY_BUILD_SCAN_CAPTURE_LINK_ENABLED)) && isCaptureRequired();
    }

    private boolean isCaptureRequired() {
        return getCaptureStrategy().equals(CaptureStrategy.ALWAYS)
                || (isBuildFailure.get() && getCaptureStrategy().equals(CaptureStrategy.ON_FAILURE))
                || (Boolean.parseBoolean(configuration.get(CONFIG_KEY_BUILD_SCAN_CAPTURE_CURRENT_ENABLED)) && getCaptureStrategy().equals(CaptureStrategy.ON_DEMAND));
    }

    @Override
    public String toString() {
        return "Configuration{" +
                "configuration=" + configuration +
                ", isBuildFailure=" + isBuildFailure +
                '}';
    }
}
